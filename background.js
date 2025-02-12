// Global variables
let ws = null;
let reconnectAttempts = 0;
let pingInterval = null;
let serverIp = 'localhost';
let messageHistory = [];
const MAX_HISTORY = 100; // Store up to 100 messages
let currentStatus = { type: 'connectionStatus', status: 'Disconnected' };
let isConnecting = false;

// Store message in history (avoid duplicates)
function addMessageToHistory(message) {
  // Check for duplicates based on timestamp and content
  const isDuplicate = messageHistory.some(m => 
    m.timestamp === message.timestamp && 
    m.message === message.message && 
    m.from === message.from
  );

  if (!isDuplicate) {
    messageHistory.push(message);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift(); // Remove oldest message
    }
    // Save to Chrome storage
    chrome.storage.local.set({ messageHistory: messageHistory }, () => {
      console.log('Message history saved');
    });
  }
}

// Clear message history
function clearMessageHistory() {
  messageHistory = [];
  chrome.storage.local.remove('messageHistory', () => {
    console.log('Message history cleared');
  });
}

// Store the server IP
function saveServerIp(ip) {
  chrome.storage.local.set({ serverIp: ip }, () => {
    console.log('Server IP saved:', ip);
  });
}

// Get the stored server IP
async function getServerIp() {
  return new Promise((resolve) => {
    chrome.storage.local.get('serverIp', (result) => {
      resolve(result.serverIp || 'localhost');
    });
  });
}

// Update and broadcast status
function updateStatus(status, message = '', serverIp = '') {
  currentStatus = { 
    type: 'connectionStatus',
    status, 
    message, 
    serverIp 
  };
  
  // Broadcast to all listeners
  chrome.runtime.sendMessage(currentStatus).catch(err => {
    console.log('No popup open to receive status');
  });
}

// Connect to WebSocket server
async function connect(targetIp = null) {
  if (isConnecting) {
    console.log('Connection attempt already in progress');
    return;
  }

  if (ws && ws.readyState !== WebSocket.CLOSED) {
    console.log('Connection already exists');
    return;
  }

  isConnecting = true;

  try {
    // Use provided IP or get stored IP
    serverIp = targetIp || await getServerIp();
    if (serverIp === 'localhost') {
    serverIp = '127.0.0.1';
  }
  console.log('Trying to connect to:', serverIp);

    updateStatus('Connecting', `Trying ${serverIp}...`);

    const wsUrl = `ws://${serverIp}:8080`;
    console.log('Creating WebSocket connection to:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      reconnectAttempts = 0;
      updateStatus('Connected', 'Connected to chat server', serverIp);

      // Setup ping interval
      clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          console.log('Sending ping...');
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 15000);
    };

    ws.onmessage = async (event) => {
      console.log('Received message:', event.data);
      try {
        const data = JSON.parse(event.data);
        console.log('Parsed message:', data);

        switch (data.type) {
          case 'system':
            console.log('Received system message:', data);
            updateStatus('Connected', data.message || 'Connected to chat server', serverIp);
            break;

          case 'pong':
            console.log('Received pong');
            break;

          case 'image':
            console.log('Received image message:', data);
            // Add received image message to history
            const receivedImage = {
              type: 'messageReceived',
              message: { image: data.message.image },
              from: data.from,
              timestamp: data.timestamp,
              read: false
            };
            addMessageToHistory(receivedImage);
            chrome.runtime.sendMessage(receivedImage).catch(err => {
              console.log('No popup open to receive image message');
            });
            break;

          case 'chat':
            console.log('Received chat message:', data);
            // Add received message to history
            const receivedMessage = {
              type: 'messageReceived',
              message: data.message,
              from: data.from,
              timestamp: data.timestamp,
              read: false
            };
            addMessageToHistory(receivedMessage);
            chrome.runtime.sendMessage(receivedMessage).catch(err => {
              console.log('No popup open to receive chat message');
            });
            break;

          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      clearInterval(pingInterval);
      updateStatus('Disconnected', 'Connection closed');
      isConnecting = false;

      // Try to reconnect with exponential backoff
      const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      reconnectAttempts++;
      console.log(`Attempting to reconnect in ${backoff}ms`);
      setTimeout(() => connect(), backoff);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateStatus('Error', 'Failed to connect to server');
      isConnecting = false;
    };

  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    updateStatus('Error', 'Failed to connect to server');
    isConnecting = false;
  }
}

// Load message history on startup
chrome.storage.local.get('messageHistory', (result) => {
  if (result.messageHistory) {
    messageHistory = result.messageHistory;
    console.log('Loaded message history:', messageHistory.length, 'messages');
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message from popup:', message);
  
  switch (message.type) {
    case 'getStatus':
      console.log('Sending current status:', currentStatus);
      sendResponse(currentStatus);
      break;

    case 'getHistory':
      console.log('Sending message history');
      sendResponse({ messages: messageHistory });
      break;

    case 'clearHistory':
      console.log('Clearing message history');
      clearMessageHistory();
      sendResponse({ success: true });
      break;

    case 'markAsRead':
      if (message.messageIds) {
        messageHistory = messageHistory.map(msg => {
          if (message.messageIds.includes(msg.timestamp)) {
            return { ...msg, read: true };
          }
          return msg;
        });
        chrome.storage.local.set({ messageHistory });
        sendResponse({ success: true });
      }
      break;

    case 'connectTo':
      if (message.ip) {
        saveServerIp(message.ip);
        if (ws) {
          ws.close();
        }
        connect(message.ip);
        sendResponse({ success: true });
      }
      break;

    case 'sendMessage':
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        sendResponse({ success: false, error: 'Not connected' });
        return true;
      }

      const text = message.text;
      if (!text.trim()) {
        sendResponse({ success: false, error: 'Empty message' });
        return true;
      }

      try {
        const chatMessage = {
          type: 'chat',
          message: text,
          timestamp: new Date().toISOString()
        };
        ws.send(JSON.stringify(chatMessage));

        // Add sent message to history
        const sentMessage = {
          type: 'messageReceived',
          message: text,
          from: 'self',
          timestamp: chatMessage.timestamp,
          read: true
        };
        addMessageToHistory(sentMessage);
        
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error sending message:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;
  case 'sendImageMessage':
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      sendResponse({ success: false, error: 'Not connected' });
      return true;
    }

    const imageData = message.imageData;
    if (!imageData) {
      sendResponse({ success: false, error: 'Empty image data' });
      return true;
    }

    try {
      const imageMessage = {
        type: 'image',
        message: { image: imageData },
        timestamp: new Date().toISOString()
,
        message_text: message.text || ''
      };
      ws.send(JSON.stringify(imageMessage));

      // Add sent image message to history
      const sentImageMessage = {
        type: 'messageReceived',
        message: { image: imageData },
        message_text: message.text || '',
        from: 'self',
        timestamp: imageMessage.timestamp,
        read: true
      };
      addMessageToHistory(sentImageMessage);

      sendResponse({ success: true });
    } catch (error) {
      console.error('Error sending image message:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  return true; // Keep channel open for sendResponse
});

// Handle initialization
let initialized = false;
function initialize() {
  if (!initialized) {
    initialized = true;
    console.log('Extension initializing...');
    connect();
  }
}

// Handle service worker lifecycle
chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onInstalled.addListener(initialize);

// Start connection if not already initialized
initialize();
