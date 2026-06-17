-- Salud de cuentas: marcar cuándo se avisó por última vez que una cuenta quedó "caída"
-- (token vencido o rechazado por EasyCancha). Sirve para deduplicar la alerta por email:
-- se avisa UNA vez cuando cae y se limpia (null) cuando vuelve a tener token vigente.
--
-- null  = cuenta sana, o ya recuperada (no hay alerta pendiente).
-- fecha = ya se avisó que está caída; no volver a spammear hasta que se recupere.
alter table public.easycancha_accounts
  add column if not exists down_alerted_at timestamptz;
