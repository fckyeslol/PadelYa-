// @vitest-environment jsdom
/**
 * A dónde manda el login después de autenticar.
 *
 * `/login?next=<...>` llega sin validar desde la query hasta
 * `AuthForm.handleLogin` → `router.push(next)`. Si ahí entra una URL absoluta, el
 * usuario se autentica de verdad en PadelYa y termina en el sitio del atacante —
 * el escenario clásico de phishing: la pantalla siguiente pide "confirmá tu
 * contraseña" y ya viene de un login legítimo.
 *
 * Estos tests fijan que sólo se navegue dentro del propio sitio.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      // Login siempre exitoso: lo que se prueba es a dónde se navega después.
      signInWithPassword: async () => ({ error: null }),
    },
  }),
}));

const { AuthForm } = await import("@/components/AuthForm");

async function loguearse(next?: string) {
  const user = userEvent.setup();
  render(<AuthForm next={next} />);

  // Por id: el label "contraseña" matchea también el toggle de ver/ocultar.
  await user.type(document.querySelector("#auth-email")!, "jugador@padelya.co");
  await user.type(document.querySelector("#auth-password")!, "una-clave-valida");
  // "Ingresar →" es el submit; "Ingresar" solo es el tab que cambia de modo.
  await user.click(screen.getByRole("button", { name: "Ingresar →" }));

  await waitFor(() => expect(push).toHaveBeenCalled());
  return push.mock.calls[0][0] as string;
}

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});

describe("destino del login", () => {
  it("sin next va a /matches", async () => {
    expect(await loguearse()).toBe("/matches");
  });

  it("respeta un next relativo", async () => {
    expect(await loguearse("/payments")).toBe("/payments");
  });

  it.each([
    ["absoluto", "https://evil.com"],
    ["absoluto http", "http://evil.com"],
    ["protocol-relative", "//evil.com"],
    ["backslash, el bypass de //", "/\\evil.com"],
    ["backslash doble", "\\\\evil.com"],
    ["javascript:", "javascript:alert(document.cookie)"],
    ["data:", "data:text/html,<script>1</script>"],
    ["con credenciales", "https://www.padelya.co@evil.com"],
    ["subdominio falso", "https://padelya.co.evil.com"],
  ])("NO navega fuera del sitio con un next %s", async (_caso, next) => {
    const destino = await loguearse(next);

    // Tiene que ser una ruta interna: empieza con una sola barra.
    expect(destino.startsWith("/")).toBe(true);
    expect(destino.startsWith("//")).toBe(false);
    expect(destino).not.toMatch(/evil\.com/i);
    expect(destino).not.toMatch(/^[a-z]+:/i);

    // Y al resolverla contra el sitio, el host no puede cambiar.
    expect(new URL(destino, "https://www.padelya.co").hostname).toBe("www.padelya.co");
  });
});
