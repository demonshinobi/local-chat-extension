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

## License

MIT
