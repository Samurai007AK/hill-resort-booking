import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { beforeAll, expect, test } from "vitest";
import { authenticate, signSession, verifySession } from "@/server/auth";
import { pool } from "./db";

const EMAIL = "auth-test@demo.in";

beforeAll(async () => {
  await pool.query(
    `INSERT INTO users (email, name, password_hash, role, team) VALUES ($1, 'Riya', $2, 'staff', 'sales')
     ON CONFLICT (email) DO NOTHING`,
    [EMAIL, await bcrypt.hash("right-password", 4)],
  );
});

test("the right password signs in with the user's role and team", async () => {
  expect(await authenticate(` ${EMAIL.toUpperCase()} `, "right-password")).toMatchObject({
    email: EMAIL,
    name: "Riya",
    role: "staff",
    team: "sales",
  });
});

test("a wrong password or an unknown email gets nothing", async () => {
  expect(await authenticate(EMAIL, "wrong-password")).toBeNull();
  expect(await authenticate("nobody@demo.in", "right-password")).toBeNull();
});

test("a session survives the cookie round trip; a forged one does not", async () => {
  const s = {
    userId: "u1",
    email: EMAIL,
    name: "Riya",
    role: "staff" as const,
    team: "sales" as const,
  };
  expect(await verifySession(await signSession(s))).toEqual(s);

  const forged = await new SignJWT({ ...s, role: "gm" })
    .setProtectedHeader({ alg: "HS256" })
    .sign(new TextEncoder().encode("example_some_other_key"));
  expect(await verifySession(forged)).toBeNull();
  expect(await verifySession(undefined)).toBeNull();
  expect(await verifySession("not-a-token")).toBeNull();
});

test("a correctly signed token still needs a valid role and team payload", async () => {
  for (const payload of [
    { role: "gm" },
    { userId: "u1", email: EMAIL, name: "Riya", role: "staff", team: null },
  ]) {
    const malformed = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    expect(await verifySession(malformed)).toBeNull();
  }
});
