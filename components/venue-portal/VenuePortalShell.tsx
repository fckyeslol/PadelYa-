"use client";

import { useState } from "react";
import { VenueDashboard } from "./VenueDashboard";
import { VenueScheduleBoard } from "./VenueScheduleBoard";
import { VenueLogoutButton } from "./VenueLogoutButton";
import { VP } from "./theme";

type View = "dashboard" | "agenda";

export function VenuePortalShell({ venueName }: { venueName: string }) {
  const [view, setView] = useState<View>("dashboard");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: VP.bg }}>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex"
        style={{
          width: "230px",
          background: VP.sidebar,
          flexDirection: "column",
          position: "fixed",
          inset: "0 auto 0 0",
          zIndex: 40,
        }}
      >
        <div style={{ padding: "2rem 1.5rem 1.5rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.6rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.28)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Portal de Cancha
          </p>
          <h1
            style={{
              margin: "0.45rem 0 0",
              fontSize: "1.05rem",
              fontWeight: 700,
              color: VP.sidebarTextActive,
              fontFamily: VP.fontDisplay,
              lineHeight: 1.25,
            }}
          >
            {venueName}
          </h1>
        </div>

        <div style={{ height: "1px", background: VP.sidebarBorder, margin: "0 1.5rem 1.25rem" }} />

        <nav
          style={{
            flex: 1,
            padding: "0 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <SidebarItem
            label="Resumen"
            icon={<IconChart />}
            active={view === "dashboard"}
            onClick={() => setView("dashboard")}
          />
          <SidebarItem
            label="Agenda"
            icon={<IconCalendar />}
            active={view === "agenda"}
            onClick={() => setView("agenda")}
          />
        </nav>

        <div style={{ padding: "1.25rem 1rem 2rem" }}>
          <VenueLogoutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header
        className="flex md:hidden"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: VP.sidebar,
          padding: "0.8rem 1rem",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "56px",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "0.58rem",
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Portal de Cancha
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 700,
              color: VP.sidebarTextActive,
              fontFamily: VP.fontDisplay,
            }}
          >
            {venueName}
          </p>
        </div>
        <VenueLogoutButton minimal />
      </header>

      {/* Main */}
      <main className="md:ml-[230px] mt-[56px] md:mt-0" style={{ flex: 1, minWidth: 0 }}>
        {view === "dashboard" ? (
          <VenueDashboard onGoToAgenda={() => setView("agenda")} />
        ) : (
          <VenueScheduleBoard embedded />
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav
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
        <BottomNavItem
          label="Resumen"
          icon={<IconChart />}
          active={view === "dashboard"}
          onClick={() => setView("dashboard")}
        />
        <BottomNavItem
          label="Agenda"
          icon={<IconCalendar />}
          active={view === "agenda"}
          onClick={() => setView("agenda")}
        />
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.65rem",
        width: "100%",
        padding: "0.7rem 0.9rem",
        borderRadius: "10px",
        border: "none",
        cursor: "pointer",
        background: active ? VP.sidebarHover : "transparent",
        color: active ? VP.sidebarTextActive : VP.sidebarText,
        fontSize: "0.88rem",
        fontWeight: active ? 600 : 400,
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
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.2rem",
        padding: "0.6rem 0 0.9rem",
        border: "none",
        cursor: "pointer",
        background: "transparent",
        color: active ? VP.sidebarTextActive : VP.sidebarText,
        fontSize: "0.68rem",
        fontWeight: active ? 600 : 400,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="18" y="3" width="4" height="18" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="2" y="13" width="4" height="8" rx="1" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
