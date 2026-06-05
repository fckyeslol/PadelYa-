-- Agenda el sync de disponibilidad de EasyCancha cada 5 minutos con pg_cron + pg_net.
-- La URL del app y el CRON_SECRET se leen de Vault, así NO quedan en el repo.
--
-- ⚠️ ANTES (o después) de aplicar esta migración, corré UNA vez en el SQL Editor de
--    Supabase con tus valores reales (esto NO se commitea):
--
--      select vault.create_secret('https://padelya.co', 'easycancha_app_url');
--      select vault.create_secret('TU_CRON_SECRET',      'easycancha_cron_secret');
--
--    (si ya existen, usá vault.update_secret en vez de create_secret.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- cron.schedule hace upsert por nombre: re-aplicar la migración no duplica el job.
select cron.schedule(
  'easycancha-sync',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'easycancha_app_url')
           || '/api/cron/easycancha-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'easycancha_cron_secret'),
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 60000
  );
  $job$
);
