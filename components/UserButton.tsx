"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeDisplayName } from "@/utils/name";

interface UserButtonProps {
  fullName: string;
  avatarUrl?: string | null;
}

/** "Mateo Pirela" → "MateoP" · email → "mateo" */
function formatHandle(fullName: string): string {
  const safeName = sanitizeDisplayName(fullName, "Jugador");
  const parts = safeName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return fullName;
  const first = parts[0];
  const lastInitial = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : "";
  return first + lastInitial;
}

/** "Mateo Pirela" → "MP" */
function initials(fullName: string): string {
  const safeName = sanitizeDisplayName(fullName, "Jugador");
  const parts = safeName.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0][0]?.toUpperCase() ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0]?.toUpperCase() ?? "") : "";
  return first + last || "?";
}

export function UserButton({ fullName, avatarUrl }: UserButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function signOut() {
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    });
  }

  const safeName = sanitizeDisplayName(fullName, "Jugador");
  const handle = formatHandle(safeName);
  const avatar = initials(safeName);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "0.35rem 0.75rem 0.35rem 0.35rem",
          cursor: "pointer",
          transition: "border-color 0.15s ease, background-color 0.15s ease",
          fontFamily: "var(--font-dm-sans)",
        }}
        className="hover:border-[var(--primary)] hover:bg-[var(--card-hover,var(--card))]"
      >
        {/* Avatar */}
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={fullName}
            width={26}
            height={26}
            style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <span
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              background: "var(--primary)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.65rem",
              fontWeight: 800,
              flexShrink: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {avatar}
          </span>
        )}

        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: "-0.01em",
            maxWidth: "120px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {handle}
        </span>

        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--text-3)"
          strokeWidth={2}
          style={{
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: "200px",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "0.375rem",
            zIndex: 100,
          }}
        >
          {/* Profile preview */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.6rem 0.75rem 0.75rem",
              borderBottom: "1px solid var(--border)",
              marginBottom: "0.375rem",
            }}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={fullName}
                width={36}
                height={36}
                style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <span
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "var(--primary)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {avatar}
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.2 }}>
                {safeName}
              </p>
            </div>
          </div>

          <DropdownItem href="/profile" onClick={() => setOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="8" r="4" />
              <path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            Mi perfil
          </DropdownItem>

          <DropdownItem href="/players" onClick={() => setOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5V4H2v16h5m10 0v-3a3 3 0 00-3-3H10a3 3 0 00-3 3v3m10 0H7m5-8a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
            Comunidad
          </DropdownItem>

          <DropdownItem href={`/players/me`} onClick={() => setOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c2.21 0 4-1.79 4-4S14.21 3 12 3 8 4.79 8 7s1.79 4 4 4zm0 2c-3.314 0-6 2.239-6 5v2h12v-2c0-2.761-2.686-5-6-5z" />
            </svg>
            Mi perfil público
          </DropdownItem>

          <DropdownItem href="/payments" onClick={() => setOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25h18M3 9h18M6.75 14.25h4.5M6.75 16.5h3M5.25 19.5h13.5A2.25 2.25 0 0021 17.25V6.75A2.25 2.25 0 0018.75 4.5H5.25A2.25 2.25 0 003 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Mis pagos
          </DropdownItem>

          <DropdownItem onClick={() => { setOpen(false); signOut(); }} danger disabled={pending}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            {pending ? "Saliendo..." : "Cerrar sesión"}
          </DropdownItem>
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  href,
  onClick,
  children,
  danger,
  disabled,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    width: "100%",
    padding: "0.5rem 0.75rem",
    borderRadius: "8px",
    fontSize: "0.85rem",
    fontWeight: 500,
    color: danger ? "var(--danger, #f87171)" : "var(--text-2)",
    fontFamily: "var(--font-dm-sans)",
    background: "none",
    border: "none",
    cursor: disabled ? "default" : "pointer",
    textDecoration: "none",
    transition: "background-color 0.12s ease, color 0.12s ease",
    opacity: disabled ? 0.5 : 1,
  };

  if (href) {
    return (
      <Link href={href} onClick={onClick} style={style} className="hover:bg-[var(--card-hover)] hover:text-[var(--text)]">
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} style={style} className="hover:bg-[var(--card-hover)] hover:text-[var(--text)]">
      {children}
    </button>
  );
}
