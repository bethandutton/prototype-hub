import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Access tokens are encrypted at rest with a key from the environment.
// Format: base64(iv) . base64(tag) . base64(ciphertext)

function key() {
  const hex = process.env.TOKEN_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error("TOKEN_SECRET must be a 64-character hex string");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(ciphertext: string) {
  const [iv, tag, data] = ciphertext.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
