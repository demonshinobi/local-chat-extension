// Global variables
let reconnectAttempts = 0;
let serverIp = 'localhost';
let messageHistory = [];
const MAX_HISTORY = 200; // Store up to 200 messages
let currentStatus = { type: 'connectionStatus', status: 'Disconnected' };
let isConnecting = false;
let reconnectTimer = null;
let lastConnectedIp = null;
let persistentConnection = true; // Always maintain connection

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
  console.log('Adding message to history:', message);
  
  // Don't store system messages
  if (message.type === 'system') {
    return;
  }
  
  // Check for duplicates
  const isDuplicate = messageHistory.some(m => 
    m.timestamp === message.timestamp && 
    m.message === message.message && 
    m.from === message.from
  );

  if (!isDuplicate) {
    // Add message to memory
    messageHistory.push(message);
    
    // Trim history if needed
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift();
    }
    
    // Update badge count
    updateBadgeCount();
  }
}

// Clear message history
function clearMessageHistory() {
  messageHistory = [];
  updateBadgeCount();
  
  // Also clear history in offscreen document
  chrome.runtime.sendMessage({ type: 'clearHistory' }).catch(err => {
    console.log('No offscreen document to clear history');
  });
  
  console.log('Message history cleared');
}

// Store the server IP
function saveServerIp(ip) {
  chrome.storage.local.set({ 'serverIp': ip }, () => {
    console.log('Server IP saved:', ip);
  });
}

// Get the stored server IP
async function getServerIp() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['serverIp', 'lastConnectedIp'], (result) => {
        // First try to use the last successfully connected IP
        if (result && result.lastConnectedIp) {
          console.log('Using last successfully connected IP:', result.lastConnectedIp);
          resolve(result.lastConnectedIp);
        } 
        // Then try the manually entered IP
        else if (result && result.serverIp) {
          console.log('Using stored server IP:', result.serverIp);
          resolve(result.serverIp);
        } 
        // Then try the last connected IP from this session
        else if (lastConnectedIp) {
          console.log('Using session last connected IP:', lastConnectedIp);
          resolve(lastConnectedIp);
        } 
        // Default to localhost
        else {
          console.log('No stored IP found, using localhost');
          resolve('localhost');
        }
      });
    } catch (error) {
      console.error('Error getting server IP from storage:', error);
      // Fallback logic
      if (lastConnectedIp) {
        resolve(lastConnectedIp);
      } else {
        resolve('localhost');
      }
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
  
  // If we're connected, store the IP as the last successfully connected IP
  if (status === 'Connected' && serverIp) {
    chrome.storage.local.set({ 'lastConnectedIp': serverIp }, () => {
      console.log('Saved last successfully connected IP:', serverIp);
    });
  }
  
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

  // Clear any existing reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  isConnecting = true;
  updateStatus('Connecting', 'Initializing connection...');

  try {
    // Get and save IP
    serverIp = targetIp || await getServerIp();
    if (targetIp) {
      saveServerIp(serverIp);
    }
    
    // Remember this IP for reconnection attempts
    lastConnectedIp = serverIp;

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

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to establish connection');
    }

    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    isConnecting = false;
    
    // Get message history from offscreen document
    chrome.runtime.sendMessage({ type: 'getHistory' }, (response) => {
      if (response && response.messages && Array.isArray(response.messages)) {
        console.log('Received message history from offscreen document:', response.messages.length, 'messages');
        messageHistory = response.messages;
        updateBadgeCount();
      }
    });

  } catch (error) {
    console.error('Connection failed:', error);
    updateStatus('Error', error.message || 'Failed to connect to server');
    isConnecting = false;
    
    // Schedule reconnection with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Max 30 seconds
    reconnectAttempts++;
    
    console.log(`Scheduling reconnection attempt in ${delay}ms`);
    reconnectTimer = setTimeout(() => {
      connect(lastConnectedIp);
    }, delay);
  }
}

