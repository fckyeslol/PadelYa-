"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function VenueLogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/cancha/auth/logout", { method: "POST" });
      router.push("/cancha/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      style={{
        padding: "0.5rem 1rem",
        borderRadius: "10px",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text-2)",
        cursor: "pointer",
        fontSize: "0.85rem",
      }}
    >
      {pending ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
