import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * App-layer field encryption (AES-256-GCM) for client PII (email, website) —
 * so a raw look at the database (Supabase dashboard / service-role queries)
 * shows ciphertext, not plaintext. Decryption only happens where the app
 * actually needs the value (rendering the clients list, exporting data).
 *
 * Requires CLIENT_DATA_ENCRYPTION_KEY (32-byte base64) in the server env —
 * never expose this to the browser.
 */
function getKey() {
  const raw = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error("CLIENT_DATA_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CLIENT_DATA_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}

/** Returns null as-is (many client fields are optional) so callers don't need extra null checks. */
export function encryptField(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  // Rows written before encryption was added are plain text — pass them through
  // rather than erroring, so a mixed-state table (pre/post migration) still renders.
  if (!stored.startsWith("v1:")) return stored;

  const [, ivB64, authTagB64, ciphertextB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
