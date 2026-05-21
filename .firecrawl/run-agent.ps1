# One-off EasyCancha agent run (credentials via env, not saved)
$ErrorActionPreference = 'Stop'
$email = $env:EC_EMAIL
$pass = $env:EC_PASS
if (-not $email -or -not $pass) { throw 'Set EC_EMAIL and EC_PASS' }
$prompt = Get-Content -Raw (Join-Path $PSScriptRoot 'agent-prompt.txt')
$prompt += "`n`nLogin email: $email`nLogin password: $pass"
$urls = 'https://www.easycancha.com/login,https://www.easycancha.com/es-CO/colombia/arriendo/deportes/padel/atlantico/barranquilla'
firecrawl agent $prompt `
  --schema-file (Join-Path $PSScriptRoot 'agent-easycancha-schema.json') `
  --urls $urls `
  --max-credits 1000 `
  --wait `
  --timeout 900 `
  -o (Join-Path $PSScriptRoot 'agent-4weeks.json')
