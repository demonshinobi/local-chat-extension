@echo off
echo Installing Local Chat Server as a Windows Service...
echo.

REM Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo This script requires administrator privileges.
    echo Please right-click on this file and select "Run as administrator".
    echo.
    pause
    exit /b 1
)

REM Set paths
set "SCRIPT_DIR=%~dp0"
set "SERVER_DIR=%SCRIPT_DIR%server"
set "NODE_PATH=%SCRIPT_DIR%node_modules"

REM Check if Node.js is installed
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "%SERVER_DIR%\node_modules" (
    echo Installing server dependencies...
    cd "%SERVER_DIR%"
    call npm install
    if %errorLevel% neq 0 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

REM Install node-windows for service management
if not exist "%NODE_PATH%\node-windows" (
    echo Installing node-windows package...
    cd "%SCRIPT_DIR%"
    call npm install node-windows --save
    if %errorLevel% neq 0 (
        echo Failed to install node-windows.
        pause
        exit /b 1
    )
)

REM Create service installation script
echo Creating service installation script...
echo var Service = require('node-windows').Service; > "%SERVER_DIR%\install-service.js"
echo var path = require('path'); >> "%SERVER_DIR%\install-service.js"
echo. >> "%SERVER_DIR%\install-service.js"
echo // Create a new service object >> "%SERVER_DIR%\install-service.js"
echo var svc = new Service({ >> "%SERVER_DIR%\install-service.js"
echo   name: 'Local Chat Server', >> "%SERVER_DIR%\install-service.js"
echo   description: 'WebSocket server for Local Chat Extension', >> "%SERVER_DIR%\install-service.js"
echo   script: path.join(__dirname, 'server.js'), >> "%SERVER_DIR%\install-service.js"
echo   nodeOptions: [], >> "%SERVER_DIR%\install-service.js"
echo   workingDirectory: __dirname, >> "%SERVER_DIR%\install-service.js"
echo   allowServiceLogon: true >> "%SERVER_DIR%\install-service.js"
echo }); >> "%SERVER_DIR%\install-service.js"
echo. >> "%SERVER_DIR%\install-service.js"
echo // Listen for service install/uninstall events >> "%SERVER_DIR%\install-service.js"
echo svc.on('install', function() { >> "%SERVER_DIR%\install-service.js"
echo   console.log('Service installed successfully!'); >> "%SERVER_DIR%\install-service.js"
echo   svc.start(); >> "%SERVER_DIR%\install-service.js"
echo }); >> "%SERVER_DIR%\install-service.js"
echo. >> "%SERVER_DIR%\install-service.js"
echo svc.on('start', function() { >> "%SERVER_DIR%\install-service.js"
echo   console.log('Service started successfully!'); >> "%SERVER_DIR%\install-service.js"
echo   console.log('The server will now run in the background and start automatically with Windows.'); >> "%SERVER_DIR%\install-service.js"
echo }); >> "%SERVER_DIR%\install-service.js"
echo. >> "%SERVER_DIR%\install-service.js"
echo svc.on('error', function(err) { >> "%SERVER_DIR%\install-service.js"
echo   console.error('Service error:', err); >> "%SERVER_DIR%\install-service.js"
echo }); >> "%SERVER_DIR%\install-service.js"
echo. >> "%SERVER_DIR%\install-service.js"
echo // Install the service >> "%SERVER_DIR%\install-service.js"
echo svc.install(); >> "%SERVER_DIR%\install-service.js"

REM Create service uninstallation script
echo Creating service uninstallation script...
echo var Service = require('node-windows').Service; > "%SERVER_DIR%\uninstall-service.js"
echo var path = require('path'); >> "%SERVER_DIR%\uninstall-service.js"
echo. >> "%SERVER_DIR%\uninstall-service.js"
echo // Create a new service object >> "%SERVER_DIR%\uninstall-service.js"
echo var svc = new Service({ >> "%SERVER_DIR%\uninstall-service.js"
echo   name: 'Local Chat Server', >> "%SERVER_DIR%\uninstall-service.js"
echo   script: path.join(__dirname, 'server.js') >> "%SERVER_DIR%\uninstall-service.js"
echo }); >> "%SERVER_DIR%\uninstall-service.js"
echo. >> "%SERVER_DIR%\uninstall-service.js"
echo // Listen for uninstall event >> "%SERVER_DIR%\uninstall-service.js"
echo svc.on('uninstall', function() { >> "%SERVER_DIR%\uninstall-service.js"
echo   console.log('Service uninstalled successfully!'); >> "%SERVER_DIR%\uninstall-service.js"
echo }); >> "%SERVER_DIR%\uninstall-service.js"
echo. >> "%SERVER_DIR%\uninstall-service.js"
echo svc.on('error', function(err) { >> "%SERVER_DIR%\uninstall-service.js"
echo   console.error('Service error:', err); >> "%SERVER_DIR%\uninstall-service.js"
echo }); >> "%SERVER_DIR%\uninstall-service.js"
echo. >> "%SERVER_DIR%\uninstall-service.js"
echo // Uninstall the service >> "%SERVER_DIR%\uninstall-service.js"
echo svc.uninstall(); >> "%SERVER_DIR%\uninstall-service.js"

REM Create uninstall batch file
echo @echo off > "%SCRIPT_DIR%\uninstall-service.bat"
echo echo Uninstalling Local Chat Server service... >> "%SCRIPT_DIR%\uninstall-service.bat"
echo. >> "%SCRIPT_DIR%\uninstall-service.bat"
echo REM Check for admin privileges >> "%SCRIPT_DIR%\uninstall-service.bat"
echo net session ^>nul 2^>^&1 >> "%SCRIPT_DIR%\uninstall-service.bat"
echo if %%errorLevel%% neq 0 ( >> "%SCRIPT_DIR%\uninstall-service.bat"
echo     echo This script requires administrator privileges. >> "%SCRIPT_DIR%\uninstall-service.bat"
echo     echo Please right-click on this file and select "Run as administrator". >> "%SCRIPT_DIR%\uninstall-service.bat"
echo     echo. >> "%SCRIPT_DIR%\uninstall-service.bat"
echo     pause >> "%SCRIPT_DIR%\uninstall-service.bat"
echo     exit /b 1 >> "%SCRIPT_DIR%\uninstall-service.bat"
echo ) >> "%SCRIPT_DIR%\uninstall-service.bat"
echo. >> "%SCRIPT_DIR%\uninstall-service.bat"
echo cd "%%~dp0server" >> "%SCRIPT_DIR%\uninstall-service.bat"
echo node uninstall-service.js >> "%SCRIPT_DIR%\uninstall-service.bat"
echo. >> "%SCRIPT_DIR%\uninstall-service.bat"
echo echo. >> "%SCRIPT_DIR%\uninstall-service.bat"
echo pause >> "%SCRIPT_DIR%\uninstall-service.bat"

REM Install the service
echo Installing the service...
cd "%SERVER_DIR%"
node install-service.js

REM Display network information
echo.
echo ======================================================
echo Local Chat Server has been installed as a Windows service!
echo.
echo The server will start automatically when Windows boots.
echo.
echo Available server addresses:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    echo - %%a
)
echo - localhost
echo.
echo To connect to the server, use one of these addresses in the extension.
echo.
echo To uninstall the service, run uninstall-service.bat as administrator.
echo ======================================================
echo.

pause
