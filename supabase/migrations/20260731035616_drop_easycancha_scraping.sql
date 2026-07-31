-- Elimina TODO el sistema de scraping de EasyCancha (2026-07-30).
--
-- Motivo: 8 cuentas baneadas. La pelea contra el anti-abuso del proveedor no era
-- sostenible. Ademas llevaba caido desde el 2026-07-15 (tokens vencidos) y produccion
-- corrio 16 dias sin el sin romperse, porque pricing y availability ya hacian fail-open
-- al tarifario de config/venue-pricing-rules.ts.
--
-- El ultimo tarifario observado quedo archivado en
-- docs/tarifario-easycancha-snapshot-2026-07.md, y la curva de 60 min de Padel Park
-- (que solo existia en vivo) se congelo en config/venue-pricing-rules.ts antes de esto.

-- 1) Cron jobs. unschedule falla si el job no existe, asi que se filtra por nombre.
do $$
declare j record;
begin
  for j in select jobname from cron.job where jobname in ('easycancha-sync', 'easycancha-watchdog')
  loop
    perform cron.unschedule(j.jobname);
  end loop;
end $$;

-- 2) La funcion del watchdog (mandaba el mail de frescura por pg_net).
drop function if exists public.easycancha_watchdog();

-- 3) Tablas. easycancha_ops_state solo guardaba el dedup de la alerta del watchdog.
drop table if exists public.easycancha_slot_watches;
drop table if exists public.easycancha_slots;
drop table if exists public.easycancha_accounts;
drop table if exists public.easycancha_session;
drop table if exists public.easycancha_ops_state;

-- 4) Secrets del vault propios del scraping. Se dejan a proposito `resend_api_key` y
--    `ops_alert_email`: son genericos y los reutilizaria cualquier alerta futura a nivel DB.
delete from vault.secrets where name in ('easycancha_app_url', 'easycancha_cron_secret');
