import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const OWNER_COOKIE = "pools-owner";
export const OWNER_SESSION_SECONDS = 30 * 24 * 60 * 60;

export function matchesSecret(candidate: string, secret: string | undefined) {
  if (!secret || !candidate) return false;
  return timingSafeEqual(
    createHash("sha256").update(candidate).digest(),
    createHash("sha256").update(secret).digest(),
  );
}

function signature(value: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`pools-owner:${value}`)
    .digest("hex");
}

export function createOwnerSession(secret: string, now = Date.now()) {
  if (!secret) throw new Error("Owner access is not configured");
  const expires = now + OWNER_SESSION_SECONDS * 1000;
  const value = `v1.${expires}.${randomBytes(16).toString("hex")}`;
  return `${value}.${signature(value, secret)}`;
}

export function validOwnerSession(
  session: string | undefined,
  secret: string | undefined,
  now = Date.now(),
) {
  if (!session || !secret) return false;
  const parts = /^v1\.(\d{13})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(session);
  if (!parts || Number(parts[1]) <= now) return false;
  const value = `v1.${parts[1]}.${parts[2]}`;
  return matchesSecret(parts[3], signature(value, secret));
}
