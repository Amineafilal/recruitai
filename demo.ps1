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
# C'est une BÉQUILLE DE DÉMONSTRATION, pas un déploiement : tout s'arrête avec
# cette fenêtre, et l'URL du tunnel change à chaque relance — d'où la
# reconstruction du site à l'étape 3.
#
# Pourquoi ce détour plutôt qu'un hébergeur, état constaté en août 2026 :
#   Heroku          plus d'offre gratuite depuis 2022, Eco à 5 $/mois
#   Fly.io          essai de 7 jours, puis carte obligatoire
#   Koyeb           offre gratuite fermée aux nouveaux comptes
#   Hugging Face    Spaces Docker passés au plan payant en juillet 2026
#   Render          gratuit et sans carte en principe, mais vérification
#                   d'identité par carte déclenchée sur certains comptes
#
# Le jour où l'un d'eux redevient praticable, render.yaml est prêt à la racine
# et le Dockerfile fonctionne partout : seules les variables changent.

$ErrorActionPreference = "Stop"
$racine = $PSScriptRoot
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$journal = Join-Path $env:TEMP "recruitai-tunnel.log"

if (-not (Test-Path $cloudflared)) {
    Write-Host "cloudflared introuvable. Installer avec :" -ForegroundColor Red
    Write-Host "  winget install --id Cloudflare.cloudflared -e"
    exit 1
}

# --- 0. Verifications prealables -------------------------------------------
# Faites AVANT d'ouvrir quoi que ce soit : decouvrir une session Vercel expiree
# apres avoir demarre l'API et le tunnel oblige a tout recommencer, et c'est
# toujours cinq minutes avant le rendez-vous que ca arrive.
Write-Host "Verification de la session Vercel..." -NoNewline
Push-Location (Join-Path $racine "apps\web")
try { $compte = (npx --yes vercel whoami 2>&1 | Select-Object -Last 1) }
finally { Pop-Location }

if ($LASTEXITCODE -ne 0 -or -not $compte) {
    Write-Host " non connecte." -ForegroundColor Red
    Write-Host "Lance d'abord :  npx vercel login" -ForegroundColor Yellow
    exit 1
}
Write-Host " $compte." -ForegroundColor Green

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

# Un tunnel ouvert ne prouve PAS que l'API reponde a travers lui : cloudflared
# annonce son URL avant meme d'avoir joint quoi que ce soit. Sans ce controle,
# le script se termine sur un message de succes et la demo casse en direct.
Write-Host "Controle de bout en bout..." -NoNewline
$joignable = $false
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 3
    try {
        $r = Invoke-WebRequest "$urlApi/health" -TimeoutSec 10 -UseBasicParsing
        if ($r.Content -match '"ok"') { $joignable = $true; break }
    } catch { }
    Write-Host "." -NoNewline
}
if (-not $joignable) {
    Write-Host " l'API ne repond pas a travers le tunnel." -ForegroundColor Red
    Write-Host "Journal : $journal"
    Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host " OK." -ForegroundColor Green

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
    if ($LASTEXITCODE -ne 0) {
        Write-Host " echec." -ForegroundColor Red
        Write-Host $sortie
        Write-Host ""
        Write-Host "L'API reste accessible ici :" -ForegroundColor Yellow
        Write-Host "  $urlApi" -ForegroundColor White
        Write-Host "Colle cette adresse dans NEXT_PUBLIC_API_URL sur vercel.com," -ForegroundColor Yellow
        Write-Host "puis redeploie a la main." -ForegroundColor Yellow
        Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
        exit 1
    }
    Write-Host " termine." -ForegroundColor Green
} finally {
    Pop-Location
}

# Dernier controle : le site public parle-t-il vraiment a l'API ? La page de
# connexion passe par une server action, donc par le backend — si elle
# repond, la chaine complete tient.
Write-Host "Verification du site public..." -NoNewline
try {
    $site = Invoke-WebRequest "https://recruitai-seven.vercel.app/connexion" -TimeoutSec 25 -UseBasicParsing
    if ($site.StatusCode -eq 200) { Write-Host " OK." -ForegroundColor Green }
    else { Write-Host " reponse inattendue ($($site.StatusCode))." -ForegroundColor Yellow }
} catch {
    Write-Host " injoignable — verifie manuellement avant la demo." -ForegroundColor Yellow
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
