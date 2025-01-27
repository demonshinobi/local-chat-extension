# Local Network Chat Extension

A Chrome extension for encrypted chat communication over local network using WebSocket.

## Features

- End-to-end encryption using AES-GCM
- Local network communication via WebSocket
- Real-time message updates
- Simple and clean interface
- Automatic reconnection

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/demonshinobi/local-chat-extension.git
```

### 2. Start the WebSocket Server
From the root directory of the project, run:
```bash
cd local-chat-extension
npm install
npm run start-server
```

You should see a message saying "WebSocket server running on port 8080"

### 3. Load the Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `local-chat-extension` directory

## Using the Extension

1. Make sure the WebSocket server is running (you'll see "WebSocket server running on port 8080" in the terminal)
2. Click the extension icon in Chrome to open the chat popup
3. Wait for "Connected" status to appear
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

## Troubleshooting

If you see any npm-related errors, make sure you're running the commands from the root directory of the project (the folder containing this README.md file).

The structure should look like this:
```
local-chat-extension/
├── README.md
├── package.json
├── manifest.json
├── popup.html
├── popup.js
├── background.js
└── server/
    ├── package.json
    └── server.js
