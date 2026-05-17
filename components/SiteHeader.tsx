"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@/components/UserButton";

type Props = {
  profile: {
    fullName: string;
    avatarUrl: string | null;
    role: string;
  } | null;
};

export function SiteHeader({ profile }: Props) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header
      style={
        isHome
          ? undefined
          : {
              background: "rgba(247,248,252,0.92)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderBottom: "1.5px solid var(--border)",
              boxShadow: "0 1px 16px rgba(30,58,110,0.06)",
            }
      }
      className={`sticky top-0 z-50 ${isHome ? "site-header--home" : ""}`}
    >
      <nav className="mx-auto flex h-[3.75rem] max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="PadelYa!"
            width={36}
            height={36}
            style={{ borderRadius: "50%" }}
          />
          <span
            style={{
              fontFamily: "var(--font-syne)",
              fontWeight: 800,
              fontSize: "1.05rem",
              letterSpacing: "-0.02em",
              color: isHome ? "#ffffff" : "var(--text)",
            }}
          >
            {isHome ? (
              "PadelYa!"
            ) : (
              <>
                Padel<span style={{ color: "var(--primary)" }}>Ya!</span>
              </>
            )}
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/matches" isHome={isHome}>
            Partidos
          </NavLink>
          <NavLink href="/matches/new" isHome={isHome}>
            Crear partido
          </NavLink>
          <NavLink href="/players" isHome={isHome}>
            Jugadores
          </NavLink>
          {profile?.role === "organizer" ? (
            <NavLink href="/organizer" isHome={isHome}>
              Organizador
            </NavLink>
          ) : null}
        </div>

        {profile ? (
          <UserButton fullName={profile.fullName} avatarUrl={profile.avatarUrl} />
        ) : (
          <Link
            href="/login"
            style={{
              background: isHome ? "#c8f135" : "var(--primary)",
              color: isHome ? "#0f1629" : "#ffffff",
              borderRadius: isHome ? "999px" : "8px",
              padding: isHome ? "0.5rem 1rem" : "0.45rem 1.1rem",
              fontWeight: 700,
              fontSize: "0.85rem",
              fontFamily: "var(--font-dm-sans)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            Ingresar
            {isHome ? <span aria-hidden>→</span> : null}
          </Link>
        )}
      </nav>
    </header>
  );
}

function NavLink({
  href,
  children,
  isHome,
}: {
  href: string;
  children: React.ReactNode;
  isHome: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        color: isHome ? "rgba(255,255,255,0.9)" : "var(--text-2)",
        fontSize: "0.875rem",
        fontWeight: 500,
        padding: "0.4rem 0.875rem",
        borderRadius: "8px",
        transition: "color 0.15s ease, background-color 0.15s ease",
        fontFamily: "var(--font-dm-sans)",
        border: "1px solid transparent",
      }}
      className={
        isHome
          ? "hover:bg-white/10"
          : "hover:text-[var(--text)] hover:border-[var(--border)] hover:bg-[var(--card)]"
      }
    >
      {children}
    </Link>
  );
}
