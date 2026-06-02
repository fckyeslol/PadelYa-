import { NextResponse } from "next/server";

/**
 * This route was used by the Mercado Pago Payment Brick to submit card data.
 * Wompi handles payment processing entirely on their side via the Widget overlay —
 * no server-side card data submission is required.
 * @deprecated
 */
export async function POST() {
  return NextResponse.json(
    { error: "Este endpoint ya no está disponible. El procesador de pagos ha cambiado a Wompi." },
    { status: 410 },
  );
}
