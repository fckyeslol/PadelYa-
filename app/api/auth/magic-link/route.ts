import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendMagicLinkEmail } from "@/services/notifications/auth-email";
import {
  buildAuthCallbackUrl,
  buildMagicLinkFromHashedToken,
  resolveAuthRedirectOrigin,
} from "@/utils/auth-url";
import { getResendEnv } from "@/utils/env";

const bodySchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  next: z.string().optional(),
  redirectOrigin: z.string().url().optional(),
});

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

  const { email, firstName, lastName, next, redirectOrigin } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const origin = resolveAuthRedirectOrigin(redirectOrigin);
  const redirectTo = buildAuthCallbackUrl(origin, next);

  try {
    const admin = getSupabaseAdminClient();

    // Always attempt signup first; if the user already exists Supabase returns
    // an email_exists error and we retry as a magiclink below.
    let linkType: "magiclink" | "signup" = "signup";
    const linkPayload = {
      email: normalizedEmail,
      options: {
        redirectTo,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    };
    let { data, error } = await (linkType === "signup"
      ? admin.auth.admin.generateLink({
          type: "signup",
          password: `${crypto.randomUUID()}Aa1!`,
          ...linkPayload,
        })
      : admin.auth.admin.generateLink({ type: "magiclink", ...linkPayload }));

    if (error && linkType === "signup") {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("already been registered") || msg.includes("email_exists")) {
        linkType = "magiclink";
        ({ data, error } = await admin.auth.admin.generateLink({
          type: "magiclink",
          ...linkPayload,
        }));
      }
    }

    if (error) {
      console.error("[auth/magic-link] generateLink", error);
      return NextResponse.json(
        { error: "No pudimos generar el link de acceso. Intenta de nuevo." },
        { status: 400 },
      );
    }

    const hashedToken = data.properties?.hashed_token;
    if (!hashedToken) {
      return NextResponse.json(
        { error: "No se recibió el token de acceso." },
        { status: 500 },
      );
    }

    const actionLink = buildMagicLinkFromHashedToken(redirectTo, hashedToken, linkType);

    try {
      await sendMagicLinkEmail({
        to: normalizedEmail,
        firstName: firstName.trim(),
        actionLink,
      });
    } catch (emailErr) {
      console.error("[auth/magic-link] Resend failed", emailErr);
      return NextResponse.json(
        { error: "No pudimos enviar el correo. Revisa tu bandeja en unos minutos o intenta de nuevo." },
        { status: 502 },
      );
    }

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

    return NextResponse.json(
      { error: "No pudimos enviar el correo. Intenta de nuevo en unos minutos." },
      { status: 502 },
    );
  }
}
