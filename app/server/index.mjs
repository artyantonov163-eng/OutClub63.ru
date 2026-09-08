import http from "node:http";
import {
  readFile,
  realpath,
  stat,
  mkdir,
  writeFile,
  rename,
  chmod,
} from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateConfig,
  verifyPassword,
  issueSession,
  readSession,
} from "./auth.mjs";
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".mp4": "video/mp4",
};
export function clientAddress(req, trustProxy) {
  const peer = req.socket.remoteAddress || "unknown";
  const forwarded = req.headers["x-forwarded-for"];
  return trustProxy &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer) &&
    typeof forwarded === "string" &&
    isIP(forwarded.trim())
    ? forwarded.trim()
    : peer;
}
export async function createServer(options = {}) {
  const root = options.root || projectRoot;
  const configPath =
    options.configPath || path.join(root, ".runtime/auth.json");
  const loadConfig = async () =>
    validateConfig(
      options.config || JSON.parse(await readFile(configPath, "utf8")),
    );
  await loadConfig(); // Fail closed before binding.
  const now = options.now || Date.now,
    ttl = options.sessionTtlMs || 30 * 24 * 3600 * 1000;
  const secure = options.secureCookie ?? process.env.COOKIE_SECURE === "true";
  const origin = options.origin || process.env.PUBLIC_ORIGIN;
  const trustProxy = options.trustProxy ?? process.env.TRUST_PROXY === "true";
  if (trustProxy && !origin)
    throw new Error("Trusted proxy requires explicit PUBLIC_ORIGIN.");
  const limit = options.rateLimit || 10,
    windowMs = options.rateWindowMs || 15 * 60 * 1000;
  const attempts = new Map(),
    revoked = new Map();
  const runtimeDir = path.join(root, ".runtime"),
    revocationPath = path.join(runtimeDir, "revocations.json");
  try {
    const entries = JSON.parse(await readFile(revocationPath, "utf8"));
    if (
      !Array.isArray(entries) ||
      entries.some(
        (entry) =>
          !Array.isArray(entry) ||
          entry.length !== 2 ||
          !/^[a-f0-9]{48}$/.test(entry[0]) ||
          !Number.isFinite(entry[1]),
      )
    )
      throw new Error("Invalid revocation store");
    for (const [id, exp] of entries) if (exp > now()) revoked.set(id, exp);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let writes = Promise.resolve();
  function persistRevocations() {
    writes = writes
      .catch(() => {})
      .then(async () => {
        for (const [id, exp] of revoked) if (exp <= now()) revoked.delete(id);
        await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
        await chmod(runtimeDir, 0o700);
        const temp = path.join(
          runtimeDir,
          `revocations-${randomBytes(8).toString("hex")}.tmp`,
        );
        await writeFile(temp, JSON.stringify([...revoked]), {
          mode: 0o600,
          flag: "wx",
        });
        await rename(temp, revocationPath);
      });
    return writes;
  }
  await persistRevocations();
  const cookieName = "out_session";
  const cookie = (value, maxAge) =>
    `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  const json = (res, status, value) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  async function serveFile(res, base, relative, privateFile = false) {
    const baseReal = await realpath(base),
      candidate = path.resolve(baseReal, relative);
    if (!candidate.startsWith(baseReal + path.sep)) return false;
    let resolved;
    try {
      resolved = await realpath(candidate);
    } catch {
      return false;
    }
    if (
      !resolved.startsWith(baseReal + path.sep) ||
      !(await stat(resolved)).isFile()
    )
      return false;
    const bytes = await readFile(resolved);
    res.writeHead(200, {
      "Content-Type":
        types[path.extname(resolved).toLowerCase()] ||
        "application/octet-stream",
      "Cache-Control": privateFile ? "no-store" : "no-cache",
      ...(privateFile
        ? { "Content-Security-Policy": "default-src 'none'; sandbox" }
        : {}),
    });
    res.end(bytes);
    return true;
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    try {
      let pathname;
      try {
        pathname = decodeURIComponent((req.url || "/").split("?")[0]);
      } catch {
        return json(res, 400, { error: "Invalid path" });
      }
      if (
        pathname.includes("\\") ||
        pathname.includes("\0") ||
        pathname.split("/").some((x) => x === ".." || x === ".")
      )
        return json(res, 400, { error: "Invalid path" });
      if (req.method !== "GET" && req.method !== "POST")
        return json(res, 405, { error: "Method not allowed" });
      const config = await loadConfig();
      const token = (req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith(cookieName + "="))
        ?.slice(cookieName.length + 1);
      const session = readSession(token, config, now());
      for (const [id, exp] of revoked) if (exp <= now()) revoked.delete(id);
      const authenticated = Boolean(session && !revoked.has(session.id));
      if (req.method === "POST") {
        const expectedOrigin =
          origin || `${secure ? "https" : "http"}://${req.headers.host}`;
        if (
          req.headers.origin !== expectedOrigin ||
          req.headers["sec-fetch-site"] === "cross-site"
        )
          return json(res, 403, { error: "Invalid origin" });
      }
      if (pathname === "/api/session" && req.method === "GET")
        return json(res, 200, { authenticated });
      if (pathname === "/api/login" && req.method === "POST") {
        const address = clientAddress(req, trustProxy),
          time = now();
        for (const [key, value] of attempts)
          if (value.until <= time) attempts.delete(key);
        const attempt = attempts.get(address) || {
          count: 0,
          until: time + windowMs,
        };
        if (attempt.count >= limit || attempts.size > 10000) {
          res.setHeader(
            "Retry-After",
            String(Math.ceil((attempt.until - time) / 1000)),
          );
          return json(res, 429, {
            error: "Too many attempts. Try again later.",
          });
        }
        attempt.count++;
        attempts.set(address, attempt);
        if (
          !/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")
        )
          return json(res, 415, { error: "JSON required" });
        let body = "",
          size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4096)
            return json(res, 413, { error: "Request too large" });
          body += chunk;
        }
        let data;
        try {
          data = JSON.parse(body);
        } catch {
          return json(res, 400, { error: "Invalid JSON" });
        }
        if (!verifyPassword(data?.password, config))
          return json(res, 401, { error: "Неверный пароль" });
        res.setHeader(
          "Set-Cookie",
          cookie(issueSession(config, time, ttl), Math.floor(ttl / 1000)),
        );
        return json(res, 200, { ok: true });
      }
      if (pathname === "/api/logout" && req.method === "POST") {
        if (session) {
          revoked.set(session.id, session.exp);
          await persistRevocations();
        }
        res.setHeader("Set-Cookie", cookie("", 0));
        return json(res, 200, { ok: true });
      }
      if (req.method !== "GET") return json(res, 404, { error: "Not found" });
      if (pathname === "/api/club" || pathname.startsWith("/media/")) {
        if (!authenticated)
          return json(res, 401, { error: "Authentication required" });
        const ok =
          pathname === "/api/club"
            ? await serveFile(
                res,
                path.join(root, "private/data"),
                "club.json",
                true,
              )
            : await serveFile(
                res,
                path.join(root, "private/media"),
                pathname.slice(7),
                true,
              );
        if (!ok) json(res, 404, { error: "Not found" });
        return;
      }
      if (
        pathname.startsWith("/api/") ||
        pathname.startsWith("/private/") ||
        pathname.startsWith("/.")
      )
        return json(res, 404, { error: "Not found" });
      const publicRoot = path.join(root, "dist/client");
      if (
        await serveFile(
          res,
          publicRoot,
          pathname === "/" ? "index.html" : pathname.slice(1),
        )
      )
        return;
      if (
        !path.extname(pathname) &&
        (await serveFile(res, publicRoot, "index.html"))
      )
        return;
      json(res, 404, { error: "Not found" });
    } catch {
      if (!res.headersSent) json(res, 503, { error: "Service unavailable" });
      else res.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
if (
  process.argv[1] &&
  (await realpath(process.argv[1]).catch(() => null)) === fileURLToPath(import.meta.url)
) {
  try {
    const server = await createServer();
    const port = Number(process.env.PORT || 4173);
    server.listen(port, process.env.HOST || "127.0.0.1", () =>
      console.log(`OUT Club listening on port ${server.address().port}`),
    );
  } catch {
    console.error(
      "OUT Club could not start. Configure authentication with node server/setup.mjs.",
    );
    process.exitCode = 1;
  }
}
