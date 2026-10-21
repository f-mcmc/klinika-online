"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Bemor qabulni o'zi bekor qiladi (ikki bosqichli tasdiq bilan). */
export function CancelButton({ code }: { code: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${code}/cancel`, { method: "POST" });
      if (res.ok) {
        router.refresh();
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      setError(
        typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "Bekor qilib bo'lmadi.",
      );
    } catch {
      setError("Internet bilan aloqa yo'q.");
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  return (
    <div className="grid gap-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Qabulni bekor qilasizmi?</span>
          <button
            type="button"
            onClick={cancel}
            disabled={sending}
            className="rounded-xl bg-danger px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {sending ? "Bekor qilinmoqda…" : "Ha, bekor qilish"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-xl border border-line px-4 py-2 font-semibold">
            Yo&apos;q
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="justify-self-start rounded-xl border border-line px-4 py-2 font-semibold text-danger hover:bg-danger/5"
        >
          Qabulni bekor qilish
        </button>
      )}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
