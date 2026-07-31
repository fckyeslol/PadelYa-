/**
 * Alta, edición y baja de las canchas de una sede, desde su portal.
 *
 * La baja es lógica (`is_active = false`), nunca un DELETE: `venue_slot_blocks` y los
 * partidos ya creados apuntan a la cancha, y borrarla de verdad rompería el historial.
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type VenueCourtAdminRow = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

const MAX_COURTS_PER_VENUE = 30;

function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function assertValidName(name: string): void {
  if (name.length < 1) throw new Error("La cancha necesita un nombre.");
  if (name.length > 40) throw new Error("El nombre no puede superar los 40 caracteres.");
}

/** Todas las canchas de la sede, incluidas las dadas de baja (el portal las muestra aparte). */
export async function listCourtsForAdmin(venueId: string): Promise<VenueCourtAdminRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_courts")
    .select("id, name, sort_order, is_active")
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error("No se pudieron cargar las canchas.");

  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    sortOrder: c.sort_order as number,
    isActive: Boolean(c.is_active),
  }));
}

export async function createCourt(venueId: string, rawName: string): Promise<VenueCourtAdminRow> {
  const name = cleanName(rawName);
  assertValidName(name);

  const existing = await listCourtsForAdmin(venueId);
  if (existing.filter((c) => c.isActive).length >= MAX_COURTS_PER_VENUE) {
    throw new Error(`No podés tener más de ${MAX_COURTS_PER_VENUE} canchas activas.`);
  }
  if (existing.some((c) => c.isActive && c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`Ya tenés una cancha llamada "${name}".`);
  }

  const nextOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_courts")
    .insert({ venue_id: venueId, name, sort_order: nextOrder, is_active: true })
    .select("id, name, sort_order, is_active")
    .single();

  if (error) {
    console.error("[venue-portal] createCourt falló", { venueId, error });
    throw new Error("No se pudo crear la cancha. Intentá de nuevo.");
  }

  return {
    id: data.id as string,
    name: data.name as string,
    sortOrder: data.sort_order as number,
    isActive: Boolean(data.is_active),
  };
}

/** Renombra o reactiva/desactiva una cancha. Solo si pertenece a la sede de la sesión. */
export async function updateCourt(params: {
  venueId: string;
  courtId: string;
  name?: string;
  isActive?: boolean;
}): Promise<void> {
  const { venueId, courtId } = params;

  const courts = await listCourtsForAdmin(venueId);
  const target = courts.find((c) => c.id === courtId);
  if (!target) throw new Error("Esa cancha no es de tu sede.");

  const patch: Record<string, unknown> = {};

  if (params.name !== undefined) {
    const name = cleanName(params.name);
    assertValidName(name);
    const duplicate = courts.some(
      (c) => c.id !== courtId && c.isActive && c.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) throw new Error(`Ya tenés una cancha llamada "${name}".`);
    patch.name = name;
  }

  if (params.isActive !== undefined) {
    if (params.isActive === false && courts.filter((c) => c.isActive).length <= 1) {
      throw new Error("Tenés que dejar al menos una cancha activa.");
    }
    patch.is_active = params.isActive;
  }

  if (Object.keys(patch).length === 0) return;

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("venue_courts")
    .update(patch)
    .eq("id", courtId)
    .eq("venue_id", venueId);

  if (error) {
    console.error("[venue-portal] updateCourt falló", { venueId, courtId, error });
    throw new Error("No se pudo guardar el cambio. Intentá de nuevo.");
  }
}
