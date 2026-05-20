"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { VenueSlotBookingDetail } from "@/services/venue-portal/slot-detail";
import { VP, VP_MATCH_STATUS, VP_SKILL_LABEL } from "@/components/venue-portal/theme";
import { formatCop } from "@/utils/currency";
import { formatDateTime } from "@/utils/dates";

type Props = {
  courtId: string;
  date: string;
  time: string;
  onClose: () => void;
};

function PlayerCard({
  player,
}: {
  player: VenueSlotBookingDetail["paidPlayers"][number];
}) {
  const [expanded, setExpanded] = useState(false);
  const name = player.profile?.fullName ?? "Jugador";

  return (
    <div
      style={{
        border: `1px solid ${VP.border}`,
        borderRadius: VP.radius,
        padding: "0.85rem",
        background: VP.surface,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: VP.text,
          padding: 0,
        }}
      >
        {player.profile?.avatarUrl ? (
          <Image
            src={player.profile.avatarUrl}
            alt=""
            width={44}
            height={44}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: VP.border,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
            }}
          >
            {name.charAt(0)}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {name}
            {player.isHost && (
              <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: VP.gold }}>
                Anfitrión
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.8rem", color: VP.text2 }}>
            {VP_SKILL_LABEL[player.profile?.skillLevel ?? ""] ?? "—"} · Pagado
          </div>
        </div>
        <span style={{ color: VP.text3, fontSize: "0.85rem" }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div
          style={{
            marginTop: "0.85rem",
            paddingTop: "0.85rem",
            borderTop: `1px solid ${VP.border}`,
            fontSize: "0.82rem",
            color: VP.text2,
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
          }}
        >
          {player.phone && <p style={{ margin: 0 }}>Teléfono: {player.phone}</p>}
          {player.profile?.whatsappPhone && (
            <p style={{ margin: 0 }}>WhatsApp: {player.profile.whatsappPhone}</p>
          )}
          {player.email && <p style={{ margin: 0 }}>Email: {player.email}</p>}
          {player.profile && (
            <>
              <p style={{ margin: 0 }}>
                Partidos jugados: {player.profile.matchesPlayed} · Próximos:{" "}
                {player.profile.upcomingMatches}
              </p>
              <p style={{ margin: 0 }}>
                Miembro desde:{" "}
                {new Date(player.profile.memberSince).toLocaleDateString("es-CO", {
                  dateStyle: "medium",
                })}
              </p>
            </>
          )}
          <Link
            href={`/players/${player.playerId}`}
            target="_blank"
            style={{ color: VP.primary, marginTop: "0.25rem" }}
          >
            Ver perfil público →
          </Link>
          {player.history.length > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: VP.text }}>
                Historial reciente
              </p>
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {player.history.slice(0, 8).map((h) => (
                  <li key={`${h.matchId}-${h.joinedAt}`}>
                    {h.venueName} · {formatDateTime(h.scheduledAt)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function VenueBookingDetail({ courtId, date, time, onClose }: Props) {
  const [detail, setDetail] = useState<VenueSlotBookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      const encodedTime = encodeURIComponent(time);
      const res = await fetch(`/api/cancha/slots/${courtId}/${date}/${encodedTime}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo cargar la reserva");
        setDetail(null);
        return;
      }
      setDetail(data as VenueSlotBookingDetail);
    });
  }, [courtId, date, time]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          maxHeight: "85vh",
          overflow: "auto",
          background: VP.surface,
          borderRadius: "20px 20px 0 0",
          border: `1px solid ${VP.border}`,
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: VP.fontDisplay, color: VP.text }}>
            Reserva · {time}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: VP.text2,
              cursor: "pointer",
              fontSize: "1.25rem",
            }}
          >
            ×
          </button>
        </div>

        {error && <p style={{ color: VP.danger }}>{error}</p>}
        {!detail && !error && <p style={{ color: VP.text2 }}>Cargando…</p>}

        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ fontSize: "0.88rem", color: VP.text2 }}>
              <p style={{ margin: "0.25rem 0" }}>
                {detail.venueName} · {formatDateTime(detail.scheduledAt)}
              </p>
              <p style={{ margin: "0.25rem 0" }}>
                Estado: {VP_MATCH_STATUS[detail.status]?.label ?? detail.status} · Nivel:{" "}
                {VP_SKILL_LABEL[detail.skillLevel] ?? detail.skillLevel}
              </p>
              <p style={{ margin: "0.25rem 0" }}>Cuota: {formatCop(detail.orgFeeCop)} por jugador</p>
              {detail.courtReference && (
                <p style={{ margin: "0.25rem 0" }}>Ref. cancha: {detail.courtReference}</p>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem", color: VP.text }}>Jugadores pagados</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {detail.paidPlayers.length === 0 && (
                  <p style={{ color: VP.text2, fontSize: "0.85rem" }}>Aún no hay pagos confirmados.</p>
                )}
                {detail.paidPlayers.map((p) => (
                  <PlayerCard key={p.playerId} player={p} />
                ))}
              </div>
            </div>

            {detail.pendingPlayers.length > 0 && (
              <div>
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem", color: VP.text }}>Pago en curso</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {detail.pendingPlayers.map((p) => (
                    <div
                      key={p.playerId}
                      style={{
                        padding: "0.65rem",
                        borderRadius: "10px",
                        border: `1px dashed ${VP.border}`,
                        fontSize: "0.85rem",
                      }}
                    >
                      {p.profile?.fullName ?? "Jugador"} — pendiente de pago
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
