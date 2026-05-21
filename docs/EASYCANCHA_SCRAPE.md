# EasyCancha scrape (4 semanas, 6 clubs)

## Requisitos

- Cuenta EasyCancha activa (no bloqueada por intentos automatizados).
- Token `authtoken` reciente (válido ~7 días).

## 1. Obtener token (manual, recomendado)

1. Inicia sesión en https://www.easycancha.com/login desde **tu navegador** (no bots).
2. DevTools → Application → Cookies → `authtoken`.
3. Guarda en `.firecrawl/session.json`:

```json
{
  "token": "eyJ...",
  "awsalb": ""
}
```

O exporta variables de entorno:

```powershell
$env:EASYCANCHA_TOKEN = "eyJ..."
```

## 2. Descargar precios vía API

```powershell
cd c:\Users\mateo\projects\padel-baq
python scripts/easycancha_fetch_4weeks.py
```

- Por defecto **fusiona** con `barranquilla_padel_prices.csv` existente.
- `--replace` sobrescribe todo el archivo.

## 3. Firecrawl Agent (opcional)

```powershell
$env:EC_EMAIL = "tu@email.com"
$env:EC_PASS = "tu-clave"
powershell -File .firecrawl/run-agent.ps1
```

EasyCancha puede bloquear cuentas con login automatizado + reCAPTCHA.

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
