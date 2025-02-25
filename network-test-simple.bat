@echo off
title Local Chat Extension Network Test

echo Local Chat Extension Network Test
echo ================================
echo.
echo This script will display your network information to help with connectivity.
echo.

echo Your network interfaces:
echo ------------------------
ipconfig | findstr /i "IPv4"
echo.

echo The chat server uses port 8080.
echo.

echo IMPORTANT: When connecting from another computer, use one of the IP addresses 
echo listed above (NOT localhost or 127.0.0.1).
echo.

echo Checking Windows Firewall status...
netsh advfirewall show allprofiles state
echo.

echo Adding firewall rule for Local Chat (if it doesn't exist)...
netsh advfirewall firewall show rule name="Local Chat Extension" > nul
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="Local Chat Extension" dir=in action=allow protocol=TCP localport=8080
    echo Firewall rule added.
) else (
    echo Firewall rule already exists.
)
echo.

echo To test connectivity:
echo 1. Start the chat server using setup.bat
echo 2. On another computer, try to connect to the extension using one of your IP addresses
echo 3. If it doesn't work, make sure both computers are on the same network
echo.

echo Press any key to exit...
pause > nul
