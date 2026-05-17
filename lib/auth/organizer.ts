import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function requireOrganizerUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!profile || profile.role !== "organizer") {
    throw new Error("Organizer access required");
  }

  return user;
}
