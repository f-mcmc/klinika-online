import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/AdminHeader";
import { AutoRefresh } from "@/components/AutoRefresh";
import { isAdmin } from "@/lib/auth";
import {
  adminDateRange,
  allowedNext,
  dayStats,
  doctorDaySlots,
  listDay,
  listDoctors,
  type Appointment,
  type AppointmentStatus,
} from "@/lib/clinic";
import { formatUzPhone } from "@/lib/phone";
import { addDays, formatTime, humanDate, isValidDate, todayLocal } from "@/lib/schedule";
import { setStatusAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Qabullar — admin", robots: { index: false } };

const BADGE: Record<AppointmentStatus, { label: string; cls: string }> = {
  booked: { label: "Kutilmoqda", cls: "bg-amber-100 text-amber-900" },
  arrived: { label: "Keldi", cls: "bg-sky-100 text-sky-900" },
  done: { label: "Qabul tugadi", cls: "bg-mint text-teal-deep" },
  no_show: { label: "Kelmadi", cls: "bg-zinc-200 text-zinc-700" },
  cancelled: { label: "Bekor", cls: "bg-danger/10 text-danger" },
};

const ACTION_LABEL: Record<AppointmentStatus, string> = {
  booked: "Qaytarish",
  arrived: "Keldi",
  done: "Qabul tugadi",
  no_show: "Kelmadi",
  cancelled: "Bekor qilish",
};

export default async function AdminDayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const range = adminDateRange();
  const { date: raw } = await searchParams;
  const date = raw && isValidDate(raw) && raw >= range.min && raw <= range.max ? raw : todayLocal();

  const [appointments, doctors, stats] = await Promise.all([listDay(date), listDoctors(true), dayStats(date)]);
  const h = humanDate(date);
  const byDoctor = new Map<number, Appointment[]>();
  for (const a of appointments) byDoctor.set(a.doctorId, [...(byDoctor.get(a.doctorId) ?? []), a]);
  const workingDoctors = doctors.filter((d) => byDoctor.has(d.id) || (d.active && doctorDaySlots(d, date).length > 0));
  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <>
      <AdminHeader current="day" />
      {date === range.today ? <AutoRefresh seconds={30} /> : null}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">
              {date === range.today ? "Bugun" : h.long}
              {date === range.today ? <span className="ml-2 text-lg font-semibold text-muted">{h.long}</span> : null}
            </h1>
            <p className="text-sm text-muted">Shu hafta jami: {stats.weekTotal} ta qabul</p>
          </div>
          <nav className="flex items-center gap-2" aria-label="Kunlar">
            {prev >= range.min ? (
              <Link href={`/admin?date=${prev}`} className="rounded-xl border border-line bg-white px-3 py-2 font-semibold">
                ← Oldingi
              </Link>
            ) : null}
            {date !== range.today ? (
              <Link href="/admin" className="rounded-xl border border-line bg-white px-3 py-2 font-semibold">
                Bugun
              </Link>
            ) : null}
            {next <= range.max ? (
              <Link href={`/admin?date=${next}`} className="rounded-xl border border-line bg-white px-3 py-2 font-semibold">
                Keyingi →
              </Link>
            ) : null}
          </nav>
        </div>

        <section aria-label="Kun ko'rsatkichlari" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Qabullar" value={stats.total} />
          <Stat label="Kutilmoqda" value={stats.waiting} />
          <Stat label="Qabul qilindi" value={stats.seen} />
          <Stat label="Kelmadi" value={stats.noShow} />
        </section>

        {workingDoctors.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-line px-5 py-10 text-center text-muted">
            Bu kuni hech bir shifokor ishlamaydi.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {workingDoctors.map((d) => {
              const list = byDoctor.get(d.id) ?? [];
              const active = list.filter((a) => a.status !== "cancelled").length;
              const capacity = doctorDaySlots(d, date).length;
              return (
                <section key={d.id} aria-labelledby={`doc-${d.id}`} className="rounded-2xl border border-line bg-white">
                  <header className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-4">
                    <div>
                      <h2 id={`doc-${d.id}`} className="font-bold">
                        {d.name}
                      </h2>
                      <p className="text-sm text-muted">{d.departmentName}</p>
                    </div>
                    <p className="text-sm whitespace-nowrap text-muted">
                      {active} / {capacity} band
                    </p>
                  </header>
                  {list.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-muted">Yozilganlar yo&apos;q.</p>
                  ) : (
                    <ul>
                      {list.map((a) => (
                        <li key={a.id} className={`border-b border-line px-5 py-4 last:border-0 ${a.status === "cancelled" ? "opacity-55" : ""}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex gap-4">
                              <span className="text-lg font-bold tabular-nums">{formatTime(a.startsAt)}</span>
                              <div>
                                <p className="font-semibold">
                                  {a.patientName}
                                  {a.birthYear ? <span className="font-normal text-muted"> · {a.birthYear} y.</span> : null}
                                </p>
                                <a href={`tel:${a.phone}`} className="text-sm text-teal hover:underline">
                                  {formatUzPhone(a.phone)}
                                </a>
                                {a.complaint ? <p className="mt-1 text-sm text-muted">Shikoyat: {a.complaint}</p> : null}
                              </div>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[a.status].cls}`}>
                              {BADGE[a.status].label}
                            </span>
                          </div>
                          {allowedNext(a.status).length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {allowedNext(a.status).map((to) => (
                                <form key={to} action={setStatusAction}>
                                  <input type="hidden" name="id" value={a.id} />
                                  <input type="hidden" name="from" value={a.status} />
                                  <input type="hidden" name="to" value={to} />
                                  <button
                                    type="submit"
                                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                                      to === "cancelled"
                                        ? "border border-line text-danger hover:bg-danger/5"
                                        : to === "no_show" || to === "booked"
                                          ? "border border-line text-muted hover:text-ink"
                                          : "bg-teal text-white hover:bg-teal-deep"
                                    }`}
                                  >
                                    {ACTION_LABEL[to]}
                                  </button>
                                </form>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
