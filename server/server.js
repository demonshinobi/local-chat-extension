const WebSocket = require('ws');
const os = require('os');
const crypto = require('crypto');
const dns = require('dns');

// Get all local IP addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal addresses but include both IPv4 and IPv6
      if (!iface.internal) {
        addresses.push({
          address: iface.address,
          family: iface.family,
          interface: name
        });
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

// Print detailed network information
console.log('Network Interfaces:');
addresses.forEach(addr => {
  console.log(`- ${addr.interface}: ${addr.address} (${addr.family})`);
});

// Get hostname
dns.lookup(os.hostname(), (err, address, family) => {
  if (err) {
    console.error('Error getting hostname:', err);
  } else {
    console.log(`Hostname: ${os.hostname()}`);
    console.log(`Primary address: ${address} (IPv${family})`);
  }
});

const wss = new WebSocket.Server({ 
  port,
  host: '0.0.0.0', // Listen on all interfaces
  perMessageDeflate: false // Disable compression for better compatibility
});

console.log(`WebSocket server created on port ${port}`);
console.log('Server is accessible at:');
addresses.forEach(addr => {
  console.log(`ws://${addr.address}:${port}`);
});

// Store connected clients
const clients = new Set();

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`New client connected from ${clientIp}`);
  console.log('Connection headers:', req.headers);
  clients.add(ws);

  // Send welcome message with all available addresses
  const welcomeMessage = {
    type: 'system',
    status: 'Connected',
    message: `Connected to chat server. Available at: ${addresses.map(a => a.address).join(', ')}:${port}`
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
      console.log(`Received ${data.type} message from ${clientIp}`);
      
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

// Print active connections every 30 seconds
setInterval(() => {
  const activeClients = Array.from(clients).filter(c => c.readyState === WebSocket.OPEN);
  console.log(`Active connections: ${activeClients.length}`);
  activeClients.forEach((client, i) => {
    console.log(`- Client ${i + 1}: ${client._socket.remoteAddress}`);
  });
}, 30000);

console.log('Server setup complete');
