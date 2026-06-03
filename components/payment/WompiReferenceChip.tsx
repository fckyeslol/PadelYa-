"use client";

import { useState } from "react";

type Props = {
  reference: string;
};

/** Tiny mono-font reference with copy-to-clipboard. */
export function WompiReferenceChip({ reference }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — silent no-op; the reference is already visible.
    }
  }

  const display = reference.length > 14 ? `${reference.slice(0, 8)}…${reference.slice(-4)}` : reference;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Referencia copiada" : "Copiar referencia"}
      title={reference}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: "var(--text-2)",
        borderRadius: "4px",
        padding: "0.18rem 0.5rem",
        fontFamily: "var(--font-mono-ui, 'DM Mono', monospace)",
        fontSize: "0.7rem",
        letterSpacing: "0.02em",
        cursor: "pointer",
        transition: "color 0.15s ease, border-color 0.15s ease",
        maxWidth: "100%",
      }}
      className="hover:border-[var(--primary)] hover:text-[var(--text)]"
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {display}
      </span>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
