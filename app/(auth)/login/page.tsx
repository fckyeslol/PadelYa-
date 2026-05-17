import { AuthForm } from "@/components/AuthForm";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;

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
        <AuthForm next={next} />
      </div>
    </div>
  );
}
