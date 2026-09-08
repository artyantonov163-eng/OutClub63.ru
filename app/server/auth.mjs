import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
export function makeConfig(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    Buffer.byteLength(password) > 1024
  )
    throw new Error("Password must contain 12–1024 characters.");
  const salt = randomBytes(32).toString("hex");
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString("hex"),
    secret: randomBytes(48).toString("hex"),
    version: randomBytes(16).toString("hex"),
  };
}
export function validateConfig(c) {
  if (
    !c ||
    !/^[a-f0-9]{64}$/.test(c.salt) ||
    !/^[a-f0-9]{128}$/.test(c.hash) ||
    !/^[a-f0-9]{96}$/.test(c.secret) ||
    !/^[a-f0-9]{32}$/.test(c.version)
  )
    throw new Error("Auth configuration is absent or invalid. Run setup.");
  return c;
}
export function verifyPassword(password, c) {
  if (typeof password !== "string" || Buffer.byteLength(password) > 1024)
    return false;
  return timingSafeEqual(
    scryptSync(password, c.salt, 64),
    Buffer.from(c.hash, "hex"),
  );
}
const sign = (payload, c) =>
  createHmac("sha256", c.secret).update(payload).digest("base64url");
export function issueSession(c, now, ttl) {
  const payload = Buffer.from(
    JSON.stringify({
      v: c.version,
      exp: now + ttl,
      id: randomBytes(24).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload, c)}`;
}
export function readSession(token, c, now) {
  try {
    if (typeof token !== "string" || token.length > 2048) return null;
    const [payload, sig, ...rest] = token.split(".");
    const expected = sign(payload, c);
    if (
      rest.length ||
      sig?.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    )
      return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.v === c.version &&
      Number.isFinite(data.exp) &&
      data.exp > now &&
      typeof data.id === "string"
      ? data
      : null;
  } catch {
    return null;
  }
}
