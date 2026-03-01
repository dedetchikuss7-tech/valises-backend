$ErrorActionPreference = "Stop"

$BASE_URL   = "http://localhost:3000"
$PORT       = 3000
$OUT_JSON   = ".tmp_scenario.json"
$PID_FILE   = ".tmp_nest_pid.txt"
$STDOUT_LOG = ".tmp_nest.out.log"
$STDERR_LOG = ".tmp_nest.err.log"

Write-Host "========================================================="
Write-Host "Valises - Run Scenario (PowerShell runner)"
Write-Host "========================================================="
Write-Host "BASE_URL     : $BASE_URL"
Write-Host "PORT         : $PORT"
Write-Host "========================================================="
Write-Host ""

function Stop-PortListener([int]$port) {
  $portPids = netstat -aon |
    Select-String ":$port" |
    Select-String "LISTENING" |
    ForEach-Object { ($_ -split "\s+")[-1] } |
    Select-Object -Unique

  foreach ($portPid in $portPids) {
    if ($portPid -match "^\d+$") {
      Write-Host "[INFO] Killing PID $portPid on port $port..."
      try { taskkill /F /PID $portPid | Out-Null } catch {}
    }
  }
}

function Exec([string]$cmd) {
  Write-Host ">> $cmd"
  cmd /c $cmd
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed (exit=$LASTEXITCODE): $cmd"
  }
}

try {
  Write-Host "[0/7] Ensure port $PORT is free..."
  Stop-PortListener $PORT
  Write-Host "[OK] Port check done.`n"

  Write-Host "[1/7] Reset DB..."
  Exec "npx prisma migrate reset --force"
  Write-Host "[OK] DB reset done.`n"

  Write-Host "[2/7] Prisma generate..."
  Exec "npx prisma generate"
  Write-Host "[OK] Prisma generate done.`n"

  Write-Host "[3/7] Build Nest..."
  if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
  Exec "npm run build"
  Write-Host "[OK] Build done.`n"

  Write-Host "[4/7] Start API in background..."
  if (Test-Path $PID_FILE) { Remove-Item $PID_FILE -Force }
  if (Test-Path $STDOUT_LOG) { Remove-Item $STDOUT_LOG -Force }
  if (Test-Path $STDERR_LOG) { Remove-Item $STDERR_LOG -Force }

  $proc = Start-Process -FilePath "node" -ArgumentList "dist/main.js" `
    -RedirectStandardOutput $STDOUT_LOG -RedirectStandardError $STDERR_LOG -PassThru

  Set-Content -Path $PID_FILE -Value $proc.Id -NoNewline
  Write-Host "[INFO] API PID=$($proc.Id)"
  Write-Host ""

  Write-Host "[5/7] Wait for /docs..."
  $docs = "$BASE_URL/docs"
  $ok = $false
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $docs -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $ok = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  if (-not $ok) { throw "Timeout waiting for /docs at $docs" }
  Write-Host "[OK] /docs reachable`n"

  Write-Host "[6/7] Run scenario..."
  if (Test-Path $OUT_JSON) { Remove-Item $OUT_JSON -Force }
  Exec "node scripts/run_scenario.js --baseUrl $BASE_URL --allowCompat false"
  Write-Host "[OK] Scenario finished (SCENARIO_OK).`n"

  Write-Host "[7/7] Print scenario output..."
  if (Test-Path $OUT_JSON) { Get-Content $OUT_JSON } else { Write-Host "[WARN] $OUT_JSON not found." }
  Write-Host ""

  exit 0
}
catch {
  Write-Host "[ERROR] $($_.Exception.Message)"
  if (Test-Path $STDERR_LOG) {
    Write-Host "`n[INFO] Last STDERR log:"
    Get-Content $STDERR_LOG -Tail 200
  }
  exit 1
}
finally {
  if (Test-Path $PID_FILE) {
    $apiPid = (Get-Content $PID_FILE -Raw).Trim()
    if ($apiPid -match "^\d+$") {
      Write-Host "[CLEANUP] Stop API (PID=$apiPid)..."
      try { taskkill /F /PID $apiPid | Out-Null } catch {}
      Write-Host "[OK] API stopped"
    }
    try { Remove-Item $PID_FILE -Force } catch {}
  }
}