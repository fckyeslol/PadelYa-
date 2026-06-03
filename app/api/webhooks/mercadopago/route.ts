import { NextResponse } from "next/server";

/**
 * Mercado Pago webhook — replaced by Wompi.
 * @deprecated Configure your new webhook URL in Wompi: /api/webhooks/wompi
 */
export async function POST() {
  return NextResponse.json(
    { error: "Este endpoint ha sido reemplazado. Configura el webhook en Wompi apuntando a /api/webhooks/wompi" },
    { status: 410 },
  );
}
