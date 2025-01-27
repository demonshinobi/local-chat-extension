// Generate a random encryption key for this session
async function generateKey() {
  return await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Encrypt message
async function encryptMessage(key, message) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = new TextEncoder().encode(message);
  
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    encodedMessage
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  return combined;
}

// Decrypt message
async function decryptMessage(key, encryptedCombined) {
  const iv = encryptedCombined.slice(0, 12);
  const encryptedData = encryptedCombined.slice(12);

  const decryptedData = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    encryptedData
  );

  return new TextDecoder().decode(decryptedData);
}

let ws;
let encryptionKey;
let reconnectAttempts = 0;
let pingInterval;
let serverIp = null;
const pendingMessages = new Map(); // Track messages waiting for delivery confirmation

// Store the server IP in chrome.storage
function saveServerIp(ip) {
  chrome.storage.local.set({ serverIp: ip });
}

// Get the stored server IP
async function getServerIp() {
  const result = await chrome.storage.local.get('serverIp');
  return result.serverIp;
}

// Generate unique message ID
function generateMessageId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Connect to WebSocket server
async function connect() {
  if (ws && ws.readyState !== WebSocket.CLOSED) {
    console.log('Connection already exists');
    return;
  }

  // Try to get stored server IP
  const storedIp = await getServerIp();
  if (!storedIp) {
    chrome.runtime.sendMessage({ 
      type: 'connectionStatus', 
      status: 'error',
      message: 'No server IP found. Please restart the server.'
    });
    return;
  }

  ws = new WebSocket(`ws://${storedIp}:8080`);
  
  ws.onopen = async () => {
    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    
    // Generate new encryption key when connection established
    encryptionKey = await generateKey();
    
    // Setup ping interval
    clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 15000);

    // Notify popup that connection is ready
    chrome.runtime.sendMessage({ 
      type: 'connectionStatus', 
      status: 'connected',
      serverIp: storedIp
    });
  };

  ws.onmessage = async (event) => {
    try {
      // First try to parse as JSON for control messages
      const data = JSON.parse(event.data);
      
      if (data.type === 'system' && data.message) {
        // Extract IP from welcome message
        const ipMatch = data.message.match(/at\s+(\d+\.\d+\.\d+\.\d+):/);
        if (ipMatch) {
          serverIp = ipMatch[1];
          saveServerIp(serverIp);
        }
        return;
      }

      if (data.type === 'pong') {
        console.log('Received pong from server');
        return;
      }

      if (data.type === 'delivered') {
        // Handle delivery confirmation
        const pendingMsg = pendingMessages.get(data.messageId);
        if (pendingMsg) {
          pendingMessages.delete(data.messageId);
          chrome.runtime.sendMessage({
            type: 'messageDelivered',
            messageId: data.messageId,
            timestamp: data.timestamp
          });
        }
        return;
      }

      // If it's a chat message, decrypt and forward
      if (data.type === 'chat') {
        const encryptedData = new Uint8Array(await data.content.arrayBuffer());
        const decryptedMessage = await decryptMessage(encryptionKey, encryptedData);
        chrome.runtime.sendMessage({
          type: 'messageReceived',
          message: decryptedMessage,
          from: data.from,
          timestamp: data.timestamp
        });
      }

    } catch (error) {
      // If not JSON, treat as encrypted message
      try {
        const encryptedData = new Uint8Array(await event.data.arrayBuffer());
        const decryptedMessage = await decryptMessage(encryptionKey, encryptedData);
        chrome.runtime.sendMessage({
          type: 'messageReceived',
          message: decryptedMessage
        });
      } catch (error) {
        console.error('Error processing received message:', error);
      }
    }
  };

  ws.onclose = () => {
    clearInterval(pingInterval);
    chrome.runtime.sendMessage({ 
      type: 'connectionStatus', 
      status: 'disconnected' 
    });
    
    // Try to reconnect after a delay with exponential backoff
    const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectAttempts++;
    console.log(`Attempting to reconnect in ${backoff}ms`);
    setTimeout(connect, backoff);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    chrome.runtime.sendMessage({ 
      type: 'connectionStatus', 
      status: 'error',
      message: error.message
    });
  };
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'sendMessage' && ws && ws.readyState === WebSocket.OPEN) {
    (async () => {
      try {
        const messageId = generateMessageId();
        const encryptedData = await encryptMessage(encryptionKey, message.text);
        
        // Create message object
        const messageObject = {
          type: 'chat',
          messageId,
          content: encryptedData
        };

        // Track message for delivery confirmation
        pendingMessages.set(messageId, {
          text: message.text,
          timestamp: new Date().toISOString()
        });

        // Send message
        ws.send(JSON.stringify(messageObject));
        
        // Notify popup that message is sent
        sendResponse({ 
          success: true, 
          messageId,
          status: 'sent'
        });

        // Set timeout for delivery confirmation
        setTimeout(() => {
          if (pendingMessages.has(messageId)) {
            pendingMessages.delete(messageId);
            chrome.runtime.sendMessage({
              type: 'messageStatus',
              messageId,
              status: 'undelivered'
            });
          }
        }, 5000);

      } catch (error) {
        console.error('Error sending message:', error);
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      }
    })();
    return true; // Will respond asynchronously
  }
});

// Start connection when background script loads
connect();
