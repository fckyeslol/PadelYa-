-- Proxy residencial por cuenta: cada una de las 6 cuentas sale por su propio IP
-- residencial sticky de Barranquilla, para que se vean como 6 humanos reales y no se
-- correlacionen por IP. Formato: http://usuario:clave@host:puerto (con la sesión sticky
-- codificada en el usuario del proveedor). Vacío = sale directo (sin proxy).
--
-- Es la fuente de verdad del proxy: lo usa tanto el sync (rutea el fetch) como el script
-- de refresh (Playwright loguea por el mismo IP, para que login y lecturas sean coherentes).
alter table public.easycancha_accounts
  add column if not exists proxy_url text not null default '';
