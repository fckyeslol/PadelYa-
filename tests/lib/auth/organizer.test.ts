/**
 * `requireOrganizerUser` es el portón de /organizer y de /api/organizer/*.
 * Lo que importa acá es que NO alcance con estar logueado: hace falta
 * `profiles.role === 'organizer'`. Un jugador cualquiera que llegue a esas
 * rutas tiene que rebotar.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

type Perfil = { role: string } | null;

const estado: {
  user: { id: string } | null;
  perfil: Perfil;
  errorPerfil: { message: string } | null;
} = { user: null, perfil: null, errorPerfil: null };

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: estado.user } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: estado.perfil, error: estado.errorPerfil }),
        }),
      }),
    }),
  }),
}));

const { requireOrganizerUser } = await import("@/lib/auth/organizer");

beforeEach(() => {
  estado.user = null;
  estado.perfil = null;
  estado.errorPerfil = null;
});

describe("sin sesión", () => {
  it("rechaza a quien no está logueado", async () => {
    await expect(requireOrganizerUser()).rejects.toThrow("Not authenticated");
  });

  it("no consulta el perfil si no hay usuario", async () => {
    // Si consultara, el perfil null daría "Organizer access required" en vez de
    // "Not authenticated": el mensaje distingue cuál de los dos cortes actuó.
    await expect(requireOrganizerUser()).rejects.toThrow(/Not authenticated/);
  });
});

describe("logueado pero sin rol", () => {
  beforeEach(() => {
    estado.user = { id: "user-1" };
  });

  it("rechaza a un jugador con rol 'player'", async () => {
    estado.perfil = { role: "player" };
    await expect(requireOrganizerUser()).rejects.toThrow("Organizer access required");
  });

  it("rechaza cuando no existe el perfil", async () => {
    estado.perfil = null;
    await expect(requireOrganizerUser()).rejects.toThrow("Organizer access required");
  });

  it.each(["", "Organizer", "ORGANIZER", "admin", "organizador"])(
    "rechaza el rol %o: la comparación es exacta y no acepta variantes",
    async (role) => {
      estado.perfil = { role };
      await expect(requireOrganizerUser()).rejects.toThrow("Organizer access required");
    },
  );
});

describe("organizador válido", () => {
  it("devuelve el usuario cuando el rol es exactamente 'organizer'", async () => {
    estado.user = { id: "user-1" };
    estado.perfil = { role: "organizer" };

    await expect(requireOrganizerUser()).resolves.toEqual({ id: "user-1" });
  });
});

describe("error al leer el perfil", () => {
  it("propaga el error en vez de tragarlo y dejar pasar", async () => {
    // Lección #2 del proyecto: un catch genérico ocultó la causa raíz. Acá
    // además tragarlo sería un bypass de autorización.
    estado.user = { id: "user-1" };
    estado.errorPerfil = { message: "no se pudo leer profiles" };

    await expect(requireOrganizerUser()).rejects.toMatchObject({
      message: "no se pudo leer profiles",
    });
  });
});
