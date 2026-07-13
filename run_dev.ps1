# TradeMind AI Dev Environment Launcher
# Boots backend FastAPI (port 8000) and frontend Vite (port 5173)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "        Booting TradeMind AI Platform        " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Start Python FastAPI Backend
Write-Host "[1/2] Starting Python FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$backendProcess = Start-Process -NoNewWindow -FilePath ".\.venv\Scripts\python.exe" -ArgumentList "-m", "backend.main" -PassThru

# 2. Start Vite React Frontend
Write-Host "[2/2] Starting React Vite Frontend on http://localhost:5173..." -ForegroundColor Yellow
$frontendProcess = Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev --prefix frontend" -PassThru

Write-Host "---------------------------------------------" -ForegroundColor Gray
Write-Host "Both processes initiated successfully!" -ForegroundColor Green
Write-Host "  - Backend Console Port: 8000" -ForegroundColor Green
Write-Host "  - Frontend Portal Port: 5173" -ForegroundColor Green
Write-Host "Press Ctrl+C to shut down both processes." -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Cyan

try {
    # Keep script open and wait for termination to kill child processes
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "Shutting down TradeMind AI..." -ForegroundColor Yellow
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host "All processes cleaned up." -ForegroundColor Green
}
