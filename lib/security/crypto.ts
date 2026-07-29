const ALGORITHM = "AES-GCM";

function base64ToBytes(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function bytesToBase64(value: ArrayBuffer | Uint8Array) {
  return Buffer.from(value instanceof Uint8Array ? value : new Uint8Array(value)).toString("base64");
}

async function getKey() {
  const encoded = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  const bytes = base64ToBytes(encoded);
  if (bytes.byteLength !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return crypto.subtle.importKey("raw", bytes as BufferSource, ALGORITHM, false, ["encrypt", "decrypt"]);
}

export async function assertEncryptionReady() {
  await getKey();
}

export async function encryptSecret(plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, await getKey(), new TextEncoder().encode(plaintext));
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
}

export async function decryptSecret(payload: string) {
  const [version, ivValue, ciphertextValue] = payload.split(".");
  if (version !== "v1" || !ivValue || !ciphertextValue) throw new Error("Unsupported encrypted value");
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: base64ToBytes(ivValue) },
    await getKey(),
    base64ToBytes(ciphertextValue),
  );
  return new TextDecoder().decode(plaintext);
}

export function createState() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
}

export async function createPkce() {
  const verifier = createState();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = bytesToBase64(digest).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return { verifier, challenge };
}
