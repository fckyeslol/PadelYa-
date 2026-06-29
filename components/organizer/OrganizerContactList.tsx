import type { MatchContact } from "@/services/matches/organizer-contacts";

/** Pretty "+57 300 111 2233" from "573001112233" (best-effort, CO-aware). */
function prettyPhone(d: string): string {
  if (d.startsWith("57") && d.length === 12) {
    const local = d.slice(2);
    return `+57 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return `+${d}`;
}

export function OrganizerContactList({ contacts }: { contacts: MatchContact[] }) {
  if (contacts.length === 0) {
    return (
      <p style={{ color: "var(--text-3)", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}>
        Aún no hay jugadores con cupo en este partido.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {contacts.map((c) => (
        <div
          key={c.matchPlayerId}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "0.7rem 0.85rem",
            background: "var(--surface)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                color: "var(--text)",
                fontWeight: 700,
                fontSize: "0.92rem",
                fontFamily: "var(--font-dm-sans)",
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.name}
              {c.isGuest && (
                <span
                  style={{
                    marginLeft: "0.4rem",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: "var(--info)",
                    border: "1px solid rgba(77,163,255,0.28)",
                    background: "rgba(77,163,255,0.10)",
                    borderRadius: "999px",
                    padding: "0.08rem 0.45rem",
                  }}
                >
                  Invitado
                </span>
              )}
            </p>
            <p
              style={{
                color: "var(--text-3)",
                fontSize: "0.76rem",
                fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)",
                marginTop: "0.1rem",
              }}
            >
              {c.phone ? prettyPhone(c.phone) : "Sin teléfono"}
              {c.isGuest && c.invitedByName ? ` · invitado por ${c.invitedByName}` : ""}
              {c.status === "pending_payment" ? " · pago pendiente" : ""}
            </p>
          </div>

          {c.phone && (
            <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
              <a
                href={`https://wa.me/${c.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp a ${c.name}`}
                style={iconBtn("rgba(0,201,167,0.12)", "var(--success)", "rgba(0,201,167,0.3)")}
              >
                <WhatsAppIcon />
              </a>
              <a
                href={`tel:+${c.phone}`}
                aria-label={`Llamar a ${c.name}`}
                style={iconBtn("rgba(233,255,71,0.10)", "var(--primary)", "rgba(233,255,71,0.28)")}
              >
                <PhoneIcon />
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function iconBtn(bg: string, color: string, border: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: "10px",
    background: bg,
    color,
    border: `1px solid ${border}`,
    textDecoration: "none",
  };
}

function PhoneIcon() {
  return (
    <svg width={17} height={17} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.2 8.2 0 012.42 5.82c0 4.54-3.7 8.23-8.24 8.23a8.2 8.2 0 01-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 01-1.26-4.37c0-4.54 3.7-8.24 8.25-8.24zm4.71 10.39c-.26-.13-1.52-.75-1.76-.84-.24-.09-.41-.13-.59.13-.17.26-.67.84-.82 1.01-.15.17-.3.2-.56.07-.26-.13-1.09-.4-2.07-1.28-.77-.68-1.28-1.53-1.43-1.79-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.46.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.07-.13-.59-1.42-.81-1.94-.21-.51-.43-.44-.59-.45-.15-.01-.32-.01-.5-.01-.17 0-.45.06-.69.32-.24.26-.9.88-.9 2.15 0 1.27.92 2.49 1.05 2.66.13.17 1.82 2.78 4.41 3.9.62.27 1.1.43 1.47.55.62.2 1.18.17 1.63.1.5-.07 1.52-.62 1.74-1.22.21-.6.21-1.11.15-1.22-.06-.11-.24-.17-.5-.3z" />
    </svg>
  );
}
