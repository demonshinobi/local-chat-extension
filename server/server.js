const WebSocket = require('ws');
const os = require('os');

// Get local IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const port = 8080;
const localIp = getLocalIpAddress();

const wss = new WebSocket.Server({
  port,
  clientTracking: true,
  perMessageDeflate: {
    zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
    zlibInflateOptions: { chunkSize: 10 * 1024 },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024
  }
});

console.log(`WebSocket server running on ${localIp}:${port}`);

// Store connected clients
const clients = new Set();

// Broadcast message to all clients except sender
function broadcast(ws, message) {
  clients.forEach((client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws, req) => {
  clients.add(ws);
  const clientIp = req.socket.remoteAddress;
  console.log(`Client connected from ${clientIp}`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    message: `Connected to chat server at ${localIp}:${port}`
  }));

  let pingInterval;
  let missedPings = 0;
  const MAX_MISSED_PINGS = 3;

  // Set up ping interval
  const setupPingInterval = () => {
    clearInterval(pingInterval);
    missedPings = 0;
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        if (missedPings >= MAX_MISSED_PINGS) {
          console.log('Client unresponsive, closing connection');
          ws.terminate();
          return;
        }
        ws.ping();
        missedPings++;
      }
    }, 15000); // 15 seconds
  };

  setupPingInterval();

  ws.on('message', (message) => {
    try {
      // Try to parse as JSON
      const data = JSON.parse(message.toString());
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (data.type === 'chat') {
        // Add sender info and timestamp
        const enhancedMessage = JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          from: clientIp
        });
        
        // Broadcast to others
        broadcast(ws, enhancedMessage);
        
        // Send delivery confirmation
        ws.send(JSON.stringify({
          type: 'delivered',
          messageId: data.messageId,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (e) {
      // Not JSON, treat as encrypted message
      broadcast(ws, message);
    }
  });

  ws.on('pong', () => {
    missedPings = 0;
    console.log(`Client ${clientIp} active`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
    clearInterval(pingInterval);
  });

  ws.on('close', () => {
    clients.delete(ws);
    clearInterval(pingInterval);
    console.log(`Client ${clientIp} disconnected`);
  });
});
