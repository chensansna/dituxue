$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$url = "http://127.0.0.1:3000"

Set-Location -LiteralPath $projectRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js was not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules"))) {
    Write-Host "First run: installing dependencies..." -ForegroundColor Yellow
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Dependency installation failed." -ForegroundColor Red
        exit 1
    }
}

$alreadyRunning = $false
try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
    $alreadyRunning = $response.StatusCode -eq 200
} catch {
    $alreadyRunning = $false
}

if (-not $alreadyRunning) {
    Write-Host "Starting the local service..." -ForegroundColor Green
    Start-Process -FilePath "npm.cmd" `
        -ArgumentList "run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000" `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden

    $ready = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
            Write-Host "." -NoNewline
        }
    }
    Write-Host ""

    if (-not $ready) {
        Write-Host "Startup timed out. Run npm run dev to inspect the error." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "The system is already running." -ForegroundColor Green
}

Write-Host "Opening: $url" -ForegroundColor Cyan
Start-Process $url
exit 0
