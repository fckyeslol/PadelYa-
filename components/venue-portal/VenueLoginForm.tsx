"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function VenueLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/cancha/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo iniciar sesión");
        return;
      }
      router.push("/cancha");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        width: "100%",
        maxWidth: "360px",
      }}
    >
      <div>
        <label htmlFor="venue-user" style={{ display: "block", fontSize: "0.85rem", color: "var(--text-2)", marginBottom: "0.35rem" }}>
          Usuario
        </label>
        <input
          id="venue-user"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Ej: LaJaula"
          required
          style={{
            width: "100%",
            padding: "0.65rem 0.85rem",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
          }}
        />
      </div>
      <div>
        <label htmlFor="venue-pass" style={{ display: "block", fontSize: "0.85rem", color: "var(--text-2)", marginBottom: "0.35rem" }}>
          Contraseña
        </label>
        <input
          id="venue-pass"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "0.65rem 0.85rem",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
          }}
        />
      </div>
      {error && (
        <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>{error}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar al portal"}
      </Button>
    </form>
  );
}
