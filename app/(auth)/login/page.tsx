import { AuthForm } from "@/components/AuthForm";

const LOGIN_ERRORS: Record<string, string> = {
  missing_code: "El enlace de acceso no es válido o ya expiró. Solicita uno nuevo.",
  auth_failed: "No pudimos completar el inicio de sesión. Intenta de nuevo.",
};

type Props = {
  searchParams: Promise<{ next?: string; error?: string; detail?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, error, detail } = await searchParams;
  let detailMessage: string | null = null;
  if (detail) {
    try {
      detailMessage = decodeURIComponent(detail);
    } catch {
      detailMessage = detail;
    }
  }

  const initialError = (error && LOGIN_ERRORS[error]) || detailMessage;

  return (
    <div
      className="flex flex-1 items-center justify-center px-6 py-16 court-grid"
      style={{ background: "var(--bg)" }}
    >
      {/* Glow */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "500px",
          height: "400px",
          background: "radial-gradient(ellipse, rgba(30,58,110,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        <AuthForm next={next} initialError={initialError} />
      </div>
    </div>
  );
}
