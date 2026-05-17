import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  fullName: z.string().min(3),
  phone: z.string().min(7),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
});

export async function POST(request: Request) {
  try {
    const input = profileSchema.parse(await request.json());
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: input.fullName,
      phone: input.phone,
      whatsapp_phone: input.phone,
      skill_level: input.skillLevel,
      role: "player",
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "Perfil actualizado" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid profile payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
