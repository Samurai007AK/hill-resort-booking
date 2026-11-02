import { createHash } from "node:crypto";
import { z } from "zod";
import { todayIST } from "@/domain/dates";
import { allowPublicEnquiry, ingestEnquiry } from "@/server/enquiry/service";

export const runtime = "nodejs";
const PublicInput = z
  .object({
    senderName: z.string().trim().min(2).max(100),
    contact: z.string().trim().min(8).max(200),
    text: z.string().trim().min(5).max(10000),
    enquiryType: z.enum(["contact", "wedding", "offsite"]),
    eventDate: z.union([z.iso.date(), z.literal("")]).default(""),
    guests: z.union([z.coerce.number().int().min(1).max(10000), z.literal("")]).default(""),
    budget: z.union([z.coerce.number().int().min(1).max(1000000000), z.literal("")]).default(""),
    consent: z.literal(true),
    idempotencyKey: z.uuid(),
  })
  .refine((value) => !value.eventDate || value.eventDate >= todayIST(), {
    message: "Choose a future event date",
    path: ["eventDate"],
  });
const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Please submit this form from the resort website." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Use the enquiry form." }, { status: 415 });
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 16000)
      return Response.json({ error: "Your message is too long." }, { status: 413 });
    const parsed = PublicInput.safeParse(JSON.parse(body));
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Please check the form." },
        { status: 400 },
      );
    const data = parsed.data;
    const address = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    const contactAllowed = await allowPublicEnquiry(
      fingerprint(`contact:${data.contact.toLowerCase()}`),
    );
    const addressAllowed = await allowPublicEnquiry(fingerprint(`address:${address}`));
    if (!contactAllowed || !addressAllowed)
      return Response.json(
        { error: "Too many enquiries. Please try again in ten minutes." },
        { status: 429 },
      );
    const event =
      data.enquiryType === "contact"
        ? ""
        : `${data.enquiryType} enquiry. ${data.eventDate ? `Event date ${data.eventDate}. ` : ""}${data.guests ? `${data.guests} guests. ` : ""}${data.budget ? `Budget INR ${data.budget}. ` : ""}`;
    const enquiry = await ingestEnquiry({
      source: data.enquiryType === "contact" ? "web" : "event_form",
      senderName: data.senderName,
      contact: data.contact,
      text: event + data.text,
      consent: data.consent,
      idempotencyKey: data.idempotencyKey,
    });
    return Response.json(
      {
        id: enquiry.id,
        message:
          "Your enquiry is with our team. A reply will be reviewed by a person before it is sent.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError)
      return Response.json(
        { error: "Please check your contact details and message." },
        { status: 400 },
      );
    return Response.json(
      { error: "We couldn't save your enquiry just now. Please try again." },
      { status: 503 },
    );
  }
}
