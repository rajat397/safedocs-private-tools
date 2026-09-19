const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string, password: string): Promise<{
  ciphertext: Uint8Array;
  iv: Uint8Array;
  salt: Uint8Array;
}> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
    salt,
  };
}

export async function decrypt(
  { ciphertext, iv, salt }: { ciphertext: Uint8Array; iv: Uint8Array; salt: Uint8Array },
  password: string
): Promise<string> {
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export async function hash(data: string | Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const buffer = typeof data === "string" ? encoder.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return new Uint8Array(digest);
}