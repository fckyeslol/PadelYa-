"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { VP, vpInputStyle, vpLabelStyle } from "@/components/venue-portal/theme";

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
      }}
    >
      <div>
        <label htmlFor="venue-user" style={vpLabelStyle}>
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
          style={vpInputStyle}
        />
      </div>
      <div>
        <label htmlFor="venue-pass" style={vpLabelStyle}>
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
          style={vpInputStyle}
        />
      </div>
      {error && (
        <p style={{ color: VP.danger, fontSize: "0.85rem", margin: 0 }}>{error}</p>
      )}
      <Button type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Entrando…" : "Entrar al portal"}
      </Button>
    </form>
  );
}
