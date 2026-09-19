import { hash } from "./index.js";

const FRAGMENT_PREFIX = "key=";

function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) base64 += "=".repeat(4 - pad);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function serializeKeyToFragment(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  const digest = await hash(new Uint8Array(raw));
  const fingerprint = arrayBufferToBase64url(digest.buffer.slice(0, 16));
  const keyData = arrayBufferToBase64url(raw);
  return `#${FRAGMENT_PREFIX}${fingerprint}.${keyData}`;
}

export function parseKeyFromFragment(): CryptoKey | null {
  const fragment = window.location.hash.slice(1);
  if (!fragment.startsWith(FRAGMENT_PREFIX)) return null;
  const [fingerprint, keyData] = fragment.slice(FRAGMENT_PREFIX.length).split(".");
  if (!fingerprint || !keyData) return null;
  try {
    const raw = base64urlToArrayBuffer(keyData);
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  } catch {
    return null;
  }
}