import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cancelGuestSpot } from "@/services/matches/operations";
import { getErrorMessage } from "@/utils/errors";

const schema = z.object({ guestMatchPlayerId: z.string().uuid() });

type Params = { params: Promise<{ matchId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { guestMatchPlayerId } = schema.parse(await request.json());
    const { isLate } = await cancelGuestSpot(matchId, guestMatchPlayerId, user.id);

    return NextResponse.json({
      ok: true,
      message: isLate
        ? "Cupo cancelado. Por ser tardía, no aplica reembolso."
        : "Cupo cancelado. El reembolso a tu medio de pago se procesará en 24–72 horas hábiles.",
    });
  } catch (error) {
    const message = getErrorMessage(error, "No se pudo cancelar el cupo del invitado");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
