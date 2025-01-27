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

// Connect to WebSocket server
function connect() {
  if (ws && ws.readyState !== WebSocket.CLOSED) {
    console.log('Connection already exists');
    return;
  }

  ws = new WebSocket('ws://localhost:8080');
  
  ws.onopen = async () => {
    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    
    // Generate new encryption key when connection established
    encryptionKey = await generateKey();
    
    // Notify popup that connection is ready
    chrome.runtime.sendMessage({ type: 'connectionStatus', status: 'connected' });

    // Setup ping-pong to keep connection alive
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  };

  ws.onmessage = async (event) => {
    try {
      // Check if message is a ping response
      if (event.data === '{"type":"pong"}') {
        console.log('Received pong from server');
        return;
      }

      // Handle normal messages
      const encryptedData = new Uint8Array(await event.data.arrayBuffer());
      const decryptedMessage = await decryptMessage(encryptionKey, encryptedData);
      
      // Send decrypted message to popup
      chrome.runtime.sendMessage({
        type: 'messageReceived',
        message: decryptedMessage
      });
    } catch (error) {
      console.error('Error processing received message:', error);
    }
  };

  ws.onclose = () => {
    clearInterval(pingInterval);
    chrome.runtime.sendMessage({ type: 'connectionStatus', status: 'disconnected' });
    
    // Try to reconnect after a delay with exponential backoff
    const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectAttempts++;
    console.log(`Attempting to reconnect in ${backoff}ms`);
    setTimeout(connect, backoff);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    chrome.runtime.sendMessage({ type: 'connectionStatus', status: 'error' });
  };
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'sendMessage' && ws && ws.readyState === WebSocket.OPEN) {
    (async () => {
      try {
        const encryptedData = await encryptMessage(encryptionKey, message.text);
        ws.send(encryptedData);
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error sending message:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Will respond asynchronously
  }
});

// Start connection when background script loads
connect();
