export default function VenuePortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="venue-portal" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {children}
    </div>
  );
}
