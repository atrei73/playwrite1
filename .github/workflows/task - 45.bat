@echo off
:loop
node 45.js
timeout /t 3 /nobreak >nul
goto loop