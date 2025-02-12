// WebSocket connection handler for offscreen document
let ws_offscreen = null;
let pingInterval = null;
let serverIp = '127.0.0.1';
let reconnectTimeout = null;

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
  
  return new Promise((resolve, reject) => {
    try {
      serverIp = ip || '127.0.0.1';
      const wsUrl = `ws://${serverIp}:8080`;
      console.log('Offscreen: creating WebSocket connection to', wsUrl);
      
      ws_offscreen = new WebSocket(wsUrl);
      
      ws_offscreen.onopen = () => {
        console.log('Offscreen: WebSocket connected');
        chrome.runtime.sendMessage({
          type: 'connectionStatus',
          status: 'Connected',
          serverIp: serverIp
        });
        
        // Setup ping interval
        pingInterval = setInterval(() => {
          if (ws_offscreen && ws_offscreen.readyState === WebSocket.OPEN) {
            ws_offscreen.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
        
        resolve(true);
      };
      
      ws_offscreen.onmessage = (event) => {
        console.log('Offscreen: Received message:', event.data);
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;
          chrome.runtime.sendMessage({
            type: 'messageReceived',
            ...data
          });
        } catch (error) {
          console.error('Offscreen: Failed to process message:', error);
        }
      };
      
      ws_offscreen.onclose = () => {
        console.log('Offscreen: WebSocket closed');
        clearInterval(pingInterval);
        ws_offscreen = null;
        
        chrome.runtime.sendMessage({
          type: 'connectionStatus',
          status: 'Disconnected',
          serverIp: serverIp
        });
        
        // Auto reconnect after delay
        reconnectTimeout = setTimeout(() => {
          connectOffscreen(serverIp);
        }, 5000);
        
        reject(new Error("WebSocket closed"));
      };
      
      ws_offscreen.onerror = (error) => {
        console.error('Offscreen: WebSocket error:', error);
        chrome.runtime.sendMessage({
          type: 'connectionStatus',
          status: 'Error',
          message: 'Connection error',
          serverIp: serverIp
        });
        reject(new Error("WebSocket error"));
      };
    } catch (error) {
      console.error('Offscreen: Failed to create WebSocket:', error);
      reject(error);
    }
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Offscreen: Received message:', message);
  
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
      sendResponse({ success: false, error: 'Not connected' });
      return true;
    }
    try {
      ws_offscreen.send(JSON.stringify(message));
      sendResponse({ success: true });
    } catch (error) {
      console.error('Offscreen: Failed to send message:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});