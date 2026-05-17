"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

type Skill = "beginner" | "intermediate" | "advanced";

export function ProfileForm() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [skillLevel, setSkillLevel] = useState<Skill>("intermediate");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function saveProfile() {
    startTransition(async () => {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, skillLevel }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      setMessage({
        text: payload.message ?? payload.error ?? "Perfil guardado",
        ok: response.ok,
      });
    });
  }

  return (
    <div className="form-card">
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2
          style={{
            fontFamily: "var(--font-syne)",
            fontWeight: 700,
            fontSize: "1.2rem",
            letterSpacing: "-0.02em",
            color: "var(--text)",
            marginBottom: "0.3rem",
          }}
        >
          Tu perfil
        </h2>
        <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
          Esta información se muestra a los otros jugadores del partido.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label className="form-label" htmlFor="fullName">
            Nombre completo
          </label>
          <input
            id="fullName"
            className="input-base"
            placeholder="Como quieres aparecer en el partido"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="phone">
            WhatsApp
          </label>
          <input
            id="phone"
            type="tel"
            className="input-base"
            placeholder="+57 300 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="profileSkill">
            Tu nivel de juego
          </label>
          <select
            id="profileSkill"
            className="input-base"
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value as Skill)}
          >
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </div>

        {message && (
          <div className={message.ok ? "banner-success" : "banner-danger"}>
            {message.text}
          </div>
        )}

        <Button
          disabled={pending || !fullName.trim()}
          onClick={saveProfile}
          size="lg"
          style={{ width: "100%" }}
        >
          {pending ? "Guardando..." : "Guardar perfil"}
        </Button>
      </div>
    </div>
  );
}
