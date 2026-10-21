import { BookingFlow } from "@/components/BookingFlow";
import { listDepartments, listDoctors, listServices } from "@/lib/clinic";
import { CLINIC } from "@/lib/config";
import { SCHEDULE, formatSum, todayLocal } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [departments, doctors, services] = await Promise.all([listDepartments(), listDoctors(), listServices()]);
  const phoneHref = `tel:${CLINIC.phone.replace(/[^\d+]/g, "")}`;
  const publicDoctors = doctors.map((d) => ({
    id: d.id,
    departmentId: d.departmentId,
    name: d.name,
    title: d.title,
    workDays: d.workDays,
    startHour: d.startHour,
    endHour: d.endHour,
    slotMinutes: d.slotMinutes,
  }));
  const bookable = departments.filter((dep) => doctors.some((d) => d.departmentId === dep.id));

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
          <a href="#" className="flex items-center gap-2.5 text-lg font-extrabold">
            <span className="cross size-6 bg-coral" aria-hidden="true" />
            {CLINIC.name}
          </a>
          <nav className="ml-auto hidden gap-6 text-muted sm:flex" aria-label="Asosiy menyu">
            <a href="#prices" className="hover:text-ink">Narxlar</a>
            <a href="#book" className="hover:text-ink">Yozilish</a>
            <a href="#contact" className="hover:text-ink">Manzil</a>
          </nav>
          <a href={phoneHref} className="ml-auto font-bold whitespace-nowrap text-teal sm:ml-0">
            {CLINIC.phone}
          </a>
        </div>
      </header>

      <main>
        <section className="bg-teal text-white">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 pt-12 pb-16 sm:pt-20 sm:pb-24 md:grid-cols-[1.3fr_0.7fr] md:items-center">
            <div>
              <p className="text-white/70">{CLINIC.tagline}</p>
              <h1 className="mt-3 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
                Navbatsiz qabul — shifokor va vaqtni o&apos;zingiz tanlang
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/85">
                Bo&apos;sh vaqtlar real vaqtda ko&apos;rinadi. Yozilganingizdan keyin qabul sahifasi ochiladi — u yerdan bekor
                qilishingiz ham mumkin.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#book" className="rounded-xl bg-coral px-6 py-3.5 font-bold hover:bg-coral-deep">
                  Qabulga yozilish
                </a>
                <a href="#prices" className="rounded-xl bg-white/12 px-6 py-3.5 font-bold hover:bg-white/20">
                  Narxlarni ko&apos;rish
                </a>
              </div>
            </div>
            <dl className="grid gap-px overflow-hidden rounded-2xl bg-white/15 text-ink">
              <div className="bg-white px-6 py-4">
                <dt className="text-sm text-muted">Ish vaqti</dt>
                <dd className="text-lg font-bold">{CLINIC.hours}</dd>
              </div>
              <div className="bg-white px-6 py-4">
                <dt className="text-sm text-muted">Shifokorlar</dt>
                <dd className="text-lg font-bold">{doctors.length} ta, {bookable.length} yo&apos;nalish</dd>
              </div>
              <div className="bg-white px-6 py-4">
                <dt className="text-sm text-muted">Yozilish</dt>
                <dd className="text-lg font-bold">{SCHEDULE.daysAhead} kun oldinga</dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="prices" aria-labelledby="prices-title" className="mx-auto max-w-5xl px-4 py-16">
          <h2 id="prices-title" className="text-3xl font-extrabold sm:text-4xl">
            Xizmatlar va narxlar
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {departments.map((dep) => {
              const list = services.filter((s) => s.departmentId === dep.id);
              if (list.length === 0) return null;
              return (
                <div key={dep.id} className="rounded-2xl border border-line bg-white p-5">
                  <h3 className="font-bold text-teal">{dep.name}</h3>
                  <ul className="mt-3 grid gap-2">
                    {list.map((s) => (
                      <li key={s.id} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0 last:pb-0">
                        <span>{s.name}</span>
                        <span className="font-semibold whitespace-nowrap tabular-nums">{formatSum(s.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section id="book" aria-labelledby="book-title" className="bg-mint/60">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 id="book-title" className="text-3xl font-extrabold sm:text-4xl">
              Qabulga yozilish
            </h2>
            <p className="mt-2 mb-8 text-muted">To&apos;rt qadam, bir daqiqa. Telefon qilish shart emas.</p>
            <BookingFlow
              departments={bookable}
              doctors={publicDoctors}
              today={todayLocal()}
              daysAhead={SCHEDULE.daysAhead}
            />
          </div>
        </section>

        <section id="contact" aria-labelledby="contact-title" className="mx-auto grid max-w-5xl gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <h2 id="contact-title" className="text-3xl font-extrabold">
              Manzil
            </h2>
            <dl className="mt-6 grid gap-4">
              <div>
                <dt className="text-sm text-muted">Manzil</dt>
                <dd className="font-semibold">{CLINIC.address}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Ish vaqti</dt>
                <dd className="font-semibold">{CLINIC.hours}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Telefon</dt>
                <dd className="font-semibold">
                  <a href={phoneHref} className="hover:underline">
                    {CLINIC.phone}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
          <iframe
            title="Xaritada manzil"
            loading="lazy"
            className="aspect-[4/3] w-full rounded-2xl border-0 bg-line"
            src={`https://maps.google.com/maps?q=${CLINIC.map.lat},${CLINIC.map.lng}&z=15&output=embed`}
          />
        </section>
      </main>

      <footer className="bg-teal-deep py-6 text-sm text-white/70">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-2 px-4">
          <span>© {new Date().getFullYear()} {CLINIC.name}</span>
          <span>Demo-loyiha · Next.js, TypeScript, PostgreSQL</span>
        </div>
      </footer>
    </>
  );
}
