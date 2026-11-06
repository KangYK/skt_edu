@echo off
cd /d "%~dp0"
set "PORTAL_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "PORTAL_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%PORTAL_NODE%" server/index.mjs --demo
pause
