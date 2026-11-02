// Signed session cookie (HS256). No database access here, so the proxy can import it cheaply.
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { secret } from "./secrets";

const fields = { userId: z.string().min(1), email: z.email(), name: z.string().min(1) };
const SessionPayload = z.union([
  z.object({ ...fields, role: z.literal("staff"), team: z.enum(["reservations", "sales"]) }),
  z.object({ ...fields, role: z.enum(["guest", "gm"]), team: z.null() }),
]);
export type Session = z.infer<typeof SessionPayload>;

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
    return SessionPayload.parse(payload);
  } catch {
    return null;
  }
}
