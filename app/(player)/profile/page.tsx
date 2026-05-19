import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/services/profiles/service";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPlayerMatchHistory } from "@/services/players/service";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { SkillLevelPicker } from "@/components/profile/SkillLevelPicker";
import { SaveProfileButton } from "@/components/profile/SaveProfileButton";
import { updateProfileAction } from "./actions";
import { formatCop } from "@/utils/currency";
import { formatDateTime } from "@/utils/dates";

const SKILL_LABELS: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

type Props = {
  searchParams: Promise<{ setup?: string; next?: string; saved?: string }>;
};

export default async function ProfilePage({ searchParams }: Props) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const history = await getPlayerMatchHistory(user.id, 12).catch(() => []);

  const { setup, next, saved } = await searchParams;
  const isSetup = setup === "1";
  const isSaved = saved === "1";
  const setupNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/matches";

  const nameParts = profile.fullName.trim().split(/\s+/);
  const defaultFirst = nameParts[0] ?? "";
  const defaultLast = nameParts.slice(1).join(" ");

  return (
    <div
      className="flex flex-1 items-start justify-center px-6 py-12"
      style={{ background: "var(--bg)" }}
    >
      <div style={{ width: "100%", maxWidth: "520px" }}>
        {/* Saved banner */}
        {isSaved && (
          <div
            className="banner-success"
            style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.6rem" }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span><strong>Perfil actualizado.</strong> Los cambios se guardaron correctamente.</span>
          </div>
        )}

        {/* Setup banner */}
        {isSetup && (
          <div
            className="banner-warning"
            style={{ marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: "0.6rem" }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: "1px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <div>
              <strong>Completa tu perfil para continuar.</strong>{" "}
              Agrega tu teléfono y nivel de juego — solo toma 30 segundos.
            </div>
          </div>
        )}

        {/* Page title */}
        <div style={{ marginBottom: "2rem" }}>
          <h1
            style={{
              fontFamily: "var(--font-montserrat)",
              fontWeight: 800,
              fontSize: "1.75rem",
              letterSpacing: "-0.025em",
              color: "var(--text)",
              marginBottom: "0.4rem",
            }}
          >
            Mi perfil
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>
            Personaliza tu cuenta de PadelYa!
          </p>
        </div>

        {/* Avatar + name card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.25rem",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "1.25rem 1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <AvatarUpload
            userId={user.id}
            currentUrl={profile.avatarUrl}
            fullName={profile.fullName}
          />
          <div>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)", fontFamily: "var(--font-montserrat)" }}>
              {profile.fullName}
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-3)", fontFamily: "var(--font-dm-sans)", marginTop: "0.15rem" }}>
              {SKILL_LABELS[profile.skillLevel]} · {profile.role === "organizer" ? "Organizador" : "Jugador"}
            </p>
          </div>
        </div>

        {/* Edit form */}
        <form
          action={updateProfileAction}
          style={{

            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <input type="hidden" name="next" value={setupNext} />
          <input type="hidden" name="setup" value={isSetup ? "1" : ""} />

          <SectionLabel>Información personal</SectionLabel>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Field label="Nombre" htmlFor="firstName">
              <input
                id="firstName"
                name="firstName"
                type="text"
                defaultValue={defaultFirst}
                placeholder="Mateo"
                className="input-base"
                required
                autoComplete="given-name"
              />
            </Field>
            <Field label="Apellido" htmlFor="lastName">
              <input
                id="lastName"
                name="lastName"
                type="text"
                defaultValue={defaultLast}
                placeholder="Pirela"
                className="input-base"
                autoComplete="family-name"
              />
            </Field>
          </div>

          <Field label="Teléfono / WhatsApp principal" htmlFor="phone">
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={profile.phone}
              placeholder="+57 300 123 4567"
              className="input-base"
              autoComplete="tel"
            />
          </Field>

          <Field label="WhatsApp alternativo (opcional)" htmlFor="whatsappPhone">
            <input
              id="whatsappPhone"
              name="whatsappPhone"
              type="tel"
              defaultValue={profile.whatsappPhone ?? ""}
              placeholder="+57 310 987 6543"
              className="input-base"
            />
          </Field>

          <SectionLabel>Nivel de juego</SectionLabel>

          <SkillLevelPicker defaultValue={profile.skillLevel} />

          <SaveProfileButton />
        </form>

        {/* History */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "1.25rem",
            marginTop: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.8rem" }}>
            <h2
              style={{
                fontFamily: "var(--font-montserrat)",
                fontWeight: 700,
                fontSize: "1rem",
                color: "var(--text)",
              }}
            >
              Historial de partidos
            </h2>
            <Link href={`/players/${user.id}`} style={{ fontSize: "0.8rem", color: "var(--text-2)", textDecoration: "underline" }}>
              Ver perfil público
            </Link>
          </div>

          {history.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>
              Aún no tienes partidos en tu historial.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
              {history.map((item) => (
                <Link
                  key={`${item.matchId}-${item.joinedAt}`}
                  href={`/matches/${item.matchId}`}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "0.65rem 0.75rem",
                    textDecoration: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.2rem",
                  }}
                >
                  <p style={{ color: "var(--text)", fontSize: "0.86rem", fontWeight: 600 }}>
                    {item.venueName}
                  </p>
                  <p style={{ color: "var(--text-2)", fontSize: "0.78rem" }}>
                    {formatDateTime(item.scheduledAt)} · {formatCop(item.orgFeeCop)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: "0.75rem",
      fontWeight: 600,
      color: "var(--text-3)",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      fontFamily: "var(--font-dm-sans)",
      marginBottom: "-0.5rem",
    }}>
      {children}
    </p>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        style={{
          display: "block",
          fontSize: "0.8rem",
          fontWeight: 500,
          color: "var(--text-2)",
          marginBottom: "0.4rem",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
