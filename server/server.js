const WebSocket = require('ws');
const os = require('os');
const crypto = require('crypto');

// Get local IP addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        addresses.push(iface.address);
      }
    }
  }
  
  return addresses;
}

// Simple encryption/decryption
function encrypt(text) {
  const key = crypto.scryptSync('local-chat-password', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    encrypted: encrypted,
    authTag: authTag.toString('hex')
  };
}

function decrypt(encryptedData) {
  const key = crypto.scryptSync('local-chat-password', 'salt', 32);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encryptedData.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const port = 8080;
const addresses = getLocalIpAddresses();
console.log(`Available IP addresses: ${addresses.join(', ')}`);

const wss = new WebSocket.Server({ 
  port,
  host: '0.0.0.0' // Listen on all interfaces
});

console.log(`WebSocket server created on port ${port}`);

// Store connected clients
const clients = new Set();

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`New client connected from ${clientIp}`);
  clients.add(ws);

  // Send welcome message immediately
  const welcomeMessage = {
    type: 'system',
    status: 'Connected',
    message: `Connected to chat server. Available at: ${addresses.join(', ')}:${port}`
  };
  
  try {
    ws.send(JSON.stringify(welcomeMessage));
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }

  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (data.type === 'chat' && data.message) {
        // Encrypt the message
        const encryptedData = encrypt(data.message);
        
        // Broadcast to all other clients
        const broadcastMessage = JSON.stringify({
          type: 'chat',
          message: data.message,
          from: clientIp,
          timestamp: new Date().toISOString(),
          encrypted: encryptedData
        });

        // Only send to other clients
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            try {
              client.send(broadcastMessage);
            } catch (error) {
              console.error('Error broadcasting message:', error);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      try {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message'
        }));
      } catch (e) {
        console.error('Error sending error message:', e);
      }
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log(`Client ${clientIp} disconnected`);
    clients.delete(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientIp}:`, error);
    clients.delete(ws);
  });
});

// Keep track of server status
let isShuttingDown = false;

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  isShuttingDown = true;
  
  // Close all client connections
  wss.clients.forEach((client) => {
    try {
      client.close();
    } catch (error) {
      console.error('Error closing client connection:', error);
    }
  });
  
  // Close the server
  wss.close(() => {
    console.log('Server shutdown complete');
    process.exit(0);
  });
});

console.log('Server setup complete');
