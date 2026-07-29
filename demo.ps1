# Démarre RecruitAI et l'expose sur une URL publique, le temps d'une démo.
#
# Usage : clic droit sur ce fichier -> "Exécuter avec PowerShell"
#         ou, dans un terminal :  .\demo.ps1
#
# Ce n'est PAS un déploiement : l'application tourne sur cette machine et
# l'adresse cesse de fonctionner dès que cette fenêtre est fermée. C'est une
# solution d'attente pour montrer le produit sans hébergeur payant.

$ErrorActionPreference = "Stop"
$racine = $PSScriptRoot

# L'installateur winget ne place pas cloudflared dans le PATH.
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
if (-not (Test-Path $cloudflared)) {
    Write-Host "cloudflared introuvable. Installer avec :" -ForegroundColor Red
    Write-Host "  winget install --id Cloudflare.cloudflared -e"
    exit 1
}

function Attendre-Serveur($url, $nom, $secondes = 90) {
    Write-Host "Démarrage de $nom..." -NoNewline
    for ($i = 0; $i -lt $secondes; $i += 3) {
        try {
            Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing | Out-Null
            Write-Host " prêt." -ForegroundColor Green
            return $true
        } catch { Start-Sleep -Seconds 3; Write-Host "." -NoNewline }
    }
    Write-Host " échec." -ForegroundColor Red
    return $false
}

# --- API -------------------------------------------------------------------
try { Invoke-WebRequest "http://localhost:3001/health" -TimeoutSec 3 -UseBasicParsing | Out-Null }
catch {
    Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$racine\apps\api'; npm start" -WindowStyle Minimized
    if (-not (Attendre-Serveur "http://localhost:3001/health" "l'API")) { exit 1 }
}

# --- Site ------------------------------------------------------------------
try { Invoke-WebRequest "http://localhost:3002/" -TimeoutSec 3 -UseBasicParsing | Out-Null }
catch {
    Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$racine\apps\web'; npm run dev" -WindowStyle Minimized
    if (-not (Attendre-Serveur "http://localhost:3002/" "le site")) { exit 1 }
}

Write-Host ""
Write-Host "Ouverture du tunnel public. L'adresse en https://...trycloudflare.com" -ForegroundColor Cyan
Write-Host "s'affiche ci-dessous : c'est elle que tu envoies au cabinet." -ForegroundColor Cyan
Write-Host "Garde cette fenetre ouverte pendant toute la demo." -ForegroundColor Yellow
Write-Host ""

& $cloudflared tunnel --url http://localhost:3002
