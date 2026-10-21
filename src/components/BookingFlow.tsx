"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { normalizeUzPhone } from "@/lib/phone";
import { SCHEDULE, WEEKDAY_SHORT, addDays, humanDate, minutesToTime, nowLocalMinutes, weekday } from "@/lib/schedule";

export interface PublicDoctor {
  id: number;
  departmentId: number;
  name: string;
  title: string;
  workDays: number[];
  startHour: number;
  endHour: number;
  slotMinutes: number;
}

interface Props {
  departments: { id: number; name: string }[];
  doctors: PublicDoctor[];
  today: string;
  daysAhead: number;
}

type Slots = { status: "idle" } | { status: "loading" } | { status: "ready"; times: string[] } | { status: "error" };

function workDaysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

export function BookingFlow({ departments, doctors, today, daysAhead }: Props) {
  const router = useRouter();
  const [depId, setDepId] = useState<number | null>(departments[0]?.id ?? null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slots>({ status: "idle" });
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const depDoctors = doctors.filter((d) => d.departmentId === depId);
  const doctor = doctors.find((d) => d.id === doctorId) ?? null;

  const days = useMemo(() => Array.from({ length: daysAhead + 1 }, (_, i) => addDays(today, i)), [today, daysAhead]);

  // Shifokor tanlanganda yozilish mumkin bo'lgan birinchi ish kunini o'zi tanlaymiz
  // (bugungi ish vaqti tugagan bo'lsa — keyingi ish kunini)
  useEffect(() => {
    if (!doctor) return;
    const lastStart = doctor.endHour * 60 - doctor.slotMinutes;
    const todayOver = nowLocalMinutes() + SCHEDULE.minLeadMinutes > lastStart;
    setDate(
      days.find((d) => doctor.workDays.includes(weekday(d)) && !(d === today && todayOver)) ?? null,
    );
    setTime(null);
  }, [doctor, days, today]);

  useEffect(() => {
    if (!doctorId || !date) {
      setSlots({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setSlots({ status: "loading" });
    fetch(`/api/slots?doctor=${doctorId}&date=${date}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const data: unknown = await res.json();
        if (!res.ok || typeof data !== "object" || data === null || !("times" in data) || !Array.isArray(data.times)) {
          throw new Error("bad response");
        }
        setSlots({ status: "ready", times: data.times.filter((t): t is string => typeof t === "string") });
      })
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) setSlots({ status: "error" });
      });
    return () => controller.abort();
  }, [doctorId, date, reload]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!doctor || !date || !time) return;
    const form = new FormData(e.currentTarget);
    const patientName = String(form.get("patientName") ?? "").trim();
    const phone = String(form.get("phone") ?? "");
    const birthRaw = String(form.get("birthYear") ?? "").trim();
    const birthYear = birthRaw ? Number(birthRaw) : null;

    if (patientName.length < 3) return setError("Ism va familiyani yozing.");
    if (!normalizeUzPhone(phone)) return setError("Telefon raqamini to'liq yozing: +998 90 123 45 67.");
    if (birthYear !== null && (!Number.isInteger(birthYear) || birthYear < 1915 || birthYear > Number(today.slice(0, 4)))) {
      return setError("Tug'ilgan yilni to'g'ri yozing, masalan 1990.");
    }

    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doctorId: doctor.id,
          date,
          time,
          patientName,
          phone,
          birthYear,
          complaint: String(form.get("complaint") ?? ""),
          website: String(form.get("website") ?? ""),
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (res.ok && typeof data === "object" && data !== null && "code" in data && typeof data.code === "string") {
        router.push(`/appointment/${data.code}`);
        return;
      }
      const message =
        typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "Xatolik yuz berdi, qayta urinib ko'ring.";
      setError(message);
      if (res.status === 409) {
        setTime(null);
        setReload((n) => n + 1);
      }
    } catch {
      setError("Internet bilan aloqa yo'q. Qayta urinib ko'ring.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-8">
      <Step n={1} title="Yo'nalish">
        <div className="flex flex-wrap gap-2">
          {departments.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={depId === d.id}
              onClick={() => {
                setDepId(d.id);
                setDoctorId(null);
                setDate(null);
                setTime(null);
              }}
              className={`rounded-full border px-4 py-2 font-medium ${
                depId === d.id ? "border-teal bg-teal text-white" : "border-line bg-white text-muted hover:text-ink"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      </Step>

      <Step n={2} title="Shifokor">
        <div className="grid gap-3 sm:grid-cols-2">
          {depDoctors.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={doctorId === d.id}
              onClick={() => setDoctorId(d.id)}
              className={`flex items-start gap-4 rounded-2xl border bg-white p-4 text-left transition-colors ${
                doctorId === d.id ? "border-teal ring-2 ring-teal/20" : "border-line hover:border-teal/50"
              }`}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-mint font-bold text-teal">
                {d.name
                  .split(" ")
                  .map((p) => p.charAt(0))
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="grid gap-0.5">
                <span className="font-semibold">{d.name}</span>
                <span className="text-sm text-muted">{d.title}</span>
                <span className="text-sm text-teal">
                  {workDaysLabel(d.workDays)} · {minutesToTime(d.startHour * 60)}–{minutesToTime(d.endHour * 60)}
                </span>
              </span>
            </button>
          ))}
          {depDoctors.length === 0 ? <p className="text-muted">Bu yo&apos;nalishda hozir shifokor yo&apos;q.</p> : null}
        </div>
      </Step>

      {doctor ? (
        <Step n={3} title="Kun va vaqt">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {days.map((d) => {
              const working = doctor.workDays.includes(weekday(d));
              const h = humanDate(d);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!working}
                  aria-pressed={date === d}
                  onClick={() => {
                    setDate(d);
                    setTime(null);
                  }}
                  className={`grid w-16 shrink-0 justify-items-center rounded-xl border py-2 ${
                    date === d
                      ? "border-teal bg-teal text-white"
                      : working
                        ? "border-line bg-white hover:border-teal/50"
                        : "border-line bg-paper text-muted/50"
                  }`}
                >
                  <span className="text-xs">{d === today ? "Bugun" : h.weekday}</span>
                  <span className="text-lg font-bold">{Number(d.slice(8))}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4" aria-live="polite">
            {slots.status === "loading" ? <p className="text-muted">Bo&apos;sh vaqtlar yuklanmoqda…</p> : null}
            {slots.status === "error" ? (
              <p className="text-danger">
                Vaqtlarni yuklab bo&apos;lmadi.{" "}
                <button type="button" className="underline" onClick={() => setReload((n) => n + 1)}>
                  Qayta urinish
                </button>
              </p>
            ) : null}
            {slots.status === "ready" && slots.times.length === 0 ? (
              <p className="text-muted">Bu kunga bo&apos;sh vaqt qolmagan. Boshqa kunni tanlang.</p>
            ) : null}
            {slots.status === "ready" && slots.times.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {slots.times.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={time === t}
                    onClick={() => setTime(t)}
                    className={`rounded-xl border py-2.5 font-semibold tabular-nums ${
                      time === t ? "border-coral bg-coral text-white" : "border-line bg-white hover:border-coral/60"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Step>
      ) : null}

      {doctor && date && time ? (
        <Step n={4} title="Bemor ma'lumotlari">
          <form
            onSubmit={submit}
            onInput={() => {
              if (error) setError(null);
            }}
            noValidate
            className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6"
          >
            <p className="rounded-xl bg-mint px-4 py-3 text-sm text-teal-deep">
              <strong>{doctor.name}</strong> · {humanDate(date).long}, <strong>{time}</strong>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ism va familiya">
                <input name="patientName" autoComplete="name" required maxLength={80} className={inputClass} />
              </Field>
              <Field label="Telefon">
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  defaultValue="+998 "
                  required
                  maxLength={20}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <Field label="Tug'ilgan yil (ixtiyoriy)">
                <input name="birthYear" inputMode="numeric" maxLength={4} placeholder="1990" className={inputClass} />
              </Field>
              <Field label="Shikoyat (ixtiyoriy)">
                <input name="complaint" maxLength={300} placeholder="Qisqacha yozing" className={inputClass} />
              </Field>
            </div>
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            {error ? (
              <p role="alert" className="font-semibold text-danger">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={sending}
              className="rounded-xl bg-coral py-3.5 font-bold text-white hover:bg-coral-deep disabled:opacity-60"
            >
              {sending ? "Yuborilmoqda…" : "Qabulga yozilish"}
            </button>
            <p className="text-xs text-muted">
              Ma&apos;lumotlaringiz faqat qabulni tashkil qilish uchun ishlatiladi.
            </p>
          </form>
        </Step>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-base font-normal focus:border-teal focus:outline-2 focus:outline-teal/20";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="min-w-0">
      <h3 id={`step-${n}`} className="mb-3 flex items-center gap-3 text-lg font-bold">
        <span className="grid size-7 place-items-center rounded-full bg-teal text-sm text-white">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}
