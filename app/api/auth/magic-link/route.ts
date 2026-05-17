import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendMagicLinkEmail } from "@/services/notifications/auth-email";
import { getResendEnv } from "@/utils/env";

const bodySchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  next: z.string().optional(),
});

function buildRedirectTo(origin: string, next?: string) {
  const path = "/auth/callback";
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return `${origin}${path}?next=${encodeURIComponent(next)}`;
  }
  return `${origin}${path}`;
}

export async function POST(request: Request) {
  const resend = getResendEnv();
  if (!resend) {
    return NextResponse.json({ fallback: true }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisa nombre, apellido y correo." }, { status: 400 });
  }

  const { email, firstName, lastName, next } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const origin = resend.appUrl.replace(/\/$/, "");
  const redirectTo = buildRedirectTo(origin, next);

  try {
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
      options: {
        redirectTo,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    });

    if (error) {
      console.error("[auth/magic-link] generateLink", error);
      return NextResponse.json(
        { error: "No pudimos generar el link de acceso. Intenta de nuevo." },
        { status: 400 },
      );
    }

    const actionLink = data.properties?.action_link;
    if (!actionLink) {
      return NextResponse.json(
        { error: "No se recibió el link de acceso." },
        { status: 500 },
      );
    }

    await sendMagicLinkEmail({
      to: normalizedEmail,
      firstName: firstName.trim(),
      actionLink,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/magic-link]", err);
    const message = err instanceof Error ? err.message : "";

    if (message.includes("Missing Supabase admin")) {
      return NextResponse.json(
        {
          error:
            "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Configúrala en Vercel y vuelve a desplegar.",
        },
        { status: 500 },
      );
    }

    if (message.includes("validation") || message.includes("domain")) {
      return NextResponse.json(
        {
          error:
            "Resend no pudo enviar el correo. Verifica tu dominio en Resend o usa RESEND_FROM_EMAIL con un remitente autorizado.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "No pudimos enviar el correo. Intenta de nuevo en unos minutos." },
      { status: 502 },
    );
  }
}
