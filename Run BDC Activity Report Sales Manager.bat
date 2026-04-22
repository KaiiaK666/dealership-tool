@echo off
setlocal
set ROOT=%~dp0
cd /d "%ROOT%sales-activity-runner"

if not exist ".env" (
  echo Missing sales-activity-runner\.env
  echo Copy .env.example to .env and fill in the DealerSocket credentials first.
  exit /b 1
)

set "WHATSAPP_TARGET_LABEL=Kau 429-8898 (You)"
set "WHATSAPP_SELF_SEARCH_TERMS=kau,956 429 8898,9564298898"
set "WHATSAPP_SELF_VERIFY_TOKENS=(You),429-8898,Message yourself"
set "DEALERSOCKET_REPORT_NAME=BDC Activity Report Sales Manager"
set "DEALERSOCKET_ROLE=Sales Manager"
set "SALES_ACTIVITY_STORAGE_KEY=sales-manager"
set "SALES_ACTIVITY_FILE_PREFIX=bdc-activity-sales-manager"
set "SALES_ACTIVITY_SCHEDULE_DAYS=Monday,Tuesday,Wednesday,Thursday,Friday,Saturday"
set "SALES_ACTIVITY_SCHEDULE_TIMES=9:58 AM,10:58 AM,11:58 AM,12:58 PM,1:58 PM,2:58 PM,3:58 PM,4:58 PM,5:58 PM,6:58 PM,7:58 PM,8:58 PM"
set "SALES_ACTIVITY_SCHEDULE_LABEL=Monday to Saturday at 9:58 AM, 10:58 AM, 11:58 AM, 12:58 PM, 1:58 PM, 2:58 PM, 3:58 PM, 4:58 PM, 5:58 PM, 6:58 PM, 7:58 PM, 8:58 PM"

node "%ROOT%sales-activity-runner\run-sales-activity-report.mjs"
