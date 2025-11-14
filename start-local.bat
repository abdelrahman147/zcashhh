@echo off
echo Starting Zcash-Solana Bridge Local Development...
echo.
echo Starting Backend Server (port 3001)...
start "Backend Server" cmd /k "node server.js"
timeout /t 2 /nobreak >nul
echo.
echo Starting Frontend Server (port 3000)...
start "Frontend Server" cmd /k "npx http-server -p 3000 -c-1"
timeout /t 2 /nobreak >nul
echo.
echo Both servers are starting...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit (servers will keep running)...
pause >nul


