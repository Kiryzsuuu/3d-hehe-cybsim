#Requires -Version 5.1
<#
  One-shot setup + launch for CyberSim.
  Installs dependencies, builds workspace packages, starts MongoDB-backed
  Redis via Docker Compose, builds/pulls the sandbox + DVWA images, applies
  the Prisma schema, seeds scenarios, starts the API + web dev servers (and
  the Python network-engine if available), then opens the game in your
  default browser.

  Safe to re-run: every step is idempotent (pnpm install, docker build,
  prisma db push, and the scenario seed are all no-ops on an unchanged state).
#>

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Test-CommandExists($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

# ---------------------------------------------------------------------------
Write-Step "Checking prerequisites"

if (-not (Test-CommandExists "node")) {
    Write-Host "Node.js not found. Install it from https://nodejs.org (v20 LTS) and re-run this script." -ForegroundColor Red
    exit 1
}
Write-Host "Node.js: $(node -v)"

if (-not (Test-CommandExists "pnpm")) {
    Write-Host "pnpm not found, installing globally..."
    npm i -g pnpm
}
Write-Host "pnpm: $(pnpm -v)"

if (-not (Test-CommandExists "docker")) {
    Write-Host "Docker not found. Install Docker Desktop from https://docker.com and re-run this script." -ForegroundColor Red
    exit 1
}

# Native commands don't throw catchable exceptions on nonzero exit, so check
# $LASTEXITCODE directly instead of relying on try/catch (which only fires if
# `docker` itself can't be found at all). Also drop ErrorActionPreference to
# Continue just for this call: with it set to Stop, a native command's stderr
# output becomes an uncaught terminating NativeCommandError instead of a
# clean, controlled message here. Retry a few times since Docker Desktop's
# engine can take 30-60s to accept connections even after it shows "Running".
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$dockerReady = $false
$dockerInfoOutput = $null
for ($i = 0; $i -lt 5; $i++) {
    $dockerInfoOutput = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
    Start-Sleep -Seconds 3
}
$ErrorActionPreference = $prevEap

if (-not $dockerReady) {
    Write-Host "Docker Desktop doesn't seem to be reachable after several tries. Please start it, wait until the whale icon shows 'Running', then re-run this script." -ForegroundColor Red
    Write-Host "Details from 'docker info':" -ForegroundColor Yellow
    Write-Host $dockerInfoOutput
    exit 1
}
Write-Host "Docker: running"

# ---------------------------------------------------------------------------
Write-Step "Checking .env"

if (-not (Test-Path "$root\.env")) {
    Copy-Item "$root\.env.example" "$root\.env"
    Write-Host "Created .env from .env.example." -ForegroundColor Yellow
    Write-Host "Edit .env now and set at least DATABASE_URL (MongoDB Atlas) and JWT_SECRET (32+ random chars)," -ForegroundColor Yellow
    Write-Host "then re-run this script." -ForegroundColor Yellow
    exit 1
}

$envContent = Get-Content "$root\.env" -Raw
if ($envContent -match 'DATABASE_URL="mongodb\+srv://<user>') {
    Write-Host ".env still has the placeholder DATABASE_URL. Edit .env with your real MongoDB Atlas connection string, then re-run this script." -ForegroundColor Red
    exit 1
}
if ($envContent -match 'JWT_SECRET="change-me') {
    Write-Host ".env still has the placeholder JWT_SECRET. Set it to a random 32+ character string, then re-run this script." -ForegroundColor Red
    exit 1
}
Write-Host ".env looks configured."

# Load .env into this process's environment so the Prisma/seed commands below can use it.
# Skip DOCKER_HOST: its Linux-style unix:// default in .env.example breaks the
# `docker` CLI on Windows (which needs the named pipe instead), the same issue
# hit and fixed for dockerode in apps/api/src/services/sandbox/docker-client.ts.
foreach ($line in (Get-Content "$root\.env")) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $key, $value = $line -split '=', 2
    $key = $key.Trim()
    if ($key -eq "DOCKER_HOST") { continue }
    $value = $value.Trim().Trim('"')
    [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
}

# ---------------------------------------------------------------------------
Write-Step "Installing dependencies (pnpm install)"
pnpm install

# ---------------------------------------------------------------------------
Write-Step "Starting Redis (docker-compose up -d)"
docker-compose up -d

# ---------------------------------------------------------------------------
Write-Step "Building sandbox CLI Docker image (cybersim-sandbox:latest)"
$sandboxImage = docker images -q cybersim-sandbox:latest
if (-not $sandboxImage) {
    docker build -t cybersim-sandbox:latest "$root\docker\sandbox"
} else {
    Write-Host "Already built, skipping."
}

Write-Step "Pulling DVWA image (vulnerables/web-dvwa)"
$dvwaImage = docker images -q vulnerables/web-dvwa
if (-not $dvwaImage) {
    docker pull vulnerables/web-dvwa
} else {
    Write-Host "Already pulled, skipping."
}

# ---------------------------------------------------------------------------
Write-Step "Applying database schema (Prisma db push)"
pnpm --filter @cybersim/api db:push

Write-Step "Seeding scenarios"
pnpm --filter @cybersim/api db:seed

if ($envContent -match 'ADMIN_EMAIL="([^"]+)"' -and $envContent -notmatch 'ADMIN_EMAIL="admin@example.com"') {
    Write-Step "Seeding admin account"
    pnpm --filter @cybersim/api db:seed-admin
}

# ---------------------------------------------------------------------------
Write-Step "Starting API server (new window)"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\api'; Write-Host 'CyberSim API :: http://localhost:3001' -ForegroundColor Cyan; pnpm dev"

Write-Step "Starting web server (new window)"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\web'; Write-Host 'CyberSim Web :: http://localhost:3000' -ForegroundColor Cyan; pnpm dev"

if (Test-CommandExists "python") {
    Write-Step "Starting network-engine (new window)"
    $pipShow = python -m pip show fastapi 2>$null
    if (-not $pipShow) {
        Write-Host "Installing network-engine Python dependencies (first run only)..."
        python -m pip install -r "$root\packages\network-engine\requirements.txt"
    }
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\packages\network-engine'; Write-Host 'CyberSim Network Engine :: http://localhost:8000' -ForegroundColor Cyan; python -m uvicorn main:app --port 8000"
} else {
    Write-Host "Python not found - skipping network-engine (the 'Cek Konektivitas' feature won't work without it)." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
Write-Step "Waiting for the web app to come up"
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}

if ($ready) {
    Write-Host ""
    Write-Host "CyberSim is up! Opening http://localhost:3000 ..." -ForegroundColor Green
    Start-Process "http://localhost:3000"
} else {
    Write-Host "Web app didn't come up within 2 minutes - check the API/Web windows for errors." -ForegroundColor Yellow
}
