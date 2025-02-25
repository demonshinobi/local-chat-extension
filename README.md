# Local Chat Pro

A secure local network chat extension for Chrome with encryption and persistent message history.

## Features

- **Secure Communication**: End-to-end encrypted messages
- **Persistent Connections**: Automatically reconnects when the connection is lost
- **User Identification**: Display names for better communication
- **Rich Media Support**: Share images via drag & drop or clipboard
- **Emoji Support**: Built-in emoji picker
- **Typing Indicators**: See when others are typing
- **Dark Mode**: Toggle between light and dark themes
- **Desktop Notifications**: Get notified of new messages
- **Message History**: Persistent message history across sessions
- **Stable Server**: Can run as a Windows service

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `local-chat-extension` folder
5. The extension is now installed and available in your browser

## Server Setup

### Option 1: Quick Start (Command Window)

1. Run `setup.bat` to install and start the server
2. The server will run in a command window
3. Note the IP address displayed in the command window

### Option 2: Windows Service (Recommended)

1. Right-click on `install-service.bat` and select "Run as administrator"
2. The script will install the server as a Windows service
3. The service will automatically start when your computer boots
4. Note the IP address displayed during installation

## Usage

1. Click the Local Chat Pro icon in your browser toolbar
2. Enter the server IP address (or use "localhost" if running on the same machine)
3. Click "Connect"
4. Once connected, you can start sending messages
5. To share an image, drag and drop it into the message input or paste from clipboard
6. To use emojis, click the emoji button and select an emoji
7. To change settings, click the gear icon in the top right corner

## Settings

- **Desktop Notifications**: Enable/disable notifications for new messages
- **Dark Mode**: Toggle between light and dark themes
- **Display Name**: Set your name to be displayed to other users

## Troubleshooting

- **Connection Issues**: Make sure the server is running and the IP address is correct
- **Server Not Starting**: Check if port 8080 is already in use by another application
- **Messages Not Sending**: Check your connection status in the extension

## Development

The extension is organized into several key files:

- `popup.html`: Main UI structure
- `css/popup.css`: Styling for the UI
- `js/ui.js`: UI-related functionality
- `js/popup.js`: Core extension functionality
- `background.js`: Background service worker for persistent connections
- `offscreen.js`: Handles WebSocket connections in the background
- `server/server.js`: WebSocket server implementation

## License

MIT
