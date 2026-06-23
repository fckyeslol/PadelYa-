-- Watchdog de frescura del scraping de EasyCancha.
--
-- Por qué: el 2026-06-20 el sync se detuvo en silencio ~3 días porque el secreto
-- del vault (easycancha_cron_secret) se desincronizó del CRON_SECRET de Vercel y
-- la ruta /api/cron/easycancha-sync devolvía 401 en cada tick. El fallo era
-- invisible (pg_cron marca "succeeded" porque pg_net es async; el 401 solo se ve
-- en net._http_response) y NO había alerta de "el sync no está corriendo": la
-- alerta existente (reportAccountHealth) vive DENTRO de la ruta, así que no se
-- ejecuta justo cuando la ruta falla.
--
-- Este watchdog es INDEPENDIENTE de esa ruta y de ese secreto: corre como su
-- propio pg_cron, lee la frescura de easycancha_slots y, si los datos se quedan
-- viejos en horario activo, alerta por Resend DIRECTO (no pasa por Vercel). Así
-- captura cualquier causa de "dejó de alimentarse": 401 por secreto, token
-- expirado, proxy caído, pg_cron-sync mal, syncTick que tira error, etc.

-- Estado singleton para deduplicar alertas.
create table if not exists public.easycancha_ops_state (
  id               smallint primary key default 1 check (id = 1),
  stale_alerted_at timestamptz
);
insert into public.easycancha_ops_state (id) values (1) on conflict (id) do nothing;

create or replace function public.easycancha_watchdog()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last         timestamptz;
  v_stale_min    numeric;
  v_hour         int;
  v_alerted      timestamptz;
  v_threshold    int := 180;   -- min sin datos frescos que se considera "caído"
  v_dedup        interval := interval '6 hours';
  v_resend_key   text;
  v_to           text;
  v_from         text := 'PadelYa <noreply@padelya.co>';
begin
  -- Última captura de disponibilidad para fechas vigentes (hoy en adelante).
  select max(captured_at) into v_last
  from public.easycancha_slots
  where slot_date >= (now() at time zone 'America/Bogota')::date;

  -- Ventana de silencio (madrugada 01:00–07:00 Bogotá) + colchón de reanudación
  -- matutina: en ese rango es NORMAL que no haya datos nuevos → no alertar.
  v_hour := extract(hour from (now() at time zone 'America/Bogota'))::int;
  if v_hour < 7 then
    return;
  end if;

  v_stale_min := extract(epoch from (now() - coalesce(v_last, 'epoch'::timestamptz))) / 60;
  select stale_alerted_at into v_alerted from public.easycancha_ops_state where id = 1;

  -- Datos frescos → limpiar la marca (recuperación) y salir.
  if v_stale_min <= v_threshold then
    if v_alerted is not null then
      update public.easycancha_ops_state set stale_alerted_at = null where id = 1;
    end if;
    return;
  end if;

  -- Stale: no repetir la alerta dentro de la ventana de dedup.
  if v_alerted is not null and v_alerted > now() - v_dedup then
    return;
  end if;

  -- Credenciales en el vault (sin ellas no hay canal → salir sin romper).
  select decrypted_secret into v_resend_key from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into v_to        from vault.decrypted_secrets where name = 'ops_alert_email';
  if v_resend_key is null or v_to is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', v_from,
      'to', string_to_array(v_to, ','),
      'subject', '⚠️ EasyCancha: el scraping dejó de alimentarse',
      'html',
        '<p>La disponibilidad de EasyCancha no se actualiza hace ~' || round(v_stale_min) ||
        ' min (última captura: ' || coalesce(v_last::text, 'nunca') || ').</p>' ||
        '<p>Posibles causas a revisar:</p><ul>' ||
        '<li>Token expirado → corre <code>npm run easycancha:token</code></li>' ||
        '<li>Secreto del cron desincronizado (vault easycancha_cron_secret vs CRON_SECRET de Vercel → 401)</li>' ||
        '<li>pg_cron easycancha-sync apagado, o syncTick tirando error</li>' ||
        '<li>Proxy residencial caído / IP del token cambiada (403)</li>' ||
        '</ul>'
    )
  );

  update public.easycancha_ops_state set stale_alerted_at = now() where id = 1;
end;
$$;

-- Server-only.
revoke execute on function public.easycancha_watchdog() from anon, authenticated;

-- Corre cada 30 min, INDEPENDIENTE del pg_cron del sync.
select cron.schedule('easycancha-watchdog', '*/30 * * * *', $$select public.easycancha_watchdog();$$);
