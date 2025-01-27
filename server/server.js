const WebSocket = require('ws');

const port = 8080;
const wss = new WebSocket.Server({ 
  port,
  // Increase timeout settings
  clientTracking: true,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024
  }
});

console.log(`WebSocket server running on port ${port}`);

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Client connected');

  // Broadcast encrypted messages to all other clients
  ws.on('message', (message) => {
    try {
      // Try to parse as JSON for ping messages
      const data = JSON.parse(message.toString());
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
    } catch (e) {
      // Not JSON, treat as encrypted message
      clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');
  });

  // Keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
    clearInterval(pingInterval);
  });

  ws.on('pong', () => {
    // Client responded to ping
    console.log('Client active');
  });

  ws.on('close', () => {
    clients.delete(ws);
    clearInterval(pingInterval);
    console.log('Client disconnected');
  });
});
