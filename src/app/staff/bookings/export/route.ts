import { z } from "zod";
import { getSession } from "@/server/auth";
import { bookingsCsv } from "@/server/admin/service";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== "staff" && session.role !== "gm"))
    return new Response("Staff access required", { status: 403 });
  const date = z.iso.date().safeParse(new URL(request.url).searchParams.get("date"));
  if (!date.success) return new Response("Choose a valid arrival date", { status: 400 });
  return new Response(await bookingsCsv(session, date.data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="arrivals-${date.data}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
