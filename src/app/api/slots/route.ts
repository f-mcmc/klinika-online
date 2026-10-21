import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAvailableTimes } from "@/lib/clinic";
import { isValidDate } from "@/lib/schedule";

const Query = z.object({
  doctor: z.coerce.number().int().positive(),
  date: z.string().refine(isValidDate),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 });
  const times = await getAvailableTimes(parsed.data.doctor, parsed.data.date);
  return NextResponse.json({ times }, { headers: { "cache-control": "no-store" } });
}
