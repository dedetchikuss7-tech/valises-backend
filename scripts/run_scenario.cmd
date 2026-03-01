@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM -----------------------------------------------------------------------------
REM Valises Backend - Scenario Runner (Windows CMD) - VERY ROBUST (Win + Prisma)
REM -----------------------------------------------------------------------------
REM Fixes:
REM  - Avoid PowerShell reserved $PID/$pid variable name
REM  - Work around Prisma EPERM engine rename by forcing BINARY engine mode
REM  - Kill process on port 3000 reliably
REM  - Retry prisma generate
REM -----------------------------------------------------------------------------

pushd "%~dp0.."
if errorlevel 1 (
  echo [ERROR] Unable to cd to repo root.
  exit /b 1
)

set "PORT=3000"
set "BASE_URL=http://localhost:%PORT%"
set "READINESS_TIMEOUT_SEC=120"
set "READINESS_POLL_MS=750"

set "TMP_NEST_OUT=.tmp_nest.out.log"
set "TMP_NEST_ERR=.tmp_nest.err.log"
set "TMP_SCENARIO=.tmp_scenario.json"
set "TMP_PID_FILE=.tmp_nest_pid.txt"

REM Clean old tmp artifacts
if exist "%TMP_NEST_OUT%" del /f /q "%TMP_NEST_OUT%" >nul 2>&1
if exist "%TMP_NEST_ERR%" del /f /q "%TMP_NEST_ERR%" >nul 2>&1
if exist "%TMP_SCENARIO%" del /f /q "%TMP_SCENARIO%" >nul 2>&1
if exist "%TMP_PID_FILE%" del /f /q "%TMP_PID_FILE%" >nul 2>&1

echo.
echo =========================================================
echo  Valises - Run Scenario
echo =========================================================
echo  BASE_URL : %BASE_URL%
echo  PORT     : %PORT%
echo =========================================================
echo.

REM -----------------------------------------------------------------------------
REM [0/7] Ensure port is free (kill process using it) - PowerShell safe variable names
REM -----------------------------------------------------------------------------
echo [0/7] Ensure port %PORT% is free (kill process using it)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$p=%PORT%;" ^
  "$lines = netstat -ano | Select-String (':'+$p+'\s');" ^
  "if(-not $lines){ Write-Host '[OK] Port free'; exit 0 }" ^
  "$procIds=@();" ^
  "foreach($l in $lines){" ^
  "  $parts = (($l -replace '\s+',' ').Trim()).Split(' ');" ^
  "  $id = $parts[-1];" ^
  "  if($id -match '^\d+$'){ $procIds += [int]$id }" ^
  "}" ^
  "$procIds = $procIds | Select-Object -Unique;" ^
  "foreach($procId in $procIds){" ^
  "  try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue; Write-Host ('[OK] Killed PID ' + $procId) } catch {}" ^
  "}"
REM no hard fail here

REM Small pause to let OS release file locks
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Milliseconds 600"

REM -----------------------------------------------------------------------------
REM [1/7] Reset DB
REM -----------------------------------------------------------------------------
echo.
echo [1/7] Reset DB (Prisma migrate reset)...
call npx prisma migrate reset --force --skip-seed
if errorlevel 1 (
  echo [ERROR] Prisma migrate reset failed.
  popd
  exit /b 1
)

REM -----------------------------------------------------------------------------
REM [2/7] Prisma generate (force BINARY engine + retries)
REM -----------------------------------------------------------------------------
echo.
echo [2/7] Prisma generate (retry on EPERM/locks)...

REM Force Prisma engine to binary (helps on Windows EPERM rename locks)
set "PRISMA_CLIENT_ENGINE_TYPE=binary"
set "PRISMA_CLI_QUERY_ENGINE_TYPE=binary"

set "GEN_TRIES=0"
set "GEN_MAX=10"

:PRISMA_GENERATE_RETRY
set /a GEN_TRIES+=1

echo [INFO] prisma generate attempt !GEN_TRIES!/!GEN_MAX! ...
call npx prisma generate
if not errorlevel 1 (
  echo [OK] Prisma generate succeeded.
  goto :AFTER_GENERATE
)

echo [WARN] Prisma generate failed (attempt !GEN_TRIES!). Still likely file lock on Prisma engine.
echo [WARN] Waiting a bit and trying again...

REM Kill any leftover node processes that might still hold prisma engine locks
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "Get-Process node -ErrorAction SilentlyContinue | ForEach-Object { try { $_ | Stop-Process -Force -ErrorAction SilentlyContinue } catch {} }"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2"

if !GEN_TRIES! GEQ !GEN_MAX! (
  echo.
  echo [ERROR] Prisma generate failed after !GEN_MAX! attempts.
  echo.
  echo === What to do (guaranteed fix) ===
  echo 1^) Close VSCode (all windows) completely.
  echo 2^) Reopen VSCode, open repo, run ONLY: scripts\run_scenario.cmd
  echo 3^) If it still fails: add repo folder to Windows Defender exclusions.
  echo.
  popd
  exit /b 1
)

goto :PRISMA_GENERATE_RETRY

:AFTER_GENERATE

REM -----------------------------------------------------------------------------
REM [3/7] Build Nest
REM -----------------------------------------------------------------------------
echo.
echo [3/7] Build Nest (dist/)...
call npm run build
if errorlevel 1 (
  echo [ERROR] Build failed.
  popd
  exit /b 1
)

