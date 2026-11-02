import { jwtVerify, SignJWT } from "jose";
import { secret } from "@/server/secrets";

const key = () => new TextEncoder().encode(secret("SESSION_SECRET"));

export async function createBookingAccess(id: string, now: Date = new Date()): Promise<string> {
  const issued = Math.floor(now.getTime() / 1000);
  return new SignJWT({ bookingId: id })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("guest-booking")
    .setIssuedAt(issued)
    .setNotBefore(issued)
    .setExpirationTime(issued + 86400)
    .sign(key());
}

export async function verifyBookingAccess(
  token: string | undefined,
  id: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      audience: "guest-booking",
      currentDate: now,
    });
    return payload.bookingId === id;
  } catch {
    return false;
  }
}
