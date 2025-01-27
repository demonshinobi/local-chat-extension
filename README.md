# Local Network Chat Extension

A Chrome extension for encrypted chat communication over local network using WebSocket.

## Features

- End-to-end encryption using AES-GCM
- Local network communication via WebSocket
- Real-time message updates
- Simple and clean interface
- Automatic reconnection

## Installation

### Server Setup
1. Navigate to the server directory:
```bash
cd local-chat-extension/server
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

### Extension Setup
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `local-chat-extension` directory

## Usage

1. Make sure the WebSocket server is running
2. Click the extension icon in Chrome to open the chat popup
3. Wait for "Connected" status
4. Start chatting with other users on the same local network

## Security

- Messages are encrypted using AES-GCM with a 256-bit key
- Each chat session generates a new encryption key
- Messages are encrypted/decrypted locally in the browser
- The WebSocket server only relays encrypted messages without decrypting them

## Technical Details

- Uses the Web Crypto API for encryption
- WebSocket server runs on port 8080
- Communication is limited to localhost for security
- Chrome v88+ required for Web Crypto API support

## Limitations

- All users must be on the same local network
- No persistent message history
- New encryption key generated on each connection
