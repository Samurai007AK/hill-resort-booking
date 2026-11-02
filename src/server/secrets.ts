/** Reads a signing secret from the environment. Production refuses to run without it. */
export function secret(name: "SESSION_SECRET" | "PAYMENT_WEBHOOK_SECRET"): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error(`${name} is not set`);
  return `example_dev_only_${name.toLowerCase()}`;
}
