import { mkdir, writeFile, rename, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeConfig } from "./auth.mjs";
const dir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.runtime",
);
async function readPassword() {
  if (!process.stdin.isTTY) {
    let value = "";
    for await (const chunk of process.stdin) {
      value += chunk;
      if (value.length > 2048) throw new Error("Input too long");
    }
    return value.replace(/[\r\n]+$/, "");
  }
  process.stderr.write(
    "Shared password (12+ characters; blank generates one): ",
  );
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const done = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stderr.write("\n");
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          done();
          reject(new Error("Cancelled"));
          return;
        }
        if (char === "\r" || char === "\n") {
          done();
          resolve(value);
          return;
        }
        if (char === "\u007f") {
          value = value.slice(0, -1);
        } else if (value.length < 1024) value += char;
      }
    };
    process.stdin.on("data", onData);
  });
}
try {
  if (process.argv.length > 2)
    throw new Error("Do not pass passwords as command arguments.");
  const password =
    (await readPassword()) || randomBytes(18).toString("base64url");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  const config = makeConfig(password);
  const temp = path.join(dir, `auth-${randomBytes(8).toString("hex")}.tmp`);
  await writeFile(temp, JSON.stringify(config, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
  await rename(temp, path.join(dir, "auth.json"));
  await writeFile(path.join(dir, "access.txt"), password + "\n", {
    mode: 0o600,
  });
  await chmod(path.join(dir, "access.txt"), 0o600);
  console.log(
    "Authentication configured. Previous sessions invalidated. Password saved privately to .runtime/access.txt.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