REM -----------------------------------------------------------------------------
REM [4/7] Start API in background and capture PID
REM -----------------------------------------------------------------------------
echo.
echo [4/7] Start API in background...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$repo = (Get-Location).Path;" ^
  "$outLog = Join-Path $repo '%TMP_NEST_OUT%';" ^
  "$errLog = Join-Path $repo '%TMP_NEST_ERR%';" ^
  "$pidFile = Join-Path $repo '%TMP_PID_FILE%';" ^
  "$p = Start-Process -FilePath 'node' -ArgumentList 'dist/main.js' -WorkingDirectory $repo -PassThru -NoNewWindow -RedirectStandardOutput $outLog -RedirectStandardError $errLog;" ^
  "Set-Content -Path $pidFile -Value $p.Id -Encoding ASCII;" ^
  "Write-Host ('[INFO] API PID=' + $p.Id);"
if errorlevel 1 (
  echo [ERROR] Failed to start API.
  echo --- STDOUT ---
  if exist "%TMP_NEST_OUT%" type "%TMP_NEST_OUT%"
  echo --- STDERR ---
  if exist "%TMP_NEST_ERR%" type "%TMP_NEST_ERR%"
  popd
  exit /b 1
)

for /f "usebackq delims=" %%P in ("%TMP_PID_FILE%") do set "NEST_PID=%%P"
if "%NEST_PID%"=="" (
  echo [ERROR] Could not read PID.
  echo --- STDOUT ---
  if exist "%TMP_NEST_OUT%" type "%TMP_NEST_OUT%"
  echo --- STDERR ---
  if exist "%TMP_NEST_ERR%" type "%TMP_NEST_ERR%"
  popd
  exit /b 1
)

echo [INFO] Nest PID = %NEST_PID%
echo [INFO] STDOUT   = %TMP_NEST_OUT%
echo [INFO] STDERR   = %TMP_NEST_ERR%

REM -----------------------------------------------------------------------------
REM [5/7] Wait for readiness
REM -----------------------------------------------------------------------------
echo.
echo [5/7] Wait for API readiness (Swagger /docs)...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$base = '%BASE_URL%';" ^
  "$timeoutSec = [int]'%READINESS_TIMEOUT_SEC%';" ^
  "$pollMs = [int]'%READINESS_POLL_MS%';" ^
  "$sw = [Diagnostics.Stopwatch]::StartNew();" ^
  "function Test-Endpoint($url) {" ^
  "  try { $r = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop; return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) }" ^
  "  catch { return $false }" ^
  "}" ^
  "$docs = ($base.TrimEnd('/') + '/docs');" ^
  "$docsJson = ($base.TrimEnd('/') + '/docs-json');" ^
  "Write-Host ('[INFO] Probing ' + $docs);" ^
  "while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {" ^
  "  if (Test-Endpoint $docs) { Write-Host '[OK] /docs reachable'; exit 0 }" ^
  "  if (Test-Endpoint $docsJson) { Write-Host '[OK] /docs-json reachable (fallback)'; exit 0 }" ^
  "  Start-Sleep -Milliseconds $pollMs" ^
  "}" ^
  "Write-Host ('[ERROR] API not ready after ' + $timeoutSec + 's'); exit 1"
if errorlevel 1 (
  echo [ERROR] Readiness check failed.
  echo --- STDOUT ---
  if exist "%TMP_NEST_OUT%" type "%TMP_NEST_OUT%"
  echo --- STDERR ---
  if exist "%TMP_NEST_ERR%" type "%TMP_NEST_ERR%"
  goto :STOP_SERVER_AND_EXIT_FAIL
)

REM -----------------------------------------------------------------------------
REM [6/7] Run scenario
REM -----------------------------------------------------------------------------
echo.
echo [6/7] Run scenario (run_scenario.js)...
set "BASE_URL=%BASE_URL%"
call node scripts/run_scenario.js
if errorlevel 1 (
  echo [ERROR] Scenario script failed.
  echo --- STDOUT ---
  if exist "%TMP_NEST_OUT%" type "%TMP_NEST_OUT%"
  echo --- STDERR ---
  if exist "%TMP_NEST_ERR%" type "%TMP_NEST_ERR%"
  goto :STOP_SERVER_AND_EXIT_FAIL
)

REM -----------------------------------------------------------------------------
REM [7/7] Print output
REM -----------------------------------------------------------------------------
echo.
echo [7/7] Print scenario output (%TMP_SCENARIO%)...
if exist "%TMP_SCENARIO%" (
  type "%TMP_SCENARIO%"
) else (
  echo [WARN] %TMP_SCENARIO% not found.
)

goto :STOP_SERVER_AND_EXIT_OK

:STOP_SERVER_AND_EXIT_FAIL
echo.
echo [CLEANUP] Stop API (PID=%NEST_PID%)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$procId=%NEST_PID%; try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue; Write-Host '[OK] API stopped' } catch { Write-Host '[WARN] API already stopped or not found' }"
popd
exit /b 1

:STOP_SERVER_AND_EXIT_OK
echo.
echo [CLEANUP] Stop API (PID=%NEST_PID%)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$procId=%NEST_PID%; try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue; Write-Host '[OK] API stopped' } catch { Write-Host '[WARN] API already stopped or not found' }"
popd
exit /b 0