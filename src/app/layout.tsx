import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { CLINIC } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${CLINIC.name} — qabulga onlayn yozilish`,
  description: "Terapiya, stomatologiya, pediatriya va diagnostika. Shifokor va bo'sh vaqtni tanlab, bir daqiqada qabulga yoziling.",
};

export const viewport: Viewport = { themeColor: "#0f5e63" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
