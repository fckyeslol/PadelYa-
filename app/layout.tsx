import type { Metadata } from "next";
import { Syne, DM_Sans, Montserrat } from "next/font/google";
import Link from "next/link";
import { getCurrentProfile } from "@/services/profiles/service";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PadelYa! — El pádel de Barranquilla",
  description: "Encuentra partidos de pádel abiertos en Barranquilla. Únete, paga y juega.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getCurrentProfile().catch(() => null);

  return (
    <html lang="es" className={`${syne.variable} ${dmSans.variable} ${montserrat.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <SiteHeader
          profile={
            profile
              ? {
                  fullName: profile.fullName,
                  avatarUrl: profile.avatarUrl ?? null,
                  role: profile.role,
                }
              : null
          }
        />

        <main className="flex-1 flex flex-col">{children}</main>

        <footer
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-3)" }}
          className="py-6 text-center text-xs"
        >
          <div
            style={{
              fontFamily: "var(--font-dm-sans)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <span>© 2026 PadelYa! · Barranquilla, Colombia</span>
            <span aria-hidden>·</span>
            <Link href="/terms" style={{ textDecoration: "underline" }}>
              Términos
            </Link>
            <Link href="/privacy" style={{ textDecoration: "underline" }}>
              Privacidad
            </Link>
            <Link href="/refund-policy" style={{ textDecoration: "underline" }}>
              Reembolsos
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
