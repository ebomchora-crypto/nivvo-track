import { createHmac, timingSafeEqual } from "crypto";

export function hashBuyer(identifier: string | null | undefined, salt: string): string | null {
  if (!identifier) return null;
  return createHmac("sha256", salt).update(identifier.trim().toLowerCase()).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
