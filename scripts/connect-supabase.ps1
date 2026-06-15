$ErrorActionPreference = "Stop"

$projectUrl = "https://bhezxqvubjbnqhoomxtz.supabase.co"
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env.local"

function Read-SecretText([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Set-EnvLine([string[]]$Lines, [string]$Name, [string]$Value) {
  $replacement = "$Name=$Value"
  $found = $false
  $updated = foreach ($line in $Lines) {
    if ($line -match "^$([regex]::Escape($Name))=") {
      $found = $true
      $replacement
    } else {
      $line
    }
  }
  if (-not $found) {
    $updated += $replacement
  }
  return $updated
}

Write-Host ""
Write-Host "Connect Supabase to this project" -ForegroundColor Green
Write-Host "Copy keys from Supabase: Project Settings -> API Keys."
Write-Host "When you paste a key here, the characters will stay hidden. This is normal."
Write-Host ""

$anonKey = Read-SecretText "Paste Publishable/anon key"
$serviceKey = Read-SecretText "Paste Secret/service_role key"

if ([string]::IsNullOrWhiteSpace($anonKey) -or [string]::IsNullOrWhiteSpace($serviceKey)) {
  throw "Keys cannot be empty."
}

$lines = if (Test-Path $envPath) { Get-Content $envPath } else { @() }
$lines = Set-EnvLine $lines "NEXT_PUBLIC_SUPABASE_URL" $projectUrl
$lines = Set-EnvLine $lines "NEXT_PUBLIC_SUPABASE_ANON_KEY" $anonKey
$lines = Set-EnvLine $lines "SUPABASE_SERVICE_ROLE_KEY" $serviceKey
$lines | Set-Content -Path $envPath -Encoding utf8

Write-Host "Local .env.local has been updated." -ForegroundColor Green
Write-Host "Linking Vercel project..."

Push-Location $root
try {
  npx vercel link --yes --project dituxue | Out-Host

  Write-Host "Updating Vercel production variables..."
  $projectUrl | npx vercel env rm NEXT_PUBLIC_SUPABASE_URL production --yes 2>$null | Out-Null
  $projectUrl | npx vercel env add NEXT_PUBLIC_SUPABASE_URL production | Out-Host

  $anonKey | npx vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production --yes 2>$null | Out-Null
  $anonKey | npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production | Out-Host

  $serviceKey | npx vercel env rm SUPABASE_SERVICE_ROLE_KEY production --yes 2>$null | Out-Null
  $serviceKey | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production | Out-Host

  Write-Host "Redeploying production site..."
  npx vercel --prod --yes | Out-Host
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Done. Supabase is connected." -ForegroundColor Green
Read-Host "Press Enter to close"
