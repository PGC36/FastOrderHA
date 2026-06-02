param(
  [int]$TotalOrders = 100000,
  [int]$Vus = 200,
  [string]$MaxDuration = "10m",
  [double]$IterationDelaySeconds = 0,
  [string]$BaseUrl = "",
  [string]$DbResetHost = "192.168.0.100",
  [string]$FinalStatusDbHost = "192.168.0.100",
  [string]$PrimaryPc = "PC2",
  [string]$BackupPc = "PC4",
  [int]$SuggestedFailoverAfterSeconds = 10
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

function Get-EnvMap {
  param([string]$Path)

  $map = @{}
  if (-not (Test-Path $Path)) {
    return $map
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }

    $parts = $line.Split("=", 2)
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    $map[$key] = $value
  }

  return $map
}

$multiHostEnv = Get-EnvMap (Join-Path $repoRoot "deploy\multi-host\multi-host.env")
$multiHostAppEnv = Get-EnvMap (Join-Path $repoRoot "deploy\multi-host\multi-host.app.env")

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  if ($multiHostAppEnv.ContainsKey("APP_VIP_IP") -and -not [string]::IsNullOrWhiteSpace($multiHostAppEnv["APP_VIP_IP"])) {
    $BaseUrl = "http://$($multiHostAppEnv["APP_VIP_IP"]):8080"
  }
  elseif ($multiHostEnv.ContainsKey("PC2_IP") -and -not [string]::IsNullOrWhiteSpace($multiHostEnv["PC2_IP"])) {
    $BaseUrl = "http://$($multiHostEnv["PC2_IP"]):8080"
  }
  else {
    $BaseUrl = "http://192.168.0.5:8080"
  }
}

if ($DbResetHost -eq "192.168.0.100" -and $multiHostEnv.ContainsKey("DB_PROXY_VIP") -and -not [string]::IsNullOrWhiteSpace($multiHostEnv["DB_PROXY_VIP"])) {
  $DbResetHost = $multiHostEnv["DB_PROXY_VIP"]
}

if ($FinalStatusDbHost -eq "192.168.0.100" -and $multiHostEnv.ContainsKey("DB_PROXY_VIP") -and -not [string]::IsNullOrWhiteSpace($multiHostEnv["DB_PROXY_VIP"])) {
  $FinalStatusDbHost = $multiHostEnv["DB_PROXY_VIP"]
}

Write-Host ""
Write-Host "FastOrder HA - corrida final 50k desde VS Code" -ForegroundColor Cyan
Write-Host ""
Write-Host "Repositorio: $repoRoot"
Write-Host "Carga: $TotalOrders ordenes, $Vus VUs, duracion maxima $MaxDuration"
Write-Host "Base URL: $BaseUrl"
Write-Host "DB reset host: $DbResetHost"
Write-Host "DB status host: $FinalStatusDbHost"
Write-Host ""
Write-Host "Failover esperado por VIP:" -ForegroundColor Yellow
Write-Host "  La app debe entrar por el endpoint configurado en BaseUrl."
Write-Host "  La BD debe seguir por la VIP $FinalStatusDbHost."
Write-Host "  Si quieren probar failover, apaguen o detengan keepalived en $PrimaryPc y verifiquen que $BackupPc tome la VIP." -ForegroundColor Yellow
Write-Host ""
Write-Host "Sugerencia practica:" -ForegroundColor Yellow
Write-Host "  Espera unos $SuggestedFailoverAfterSeconds segundos despues de ver que k6 empezo a contar iteraciones."
Write-Host ""
Write-Host "Comando que se ejecutara aqui:" -ForegroundColor DarkGray
Write-Host "  node .\monitoring\k6\run-50k-db-chaos.js --total-orders $TotalOrders --vus $Vus --base-url $BaseUrl --max-duration $MaxDuration --iteration-delay-seconds $IterationDelaySeconds --disable-chaos --db-reset-host $DbResetHost --final-status-db-host $FinalStatusDbHost --final-poll-interval-seconds 10 --final-poll-timeout-minutes 30"
Write-Host ""

node .\monitoring\k6\run-50k-db-chaos.js `
  --total-orders $TotalOrders `
  --vus $Vus `
  --base-url $BaseUrl `
  --max-duration $MaxDuration `
  --iteration-delay-seconds $IterationDelaySeconds `
  --disable-chaos `
  --db-reset-host $DbResetHost `
  --final-status-db-host $FinalStatusDbHost `
  --final-poll-interval-seconds 10 `
  --final-poll-timeout-minutes 30
