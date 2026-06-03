param(
    [string]$EnvFile = ".\multi-host.env",
    [string]$TemplateFile = "..\..\monitoring\prometheus\prometheus.multi-host.tmpl.yml",
    [string]$OutputFile = "..\..\monitoring\prometheus\prometheus.multi-host.generated.yml"
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "No se encontro el archivo de variables: $Path"
    }

    $values = @{}

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()

        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }

        $parts = $trimmed -split "=", 2
        if ($parts.Count -ne 2) {
            throw "Linea invalida en ${Path}: $line"
        }

        $values[$parts[0].Trim()] = $parts[1].Trim()
    }

    return $values
}

$resolvedEnvFile = Join-Path $PSScriptRoot $EnvFile
$resolvedTemplateFile = Join-Path $PSScriptRoot $TemplateFile
$resolvedOutputFile = Join-Path $PSScriptRoot $OutputFile

$vars = Read-EnvFile -Path $resolvedEnvFile
$required = @("PC1_IP", "PC2_IP", "PC3_IP", "PC4_IP")

foreach ($key in $required) {
    if (-not $vars.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($vars[$key])) {
        throw "Falta la variable obligatoria '$key' en $resolvedEnvFile"
    }
}

if (-not $vars.ContainsKey("APP_HOST") -or [string]::IsNullOrWhiteSpace($vars["APP_HOST"])) {
    $vars["APP_HOST"] = $vars["PC2_IP"]
}

if (-not $vars.ContainsKey("RABBITMQ_HOST") -or [string]::IsNullOrWhiteSpace($vars["RABBITMQ_HOST"])) {
    $vars["RABBITMQ_HOST"] = $vars["PC2_IP"]
}

$serviceDefaults = @{
    "API_GATEWAY_HOST" = $vars["PC2_IP"]
    "MENU_SERVICE_HOST" = $vars["PC2_IP"]
    "ORDER_SERVICE_HOST" = $vars["PC2_IP"]
    "INVENTORY_SERVICE_HOST" = $vars["PC2_IP"]
    "KITCHEN_SERVICE_HOST" = $vars["PC2_IP"]
    "DELIVERY_SERVICE_HOST" = $vars["PC3_IP"]
    "NOTIFICATION_SERVICE_HOST" = $vars["PC3_IP"]
}

foreach ($key in $serviceDefaults.Keys) {
    if (-not $vars.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($vars[$key])) {
        $vars[$key] = $serviceDefaults[$key]
    }
}

$content = Get-Content -LiteralPath $resolvedTemplateFile -Raw
foreach ($key in @($required + @("APP_HOST", "RABBITMQ_HOST") + @($serviceDefaults.Keys))) {
    $content = $content.Replace('${' + $key + '}', $vars[$key])
}

$outputDir = Split-Path -Parent $resolvedOutputFile
if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

Set-Content -LiteralPath $resolvedOutputFile -Value $content -NoNewline

Write-Host "Archivo generado:" $resolvedOutputFile
