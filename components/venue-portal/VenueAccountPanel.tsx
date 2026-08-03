"use client";

import { useCallback, useEffect, useState } from "react";
import {
  VP,
  vpCardStyle,
  vpEyebrowStyle,
  vpInputStyle,
  vpLabelStyle,
  vpPrimaryButtonStyle,
  vpTitleStyle,
} from "./theme";

type AccountInfo = { username: string; venueName: string; usingSeededPassword: boolean };

/** Sin setState adentro: la usan tanto el effect de montaje como el refresco post-guardado. */
async function fetchAccount(signal?: AbortSignal): Promise<AccountInfo | null> {
  try {
    const res = await fetch("/api/cancha/account/password", { signal });
    const json = await res.json();
    return res.ok ? (json as AccountInfo) : null;
  } catch {
    // El panel sigue siendo usable sin este dato: solo se pierde el aviso.
    return null;
  }
}

export function VenueAccountPanel() {
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const refresh = useCallback(async () => {
    const account = await fetchAccount();
    if (account) setInfo(account);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const account = await fetchAccount(controller.signal);
      if (!controller.signal.aborted && account) setInfo(account);
    })();
    return () => controller.abort();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (next !== confirm) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/cancha/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo cambiar la contraseña.");
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem 1.25rem 5rem", maxWidth: "560px" }}>
      <p style={vpEyebrowStyle}>Cuenta</p>
      <h2 style={vpTitleStyle}>Tu acceso</h2>

      {info && (
        <div style={{ ...vpCardStyle, marginTop: "1.25rem" }}>
          <p style={{ margin: 0, ...vpEyebrowStyle }}>Usuario</p>
          <p
            style={{
              margin: "0.3rem 0 0",
              fontFamily: VP.fontMono,
              fontSize: "1.1rem",
              color: VP.text,
            }}
          >
            {info.username}
          </p>
        </div>
      )}

      {info?.usingSeededPassword && (
        <div
          style={{
            ...vpCardStyle,
            marginTop: "0.75rem",
            borderColor: "rgba(255,90,31,0.35)",
            background: VP.goldMuted,
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: VP.text, fontSize: "0.95rem" }}>
            Seguís con la contraseña que te dimos
          </p>
          <p style={{ margin: "0.35rem 0 0", color: VP.text2, fontSize: "0.88rem", lineHeight: 1.5 }}>
            Esa contraseña la conocemos nosotros. Cambiala por una tuya para que el acceso a tu
            cancha sea solo tuyo.
          </p>
        </div>
      )}

      <form onSubmit={submit} style={{ ...vpCardStyle, marginTop: "0.75rem" }}>
        <p style={{ margin: "0 0 1rem", ...vpEyebrowStyle }}>Cambiar contraseña</p>

        <div style={{ marginBottom: "0.85rem" }}>
          <label style={vpLabelStyle} htmlFor="current-password">
            Contraseña actual
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            style={vpInputStyle}
          />
        </div>

        <div style={{ marginBottom: "0.85rem" }}>
          <label style={vpLabelStyle} htmlFor="new-password">
            Contraseña nueva
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            aria-describedby="password-rules"
            style={vpInputStyle}
          />
          <p id="password-rules" style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: VP.text3 }}>
            Mínimo 10 caracteres, con letras y números.
          </p>
        </div>

        <div style={{ marginBottom: "1.1rem" }}>
          <label style={vpLabelStyle} htmlFor="confirm-password">
            Repetí la contraseña nueva
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            style={vpInputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{ ...vpPrimaryButtonStyle, width: "100%", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Cambiando…" : "Cambiar contraseña"}
        </button>

        {error && (
          <p role="alert" style={{ margin: "0.9rem 0 0", color: VP.danger, fontSize: "0.9rem" }}>
            {error}
          </p>
        )}
        {done && !error && (
          <p style={{ margin: "0.9rem 0 0", color: VP.success, fontSize: "0.9rem" }}>
            Contraseña cambiada. Usá la nueva la próxima vez que entres.
          </p>
        )}
      </form>
    </div>
  );
}
