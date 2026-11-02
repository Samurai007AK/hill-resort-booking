"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/domain/access";
import { authenticate, endSession, startSession } from "@/server/auth";

const LoginForm = z.object({
  email: z.email("Enter your email").max(200),
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().max(500).optional(),
});

export type LoginState = { error: string; email: string } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const parsed = LoginForm.safeParse({
    email,
    password: form.get("password"),
    next: form.get("next") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const session = await authenticate(parsed.data.email, parsed.data.password);
  if (!session) return { error: "Wrong email or password", email };

  await startSession(session);
  redirect(safeNext(session.role, parsed.data.next));
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/");
}
