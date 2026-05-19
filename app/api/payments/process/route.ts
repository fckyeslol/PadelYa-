import { NextResponse } from "next/server";
import { z } from "zod";
import { processMercadoPagoPayment } from "@/services/payments/service";

const processSchema = z.object({
  externalReference: z.string().uuid(),
  formData: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  try {
    const body = processSchema.parse(await request.json());
    const result = await processMercadoPagoPayment(
      body.formData as Parameters<typeof processMercadoPagoPayment>[0],
      body.externalReference,
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error procesando el pago";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
