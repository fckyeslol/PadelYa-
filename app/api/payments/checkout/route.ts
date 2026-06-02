import { NextResponse } from "next/server";
import { checkoutSchema } from "@/types/contracts";
import { createCheckoutForMatch } from "@/services/payments/service";
import { getErrorMessage } from "@/utils/errors";

export async function POST(request: Request) {
  try {
    const payload = checkoutSchema.parse(await request.json());
    const checkout = await createCheckoutForMatch(payload.matchId);
    return NextResponse.json(checkout, { status: 201 });
  } catch (error) {
    const message = getErrorMessage(error, "No fue posible iniciar el pago con Wompi");
    console.error("[checkout]", message, error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
