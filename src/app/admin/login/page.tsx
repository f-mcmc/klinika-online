import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { demoCredentials, isAdmin } from "@/lib/auth";
import { CLINIC } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kirish — qabulxona", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;
  const demo = demoCredentials();

  return (
    <main className="grid min-h-dvh place-items-center bg-teal px-4">
      <form action="/api/admin/login" method="post" className="w-full max-w-sm rounded-3xl bg-paper p-8">
        <p className="flex items-center gap-2 text-xl font-extrabold">
          <span className="cross size-5 bg-coral" aria-hidden="true" />
          {CLINIC.name}
        </p>
        <h1 className="mt-1 text-sm text-muted">Qabulxona: qabullar, shifokorlar va narxlar</h1>
        {demo ? (
          <p className="mt-4 rounded-xl bg-mint px-4 py-3 text-sm">
            Demo: login <strong>{demo.login}</strong>, parol <strong>{demo.password}</strong>
          </p>
        ) : null}
        <label className="mt-6 grid gap-1.5 text-sm font-semibold">
          Login
          <input name="login" required autoComplete="username" className="rounded-xl border border-line bg-white px-4 py-3 text-base font-normal" />
        </label>
        <label className="mt-4 grid gap-1.5 text-sm font-semibold">
          Parol
          <input name="password" type="password" required autoComplete="current-password" className="rounded-xl border border-line bg-white px-4 py-3 text-base font-normal" />
        </label>
        {error ? (
          <p className="mt-4 font-semibold text-danger" role="alert">
            Login yoki parol noto&apos;g&apos;ri.
          </p>
        ) : null}
        <button type="submit" className="mt-6 w-full rounded-2xl bg-teal py-3.5 font-semibold text-white hover:bg-teal-deep">
          Kirish
        </button>
        <a href="/" className="mt-4 block text-center text-sm text-muted hover:text-ink">
          Saytga qaytish
        </a>
      </form>
    </main>
  );
}
