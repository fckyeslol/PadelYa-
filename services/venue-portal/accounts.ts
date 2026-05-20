import { BARRANQUILLA_VENUES } from "@/config/venues";
import { verifyVenuePassword } from "@/lib/auth/venue-password";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type VenueAccountRow = {
  id: string;
  venue_id: string;
  username: string;
  password_hash: string;
  is_active: boolean;
};

export async function authenticateVenueAccount(
  username: string,
  password: string,
): Promise<{ account: VenueAccountRow; venueName: string } | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_accounts")
    .select("id, venue_id, username, password_hash, is_active")
    .eq("username", username.trim())
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.is_active) return null;
  if (!verifyVenuePassword(password, data.password_hash)) return null;

  const venueMeta = BARRANQUILLA_VENUES.find((v) => v.id === data.venue_id);
  return {
    account: data as VenueAccountRow,
    venueName: venueMeta?.name ?? data.venue_id,
  };
}
