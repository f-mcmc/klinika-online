import { NextResponse, type NextRequest } from "next/server";
import { AppointmentError, cancelByPatient } from "@/lib/clinic";
import { humanDate, formatDateLocal, formatTime } from "@/lib/schedule";
import { notifyOwner } from "@/lib/telegram";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Z0-9]{10}$/.test(code)) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  try {
    const { appointment: a, changed } = await cancelByPatient(code);
    if (changed) {
      await notifyOwner(
        `❌ Bemor qabulni bekor qildi: ${humanDate(formatDateLocal(a.startsAt)).long}, ${formatTime(a.startsAt)} — ${a.doctorName}, ${a.patientName}`,
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AppointmentError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "invalid" ? 404 : 409 });
    }
    console.error("Cancel failed", err);
    return NextResponse.json({ error: "Xatolik yuz berdi" }, { status: 500 });
  }
}
