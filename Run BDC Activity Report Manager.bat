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
set "DEALERSOCKET_REPORT_NAME=BDC Activity Report BDC Staff"
set "DEALERSOCKET_ROLE=BDC Manager/Internet Manager Power Team"
set "SALES_ACTIVITY_STORAGE_KEY=manager"
set "SALES_ACTIVITY_FILE_PREFIX=bdc-activity-manager"
set "SALES_ACTIVITY_SCHEDULE_DAYS=Monday,Tuesday,Wednesday,Thursday,Friday,Saturday"
set "SALES_ACTIVITY_SCHEDULE_TIMES=9:59 AM,10:59 AM,11:59 AM,12:59 PM,1:59 PM,2:59 PM,3:59 PM,4:59 PM,5:59 PM,6:59 PM,7:59 PM,8:59 PM"
set "SALES_ACTIVITY_SCHEDULE_LABEL=Monday to Saturday at 9:59 AM, 10:59 AM, 11:59 AM, 12:59 PM, 1:59 PM, 2:59 PM, 3:59 PM, 4:59 PM, 5:59 PM, 6:59 PM, 7:59 PM, 8:59 PM"

node "%ROOT%sales-activity-runner\run-sales-activity-report.mjs"
