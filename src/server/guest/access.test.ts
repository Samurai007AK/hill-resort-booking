import { describe, expect, test } from "vitest";
import { createBookingAccess, verifyBookingAccess } from "./access";

describe("private booking access", () => {
  test("only the signed booking can be opened", async () => {
    const token = await createBookingAccess("booking-a");
    expect(await verifyBookingAccess(token, "booking-a")).toBe(true);
    expect(await verifyBookingAccess(token, "booking-b")).toBe(false);
    expect(await verifyBookingAccess(undefined, "booking-a")).toBe(false);
    expect(await verifyBookingAccess(`${token}x`, "booking-a")).toBe(false);
  });
  test("access expires and cannot be used before it was issued", async () => {
    const issued = new Date("2026-11-02T10:00:00Z");
    const token = await createBookingAccess("booking-a", issued);
    expect(await verifyBookingAccess(token, "booking-a", new Date("2026-11-02T09:59:00Z"))).toBe(
      false,
    );
    expect(await verifyBookingAccess(token, "booking-a", new Date("2026-11-02T11:00:00Z"))).toBe(
      true,
    );
    expect(await verifyBookingAccess(token, "booking-a", new Date("2026-11-04T11:00:00Z"))).toBe(
      false,
    );
  });
});
