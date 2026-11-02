// Signed session cookie (HS256). No database access here, so the proxy can import it cheaply.
import { jwtVerify, SignJWT } from "jose";
import type { Role, Team } from "@/domain/access";
import { secret } from "./secrets";

export type Session = { userId: string; email: string; name: string; role: Role; team: Team | null };

export const SESSION_COOKIE = "session";
export const SESSION_HOURS = 8;

const key = () => new TextEncoder().encode(secret("SESSION_SECRET"));

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

/** The session in a token, or null if it is missing, forged or expired. */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const { userId, email, name, role, team } = payload as unknown as Session;
    return { userId, email, name, role, team };
  } catch {
    return null;
  }
}
