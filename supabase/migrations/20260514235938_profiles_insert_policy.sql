-- BACKFILL (2026-07-30): esta migracion se habia aplicado en prod SIN quedar
-- versionada en el repo. Se reconstruye desde
-- supabase_migrations.schema_migrations (version 20260514235938) para que la DB
-- se pueda recrear desde cero. Ya esta registrada en prod: `db push` la salta.
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());
