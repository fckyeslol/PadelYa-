-- BACKFILL (2026-07-30): esta migracion se habia aplicado en prod SIN quedar
-- versionada en el repo. `matches.duration_minutes` es NOT NULL y la usa toda
-- la app (pricing, slots, MatchForm), pero no aparecia en ningun archivo de
-- supabase/migrations/ — un rebuild desde el repo arrancaba roto.
-- Se reconstruye desde supabase_migrations.schema_migrations
-- (version 20260524201319). Ya esta registrada en prod: `db push` la salta.
ALTER TABLE matches ADD COLUMN duration_minutes integer NOT NULL DEFAULT 90;
