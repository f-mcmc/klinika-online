import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AppointmentError, createAppointment } from "@/lib/clinic";
import { formatUzPhone, normalizeUzPhone } from "@/lib/phone";
import { humanDate, isValidDate } from "@/lib/schedule";
import { notifyOwner } from "@/lib/telegram";

const thisYear = new Date().getUTCFullYear();

const Body = z.object({
  doctorId: z.number().int().positive(),
  date: z.string().refine(isValidDate),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  patientName: z.string().trim().min(3, "Ism va familiyani yozing").max(80),
  phone: z.string().trim().max(30),
  birthYear: z.number().int().min(thisYear - 110).max(thisYear).nullable(),
  complaint: z.string().trim().max(300).default(""),
  /** Botlarga tuzoq */
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  const json: unknown = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.path[0] === "patientName" ? issue.message : "Ma'lumotlar noto'g'ri";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const phone = normalizeUzPhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "Telefon raqamini to'liq yozing" }, { status: 400 });

  try {
    const { code, doctor } = await createAppointment({ ...parsed.data, phone });
    const d = humanDate(parsed.data.date);
    await notifyOwner(
      [
        `🩺 Yangi qabul: ${d.long}, ${parsed.data.time}`,
        `${doctor.name} (${doctor.departmentName})`,
        `Bemor: ${parsed.data.patientName}, ${formatUzPhone(phone)}`,
        parsed.data.complaint ? `Shikoyat: ${parsed.data.complaint}` : "",
        `${req.nextUrl.origin}/admin?date=${parsed.data.date}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return NextResponse.json({ code }, { status: 201 });
  } catch (err) {
    if (err instanceof AppointmentError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    console.error("Appointment failed", err);
    return NextResponse.json({ error: "Xatolik yuz berdi, qayta urinib ko'ring" }, { status: 500 });
  }
}
