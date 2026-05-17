"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  matchId: string;
}

interface SetScore {
  t1: string;
  t2: string;
}

const VALID_GAMES = ["0","1","2","3","4","5","6","7"];

function parseSet(s: SetScore): { t1: number; t2: number } | null {
  const t1 = parseInt(s.t1);
  const t2 = parseInt(s.t2);
  if (isNaN(t1) || isNaN(t2)) return null;
  if (t1 < 0 || t2 < 0 || t1 > 7 || t2 > 7) return null;
  return { t1, t2 };
}

function inferWinner(sets: { t1: number; t2: number }[]): 1 | 2 | null {
  let w1 = 0, w2 = 0;
  for (const s of sets) {
    if (s.t1 > s.t2) w1++;
    else if (s.t2 > s.t1) w2++;
  }
  if (w1 > w2) return 1;
  if (w2 > w1) return 2;
  return null;
}

export function MatchResultForm({ matchId }: Props) {
  const [sets, setSets] = useState<SetScore[]>([
    { t1: "", t2: "" },
    { t1: "", t2: "" },
  ]);
  const [thirdSet, setThirdSet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function updateSet(idx: number, side: "t1" | "t2", val: string) {
    if (val !== "" && !VALID_GAMES.includes(val)) return;
    setSets((prev) => prev.map((s, i) => i === idx ? { ...s, [side]: val } : s));
  }

  function submit() {
    setError(null);
    const parsed = sets.slice(0, thirdSet ? 3 : 2).map(parseSet);

    if (parsed.some((p) => p === null)) {
      setError("Completa todos los sets (0–7 juegos por set).");
      return;
    }

    const validSets = parsed as { t1: number; t2: number }[];
    const winner = inferWinner(validSets);

    if (!winner) {
      setError("Los sets no definen un ganador claro. Revisa los marcadores.");
      return;
    }

    startTransition(async () => {
      const body = {
        set1Team1: validSets[0].t1,
        set1Team2: validSets[0].t2,
        set2Team1: validSets[1].t1,
        set2Team2: validSets[1].t2,
        ...(thirdSet && validSets[2] && {
          set3Team1: validSets[2].t1,
          set3Team2: validSets[2].t2,
        }),
        winnerTeam: winner,
      };

      const res = await fetch(`/api/matches/${matchId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar el resultado.");
        return;
      }

      router.refresh();
    });
  }

  const setsToShow = thirdSet ? [...sets, sets[2] ?? { t1: "", t2: "" }] : sets.slice(0, 2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Set inputs */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {setsToShow.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-3)", fontFamily: "var(--font-dm-sans)", width: "44px", flexShrink: 0 }}>
              Set {i + 1}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
              <SetInput value={s.t1} onChange={(v) => updateSet(i, "t1", v)} label="Pareja A" />
              <span style={{ color: "var(--text-3)", fontSize: "1rem", fontWeight: 700, flexShrink: 0 }}>–</span>
              <SetInput value={s.t2} onChange={(v) => updateSet(i, "t2", v)} label="Pareja B" />
            </div>
          </div>
        ))}
      </div>

      {/* 3rd set toggle */}
      {!thirdSet && (
        <button
          type="button"
          onClick={() => { setThirdSet(true); setSets((p) => [...p, { t1: "", t2: "" }]); }}
          style={{
            alignSelf: "flex-start",
            background: "none",
            border: "1px dashed var(--border)",
            borderRadius: "8px",
            padding: "0.3rem 0.875rem",
            fontSize: "0.8rem",
            color: "var(--text-3)",
            fontFamily: "var(--font-dm-sans)",
            cursor: "pointer",
            transition: "border-color 0.15s, color 0.15s",
          }}
          className="hover:border-[var(--text-2)] hover:text-[var(--text-2)]"
        >
          + Agregar 3er set
        </button>
      )}

      {error && (
        <p style={{ fontSize: "0.8rem", color: "var(--danger)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "8px", padding: "0.6rem 0.875rem", fontFamily: "var(--font-dm-sans)" }}>
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={pending}
        style={{
          background: "var(--primary)",
          color: "#ffffff",
          border: "none",
          borderRadius: "10px",
          padding: "0.7rem",
          fontSize: "0.9rem",
          fontWeight: 700,
          fontFamily: "var(--font-dm-sans)",
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.65 : 1,
          transition: "opacity 0.15s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        {pending ? "Guardando..." : "Registrar resultado"}
      </button>

      <p style={{ fontSize: "0.75rem", color: "var(--text-3)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.5 }}>
        El resultado queda guardado en el historial del partido. Pareja A = jugadores 1 y 2, Pareja B = jugadores 3 y 4.
      </p>
    </div>
  );
}

function SetInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="number"
      min={0}
      max={7}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      title={label}
      style={{
        width: "52px",
        textAlign: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "0.45rem 0.25rem",
        fontSize: "1rem",
        fontWeight: 700,
        color: "var(--text)",
        fontFamily: "var(--font-dm-sans)",
        MozAppearance: "textfield",
      }}
    />
  );
}
