import { NextResponse } from "next/server";
import { z } from "zod";
import { processMercadoPagoPayment } from "@/services/payments/service";
import { getErrorMessage } from "@/utils/errors";

const processSchema = z.object({
  externalReference: z.string().uuid(),
  formData: z
    .union([z.record(z.string(), z.unknown()), z.null()])
    .optional()
    .transform((value) => value ?? {}),
});

export async function POST(request: Request) {
  try {
    const body = processSchema.parse(await request.json());
    const result = await processMercadoPagoPayment(body.formData, body.externalReference);
    return NextResponse.json(result);
  } catch (error) {
    const message = getErrorMessage(error, "No fue posible procesar el pago");
    console.error("[payments/process]", message, error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
