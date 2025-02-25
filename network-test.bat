@echo off
echo Local Chat Extension Network Test
echo ================================
echo.
echo This script will help test network connectivity for the Local Chat Extension.
echo.

REM Get all IP addresses
echo Your network interfaces:
echo ------------------------
ipconfig | findstr /i "IPv4"
echo.

REM Display the server port
echo The chat server uses port 8080.
echo.

REM Check if the port is already in use
echo Checking if port 8080 is already in use...
netstat -an | findstr ":8080"
echo.

REM Check Windows Firewall status
echo Checking Windows Firewall status...
netsh advfirewall show allprofiles state
echo.

REM Add firewall rule if it doesn't exist
echo Adding firewall rule for Local Chat (if it doesn't exist)...
netsh advfirewall firewall show rule name="Local Chat Extension" > nul
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="Local Chat Extension" dir=in action=allow protocol=TCP localport=8080
    echo Firewall rule added.
) else (
    echo Firewall rule already exists.
)
echo.

REM Start a simple HTTP server for testing
echo Starting a test server on port 8080...
echo This will help verify if other computers can connect to your machine.
echo.
echo Press Ctrl+C to stop the test server when done.
echo.
echo Test server is running. From another computer, try to connect to:
echo.
ipconfig | findstr /i "IPv4"
echo.
echo Use a web browser and navigate to http://YOUR_IP:8080
echo (Replace YOUR_IP with one of the IP addresses listed above)
echo.
echo If the connection works, you should see a "Connection successful!" message.
echo.

REM Create a simple HTML file for the test
echo ^<!DOCTYPE html^> > test.html
echo ^<html^> >> test.html
echo ^<head^>^<title^>Local Chat Connection Test^</title^>^</head^> >> test.html
echo ^<body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;"^> >> test.html
echo ^<h1^>Connection successful!^</h1^> >> test.html
echo ^<p^>If you can see this page, it means you can successfully connect to the Local Chat server.^</p^> >> test.html
echo ^<p^>Use this IP address in the Local Chat Extension.^</p^> >> test.html
echo ^</body^> >> test.html
echo ^</html^> >> test.html

REM Start a simple HTTP server using Node.js
node -e "const http = require('http'); const fs = require('fs'); const server = http.createServer((req, res) => { res.writeHead(200, {'Content-Type': 'text/html'}); res.end(fs.readFileSync('test.html')); }); server.listen(8080, '0.0.0.0', () => console.log('Test server running on port 8080'));"

REM Clean up
del test.html
