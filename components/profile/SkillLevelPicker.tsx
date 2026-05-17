"use client";

import { useState } from "react";

type SkillLevel = "beginner" | "intermediate" | "advanced";

const LEVELS: { value: SkillLevel; label: string; color: string }[] = [
  { value: "beginner",     label: "Principiante", color: "var(--success)" },
  { value: "intermediate", label: "Intermedio",   color: "var(--gold)" },
  { value: "advanced",     label: "Avanzado",     color: "var(--danger)" },
];

export function SkillLevelPicker({ defaultValue }: { defaultValue: SkillLevel }) {
  const [selected, setSelected] = useState<SkillLevel>(defaultValue);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.625rem" }}>
      {LEVELS.map(({ value, label, color }) => {
        const active = selected === value;
        return (
          <label key={value} style={{ cursor: "pointer" }}>
            {/* Hidden radio — carries the value on form submit */}
            <input
              type="radio"
              name="skillLevel"
              value={value}
              checked={active}
              onChange={() => setSelected(value)}
              style={{ display: "none" }}
            />
            <div
              style={{
                border: `1px solid ${active ? color : "var(--border)"}`,
                borderRadius: "10px",
                padding: "0.75rem 0.5rem",
                textAlign: "center",
                background: active ? `color-mix(in srgb, ${color} 12%, transparent)` : "transparent",
                transition: "border-color 0.15s, background 0.15s",
                userSelect: "none",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: color,
                  display: "inline-block",
                  marginBottom: "0.3rem",
                }}
              />
              <p style={{
                fontSize: "0.8rem",
                fontWeight: active ? 700 : 500,
                color: active ? color : "var(--text-2)",
                fontFamily: "var(--font-dm-sans)",
              }}>
                {label}
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
