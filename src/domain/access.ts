export type Role = "guest" | "staff" | "gm";
export type Team = "reservations" | "sales";

/** Who may open a path. /staff/** is for staff and the GM, /gm/** for the GM only, the rest is public. */
export function canAccess(role: Role | null, path: string): boolean {
  if (path === "/gm" || path.startsWith("/gm/")) return role === "gm";
  if (path === "/staff" || path.startsWith("/staff/")) return role === "staff" || role === "gm";
  return true;
}

/** Where a role lands after signing in. */
export function homeFor(role: Role): string {
  return role === "gm" ? "/gm" : role === "staff" ? "/staff" : "/";
}

/** A post-login redirect target: a same-site path the role may open, else the role's home. */
export function safeNext(role: Role, next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return homeFor(role);
  return canAccess(role, next) ? next : homeFor(role);
}
