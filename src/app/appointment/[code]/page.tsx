import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelButton } from "@/components/CancelButton";
import { canPatientCancel, getAppointmentByCode, type AppointmentStatus } from "@/lib/clinic";
import { CLINIC } from "@/lib/config";
import { SCHEDULE, formatDateLocal, formatTime, humanDate } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Qabulingiz — ${CLINIC.name}`, robots: { index: false } };

const STATUS: Record<AppointmentStatus, { label: string; cls: string }> = {
  booked: { label: "Yozildingiz", cls: "bg-mint text-teal-deep" },
  arrived: { label: "Klinikadasiz", cls: "bg-sky-100 text-sky-900" },
  done: { label: "Qabul o'tdi", cls: "bg-mint text-teal-deep" },
  no_show: { label: "Qabulga kelmadingiz", cls: "bg-amber-100 text-amber-900" },
  cancelled: { label: "Bekor qilingan", cls: "bg-danger/10 text-danger" },
};

export default async function AppointmentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Z0-9]{10}$/.test(code)) notFound();
  const a = await getAppointmentByCode(code);
  if (!a) notFound();

  const date = formatDateLocal(a.startsAt);
  const status = STATUS[a.status];
  const phoneHref = `tel:${CLINIC.phone.replace(/[^\d+]/g, "")}`;

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:py-16">
      <Link href="/" className="text-sm font-semibold text-teal hover:underline">
        ← {CLINIC.name}
      </Link>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">Qabulingiz</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${status.cls}`}>{status.label}</span>
      </div>

      <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line">
        <Row label="Vaqt" value={`${humanDate(date).long}, ${formatTime(a.startsAt)}`} strong />
        <Row label="Shifokor" value={`${a.doctorName} — ${a.doctorTitle}`} />
        <Row label="Yo'nalish" value={a.departmentName} />
        <Row label="Bemor" value={a.patientName} />
        <Row label="Manzil" value={CLINIC.address} />
      </dl>

      {a.status === "booked" ? (
        <div className="mt-6 grid gap-4">
          <p className="text-muted">
            Qabulga 10 daqiqa oldin keling va pasportingizni olib keling. Bu sahifani saqlab qo&apos;ying — havola orqali qabulni
            ko&apos;rishingiz yoki bekor qilishingiz mumkin.
          </p>
          {canPatientCancel(a) ? (
            <CancelButton code={a.code} />
          ) : (
            <p className="text-sm text-muted">
              Qabulgacha {SCHEDULE.cancelBeforeHours} soatdan kam qoldi — bekor qilish uchun qo&apos;ng&apos;iroq qiling:{" "}
              <a href={phoneHref} className="font-semibold text-teal">
                {CLINIC.phone}
              </a>
            </p>
          )}
        </div>
      ) : null}

      {a.status === "cancelled" ? (
        <Link href="/#book" className="mt-6 inline-block rounded-xl bg-coral px-5 py-3 font-bold text-white hover:bg-coral-deep">
          Boshqa vaqtga yozilish
        </Link>
      ) : null}
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid gap-0.5 bg-white px-5 py-3.5 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={strong ? "text-lg font-bold" : "font-medium"}>{value}</dd>
    </div>
  );
}
