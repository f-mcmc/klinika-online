import Link from "next/link";
import { CLINIC } from "@/lib/config";

export function AdminHeader({ current }: { current: "day" | "settings" }) {
  const tab = (key: "day" | "settings", href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${
        current === key ? "bg-white text-teal-deep" : "text-white/80 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <header className="bg-teal-deep text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <span className="flex items-center gap-2 font-bold">
          <span className="cross size-5 bg-coral" aria-hidden="true" />
          {CLINIC.name} · Qabulxona
        </span>
        <nav className="flex gap-1" aria-label="Admin bo'limlari">
          {tab("day", "/admin", "Qabullar")}
          {tab("settings", "/admin/settings", "Shifokorlar va narxlar")}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <Link href="/" className="text-white/80 hover:text-white">
            Saytga
          </Link>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="text-white/80 hover:text-white">
              Chiqish
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
