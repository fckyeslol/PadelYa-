import { NextResponse } from "next/server";
import { checkoutSchema } from "@/types/contracts";
import { createCheckoutForMatch } from "@/services/payments/service";

export async function POST(request: Request) {
  try {
    const payload = checkoutSchema.parse(await request.json());
    const checkout = await createCheckoutForMatch(payload.matchId);
    return NextResponse.json(checkout, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create checkout session";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
