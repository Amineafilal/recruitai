# Rend RecruitAI pleinement fonctionnel sur son adresse Vercel publique,
# le temps d'une démonstration.
#
#   Visiteur -> Vercel (site, toujours en ligne) -> tunnel -> ce PC (API)
#
# Le site est hébergé en permanence chez Vercel ; seule l'API tourne ici. Ce
# script démarre l'API, ouvre un tunnel public vers elle, puis reconfigure
# Vercel pour qu'il l'appelle à travers ce tunnel.
#
# Usage : .\demo.ps1
#
# Tant qu'aucun hébergeur ne peut accueillir l'API (carte bancaire exigée
# partout), c'est la seule façon d'avoir l'application complète en ligne.
# Ce n'est PAS un déploiement : tout s'arrête avec cette fenêtre.

$ErrorActionPreference = "Stop"
$racine = $PSScriptRoot
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$journal = Join-Path $env:TEMP "recruitai-tunnel.log"

if (-not (Test-Path $cloudflared)) {
    Write-Host "cloudflared introuvable. Installer avec :" -ForegroundColor Red
    Write-Host "  winget install --id Cloudflare.cloudflared -e"
    exit 1
}

# --- 1. API locale ---------------------------------------------------------
function Api-Repond {
    try { Invoke-WebRequest "http://localhost:3001/health" -TimeoutSec 3 -UseBasicParsing | Out-Null; $true }
    catch { $false }
}

if (-not (Api-Repond)) {
    Write-Host "Demarrage de l'API..." -NoNewline
    Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$racine\apps\api'; npm start" -WindowStyle Minimized
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 3
        if (Api-Repond) { break }
        Write-Host "." -NoNewline
    }
    if (-not (Api-Repond)) { Write-Host " echec." -ForegroundColor Red; exit 1 }
    Write-Host " prete." -ForegroundColor Green
} else {
    Write-Host "API deja demarree." -ForegroundColor Green
}

# --- 2. Tunnel public vers l'API -------------------------------------------
Write-Host "Ouverture du tunnel..." -NoNewline
Remove-Item $journal -ErrorAction SilentlyContinue
$tunnel = Start-Process $cloudflared `
    -ArgumentList "tunnel","--url","http://localhost:3001" `
    -RedirectStandardError $journal -PassThru -WindowStyle Hidden

$urlApi = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Path $journal) {
        $trouve = Select-String -Path $journal -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" `
                  -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($trouve) { $urlApi = $trouve.Matches[0].Value; break }
    }
    Write-Host "." -NoNewline
}

if (-not $urlApi) {
    Write-Host " echec." -ForegroundColor Red
    Write-Host "Journal : $journal"
    Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host " ouvert." -ForegroundColor Green
Write-Host "  API publique : $urlApi" -ForegroundColor Gray

# --- 3. Vercel pointe vers ce tunnel ---------------------------------------
# NEXT_PUBLIC_API_URL est figee A LA COMPILATION : changer la variable ne
# suffit pas, il faut reconstruire. D'ou le redeploiement ci-dessous.
Write-Host "Mise a jour de Vercel..." -ForegroundColor Cyan
Push-Location (Join-Path $racine "apps\web")
try {
    npx vercel env rm NEXT_PUBLIC_API_URL production --yes 2>&1 | Out-Null
    $urlApi | npx vercel env add NEXT_PUBLIC_API_URL production 2>&1 | Out-Null
    Write-Host "Reconstruction du site (2-3 min)..." -NoNewline
    $sortie = npx vercel deploy --prod --yes 2>&1
    Write-Host " termine." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " RecruitAI est en ligne et pleinement fonctionnel" -ForegroundColor Green
Write-Host " https://recruitai-seven.vercel.app" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Garde cette fenetre ouverte pendant toute la demo." -ForegroundColor Yellow
Write-Host "A la fermeture, le site restera visible mais la connexion" -ForegroundColor Yellow
Write-Host "et le tableau de bord cesseront de fonctionner." -ForegroundColor Yellow
Write-Host ""
Write-Host "Ctrl+C pour arreter." -ForegroundColor Gray

try { Wait-Process -Id $tunnel.Id }
finally { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue }
