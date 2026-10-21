"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Admin sahifasini har N soniyada yangilaydi — yangi buyurtmalar o'zi chiqadi. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);
  return null;
}
