param(
  [string]$ScriptId = "1bT5Ax1ceE7Bu9DpRoYO2RS0DKqRpTc6EoKBP-zEVulenpS85qEChjtj2",
  [string]$DeploymentId = "AKfycbwd29DAfHveG_BPgXKNxfErri5dRLQHcXCPELr0qPuvr8MvoHcwt79EWXXUYjmsbMg"
)

$ErrorActionPreference = "Stop"
$Repo = "zatzuro/pmc-cd-v1-26"
$RootDir = "google-apps-script"

function Require-Command([string]$Name, [string]$Help) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name no esta instalado. $Help"
  }
}

Require-Command "node" "Instala Node.js 20 o superior."
Require-Command "npm" "Instala Node.js 20 o superior."
Require-Command "gh" "Instala GitHub CLI y ejecuta: gh auth login"

gh auth status | Out-Null

if (-not (Get-Command "clasp" -ErrorAction SilentlyContinue)) {
  Write-Host "Instalando clasp..."
  npm install --global "@google/clasp@3"
}

$ClaspRc = Join-Path $HOME ".clasprc.json"
if (-not (Test-Path $ClaspRc)) {
  Write-Host "Se abrira Google para autorizar Apps Script."
  clasp login
}

if (-not (Test-Path $ClaspRc)) {
  throw "No se genero $ClaspRc. Repite clasp login."
}

if ([string]::IsNullOrWhiteSpace($ScriptId)) {
  $ScriptId = Read-Host "Pega el Script ID de Apps Script"
}
if ([string]::IsNullOrWhiteSpace($DeploymentId)) {
  $DeploymentId = Read-Host "Pega el Deployment ID del Web App existente"
}

$ClaspJson = @{
  scriptId = $ScriptId
  rootDir = $RootDir
} | ConvertTo-Json -Compress

Write-Host "Guardando credenciales de forma segura en GitHub Secrets..."
Get-Content $ClaspRc -Raw | gh secret set CLASPRC_JSON --repo $Repo
$ClaspJson | gh secret set CLASP_JSON --repo $Repo
$DeploymentId | gh secret set APPS_SCRIPT_DEPLOYMENT_ID --repo $Repo

Write-Host "Disparando validacion del pipeline..."
gh workflow run apps-script-deploy.yml --repo $Repo

Write-Host ""
Write-Host "Listo. GitHub ya puede desplegar Apps Script desde main."
Write-Host "El workflow verificara que el Deployment ID pertenezca al Script ID antes de publicar."
