// WebSocket connection handler for offscreen document
let ws_offscreen = null;
let pingInterval = null;
let serverIp = '127.0.0.1';
let reconnectTimeout = null;
let lastPingTime = 0;
let connectionActive = false;
const PING_INTERVAL_MS = 10000; // 10 seconds
const PING_TIMEOUT_MS = 8000;   // 8 seconds
const MAX_RECONNECT_ATTEMPTS = 10; // Maximum reconnection attempts
let reconnectAttempts = 0;
let lastSuccessfulConnection = null; // Track last successful connection time
let messageHistory = []; // Store message history locally

// Check if connection is still alive
function checkConnection() {
  if (!ws_offscreen || ws_offscreen.readyState !== WebSocket.OPEN) {
    return false;
  }
  
  const now = Date.now();
  if (now - lastPingTime > PING_TIMEOUT_MS) {
    console.log('Offscreen: Connection appears stale, sending ping');
    try {
      ws_offscreen.send(JSON.stringify({ type: 'ping' }));
      lastPingTime = now;
    } catch (error) {
      console.error('Offscreen: Failed to send ping:', error);
      return false;
    }
  }
  
  return true;
}

// Try different connection methods
async function tryConnect(ip) {
  // Normalize IP address
  let normalizedIp = ip;
  
  // Always try the vEthernet IP first (from setup.bat)
  try {
    console.log('Offscreen: Trying vEthernet IP 172.31.208.1 first');
    const vEthernetResult = await attemptConnection('172.31.208.1');
    if (vEthernetResult.success) return vEthernetResult;
    
    // If vEthernet fails, try the provided IP
    if (ip !== '172.31.208.1') {
      console.log(`Offscreen: vEthernet failed, trying provided IP ${normalizedIp}`);
      const result = await attemptConnection(normalizedIp);
      if (result.success) return result;
    }
    
    // Try multiple connection strategies
    if (ip === 'localhost') {
      // Try both localhost and 127.0.0.1
      console.log('Offscreen: Trying localhost');
      const localhostResult = await attemptConnection('localhost');
      if (localhostResult.success) return localhostResult;
      
      console.log('Offscreen: Localhost failed, trying 127.0.0.1');
      return await attemptConnection('127.0.0.1');
    } else if (ip.includes('.')) {
      // For IP addresses, try localhost as fallback
      console.log('Offscreen: IP failed, trying localhost');
      const localhostResult = await attemptConnection('localhost');
      if (localhostResult.success) return localhostResult;
      
      // If localhost fails, try 127.0.0.1
      console.log('Offscreen: Localhost failed, trying 127.0.0.1');
      return await attemptConnection('127.0.0.1');
    } else {
      // For hostnames, try localhost as fallback
      console.log('Offscreen: Hostname failed, trying localhost');
      const localhostResult = await attemptConnection('localhost');
      if (localhostResult.success) return localhostResult;
      
      // If localhost fails, try 127.0.0.1
      console.log('Offscreen: Localhost failed, trying 127.0.0.1');
      return await attemptConnection('127.0.0.1');
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Attempt a connection to a specific address
async function attemptConnection(ip) {
  return new Promise((resolve) => {
    try {
      console.log(`Offscreen: Attempting connection to ws://${ip}:8080`);
      const ws = new WebSocket(`ws://${ip}:8080`);
      
      // Set a timeout for the connection attempt
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log(`Offscreen: Connection to ${ip} timed out`);
          ws.close();
          resolve({ success: false, error: 'Connection timeout' });
        }
      }, 5000);
      
      ws.onopen = () => {
        console.log(`Offscreen: Successfully connected to ${ip}`);
        clearTimeout(timeout);
        resolve({ success: true, ws: ws });
      };
      
      ws.onerror = (error) => {
        console.log(`Offscreen: Error connecting to ${ip}:`, error);
        clearTimeout(timeout);
        resolve({ success: false, error: 'Connection error' });
      };
    } catch (error) {
      console.log(`Offscreen: Exception connecting to ${ip}:`, error);
      resolve({ success: false, error: error.message });
    }
  });
}

