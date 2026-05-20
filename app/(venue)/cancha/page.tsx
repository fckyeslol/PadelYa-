import { redirect } from "next/navigation";
import { getVenueSession } from "@/lib/auth/venue";
import { VenueScheduleBoard } from "@/components/venue-portal/VenueScheduleBoard";

export const dynamic = "force-dynamic";

export default async function VenueDashboardPage() {
  const session = await getVenueSession();
  if (!session) redirect("/cancha/login");

  return <VenueScheduleBoard venueName={session.venueName} />;
}
