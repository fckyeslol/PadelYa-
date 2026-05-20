"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { VP } from "@/components/venue-portal/theme";

export function VenueLogoutButton({ minimal = false }: { minimal?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/cancha/auth/logout", { method: "POST" });
      router.push("/cancha/login");
      router.refresh();
    });
  }

  if (minimal) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: VP.sidebarText,
          fontSize: "0.8rem",
          padding: "0.25rem 0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          borderRadius: "6px",
        }}
      >
        <LogoutIcon />
        {pending ? "…" : "Salir"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      style={{
        width: "100%",
        padding: "0.6rem 0.85rem",
        borderRadius: "10px",
        border: `1px solid ${VP.sidebarBorder}`,
        background: VP.sidebarHover,
        color: VP.sidebarText,
        cursor: "pointer",
        fontSize: "0.82rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        transition: "all 0.15s ease",
      }}
    >
      <LogoutIcon />
      {pending ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
