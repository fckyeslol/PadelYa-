import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
  }
>;

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--primary)",
    color: "#ffffff",
    border: "none",
  },
  secondary: {
    background: "var(--card)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-2)",
    border: "1px solid var(--border)",
  },
  danger: {
    background: "rgba(248,113,113,0.1)",
    color: "var(--danger)",
    border: "1px solid rgba(248,113,113,0.25)",
  },
};

const SIZE_STYLES: Record<Size, React.CSSProperties> = {
  sm: { padding: "0.375rem 0.75rem", fontSize: "0.8rem" },
  md: { padding: "0.5rem 1.125rem", fontSize: "0.875rem" },
  lg: { padding: "0.75rem 1.5rem", fontSize: "1rem" },
};

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  style,
  ...props
}: Props) {
  return (
    <button
      style={{
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        borderRadius: "10px",
        fontWeight: 600,
        fontFamily: "var(--font-dm-sans)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.4rem",
        transition: "opacity 0.15s ease, background-color 0.15s ease",
        letterSpacing: "-0.01em",
        ...style,
      }}
      className={`disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
