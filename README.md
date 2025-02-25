# Local Chat Extension

A Chrome extension for local network chat with persistent messaging, image sharing, and GIF support.

## Features

- **Persistent Messaging**: Messages are stored and persist between sessions
- **Image Sharing**: Share images via drag & drop or clipboard paste
- **GIF Support**: Send animated GIFs that stay animated in the chat
- **End-to-End Encryption**: Messages are encrypted for privacy
- **Typing Indicators**: See when others are typing
- **Dark Mode**: Toggle between light and dark themes
- **Desktop Notifications**: Get notified of new messages
- **User Customization**: Set your display name

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/demonshinobi/local-chat-extension.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the extension directory

5. Run the server:
   ```
   cd local-chat-extension
   ./setup.bat
   ```

## Usage

1. Click the extension icon in Chrome to open the chat popup

2. Enter the server IP address (usually shown in the server console, typically `172.31.208.1`)

3. Click "Connect" to join the chat

4. Start chatting! You can:
   - Send text messages
   - Share images by pasting from clipboard or drag & drop
   - Send GIFs by clicking the GIF button
   - Add emojis by clicking the emoji button
   - Toggle dark mode in settings
   - Clear message history if needed

## Network Connectivity

If you're having trouble connecting from different computers on the same network, follow these steps:

### For the Server Host:

1. Run the included `network-test.bat` script to:
   - Check your network interfaces and IP addresses
   - Add a Windows Firewall exception for port 8080
   - Test if your computer is accessible from other machines

2. Make sure you're using the correct IP address:
   - The server displays all available IP addresses on startup
   - For computers in the same building but different networks, use your machine's actual IP address (not localhost or 127.0.0.1)
   - Typically, use the IP that starts with 192.168.x.x or 10.x.x.x

3. Check your firewall settings:
   - Ensure Windows Firewall allows incoming connections on port 8080
   - If using third-party antivirus/firewall software, add an exception for the chat server

### For Clients:

1. Make sure you're on the same network as the server host
   - If on different networks, you may need VPN or network bridging

2. Enter the correct server IP address:
   - Use the IP address of the server host's computer (not localhost)
   - The IP should be visible in the server console when it starts

3. Test connectivity:
   - Try accessing http://SERVER_IP:8080 in a web browser
   - If this works but the chat doesn't connect, check the extension settings

### Troubleshooting:

- **"Cannot connect to server"**: Verify the server is running and the IP address is correct
- **Server running but clients can't connect**: Check firewall settings and run `network-test.bat`
- **Connection drops frequently**: Ensure stable network connection and try a different IP address

## Server

The extension includes a WebSocket server built with Node.js. The server:

- Stores message history persistently
- Handles message broadcasting
- Manages client connections
- Provides encryption for messages

To start the server, run `setup.bat` in the extension directory.

## Technical Details

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js WebSocket server
- **Storage**: Local file-based persistence
- **Encryption**: AES-256-GCM
- **Networking**: WebSocket on port 8080

## License

MIT
