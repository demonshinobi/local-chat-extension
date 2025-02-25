@echo off
echo Installing and setting up Local Chat Server...
echo.

:: Get server's IP address for the extension
echo Detecting network interfaces...
echo.

:: First try to get the vEthernet IP (often used for Docker/WSL)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"vEthernet.*IPv4 Address"') do (
    set VETHERNET_IP=%%a
    set VETHERNET_IP=!VETHERNET_IP: =!
    echo Found vEthernet IP: !VETHERNET_IP!
    goto :found_vethernet
)
:found_vethernet

:: Then get all IPv4 addresses
echo Available IP addresses:
setlocal enabledelayedexpansion
set IP_COUNT=0
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    set LOCAL_IP=%%a
    set LOCAL_IP=!LOCAL_IP: =!
    set /a IP_COUNT+=1
    echo !IP_COUNT!. !LOCAL_IP!
)

:: If vEthernet IP is available, use it as primary
if defined VETHERNET_IP (
    set PRIMARY_IP=%VETHERNET_IP%
) else (
    :: Otherwise use the first IPv4 address
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
        set PRIMARY_IP=%%a
        set PRIMARY_IP=!PRIMARY_IP: =!
        goto :found_primary
    )
)
:found_primary

echo.
echo Using primary IP: %PRIMARY_IP%
echo.

:: Create server directory if it doesn't exist
if not exist "server" (
    echo Creating server directory...
    mkdir server
)

:: Install dependencies
echo Installing server dependencies...
cd server
call npm install ws --save
call npm install --no-audit --no-fund
cd ..

:: Kill any existing server processes
echo Stopping any existing servers...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Local-Chat-Server" 2>nul

:: Create the service startup script
echo Creating server startup script...
echo @echo off > server\start-service.bat
echo cd /d "%%~dp0" >> server\start-service.bat
echo title Local-Chat-Server >> server\start-service.bat
echo node server.js >> server\start-service.bat

:: Start the server now
echo Starting server...
start cmd /k "cd /d "%~dp0server" && title Local-Chat-Server && node server.js"

:: Wait for server to start
echo Waiting for server to start...
timeout /t 3 /nobreak > nul

:: Show completion message with better formatting
echo.
echo ======================================================
echo Setup complete! The chat server is now running.
echo.
echo SERVER INFORMATION:
echo ------------------
echo Primary IP: %PRIMARY_IP%
echo.
echo To connect to the server, use one of these addresses:
echo - %PRIMARY_IP% (recommended)
echo - localhost (only for local connections)
echo.
echo To manually restart the server:
echo - Double-click on server\start-service.bat
echo.
echo IMPORTANT: Keep the server window open while chatting
echo ======================================================
echo.
echo Press any key to exit this setup window...
pause > nul
