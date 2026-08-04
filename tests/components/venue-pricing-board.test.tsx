// @vitest-environment jsdom
/**
 * Regresión del aviso de "Precios guardados" (PR #23).
 *
 * El bug: `save()` hacía `setSaved(true)` y después `await refresh()`. Al llegar
 * los datos nuevos cambiaba `allRules`, lo que disparaba el recálculo de la
 * grilla — y ese recálculo limpiaba el flag. El cartel aparecía y desaparecía
 * solo, así que la sede no sabía si su tarifario había quedado guardado.
 *
 * El arreglo: el flag sólo se limpia cuando cambia día o duración, que es a lo
 * que el aviso se refiere. Estos tests fijan las dos mitades de esa regla.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VenuePricingBoard } from "@/components/venue-portal/VenuePricingBoard";

type ApiRule = {
  dayType: string;
  durationMinutes: 60 | 90 | 120;
  startTime: string;
  endTime: string;
  courtPriceCop: number;
};

const REGLA_LUN_JUE_90: ApiRule = {
  dayType: "weekday",
  durationMinutes: 90,
  startTime: "06:00",
  endTime: "12:00",
  courtPriceCop: 70_000,
};

/** Reglas que devuelve el GET de /api/cancha/pricing. Mutable por test. */
let reglas: ApiRule[] = [];
let putsRecibidos = 0;

const AVISO = /Precios guardados/i;

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/api/cancha/pricing") && (init?.method ?? "GET") === "GET") {
      return new Response(
        JSON.stringify({ rules: reglas, courtMarkupCop: 22_500, suggested: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/api/cancha/pricing") && init?.method === "PUT") {
      putsRecibidos++;
      // Igual que en prod: al guardar, el GET siguiente ya trae la regla nueva.
      // Objeto nuevo a propósito: es lo que cambiaba la identidad de `allRules`
      // y disparaba el reset que borraba el aviso.
      reglas = [{ ...REGLA_LUN_JUE_90 }];
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    throw new Error(`fetch no mockeado: ${init?.method ?? "GET"} ${url}`);
  });
}

beforeEach(() => {
  reglas = [{ ...REGLA_LUN_JUE_90 }];
  putsRecibidos = 0;
  vi.stubGlobal("fetch", mockFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Espera a que termine la carga inicial (deja de verse "Cargando…"). */
async function esperarCarga() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Guardar precios/i })).toBeTruthy();
  });
}

async function guardar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Guardar precios/i }));
  await waitFor(() => expect(putsRecibidos).toBe(1));
}

describe("el aviso de guardado", () => {
  it("aparece después de guardar", async () => {
    const user = userEvent.setup();
    render(<VenuePricingBoard />);
    await esperarCarga();

    expect(screen.queryByText(AVISO)).toBeNull();

    await guardar(user);
    await waitFor(() => expect(screen.getByText(AVISO)).toBeTruthy());
  });

  it("SIGUE visible después del refresh que hace save() — el bug de PR #23", async () => {
    const user = userEvent.setup();
    render(<VenuePricingBoard />);
    await esperarCarga();

    await guardar(user);
    await waitFor(() => expect(screen.getByText(AVISO)).toBeTruthy());

    // El refresco post-guardado ya trajo `allRules` nuevo. Antes del arreglo el
    // recálculo de la grilla limpiaba el flag y el cartel desaparecía solo.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText(AVISO)).toBeTruthy();
  });

  it("se limpia al cambiar de día, que es a lo que el aviso se refiere", async () => {
    const user = userEvent.setup();
    render(<VenuePricingBoard />);
    await esperarCarga();

    await guardar(user);
    await waitFor(() => expect(screen.getByText(AVISO)).toBeTruthy());

    await user.click(screen.getByText("Viernes"));
    await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull());
  });

  it("se limpia al cambiar de duración", async () => {
    const user = userEvent.setup();
    render(<VenuePricingBoard />);
    await esperarCarga();

    await guardar(user);
    await waitFor(() => expect(screen.getByText(AVISO)).toBeTruthy());

    await user.click(screen.getByText("60 min"));
    await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull());
  });

  it("volver al día original no resucita el aviso", async () => {
    const user = userEvent.setup();
    render(<VenuePricingBoard />);
    await esperarCarga();

    await guardar(user);
    await user.click(screen.getByText("Viernes"));
    await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull());

    await user.click(screen.getByText("Lunes a jueves"));
    expect(screen.queryByText(AVISO)).toBeNull();
  });
});

describe("carga inicial", () => {
  it("pide el tarifario una sola vez al montar", async () => {
    render(<VenuePricingBoard />);
    await esperarCarga();

    const llamadas = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const gets = llamadas.filter(([, init]) => (init?.method ?? "GET") === "GET");
    expect(gets).toHaveLength(1);
  });

  it("muestra la franja que la sede tenía guardada", async () => {
    render(<VenuePricingBoard />);
    await esperarCarga();

    expect(screen.getByDisplayValue("06:00")).toBeTruthy();
    expect(screen.getByDisplayValue("12:00")).toBeTruthy();
  });

  it("propaga el error del server en vez de tragarlo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "No se pudo cargar el tarifario." }), { status: 500 }),
      ),
    );

    render(<VenuePricingBoard />);
    await waitFor(() =>
      expect(screen.getByText(/No se pudo cargar el tarifario/i)).toBeTruthy(),
    );
  });
});
