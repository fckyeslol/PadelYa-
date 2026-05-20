import { redirect } from "next/navigation";
import { getVenueSession } from "@/lib/auth/venue";
import { VenuePortalShell } from "@/components/venue-portal/VenuePortalShell";

export const dynamic = "force-dynamic";

export default async function VenueDashboardPage() {
  const session = await getVenueSession();
  if (!session) redirect("/cancha/login");

  return <VenuePortalShell venueName={session.venueName} />;
}
