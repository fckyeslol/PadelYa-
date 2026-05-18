"use server";

import { redirect } from "next/navigation";
import { upsertProfile } from "@/services/profiles/service";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function updateProfileAction(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const firstName = (formData.get("firstName") as string | null)?.trim() ?? "";
  const lastName = (formData.get("lastName") as string | null)?.trim() ?? "";
  const phone = (formData.get("phone") as string | null)?.trim() ?? "";
  const whatsappPhone = (formData.get("whatsappPhone") as string | null)?.trim() || undefined;
  const skillLevel = formData.get("skillLevel") as "beginner" | "intermediate" | "advanced" | null;

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  if (!fullName) {
    throw new Error("El nombre es requerido");
  }

  await upsertProfile(user.id, {
    fullName,
    phone,
    whatsappPhone,
    ...(skillLevel && { skillLevel }),
  });

  const next = (formData.get("next") as string | null)?.trim();
  const setup = formData.get("setup") as string | null;
  if (setup === "1" && next && next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }
  redirect("/profile");
}
