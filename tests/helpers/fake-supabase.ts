/**
 * Minimal in-memory fake of the Supabase JS client, covering the subset of the
 * PostgREST query builder used by services/payments/service.ts:
 *   .from(t).select/insert/update/delete · .eq/.neq/.in · .order/.limit
 *   .maybeSingle()/.single() · awaiting the builder · .rpc() · .auth.admin
 *
 * Rows are stored in plain arrays and mutated in place, so a write is visible to
 * the next read — enough to exercise the real orchestration (capacity, intents,
 * child allocations, webhook fan-out) without a database.
 */
import { randomUUID } from "node:crypto";

export type Row = Record<string, unknown>;

export interface FakeStore {
  matches: Row[];
  match_players: Row[];
  payment_intents: Row[];
  payments: Row[];
  profiles: Row[];
  refunds: Row[];
  analytics_events: Row[];
  /** auth.users keyed by id → { user: { email, user_metadata } } */
  authUsers: Record<string, { email?: string; user_metadata?: Row } | null>;
  [table: string]: unknown;
}

export function createStore(seed: Partial<FakeStore> = {}): FakeStore {
  return {
    matches: [],
    match_players: [],
    payment_intents: [],
    payments: [],
    profiles: [],
    refunds: [],
    analytics_events: [],
    authUsers: {},
    ...seed,
  };
}

type Filter = { kind: "eq" | "neq" | "in"; col: string; val: unknown };
type Mode = "array" | "maybeSingle" | "single";
const clone = (r: Row): Row => ({ ...r });

class Query implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private filters: Filter[] = [];
  private payload: Row | Row[] | undefined;
  private countMode = false;
  private headMode = false;
  private orderCol?: string;
  private orderAsc = true;
  private limitN?: number;
  private inserted: Row[] = [];

  constructor(private store: FakeStore, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headMode = true;
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row, _opts?: { onConflict?: string }) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push({ kind: "neq", col, val });
    return this;
  }
  in(col: string, val: unknown[]) {
    this.filters.push({ kind: "in", col, val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }

  private rows(): Row[] {
    if (!Array.isArray(this.store[this.table])) this.store[this.table] = [];
    return this.store[this.table] as Row[];
  }

  private matches = (row: Row): boolean =>
    this.filters.every((f) => {
      if (f.kind === "eq") return row[f.col] === f.val;
      if (f.kind === "neq") return row[f.col] !== f.val;
      return (f.val as unknown[]).includes(row[f.col]);
    });

  private pack(arr: Row[], mode: Mode) {
    if (mode === "maybeSingle") return { data: arr[0] ?? null, error: null };
    if (mode === "single")
      return arr.length ? { data: arr[0], error: null } : { data: null, error: { message: "No rows found" } };
    return { data: arr, error: null };
  }

  private exec(mode: Mode): { data: unknown; error: unknown; count?: number } {
    if (this.op === "insert") {
      const arr = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      this.inserted = arr.map((r) => ({ ...r, id: (r.id as string) ?? randomUUID() }));
      this.rows().push(...this.inserted);
      return this.pack(this.inserted.map(clone), mode);
    }
    if (this.op === "update") {
      const updated = this.rows().filter(this.matches);
      for (const r of updated) Object.assign(r, this.payload);
      return this.pack(updated.map(clone), mode);
    }
    if (this.op === "delete") {
      const removed = this.rows().filter(this.matches);
      this.store[this.table] = this.rows().filter((r) => !this.matches(r));
      return this.pack(removed.map(clone), mode);
    }
    // select
    let result = this.rows().filter(this.matches).map(clone);
    if (this.orderCol) {
      const c = this.orderCol;
      const dir = this.orderAsc ? 1 : -1;
      result = result.sort((a, b) => {
        const av = a[c] as number | string;
        const bv = b[c] as number | string;
        return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
      });
    }
    if (this.limitN != null) result = result.slice(0, this.limitN);
    if (this.countMode) {
      return { data: this.headMode ? null : result, count: result.length, error: null };
    }
    return this.pack(result, mode);
  }

  maybeSingle() {
    return Promise.resolve(this.exec("maybeSingle"));
  }
  single() {
    return Promise.resolve(this.exec("single"));
  }
  then<TR1 = unknown, TR2 = never>(
    onfulfilled?: ((v: { data: unknown; error: unknown; count?: number }) => TR1 | PromiseLike<TR1>) | null,
    onrejected?: ((reason: unknown) => TR2 | PromiseLike<TR2>) | null,
  ): Promise<TR1 | TR2> {
    return Promise.resolve(this.exec("array")).then(onfulfilled, onrejected);
  }
}

function runRpc(store: FakeStore, name: string, args: Row) {
  if (name === "try_fill_match") {
    const matchId = args.p_match_id;
    const match = store.matches.find((m) => m.id === matchId);
    const max = (match?.max_players as number) ?? 4;
    const paid = store.match_players.filter(
      (mp) => mp.match_id === matchId && mp.status === "paid",
    ).length;
    if (match && paid >= max) {
      match.status = "full";
      match.filled_at = new Date().toISOString();
      return { data: "full", error: null };
    }
    return { data: (match?.status as string) ?? "open", error: null };
  }
  return { data: null, error: null };
}

export function createFakeSupabase(store: FakeStore) {
  return {
    from: (table: string) => new Query(store, table),
    rpc: (name: string, args: Row) => Promise.resolve(runRpc(store, name, args)),
    auth: {
      admin: {
        getUserById: (id: string) =>
          Promise.resolve({ data: { user: store.authUsers[id] ?? null }, error: null }),
      },
    },
  };
}
