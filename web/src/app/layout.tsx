import type { Metadata } from "next";
import { Overpass, Overpass_Mono } from "next/font/google";
import "./globals.css";

const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const overpassMono = Overpass_Mono({
  variable: "--font-overpass-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "NILT", template: "%s · NILT" },
  description: "Núcleo Integrado de Logística e Transporte — Prisa Logística",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${overpass.variable} ${overpassMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
