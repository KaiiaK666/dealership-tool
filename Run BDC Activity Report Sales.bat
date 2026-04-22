@echo off
setlocal
set ROOT=%~dp0
cd /d "%ROOT%sales-activity-runner"

if not exist ".env" (
  echo Missing sales-activity-runner\.env
  echo Copy .env.example to .env and fill in the DealerSocket credentials first.
  exit /b 1
)

node "%ROOT%sales-activity-runner\run-sales-activity-report.mjs"
