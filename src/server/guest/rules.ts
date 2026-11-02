import { z } from "zod";
import { addDays } from "@/domain/dates";

export type Option = { roomTypeId: string; checkIn: string; checkOut: string; available: number };
export type Search = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  qty: number;
  promo?: string;
};
type Capacity = { maxAdults: number; maxChildren: number };
type Party = { adults: number; children: number };

export function normalizePhone(raw: string): string | null {
  if (!/^[+\d\s()-]+$/.test(raw.trim())) return null;
  const digits = raw.replace(/\D/g, "");
  const indian =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;
  if (
    indian.length === 10 &&
    /^[6-9]\d{9}$/.test(indian) &&
    (!raw.trim().startsWith("+") || digits.startsWith("91"))
  )
    return `+91 ${indian.slice(0, 5)} ${indian.slice(5)}`;
  if (raw.trim().startsWith("+") && !digits.startsWith("91") && /^[1-9]\d{7,14}$/.test(digits))
    return `+${digits}`;
  return null;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const count = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = value === undefined || value.trim() === "" ? fallback : Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
};

export function parseSearch(
  sp: Record<string, string | string[] | undefined>,
  today: string,
): { search: Search; error?: string } {
  const fallbackIn = addDays(today, 1),
    fallbackOut = addDays(today, 3);
  const checkIn = first(sp.in) ?? fallbackIn,
    checkOut =
      first(sp.out) ??
      (first(sp.in) && z.iso.date().safeParse(checkIn).success ? addDays(checkIn, 2) : fallbackOut);
  let error: string | undefined;
  if (!z.iso.date().safeParse(checkIn).success || !z.iso.date().safeParse(checkOut).success)
    error = "Pick valid dates";
  else if (checkIn < today) error = "Check-in can't be in the past";
  else if (checkOut <= checkIn) error = "Check-out must be after check-in";
  else if ((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000 > 30)
    error = "A stay can be at most 30 nights";
  const promo = first(sp.promo)?.trim().toUpperCase().slice(0, 32);
  const search: Search = {
    checkIn: error ? fallbackIn : checkIn,
    checkOut: error ? fallbackOut : checkOut,
    adults: count(first(sp.adults), 2, 1, 16),
    children: count(first(sp.children), 0, 0, 12),
    qty: count(first(sp.qty), 1, 1, 4),
  };
  if (promo) search.promo = promo;
  return error ? { search, error } : { search };
}
export function fits(room: Capacity, party: Party & { qty: number }): boolean {
  return keysNeeded(room, party) <= party.qty;
}
export function keysNeeded(room: Capacity, party: Party): number {
  const childrenRooms =
    party.children === 0
      ? 0
      : room.maxChildren === 0
        ? Infinity
        : Math.ceil(party.children / room.maxChildren);
  return Math.max(1, Math.ceil(party.adults / room.maxAdults), childrenRooms);
}
export function pickAlternatives(
  wanted: Party & { roomTypeId: string; checkIn: string; checkOut: string; qty: number },
  options: Option[],
  rooms: (Capacity & { id: string })[],
  today: string,
): Option[] {
  const candidates = options.filter((option) => {
    const room = rooms.find((r) => r.id === option.roomTypeId);
    const same =
      option.roomTypeId === wanted.roomTypeId &&
      option.checkIn === wanted.checkIn &&
      option.checkOut === wanted.checkOut;
    return (
      !same &&
      option.checkIn >= today &&
      option.available >= wanted.qty &&
      room &&
      fits(room, wanted)
    );
  });
  const nearby = candidates
    .filter((option) => option.roomTypeId === wanted.roomTypeId)
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.checkIn) - Date.parse(wanted.checkIn)) -
          Math.abs(Date.parse(b.checkIn) - Date.parse(wanted.checkIn)) ||
        b.checkIn.localeCompare(a.checkIn),
    );
  const otherRooms = candidates.filter((option) => option.roomTypeId !== wanted.roomTypeId);
  const result: Option[] = [];
  for (let index = 0; index < Math.max(nearby.length, otherRooms.length); index++) {
    if (nearby[index]) result.push(nearby[index]);
    if (otherRooms[index]) result.push(otherRooms[index]);
  }
  return result.slice(0, 3);
}
