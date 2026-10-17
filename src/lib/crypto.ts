/**
 * At-rest encryption for third-party credentials (API keys, PATs, OAuth tokens).
 *
 * AES-256-GCM with a random 12-byte IV. Ciphertext is stored as
 * `enc:v1:<iv>:<tag>:<data>` (base64url) so plaintext rows written before
 * encryption was introduced are still readable: `decryptSecret` passes through
 * anything without the prefix.
 *
 * The key comes from INTEGRATION_ENCRYPTION_KEY (32 bytes, base64 or hex).
 * Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

let warned = false;

function loadKey(): Buffer | null {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or hex).");
  }
  return buf;
}

export function isEncryptionConfigured(): boolean {
  return loadKey() !== null;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Encrypts a secret for storage. If no key is configured the value is stored
 * as-is (with a one-time warning) so a missing env var degrades gracefully
 * instead of breaking every connect flow.
 */
export function encryptSecret(plain: string): string {
  const key = loadKey();
  if (!key) {
    if (!warned) {
      warned = true;
      console.warn("⚠️  INTEGRATION_ENCRYPTION_KEY is not set; integration credentials are being stored unencrypted.");
    }
    return plain;
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${data.toString("base64url")}`;
}

/** Decrypts a stored secret. Plaintext (legacy) values are returned unchanged. */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const key = loadKey();
  if (!key) {
    throw new Error(
      "This credential is encrypted but INTEGRATION_ENCRYPTION_KEY is not set in this environment. Add the key or reconnect the integration."
    );
  }
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Stored credential is malformed.");
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}

/** Like decryptSecret but tolerates null for optional columns such as refreshToken. */
export function decryptOptionalSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  return decryptSecret(stored);
}
