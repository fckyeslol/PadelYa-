# EasyCancha scrape (4 semanas, 6 clubs)

## Requisitos

- Cuenta EasyCancha activa (no bloqueada por intentos automatizados).
- Token `authtoken` reciente (válido ~7 días).

## 1. Obtener token (automático, recomendado)

Login real con Playwright que pasa el reCAPTCHA v3 de forma natural (navegador
de verdad, perfil persistente, tipeo humano) y guarda el `authtoken` en
`.firecrawl/session.json` (gitignored).

```powershell
# una sola vez: instalar el navegador
npx playwright install chromium

# credenciales en .env.local (gitignored)
#   EASYCANCHA_EMAIL=tu@email.com
#   EASYCANCHA_PASSWORD=tu-clave

npm run easycancha:token        # ventana visible (recomendado)
# o: npx tsx scripts/easycancha-refresh-token.ts --headless
```

El token dura ~7 días. **Corré esto espaciado, no en loop**: el login de EasyCancha
tiene detección de abuso (código `-48`) y puede marcar la cuenta. El perfil
persistente reusa la sesión válida si todavía no expiró (no re-loguea de gusto).

### Fallback manual

1. Inicia sesión en https://www.easycancha.com/login desde **tu navegador**.
2. DevTools → Application → Cookies → `authtoken`.
3. Guarda en `.firecrawl/session.json`: `{ "token": "eyJ...", "awsalb": "" }`
   (o `$env:EASYCANCHA_TOKEN = "eyJ..."`).

## 2. Descargar precios vía API

```powershell
cd c:\Users\mateo\projects\padel-baq
python scripts/easycancha_fetch_4weeks.py
```

- Por defecto **fusiona** con `barranquilla_padel_prices.csv` existente.
- `--replace` sobrescribe todo el archivo.

## 3. Firecrawl Agent (deprecado)

Reemplazado por `scripts/easycancha-refresh-token.ts` (sección 1), que es local,
gratis y más confiable. La carpeta `.firecrawl/` queda solo como referencia.

## 4. Regenerar precios en la app

```powershell
npm run pricing:generate
npm run pricing:validate
npm run pricing:backfill
```

## Clubs (IDs)

| Club | ID | timespan |
|------|-----|----------|
| PADEL ZENTER DEL RIO | 1125 | 90 |
| PADEL ZENTER LA ARENOSA | 1475 | 90 |
| Pádel Park Barranquilla | 1442 | 60 |
| La Jaula Padel Barranquilla | 1526 | 90 |
| X3 Padel Club | 1675 | 90 |
| Ace Padel Club | 1866 | 90 |

(Centralizados en `config/easycancha.ts`.)

## Disponibilidad → Supabase (cron, hands-off)

Sincroniza ocupación de los 6 clubes a Supabase y avisa por email cuando un turno
pasa de ocupado → libre. Corre como cron de Vercel (no necesita tu PC prendida).

**Deploy (una vez):**

1. **Migración** — pegá `supabase/migrations/20260605020000_easycancha_availability.sql`
   en el SQL Editor del dashboard de Supabase y ejecutá (crea `easycancha_session`,
   `easycancha_slots`, `easycancha_slot_watches`).
2. **Token a Supabase** — corré `npm run easycancha:token` (ahora también lo sube a
   `easycancha_session`, que es de donde lo lee el cron). Repetir cada ~7 días.
3. **Schedule (pg_cron + pg_net)** — aplicá
   `supabase/migrations/20260605030000_easycancha_cron.sql` (agenda el cron cada 5 min).
   Lee la URL y el `CRON_SECRET` desde Vault, así que **una vez** en el SQL Editor corré
   (con tus valores reales, esto NO se commitea):

   ```sql
   select vault.create_secret('https://padelya.co', 'easycancha_app_url');
   select vault.create_secret('TU_CRON_SECRET',      'easycancha_cron_secret');
   ```

   Verificar: `select * from cron.job;` y `select * from cron.job_run_details order by start_time desc limit 5;`

**Alertas:** sin watches el cron solo agrega datos. Gestionalos con el script:

```powershell
npm run easycancha:watch -- add tu@email.com                       # comodín (todo)
npm run easycancha:watch -- add tu@email.com club=1125 from=18:00 to=22:00
npm run easycancha:watch -- list
npm run easycancha:watch -- remove tu@email.com
```

(weekday: 0=domingo … 6=sábado.)
