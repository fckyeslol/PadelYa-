import type { Metadata, Viewport } from "next";
import { DM_Sans, Barlow_Condensed, DM_Mono } from "next/font/google";
import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentProfile } from "@/services/profiles/service";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0C0B08",
};

const SITE_URL = "https://www.padelya.co";
const SITE_DESCRIPTION =
  "Encuentra partidos de pádel abiertos en Barranquilla, únete con un clic y paga tu cupo en línea. Juega con gente de tu nivel, sin grupos de WhatsApp.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PadelYa! — Encuentra partidos de pádel en Barranquilla",
    template: "%s · PadelYa!",
  },
  description: SITE_DESCRIPTION,
  applicationName: "PadelYa!",
  keywords: [
    "pádel Barranquilla",
    "partidos de pádel",
    "canchas de pádel Barranquilla",
    "jugar pádel",
    "padel",
  ],
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PadelYa!",
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: SITE_URL,
    siteName: "PadelYa!",
    title: "PadelYa! — Encuentra partidos de pádel en Barranquilla",
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo.png", width: 329, height: 329, alt: "PadelYa!" }],
  },
  twitter: {
    card: "summary",
    title: "PadelYa! — Partidos de pádel en Barranquilla",
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

/** Organization structured data — helps Google understand the brand. */
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PadelYa!",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description:
    "Plataforma para encontrar y unirse a partidos de pádel en Barranquilla, Colombia.",
  areaServed: { "@type": "City", name: "Barranquilla" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isVenuePortal = pathname.startsWith("/cancha");

  const profile = isVenuePortal ? null : await getCurrentProfile().catch(() => null);

  return (
    <html
      lang="es"
      className={`${barlowCondensed.variable} ${dmSans.variable} ${dmMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {!isVenuePortal && (
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
        )}

        <main className="flex-1 flex flex-col">{children}</main>

        {!isVenuePortal && (
          <footer
            style={{
              background: "var(--surface)",
              borderTop: "1px solid var(--border)",
              color: "var(--text-3)",
            }}
            className="py-8"
          >
            <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    fontFamily: "var(--font-barlow, 'Barlow Condensed', sans-serif)",
                    fontWeight: 900,
                    fontSize: "1.1rem",
                    letterSpacing: "0.02em",
                    color: "var(--text)",
                    textTransform: "uppercase",
                  }}
                >
                  Padel<span style={{ color: "var(--primary)" }}>Ya!</span>
                </span>
                <span
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-3)",
                    fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
                  }}
                >
                  · Barranquilla, Colombia
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1.5rem",
                  fontSize: "0.78rem",
                  fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
                }}
              >
                <Link href="/terms" style={{ color: "var(--text-3)", textDecoration: "none" }}
                  className="hover:text-[var(--text-2)]">
                  Términos
                </Link>
                <Link href="/privacy" style={{ color: "var(--text-3)", textDecoration: "none" }}
                  className="hover:text-[var(--text-2)]">
                  Privacidad
                </Link>
                <Link href="/refund-policy" style={{ color: "var(--text-3)", textDecoration: "none" }}
                  className="hover:text-[var(--text-2)]">
                  Reembolsos
                </Link>
                <span>© 2026</span>
              </div>
            </div>
          </footer>
        )}
      </body>
    </html>
  );
}