// Process and store message in history
function processAndStoreMessage(message) {
  // Don't store system messages except history messages
  if (message.type === 'system' && message.status !== 'History') {
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
    if (messageHistory.length > 200) { // Max 200 messages
      messageHistory.shift();
    }
    
    // Forward to background script
    try {
      chrome.runtime.sendMessage({
        type: 'messageReceived',
        ...message
      });
    } catch (error) {
      console.error('Offscreen: Failed to forward message to background:', error);
    }
  }
}

// Clear message history
function clearMessageHistory() {
  console.log('Offscreen: Clearing message history');
  messageHistory = [];
  
  // Also send clear history command to server if connected
  if (ws_offscreen && ws_offscreen.readyState === WebSocket.OPEN) {
    try {
      ws_offscreen.send(JSON.stringify({
        type: 'clearHistory',
        timestamp: new Date().toISOString()
      }));
      console.log('Offscreen: Sent clear history command to server');
    } catch (error) {
      console.error('Offscreen: Failed to send clear history command:', error);
    }
  }
}

async function connectOffscreen(ip) {
  // If WebSocket is already connected, reuse it.
  if (ws_offscreen && ws_offscreen.readyState === WebSocket.OPEN) {
    console.log('Offscreen: already connected to', ip);
    return true;
  }
  
  // Clear any existing connection and timers.
  if (ws_offscreen) {
    ws_offscreen.close();
    ws_offscreen = null;
  }
  
  clearInterval(pingInterval);
  clearTimeout(reconnectTimeout);
  connectionActive = false;
  
  return new Promise((resolve, reject) => {
    try {
      serverIp = ip || 'localhost';
      
      // Try to connect
      tryConnect(serverIp).then(result => {
        if (result.success) {
          ws_offscreen = result.ws;
          console.log('Offscreen: WebSocket connection successful');
      
          // Connection successful, set up event handlers
          connectionActive = true;
          lastPingTime = Date.now();
          lastSuccessfulConnection = Date.now();
          reconnectAttempts = 0; // Reset reconnect attempts on success
          
          // Store the successful IP in chrome.storage for persistence
          try {
            chrome.storage.local.set({ 'lastConnectedIp': serverIp }, () => {
              if (chrome.runtime.lastError) {
                console.error('Offscreen: Error saving lastConnectedIp:', chrome.runtime.lastError);
              } else {
                console.log('Offscreen: Saved last successful connection IP:', serverIp);
              }
            });
          } catch (error) {
            console.error('Offscreen: Exception saving lastConnectedIp:', error);
          }
          
          try {
            chrome.runtime.sendMessage({
              type: 'connectionStatus',
              status: 'Connected',
              serverIp: serverIp
            });
          } catch (error) {
            console.error('Offscreen: Failed to send connection status:', error);
          }
          
          // Setup ping interval with more robust error handling
          pingInterval = setInterval(() => {
            if (ws_offscreen && ws_offscreen.readyState === WebSocket.OPEN) {
              try {
                ws_offscreen.send(JSON.stringify({ type: 'ping' }));
                lastPingTime = Date.now();
              } catch (error) {
                console.error('Offscreen: Failed to send ping:', error);
                // If ping fails, check connection and potentially reconnect
                if (!checkConnection()) {
                  clearInterval(pingInterval);
                  if (ws_offscreen) {
                    ws_offscreen.close();
                  }
                  
                  // Attempt immediate reconnection
                  console.log('Offscreen: Ping failed, attempting reconnection');
                  connectOffscreen(serverIp).catch(err => {
                    console.error('Offscreen: Reconnection after ping failure failed:', err);
                  });
                }
              }
            } else {
              // Connection is not open, clear interval and attempt reconnection
              clearInterval(pingInterval);
              console.log('Offscreen: Connection not open during ping interval, reconnecting');
              connectOffscreen(serverIp).catch(err => {
                console.error('Offscreen: Reconnection during ping interval failed:', err);
              });
            }
          }, PING_INTERVAL_MS);
          
          // Set up message handler
          setupMessageHandler();
          
          resolve(true);
        } else {
          console.error(`Offscreen: Connection failed: ${result.error}`);
          try {
            chrome.runtime.sendMessage({
              type: 'connectionStatus',
              status: 'Error',
              message: result.error,
              serverIp: serverIp
            });
          } catch (error) {
            console.error('Offscreen: Failed to send error status:', error);
          }
          
          // Increment reconnect attempts
          reconnectAttempts++;
          
          // Schedule reconnection with exponential backoff
          const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts), 30000); // Max 30 seconds
          console.log(`Offscreen: Scheduling reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
          
          // Only attempt reconnection if we haven't exceeded the maximum attempts
          // or if we had a successful connection in the past
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS || lastSuccessfulConnection) {
            reconnectTimeout = setTimeout(() => {
              connectOffscreen(serverIp).catch(err => {
                console.error('Offscreen: Scheduled reconnection failed:', err);
              });
            }, delay);
          } else {
            console.error('Offscreen: Maximum reconnection attempts reached without success');
          }
          
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.error('Offscreen: Connection attempt failed:', error);
        reject(error);
      });
    } catch (error) {
      console.error('Offscreen: Failed to create WebSocket:', error);
      reject(error);
    }
  });
}

// Set up WebSocket message handler
function setupMessageHandler() {
  if (!ws_offscreen) return;
      
  ws_offscreen.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Handle pong messages
      if (data.type === 'pong') {
        console.log('Offscreen: Received pong');
        return;
      }
      
      console.log('Offscreen: Received message:', data.type);
      
      // Process and store message
      processAndStoreMessage(data);
    } catch (error) {
      console.error('Offscreen: Failed to process message:', error);
    }
  };
  
  ws_offscreen.onclose = (event) => {
    console.log(`Offscreen: WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
    clearInterval(pingInterval);
    connectionActive = false;
    
    try {
      chrome.runtime.sendMessage({
        type: 'connectionStatus',
        status: 'Disconnected',
        message: event.reason || 'Connection closed',
        serverIp: serverIp
      });
    } catch (error) {
      console.error('Offscreen: Failed to send disconnection status:', error);
    }
    
    // Increment reconnect attempts
    reconnectAttempts++;
    
    // Auto reconnect after delay with exponential backoff
    const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts), 30000);
    console.log(`Offscreen: Will attempt reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    
    // Only attempt reconnection if we haven't exceeded the maximum attempts
    // or if we had a successful connection in the past
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS || lastSuccessfulConnection) {
      reconnectTimeout = setTimeout(() => {
        // Try to get the best IP to use for reconnection
        try {
          chrome.storage.local.get(['lastConnectedIp', 'serverIp'], (result) => {
            if (chrome.runtime.lastError) {
              console.error('Offscreen: Error getting IPs for reconnection:', chrome.runtime.lastError);
              // Use the current serverIp as fallback
              connectOffscreen(serverIp).catch(err => {
                console.error('Offscreen: Reconnection with current IP failed:', err);
              });
            } else {
              const bestIp = result.lastConnectedIp || result.serverIp || serverIp;
              console.log('Offscreen: Reconnecting with best IP:', bestIp);
              connectOffscreen(bestIp).catch(err => {
                console.error('Offscreen: Reconnection failed:', err);
              });
            }
          });
        } catch (error) {
          console.error('Offscreen: Exception getting IPs for reconnection:', error);
          // Use the current serverIp as fallback
          connectOffscreen(serverIp).catch(err => {
            console.error('Offscreen: Fallback reconnection failed:', err);
          });
        }
      }, delay);
    } else {
      console.error('Offscreen: Maximum reconnection attempts reached without success');
    }
  };
  
  ws_offscreen.onerror = (error) => {
    console.error('Offscreen: WebSocket error:', error);
    
    try {
      chrome.runtime.sendMessage({
        type: 'connectionStatus',
        status: 'Error',
        message: 'Connection error',
        serverIp: serverIp
      });
    } catch (err) {
      console.error('Offscreen: Failed to send error status:', err);
    }
  };
  
  // Handle pong responses
  ws_offscreen.onpong = () => {
    console.log(`Offscreen: Received pong`);
  };
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Offscreen: Received message from background:', message.type);
  
  if (message.type === 'updateConnection') {
    connectOffscreen(message.serverIp)
      .then(success => {
        // Use setTimeout to ensure asynchronous response
        setTimeout(() => {
          sendResponse({ success });
        }, 0);
      })
      .catch(err => {
        setTimeout(() => {
          sendResponse({ success: false, error: err.message });
        }, 0);
      });
    return true;
  }
  
  if (message.type === 'sendMessage' || message.type === 'sendImageMessage') {
    if (!ws_offscreen || ws_offscreen.readyState !== WebSocket.OPEN) {
      // Try to reconnect first
      connectOffscreen(serverIp)
        .then(() => {
          try {
            // For large image data, log the size
            if (message.type === 'sendImageMessage' && message.imageData) {
              const size = message.imageData.length;
              console.log(`Offscreen: Sending image message (size: ${size} bytes)`);
            }
            
            // Format the message for the server
            let messageToSend;
            if (message.type === 'sendMessage') {
              messageToSend = {
                type: 'chat',
                message: message.message,
                username: message.username || 'Anonymous'
              };
              console.log('Offscreen: Sending chat message:', messageToSend);
            } else {
              messageToSend = message;
            }
            
            ws_offscreen.send(JSON.stringify(messageToSend));
            sendResponse({ success: true });
          } catch (error) {
            console.error('Offscreen: Failed to send message after reconnect:', error);
            sendResponse({ success: false, error: error.message });
          }
        })
        .catch(err => {
          sendResponse({ success: false, error: 'Not connected and reconnection failed' });
        });
    } else {
      try {
        // For large image data, log the size
        if (message.type === 'sendImageMessage' && message.imageData) {
          const size = message.imageData.length;
          console.log(`Offscreen: Sending image message (size: ${size} bytes)`);
        }
        
        // Format the message for the server
        let messageToSend;
        if (message.type === 'sendMessage') {
          messageToSend = {
            type: 'chat',
            message: message.message,
            username: message.username || 'Anonymous'
          };
          console.log('Offscreen: Sending chat message:', messageToSend);
        } else {
          messageToSend = message;
        }
        
        ws_offscreen.send(JSON.stringify(messageToSend));
        sendResponse({ success: true });
      } catch (error) {
        console.error('Offscreen: Failed to send message:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  }
  
  if (message.type === 'checkConnection') {
    const isConnected = checkConnection();
    sendResponse({ connected: isConnected });
    return true;
  }
  
  if (message.type === 'typing' || message.type === 'stoppedTyping') {
    if (ws_offscreen && ws_offscreen.readyState === WebSocket.OPEN) {
      try {
        ws_offscreen.send(JSON.stringify(message));
        sendResponse({ success: true });
      } catch (error) {
        console.error('Offscreen: Failed to send typing indicator:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      sendResponse({ success: false, error: 'Not connected' });
    }
    return true;
  }
  
  if (message.type === 'getHistory') {
    sendResponse({ messages: messageHistory });
    return true;
  }
  
  if (message.type === 'clearHistory') {
    clearMessageHistory();
    sendResponse({ success: true });
    return true;
  }
});

// Initialize connection check interval
setInterval(() => {
  checkConnection();
}, PING_INTERVAL_MS);

console.log('Offscreen document initialized');
