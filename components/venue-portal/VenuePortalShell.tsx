"use client";

import { useState } from "react";
import { VenueDashboard } from "./VenueDashboard";
import { VenueScheduleBoard } from "./VenueScheduleBoard";
import { VenuePricingBoard } from "./VenuePricingBoard";
import { VenueHoursPanel } from "./VenueHoursPanel";
import { VenueCourtsPanel } from "./VenueCourtsPanel";
import { VenueAccountPanel } from "./VenueAccountPanel";
import { VenueLogoutButton } from "./VenueLogoutButton";
import { VP } from "./theme";

type View = "dashboard" | "agenda" | "precios" | "horarios" | "canchas" | "cuenta";

type NavEntry = { id: View; label: string; short: string; icon: React.ReactNode };

const NAV: NavEntry[] = [
  { id: "dashboard", label: "Resumen", short: "Resumen", icon: <IconChart /> },
  { id: "agenda", label: "Agenda", short: "Agenda", icon: <IconCalendar /> },
  { id: "precios", label: "Tarifario", short: "Precios", icon: <IconTag /> },
  { id: "horarios", label: "Horarios", short: "Horarios", icon: <IconClock /> },
  { id: "canchas", label: "Canchas", short: "Canchas", icon: <IconCourt /> },
  { id: "cuenta", label: "Cuenta", short: "Cuenta", icon: <IconKey /> },
];

/** En móvil la barra inferior lleva las 4 tareas frecuentes; el resto va en el menú. */
const MOBILE_NAV = NAV.filter((n) => n.id !== "canchas" && n.id !== "cuenta");
const MOBILE_OVERFLOW = NAV.filter((n) => n.id === "canchas" || n.id === "cuenta");

export function VenuePortalShell({ venueName }: { venueName: string }) {
  const [view, setView] = useState<View>("dashboard");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: VP.bg }}>
      {/* Barra lateral (escritorio) */}
      <aside
        className="hidden md:flex"
        style={{
          width: "236px",
          background: VP.sidebar,
          borderRight: `1px solid ${VP.sidebarBorder}`,
          flexDirection: "column",
          position: "fixed",
          inset: "0 auto 0 0",
          zIndex: 40,
        }}
      >
        <div style={{ padding: "1.9rem 1.4rem 1.3rem" }}>
          <p
            style={{
              margin: 0,
              fontFamily: VP.fontDisplay,
              fontSize: "0.68rem",
              fontWeight: 600,
              color: VP.primary,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Portal de cancha
          </p>
          <h1
            style={{
              margin: "0.5rem 0 0",
              fontSize: "1.35rem",
              fontWeight: 700,
              color: VP.text,
              fontFamily: VP.fontDisplay,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            {venueName}
          </h1>
        </div>

        <div style={{ height: "1px", background: VP.sidebarBorder, margin: "0 1.4rem 1rem" }} />

        <nav
          aria-label="Secciones del portal"
          style={{ flex: 1, padding: "0 0.7rem", display: "flex", flexDirection: "column", gap: "2px" }}
        >
          {NAV.map((entry) => (
            <SidebarItem
              key={entry.id}
              label={entry.label}
              icon={entry.icon}
              active={view === entry.id}
              onClick={() => setView(entry.id)}
            />
          ))}
        </nav>

        <div style={{ padding: "1.2rem 1rem 1.9rem" }}>
          <VenueLogoutButton />
        </div>
      </aside>

      {/* Cabecera (móvil) */}
      <header
        className="flex md:hidden"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: VP.sidebar,
          borderBottom: `1px solid ${VP.sidebarBorder}`,
          padding: "0.7rem 1rem",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "58px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontFamily: VP.fontDisplay,
              fontSize: "0.6rem",
              color: VP.primary,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Portal de cancha
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 700,
              color: VP.text,
              fontFamily: VP.fontDisplay,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {venueName}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
          {MOBILE_OVERFLOW.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setView(entry.id)}
              aria-label={entry.label}
              aria-current={view === entry.id ? "page" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                background: view === entry.id ? VP.primaryMuted : "transparent",
                color: view === entry.id ? VP.primary : VP.sidebarText,
              }}
            >
              {entry.icon}
            </button>
          ))}
          <VenueLogoutButton minimal />
        </div>
      </header>

      <main className="md:ml-[236px] mt-[58px] md:mt-0" style={{ flex: 1, minWidth: 0 }}>
        {view === "dashboard" && <VenueDashboard onGoToAgenda={() => setView("agenda")} />}
        {view === "agenda" && <VenueScheduleBoard embedded />}
        {view === "precios" && <VenuePricingBoard />}
        {view === "horarios" && <VenueHoursPanel />}
        {view === "canchas" && <VenueCourtsPanel />}
        {view === "cuenta" && <VenueAccountPanel />}
      </main>

      {/* Barra inferior (móvil) */}
      <nav
        aria-label="Secciones del portal"
        className="flex md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: VP.sidebar,
          borderTop: `1px solid ${VP.sidebarBorder}`,
        }}
      >
        {MOBILE_NAV.map((entry) => (
          <BottomNavItem
            key={entry.id}
            label={entry.short}
            icon={entry.icon}
            active={view === entry.id}
            onClick={() => setView(entry.id)}
          />
        ))}
      </nav>
    </div>
  );
}

function SidebarItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.7rem",
        width: "100%",
        minHeight: "44px",
        padding: "0.65rem 0.85rem",
        borderRadius: "10px",
        border: "none",
        cursor: "pointer",
        background: active ? VP.primary : "transparent",
        color: active ? VP.sidebarTextActive : VP.sidebarText,
        fontFamily: VP.fontBody,
        fontSize: "0.9rem",
        fontWeight: active ? 700 : 500,
        textAlign: "left",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function BottomNavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.22rem",
        minHeight: "58px",
        padding: "0.55rem 0 0.85rem",
        border: "none",
        borderTop: `2px solid ${active ? VP.primary : "transparent"}`,
        cursor: "pointer",
        background: "transparent",
        color: active ? VP.primary : VP.sidebarText,
        fontFamily: VP.fontBody,
        fontSize: "0.66rem",
        fontWeight: active ? 700 : 500,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

const iconProps = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconChart() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <rect x="18" y="3" width="4" height="18" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="2" y="13" width="4" height="8" rx="1" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

/** Una cancha de pádel vista desde arriba: rectángulo, red al medio, líneas de saque. */
function IconCourt() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="7" y1="4" x2="7" y2="20" />
      <line x1="17" y1="4" x2="17" y2="20" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="m10.85 12.15 8.4-8.4" />
      <path d="m18 6 2 2" />
      <path d="m15 9 2 2" />
    </svg>
  );
}
