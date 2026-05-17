import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/domain";
import { sanitizeDisplayName } from "@/utils/name";

type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_phone: string | null;
  skill_level: Profile["skillLevel"];
  role: Profile["role"];
  strike_count: number;
  avatar_url: string | null;
  created_at: string;
};

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: sanitizeDisplayName(row.full_name, "Jugador"),
    phone: row.phone ?? "",
    whatsappPhone: row.whatsapp_phone,
    skillLevel: row.skill_level,
    role: row.role,
    strikeCount: row.strike_count,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

export async function getCurrentProfile() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, phone, whatsapp_phone, skill_level, role, strike_count, avatar_url, created_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) return null;

  const row = data as ProfileRow;
  const safeName = sanitizeDisplayName(row.full_name, "Jugador");

  if (row.full_name !== safeName && safeName && !safeName.includes("@")) {
    // Self-heal old records that accidentally stored email as full_name.
    await upsertProfile(user.id, { fullName: safeName });
    row.full_name = safeName;
  }

  return mapProfile(row);
}

export async function upsertProfile(
  userId: string,
  fields: { fullName?: string; phone?: string; whatsappPhone?: string; skillLevel?: Profile["skillLevel"]; avatarUrl?: string },
) {
  // Use admin client — the regular client has no INSERT RLS policy for profiles
  const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      ...(fields.fullName !== undefined && { full_name: fields.fullName }),
      ...(fields.phone !== undefined && { phone: fields.phone }),
      ...(fields.whatsappPhone !== undefined && { whatsapp_phone: fields.whatsappPhone }),
      ...(fields.skillLevel !== undefined && { skill_level: fields.skillLevel }),
      ...(fields.avatarUrl !== undefined && { avatar_url: fields.avatarUrl }),
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}
