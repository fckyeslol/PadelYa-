"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [homeScrolled, setHomeScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isHome) {
      setHomeScrolled(false);
      return;
    }
    const onScroll = () => setHomeScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const homeHeaderClass = isHome
    ? `site-header--home${homeScrolled ? " site-header--home-scrolled" : ""}`
    : "";

  const navLinks = [
    { href: "/matches", label: "Partidos" },
    { href: "/matches/new", label: "Crear partido" },
    { href: "/players", label: "Jugadores" },
    ...(profile?.role === "organizer" ? [{ href: "/organizer", label: "Organizador" }] : []),
  ];

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
      className={`sticky top-0 z-50 ${homeHeaderClass}`}
    >
      <nav className="mx-auto flex h-[3.75rem] max-w-6xl items-center justify-between px-5">
        {/* Logo */}
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
              fontFamily: "var(--font-montserrat)",
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

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <NavLink key={link.href} href={link.href} isHome={isHome}>
              {link.label}
            </NavLink>
          ))}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          {profile ? (
            <UserButton fullName={profile.fullName} avatarUrl={profile.avatarUrl} />
          ) : (
            <Link
              href="/login"
              className="hidden md:inline-flex items-center gap-1"
              style={{
                background: isHome ? "#c8f135" : "var(--primary)",
                color: isHome ? "#0f1629" : "#ffffff",
                borderRadius: isHome ? "999px" : "8px",
                padding: isHome ? "0.5rem 1rem" : "0.45rem 1.1rem",
                fontWeight: 700,
                fontSize: "0.85rem",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              Ingresar {isHome && <span aria-hidden>→</span>}
            </Link>
          )}

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex items-center"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileOpen}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.4rem",
              color: isHome ? "#ffffff" : "var(--text)",
              borderRadius: "8px",
            }}
          >
            {mobileOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden"
          style={{
            background: isHome ? "rgba(10,47,122,0.97)" : "rgba(247,248,252,0.97)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: `1px solid ${isHome ? "rgba(255,255,255,0.12)" : "var(--border)"}`,
            padding: "0.5rem 1.25rem 1rem",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                style={{
                  color: isHome ? "rgba(255,255,255,0.9)" : "var(--text)",
                  padding: "0.7rem 0.75rem",
                  borderRadius: "10px",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  fontFamily: "var(--font-dm-sans)",
                  textDecoration: "none",
                  display: "block",
                  transition: "background 0.15s",
                }}
                className="hover:bg-white/10"
              >
                {link.label}
              </Link>
            ))}

            {!profile && (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                style={{
                  marginTop: "0.5rem",
                  background: isHome ? "#c8f135" : "var(--primary)",
                  color: isHome ? "#0f1629" : "#ffffff",
                  borderRadius: "10px",
                  padding: "0.75rem 1rem",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  fontFamily: "var(--font-dm-sans)",
                  textDecoration: "none",
                  textAlign: "center",
                  display: "block",
                }}
              >
                Ingresar →
              </Link>
            )}
          </div>
        </div>
      )}
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

function MenuIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
