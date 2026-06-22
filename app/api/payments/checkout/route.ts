import { NextResponse } from "next/server";
import { combinedCheckoutSchema } from "@/types/contracts";
import { createCombinedCheckout } from "@/services/payments/service";
import { getErrorMessage } from "@/utils/errors";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      matchId?: unknown;
      includeSelf?: unknown;
      guests?: unknown;
    };

    const hasGuests = Array.isArray(body.guests) && body.guests.length > 0;
    // The legacy client posts just { matchId } to pay its own slot, so default
    // includeSelf to true unless guests are provided without it.
    const payload = combinedCheckoutSchema.parse({
      matchId: body.matchId,
      includeSelf: typeof body.includeSelf === "boolean" ? body.includeSelf : !hasGuests,
      guests: body.guests ?? [],
    });

    const checkout = await createCombinedCheckout(payload);
    return NextResponse.json(checkout, { status: 201 });
  } catch (error) {
    const message = getErrorMessage(error, "No fue posible iniciar el pago con Wompi");
    console.error("[checkout]", message, error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
