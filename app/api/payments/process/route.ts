import { NextResponse } from "next/server";
import { z } from "zod";
import {
  normalizeBrickFormData,
  processMercadoPagoPayment,
} from "@/services/payments/service";
import { getErrorMessage } from "@/utils/errors";

const processSchema = z
  .object({
    externalReference: z.string().uuid(),
    formData: z
      .union([z.record(z.string(), z.unknown()), z.null()])
      .optional()
      .transform((value) => value ?? {}),
  })
  .passthrough();

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = processSchema.parse(rawBody);

    const brickFormData = normalizeBrickFormData({
      formData: parsed.formData,
      ...rawBody,
    });

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null;

    const result = await processMercadoPagoPayment(
      brickFormData,
      parsed.externalReference,
      { clientIp },
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = getErrorMessage(error, "No fue posible procesar el pago");
    console.error("[payments/process]", message, error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
