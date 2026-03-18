@echo off
set ROOT=%~dp0
start "Dealership Backend" cmd /k "cd /d %ROOT%backend && python -m uvicorn main:app --host 0.0.0.0 --port 8108"
start "Dealership Frontend" cmd /k "cd /d %ROOT%frontend && npm.cmd run dev"
