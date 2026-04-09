@echo off
start "EventSphere Backend" cmd /k "cd /d %~dp0backend && npm run dev"
start "EventSphere Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
