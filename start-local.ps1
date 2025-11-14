Write-Host "Starting Zcash-Solana Bridge Local Development..." -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting Backend Server (port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host 'Backend Server - Port 3001' -ForegroundColor Green; node server.js" -WindowStyle Minimized

Start-Sleep -Seconds 2

Write-Host "Starting Frontend Server (port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host 'Frontend Server - Port 3000' -ForegroundColor Green; npx http-server -p 3000 -c-1" -WindowStyle Minimized

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Servers are starting..." -ForegroundColor Green
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Open http://localhost:3000 in your browser" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray


