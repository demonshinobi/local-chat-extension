# Local Network Chat Extension

A Chrome extension for encrypted chat communication over local network using WebSocket.

## Features

- Real-time chat between Chrome browsers on the same local network
- End-to-end encryption using AES-256-GCM
- Message history (stores last 50 messages in memory)
- Automatic server discovery on local network
- Clean and simple user interface

## Installation

1. Clone this repository:
```bash
git clone https://github.com/demonshinobi/local-chat-extension.git
cd local-chat-extension
```

2. Install server dependencies:
```bash
cd server
npm install
cd ..
```

3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `local-chat-extension` folder

4. Run the server:
   - Double-click `setup.bat` to install and start the server
   - The server will run in the background and start automatically when you log in

## Usage

1. Click the extension icon in Chrome to open the chat popup
2. The extension will automatically connect to any local chat server
3. Type your message and press Enter or click Send
4. Messages are encrypted and only visible to users on your local network
5. Message history is preserved while the extension is running

## Technical Details

- Server: Node.js with WebSocket (ws) library
- Encryption: AES-256-GCM with random IV for each message
- Extension: Chrome Manifest V3
- Network: Automatic local IP discovery and connection

## Security

- All messages are encrypted using AES-256-GCM
- Each message uses a unique initialization vector (IV)
- Messages are only stored in memory, not persisted to disk
- Communication is limited to local network only

## Development

To modify the extension:

1. Make your changes to the source files
2. Reload the extension in Chrome
3. For server changes, restart `setup.bat`

## Files

- `popup.html/js`: Extension popup UI and logic
- `background.js`: Extension background service worker
- `server/server.js`: WebSocket server implementation
- `manifest.json`: Extension configuration
- `setup.bat`: Server installation and startup script

## License

MIT License - feel free to modify and use as needed!
