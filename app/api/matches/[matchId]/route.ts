import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ matchId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { matchId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data: match, error: matchError } = await admin
    .from("matches")
    .select("host_player_id, status")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError || !match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }
  if (match.host_player_id !== user.id) {
    return NextResponse.json({ error: "Solo el anfitrión puede editar el partido" }, { status: 403 });
  }
  if (!["pending_court", "open"].includes(match.status)) {
    return NextResponse.json({ error: "No se puede editar un partido en este estado" }, { status: 400 });
  }

  const body = (await request.json()) as {
    venueName?: string;
    notes?: string;
    orgFeeCop?: number;
  };

  const updates: Record<string, unknown> = {};
  if (body.venueName?.trim()) updates.venue_name = body.venueName.trim();
  if (body.notes !== undefined) updates.notes = body.notes.trim() || null;
  if (match.status === "pending_court" && typeof body.orgFeeCop === "number" && body.orgFeeCop >= 0) {
    updates.org_fee_cop = body.orgFeeCop;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { error } = await admin.from("matches").update(updates).eq("id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
