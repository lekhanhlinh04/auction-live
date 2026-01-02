@echo off
echo ========================================
echo   Auction Server - Start All Services
echo ========================================
echo.

echo [1/2] Starting TCP Server C (port 8081)...
start "Auction Server C" cmd /k "server.exe"
timeout /t 2 /nobreak >nul

echo [2/2] Starting WebSocket Gateway (port 8080)...
start "WebSocket Gateway" cmd /k "node gateway.js"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   All services started!
echo ========================================
echo.
echo TCP Server C:    http://localhost:8081
echo WebSocket Gateway: ws://localhost:8080
echo.
echo Press any key to exit...
pause >nul


