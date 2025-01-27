@echo off
echo Installing and setting up Local Chat Server...

:: Get server's IP address for the extension
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

:: Install dependencies
cd server
echo Installing server dependencies...
call npm install ws
call npm install

:: Kill any existing server processes
echo Stopping any existing servers...
taskkill /F /IM node.exe 2>nul

:: Create startup script
echo.
echo Creating startup script...
(
echo @echo off
echo cd /d "%%~dp0"
echo start /b node server.js ^> server-output.log 2^>^&1
) > "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\start-chat-server.bat"

:: Start the server
echo Starting server...
start /b node server.js > server-output.log 2>&1

:: Wait for server to start
echo Waiting for server to start...
timeout /t 3 /nobreak > nul

:: Show server output
echo.
echo Server output:
echo -------------
type server-output.log

:: Show completion message
echo.
echo Setup complete! The chat server will now:
echo 1. Run silently in the background (check server-output.log for status)
echo 2. Start automatically when you log in
echo 3. Listen on IP: %LOCAL_IP%
echo.
echo The server is ready to use.
