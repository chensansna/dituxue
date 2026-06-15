import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SECONDS = 15 * 60;

function proxySecret() {
  return process.env.QWEN_IMAGE_PROXY_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.QWEN_API_KEY ?? "";
}

export function publicAppOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const raw = configured || (vercelHost ? `https://${vercelHost}` : "");
  if (!raw) return null;
  const origin = raw.startsWith("http") ? raw : `https://${raw}`;
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) return null;
  return origin.replace(/\/+$/, "");
}

export function signQwenImageProxyUrl(path: string, mimeType: string, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const origin = publicAppOrigin();
  const secret = proxySecret();
  if (!origin || !secret) return null;
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = signQwenImageProxyPayload(path, mimeType, expires);
  const params = new URLSearchParams({ path, mime: mimeType, expires: String(expires), sig: signature });
  return `${origin}/api/qwen/review-image?${params.toString()}`;
}

export function signQwenImageProxyPayload(path: string, mimeType: string, expires: number) {
  return createHmac("sha256", proxySecret()).update(`${path}\n${mimeType}\n${expires}`).digest("hex");
}

export function verifyQwenImageProxySignature(path: string, mimeType: string, expires: number, signature: string) {
  const secret = proxySecret();
  if (!secret || !signature || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = signQwenImageProxyPayload(path, mimeType, expires);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
