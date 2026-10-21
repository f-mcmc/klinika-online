import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { isAdmin } from "@/lib/auth";
import { listDepartments, listDoctors, listServices } from "@/lib/clinic";
import { WEEKDAY_SHORT } from "@/lib/schedule";
import {
  addDoctorAction,
  addServiceAction,
  toggleDoctorAction,
  toggleServiceAction,
  updatePriceAction,
  updateScheduleAction,
} from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shifokorlar va narxlar — admin", robots: { index: false } };

const input = "min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm";
/** Dushanbadan boshlab */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const HOURS = Array.from({ length: 25 }, (_, i) => i);
const SLOTS = [15, 20, 30, 40, 60] as const;

function ScheduleFields({ days, start, end, slot }: { days: number[]; start: number; end: number; slot: number }) {
  return (
    <>
      <fieldset className="flex flex-wrap gap-1">
        <legend className="sr-only">Ish kunlari</legend>
        {WEEK_ORDER.map((d) => (
          <label key={d} className="cursor-pointer">
            <input type="checkbox" name="workDays" value={d} defaultChecked={days.includes(d)} className="peer sr-only" />
            <span className="block rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted peer-checked:border-teal peer-checked:bg-teal peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-coral">
              {WEEKDAY_SHORT[d]}
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-1 text-sm">
        <span className="sr-only">Boshlanish</span>
        <select name="startHour" defaultValue={start} className={input} aria-label="Boshlanish soati">
          {HOURS.slice(0, 24).map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
        –
        <select name="endHour" defaultValue={end} className={input} aria-label="Tugash soati">
          {HOURS.slice(1).map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </label>
      <select name="slotMinutes" defaultValue={slot} className={input} aria-label="Bitta qabul davomiyligi">
        {SLOTS.map((s) => (
          <option key={s} value={s}>
            {s} daq
          </option>
        ))}
      </select>
    </>
  );
}

export default async function SettingsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const [departments, doctors, services] = await Promise.all([listDepartments(), listDoctors(true), listServices(true)]);

  return (
    <>
      <AdminHeader current="settings" />
      <main className="mx-auto grid max-w-6xl gap-12 px-4 py-8">
        <section aria-labelledby="doctors-title">
          <h1 id="doctors-title" className="text-2xl font-extrabold">
            Shifokorlar
          </h1>
          <p className="mt-1 text-sm text-muted">
            Ish kunlari, soatlari va bitta qabul davomiyligi. O&apos;zgarish saytda darhol bo&apos;sh vaqtlarga ta&apos;sir qiladi;
            avval yozilgan qabullar saqlanib qoladi.
          </p>
          <ul className="mt-4 grid gap-2">
            {doctors.map((d) => (
              <li
                key={d.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${d.active ? "border-line bg-white" : "border-dashed border-line bg-line/40"}`}
              >
                <div className="min-w-48 flex-1">
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-sm text-muted">
                    {d.departmentName} · {d.title}
                  </p>
                </div>
                <form action={updateScheduleAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={d.id} />
                  <ScheduleFields days={d.workDays} start={d.startHour} end={d.endHour} slot={d.slotMinutes} />
                  <button type="submit" className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-mint">
                    Saqlash
                  </button>
                </form>
                <form action={toggleDoctorAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="active" value={String(!d.active)} />
                  <button
                    type="submit"
                    className={`w-28 rounded-lg px-3 py-2 text-sm font-semibold ${
                      d.active ? "bg-danger/10 text-danger hover:bg-danger/20" : "bg-teal text-white hover:bg-teal-deep"
                    }`}
                  >
                    {d.active ? "Yashirish" : "Qaytarish"}
                  </button>
                </form>
              </li>
            ))}
          </ul>

          <Card title="Yangi shifokor">
            <form action={addDoctorAction} className="flex flex-wrap items-center gap-2">
              <select name="departmentId" required className={input} aria-label="Yo'nalish">
                {departments.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}
                  </option>
                ))}
              </select>
              <input name="name" required minLength={3} maxLength={60} placeholder="Ism familiya" aria-label="Ism familiya" className={`${input} flex-1 basis-40`} />
              <input name="title" maxLength={80} placeholder="Mutaxassisligi, tajribasi" aria-label="Mutaxassisligi" className={`${input} flex-[2] basis-56`} />
              <ScheduleFields days={[1, 2, 3, 4, 5]} start={9} end={17} slot={30} />
              <button type="submit" className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-deep">
                + Qo&apos;shish
              </button>
            </form>
          </Card>
        </section>

        <section aria-labelledby="services-title">
          <h2 id="services-title" className="text-2xl font-extrabold">
            Xizmatlar va narxlar
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {departments.map((dep) => (
              <div key={dep.id} className="rounded-2xl border border-line bg-white p-4">
                <h3 className="font-bold text-teal">{dep.name}</h3>
                <ul className="mt-3 grid gap-2">
                  {services
                    .filter((s) => s.departmentId === dep.id)
                    .map((s) => (
                      <li key={s.id} className={`flex flex-wrap items-center gap-2 ${s.active ? "" : "opacity-55"}`}>
                        <span className="min-w-36 flex-1 text-sm">{s.name}</span>
                        <form action={updatePriceAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={s.id} />
                          <input
                            name="price"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1000}
                            defaultValue={s.price}
                            aria-label={`${s.name} narxi, so'm`}
                            className={`${input} w-28 tabular-nums`}
                          />
                          <button type="submit" className="rounded-lg border border-line px-2.5 py-2 text-xs font-semibold hover:bg-mint">
                            Saqlash
                          </button>
                        </form>
                        <form action={toggleServiceAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="active" value={String(!s.active)} />
                          <button type="submit" className="rounded-lg px-2.5 py-2 text-xs font-semibold text-muted hover:text-ink">
                            {s.active ? "Yashirish" : "Qaytarish"}
                          </button>
                        </form>
                      </li>
                    ))}
                </ul>
                <form action={addServiceAction} className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <input type="hidden" name="departmentId" value={dep.id} />
                  <input name="name" required minLength={2} maxLength={80} placeholder="Yangi xizmat" aria-label="Yangi xizmat nomi" className={`${input} flex-1 basis-36`} />
                  <input name="price" type="number" inputMode="numeric" min={0} step={1000} required placeholder="Narx" aria-label="Narx, so'm" className={`${input} w-28`} />
                  <button type="submit" className="rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-deep">
                    + Qo&apos;shish
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-line p-4">
      <h3 className="mb-3 text-sm font-bold text-muted">{title}</h3>
      {children}
    </div>
  );
}
