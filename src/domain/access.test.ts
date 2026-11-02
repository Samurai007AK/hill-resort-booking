import { expect, test } from "vitest";
import { canAccess, safeNext, type Role } from "./access";

test.each<[Role | null, string, boolean]>([
  [null, "/", true],
  [null, "/rooms/coffee-villa", true],
  [null, "/staff", false],
  [null, "/staff/inbox", false],
  [null, "/gm", false],
  ["guest", "/staff/calendar", false],
  ["guest", "/gm", false],
  ["guest", "/rooms/estate-room", true],
  ["staff", "/staff", true],
  ["staff", "/staff/inbox", true],
  ["staff", "/gm", false],
  ["staff", "/gm/reset", false],
  ["gm", "/gm", true],
  ["gm", "/staff/inbox", true],
  [null, "/staffing", true], // only the /staff segment is guarded
  [null, "/gmail", true],
])("%s on %s -> %s", (role, path, allowed) => {
  expect(canAccess(role, path)).toBe(allowed);
});

test.each<[Role, string | null, string]>([
  ["staff", "/staff/inbox", "/staff/inbox"],
  ["staff", null, "/staff"],
  ["gm", null, "/gm"],
  ["guest", null, "/"],
  ["staff", "/gm", "/staff"], // not allowed there: go home instead
  ["gm", "//evil.example", "/gm"], // no open redirect
  ["gm", "https://evil.example", "/gm"],
  ["gm", "/\\evil.example", "/gm"],
])("after login %s with next=%s goes to %s", (role, next, to) => {
  expect(safeNext(role, next)).toBe(to);
});
