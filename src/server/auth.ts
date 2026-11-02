import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "@/db/pool";
import type { Role } from "@/domain/access";
import { SESSION_COOKIE, SESSION_HOURS, signSession, verifySession, type Session } from "./session";

export { signSession, verifySession, type Session };

/** The user for these credentials, or null. Same answer for an unknown email and a wrong password. */
export async function authenticate(email: string, password: string): Promise<Session | null> {
  const { rows } = await pool.query("SELECT id, email, name, role, team, password_hash FROM users WHERE email = $1", [
    email.trim().toLowerCase(),
  ]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return null;
  return { userId: u.id, email: u.email, name: u.name, role: u.role, team: u.team };
}

export async function startSession(s: Session): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await signSession(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * For server components and server actions: the session if its role is allowed, otherwise a
 * redirect to /login. The proxy guards pages too; actions must still call this themselves.
 */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s || !roles.includes(s.role)) redirect("/login");
  return s;
}
