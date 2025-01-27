# Create log directory
$logDir = Join-Path $env:TEMP "local-chat-logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir "server.log"

# Log function
function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp: $Message" | Tee-Object -FilePath $logFile -Append
}

Write-Log "Starting server setup..."

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Install dependencies
Write-Log "Installing dependencies..."
npm install 2>&1 | ForEach-Object { Write-Log $_ }

# Start server
Write-Log "Starting WebSocket server..."
$process = Start-Process node -ArgumentList "server.js" -PassThru -WindowStyle Hidden -RedirectStandardOutput $logFile -RedirectStandardError $logFile

# Wait a moment to check if process is still running
Start-Sleep -Seconds 2
if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
    Write-Log "Server started successfully (PID: $($process.Id))"
} else {
    Write-Log "Error: Server failed to start"
    exit 1
}

Write-Log "Setup complete"