// Update badge count for unread messages
function updateBadgeCount() {
  try {
    // Count unread messages
    const unreadCount = messageHistory.filter(msg => !msg.read).length;
    
    // Update badge
    if (unreadCount > 0) {
      chrome.action.setBadgeText({ text: unreadCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    
    console.log('Updated badge count:', unreadCount);
  } catch (error) {
    console.error('Error updating badge count:', error);
  }
}

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
      console.log('Sending message history, count:', messageHistory.length);
      
      // If we have no messages in memory but we're connected, try to get them from offscreen
      if (messageHistory.length === 0 && currentStatus.status === 'Connected') {
        chrome.runtime.sendMessage({ type: 'getHistory' }, (response) => {
          if (response && response.messages && Array.isArray(response.messages)) {
            console.log('Received message history from offscreen document:', response.messages.length, 'messages');
            messageHistory = response.messages;
            updateBadgeCount();
            sendResponse({ messages: messageHistory });
          } else {
            sendResponse({ messages: [] });
          }
        });
        return true; // Keep the message channel open for the async response
      }
      
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
        
        // Update badge count after marking messages as read
        updateBadgeCount();
        
        sendResponse({ success: true });
      }
      break;

    case 'connectTo':
      if (message.ip) {
        saveServerIp(message.ip);
        connect(message.ip).then(() => {
          // Force a status update after a short delay
          setTimeout(() => {
            if (currentStatus.status !== 'Connected') {
              // Try direct connection to the server
              chrome.runtime.sendMessage({
                type: 'updateConnection',
                serverIp: message.ip
              }, (response) => {
                if (response && response.success) {
                  updateStatus('Connected', 'Connected to ' + message.ip, message.ip);
                }
              });
            }
          }, 2000);
        });
        sendResponse({ success: true });
      }
      break;

    case 'messageReceived':
      console.log('Received message from server:', message);
      
      // Handle system message for history cleared
      if (message.type === 'system' && message.status === 'HistoryCleared') {
        console.log('Server history has been cleared');
        clearMessageHistory();
        
        // Forward to popup if open
        chrome.runtime.sendMessage(message).catch(err => {
          console.log('No popup open to receive message');
        });
        
        return;
      }
      
      // Make sure the message has all required fields
      if (message.type === 'chat' && message.message) {
        console.log('Processing chat message:', message.message);
        
        // Create a clean message object
        const chatMessage = {
          type: 'chat',
          message: message.message,
          from: message.from || 'unknown',
          username: message.username || 'Anonymous',
          timestamp: message.timestamp || new Date().toISOString(),
          read: false // Mark as unread by default
        };
        
        // Add to history
        addMessageToHistory(chatMessage);
        
        // Forward to popup if open
        chrome.runtime.sendMessage(chatMessage).catch(err => {
          console.log('No popup open to receive message');
        });
        
        // Show notification if not from self
        if (message.from !== 'self' && chatMessage.from !== 'self') {
          try {
            // Check if notifications are enabled
            chrome.storage.local.get('notificationsEnabled', (result) => {
              if (result && result.notificationsEnabled !== false) {
                // Create and show notification
                chrome.notifications.create({
                  type: 'basic',
                  iconUrl: 'icons/icon128.png',
                  title: chatMessage.username || 'New Message',
                  message: chatMessage.message,
                  priority: 2
                });
              }
            });
          } catch (error) {
            console.error('Error showing notification:', error);
          }
        }
      } else if (message.type === 'image' && message.imageData) {
        console.log('Processing image message');
        
        // Create a clean message object
        const imageMessage = {
          type: 'image',
          imageData: message.imageData,
          from: message.from || 'unknown',
          username: message.username || 'Anonymous',
          timestamp: message.timestamp || new Date().toISOString(),
          read: false // Mark as unread by default
        };
        
        // Add to history
        addMessageToHistory(imageMessage);
        
        // Forward to popup if open
        chrome.runtime.sendMessage(imageMessage).catch(err => {
          console.log('No popup open to receive message');
        });
        
        // Show notification if not from self
        if (message.from !== 'self' && imageMessage.from !== 'self') {
          try {
            // Check if notifications are enabled
            chrome.storage.local.get('notificationsEnabled', (result) => {
              if (result && result.notificationsEnabled !== false) {
                // Create and show notification
                chrome.notifications.create({
                  type: 'basic',
                  iconUrl: 'icons/icon128.png',
                  title: imageMessage.username || 'New Message',
                  message: 'Sent you an image',
                  priority: 2
                });
              }
            });
          } catch (error) {
            console.error('Error showing notification:', error);
          }
        }
      } else if (message.type === 'system' && message.status === 'History') {
        // This is a history message from the server, ignore it
        console.log('Received history message from server');
      } else if (message.type === 'system') {
        console.log('Processing system message:', message.message || message.status);
        
        // Forward system messages but don't store them
        chrome.runtime.sendMessage(message).catch(err => {
          console.log('No popup open to receive message');
        });
      }
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
    // Get saved IP and connect
    const savedIp = await getServerIp();
    serverIp = savedIp;
    console.log('Loaded saved server IP:', serverIp);
    connect(serverIp);
    
    // Set up more frequent connection check (every 15 seconds)
    setInterval(checkConnection, 15000);
  } catch (error) {
    console.error('Failed to load saved IP:', error);
    connect('127.0.0.1');
  }
}

// Periodically check connection status and reconnect if needed
function checkConnection() {
  if (persistentConnection && currentStatus.status !== 'Connected' && !isConnecting) {
    console.log('Connection check: Not connected. Attempting to reconnect...');
    
    // Try to reconnect using the best available IP
    getServerIp().then(bestIp => {
      console.log('Reconnecting with best available IP:', bestIp);
      connect(bestIp);
    });
  } else {
    console.log('Connection check: Status is', currentStatus.status);
    
    // Even if connected, periodically verify the connection is still active
    if (currentStatus.status === 'Connected') {
      chrome.runtime.sendMessage({
        type: 'checkConnection'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Error checking connection:', chrome.runtime.lastError);
          return;
        }
        
        if (response && response.connected === false) {
          console.log('Connection check failed, reconnecting...');
          updateStatus('Disconnected', 'Connection lost');
          connect();
        }
      });
    }
  }
}

// Handle service worker lifecycle
chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onInstalled.addListener(initialize);

// Start connection if not already initialized
initialize();
