import { ApiError } from "./ApiError.js";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour rolling window

const quotas = new Map(); // ip -> { bytes: number, windowStart: number }

// Purge stale entries once per hour to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of quotas.entries()) {
    if (now - entry.windowStart > WINDOW_MS) quotas.delete(ip);
  }
}, WINDOW_MS).unref();

export function checkUploadQuota(ip, newBytes, maxBytes) {
  const now = Date.now();
  const entry = quotas.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    quotas.set(ip, { bytes: newBytes, windowStart: now });
    return;
  }

  if (entry.bytes + newBytes > maxBytes) {
    const resetInMinutes = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 60_000);
    throw new ApiError(429, `Upload quota exceeded. You can upload again in ${resetInMinutes} minute(s).`);
  }

  quotas.set(ip, { bytes: entry.bytes + newBytes, windowStart: entry.windowStart });
}
