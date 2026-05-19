export function PaymentStatusBanner({ status }: { status?: string }) {
  if (!status) return null;

  if (status === "approved") {
    return (
      <div className="banner-success" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <CheckIcon />
        <span>Pago confirmado. Tu cupo esta reservado.</span>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="banner-danger" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <XCircleIcon />
        <span>El pago fue rechazado. Intenta nuevamente.</span>
      </div>
    );
  }

  return (
    <div className="banner-warning" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <ClockIcon />
      <span>Pago en proceso. Te confirmamos cuando Mercado Pago lo apruebe.</span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
