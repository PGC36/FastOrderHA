param(
  [int]$TotalOrders = 100000,
  [int]$Vus = 200,
  [string]$MaxDuration = "10m",
  [double]$IterationDelaySeconds = 0,
  [string]$DbResetHost = "192.168.0.7",
  [string]$FinalStatusDbHost = "192.168.0.7",
  [string]$PrimaryContainer = "fastorder-db-1",
  [string]$PrimaryPc = "PC2",
  [int]$SuggestedKillAfterSeconds = 10
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

Write-Host ""
Write-Host "FastOrder HA - corrida final 50k desde VS Code" -ForegroundColor Cyan
Write-Host ""
Write-Host "Repositorio: $repoRoot"
Write-Host "Carga: $TotalOrders ordenes, $Vus VUs, duracion maxima $MaxDuration"
Write-Host "DB reset host: $DbResetHost"
Write-Host "DB status host: $FinalStatusDbHost"
Write-Host ""
Write-Host "Failover manual esperado:" -ForegroundColor Yellow
Write-Host "  En $PrimaryPc ejecuta este comando cuando la carga ya este corriendo:"
Write-Host "  docker kill $PrimaryContainer" -ForegroundColor Yellow
Write-Host ""
Write-Host "Sugerencia practica:" -ForegroundColor Yellow
Write-Host "  Espera unos $SuggestedKillAfterSeconds segundos despues de ver que k6 empezo a contar iteraciones."
Write-Host ""
Write-Host "Comando que se ejecutara aqui:" -ForegroundColor DarkGray
Write-Host "  node .\monitoring\k6\run-50k-db-chaos.js --total-orders $TotalOrders --vus $Vus --max-duration $MaxDuration --iteration-delay-seconds $IterationDelaySeconds --disable-chaos --db-reset-host $DbResetHost --final-status-db-host $FinalStatusDbHost --final-poll-interval-seconds 10 --final-poll-timeout-minutes 30"
Write-Host ""

node .\monitoring\k6\run-50k-db-chaos.js `
  --total-orders $TotalOrders `
  --vus $Vus `
  --max-duration $MaxDuration `
  --iteration-delay-seconds $IterationDelaySeconds `
  --disable-chaos `
  --db-reset-host $DbResetHost `
  --final-status-db-host $FinalStatusDbHost `
  --final-poll-interval-seconds 10 `
  --final-poll-timeout-minutes 30

