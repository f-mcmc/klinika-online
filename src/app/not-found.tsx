import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-content-center px-4 text-center">
      <h1 className="text-3xl font-bold">Sahifa topilmadi</h1>
      <p className="mt-2 text-muted">Havola eskirgan yoki noto&apos;g&apos;ri yozilgan.</p>
      <Link href="/" className="mt-6 font-semibold text-teal hover:underline">
        Bosh sahifaga qaytish
      </Link>
    </main>
  );
}
