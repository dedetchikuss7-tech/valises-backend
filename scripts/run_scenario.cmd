@echo off
setlocal enabledelayedexpansion

REM ============================
REM Valises Backend - Run Scenario (DX)
REM One-shot dev workflow:
REM - reset DB
REM - start API
REM - create users
REM - KYC traveler verified
REM - create tx
REM - payment success
REM - status -> IN_TRANSIT -> DELIVERED
REM - open dispute -> recommendation -> resolve split
REM - show ledger
REM - stop API
REM ============================

cd /d %~dp0\..

set BASE_URL=http://localhost:3000
set PID_FILE=.tmp_nest_pid.txt

echo.
echo [1/7] Reset DB (DEV)...
REM WARNING: this drops data in the dev database pointed by DATABASE_URL
npx prisma migrate reset --force
if errorlevel 1 (
  echo [ERROR] prisma migrate reset failed
  exit /b 1
)

echo.
echo [2/7] Start API (Nest) in background...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm run start:dev' -WorkingDirectory '%CD%' -PassThru; $p.Id | Out-File -Encoding ascii '%CD%\%PID_FILE%';"

echo.
echo [3/7] Wait for API to be ready on %BASE_URL% ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok=$false; for($i=0;$i -lt 60;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing '%BASE_URL%/docs' -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){$ok=$true; break} } catch{} Start-Sleep -Seconds 1 }; if(-not $ok){ exit 1 }"
if errorlevel 1 (
  echo [ERROR] API did not become ready (timeout).
  goto :stop
)

echo.
echo [4/7] Run scenario via Node script...
node scripts\run_scenario.js --baseUrl %BASE_URL%
if errorlevel 1 (
  echo [ERROR] Scenario failed.
  goto :stop
)

echo.
echo [5/7] Scenario completed OK.

:stop
echo.
echo [6/7] Stop API (Nest)...
if exist "%PID_FILE%" (
  for /f %%i in (%PID_FILE%) do set NEST_PID=%%i
  if not "%NEST_PID%"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Try { Stop-Process -Id %NEST_PID% -Force -ErrorAction Stop } Catch { }"
  )
  del "%PID_FILE%" >nul 2>&1
)

echo.
echo [7/7] Done.
endlocal
exit /b 0