// Global variables
let reconnectAttempts = 0;
let serverIp = 'localhost';
let messageHistory = [];
const MAX_HISTORY = 100; // Store up to 100 messages
let currentStatus = { type: 'connectionStatus', status: 'Disconnected' };
let isConnecting = false;

// Begin Offscreen API helper function
async function ensureOffscreenDocument() {
  if (!chrome.offscreen) {
    console.error('Offscreen API not available.');
    return false;
  }
  
  try {
    const exists = await chrome.offscreen.hasDocument();
    if (!exists) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["WORKERS"],
        justification: "WebSocket connection for chat"
      });
      console.log('Offscreen document created.');
    } else {
      console.log('Offscreen document already exists.');
    }
    return true;
  } catch (error) {
    console.error('Failed to create/check offscreen document:', error);
    return false;
  }
}

// Store message in history (avoid duplicates)
function addMessageToHistory(message) {
  const isDuplicate = messageHistory.some(m => 
    m.timestamp === message.timestamp && 
    m.message === message.message && 
    m.from === message.from
  );

  if (!isDuplicate) {
    messageHistory.push(message);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift();
    }
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
    try {
      chrome.storage.local.get(['serverIp'], (result) => {
        const ip = result.serverIp;
        resolve(ip === 'localhost' ? '127.0.0.1' : (ip || '127.0.0.1'));
      });
    } catch (error) {
      resolve('127.0.0.1');
    }
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
  
  chrome.runtime.sendMessage(currentStatus).catch(err => {
    console.log('No popup open to receive status');
  });
}

// Connect to WebSocket server via offscreen document
async function connect(targetIp = null) {
  if (isConnecting) {
    console.log('Connection attempt in progress, waiting...');
    return;
  }

  isConnecting = true;
  updateStatus('Connecting', 'Initializing connection...');

  try {
    // Get and save IP
    serverIp = targetIp || await getServerIp();
    if (targetIp) {
      saveServerIp(serverIp);
    }

    // Ensure offscreen document exists
    const offscreenReady = await ensureOffscreenDocument();
    if (!offscreenReady) {
      throw new Error('Failed to initialize offscreen document');
    }

    // Send connection request to offscreen document
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'updateConnection',
        serverIp: serverIp
      }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: false });
        }
      });
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to establish connection');
    }

  } catch (error) {
    console.error('Connection failed:', error);
    updateStatus('Error', error.message || 'Failed to connect to server');
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

// Handle messages from popup and offscreen document
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  // Check if message is from offscreen document
  const isFromOffscreen = sender.documentId && chrome.offscreen;
  if (isFromOffscreen && message.type !== 'updateConnection') {
    console.log('Message from offscreen document:', message);
  }
  
  switch (message.type) {
    case 'connectionStatus':
      updateStatus(message.status, message.message, message.serverIp);
      isConnecting = false;
      break;

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
        connect(message.ip);
        sendResponse({ success: true });
      }
      break;

    case 'messageReceived':
      addMessageToHistory(message);
      chrome.runtime.sendMessage(message).catch(err => {
        console.log('No popup open to receive message');
      });
      break;
  }
  return true;
});

// Handle initialization
let initialized = false;
async function initialize() {
  if (initialized) return;
  initialized = true;
  console.log('Extension initializing...');

  try {
    const savedIp = await getServerIp();
    serverIp = savedIp;
    console.log('Loaded saved server IP:', serverIp);
    connect(serverIp);
  } catch (error) {
    console.error('Failed to load saved IP:', error);
    connect('127.0.0.1');
  }
}

// Handle service worker lifecycle
chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onInstalled.addListener(initialize);

// Start connection if not already initialized
initialize();
