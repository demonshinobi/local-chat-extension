const WebSocket = require('ws');
const os = require('os');
const crypto = require('crypto');
const dns = require('dns');
const fs = require('fs');
const path = require('path');

// Setup logging
const LOG_FILE = path.join(__dirname, 'server.log');
const MAX_LOG_SIZE = 1024 * 1024; // 1MB

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  // Log to console
  console.log(logMessage);
  
  // Log to file with rotation
  try {
    // Check if log file exists and its size
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > MAX_LOG_SIZE) {
        // Rotate log file
        const backupFile = `${LOG_FILE}.1`;
        if (fs.existsSync(backupFile)) {
          fs.unlinkSync(backupFile);
        }
        fs.renameSync(LOG_FILE, backupFile);
      }
    }
    
    // Append to log file
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

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

// Store message history
const MESSAGE_HISTORY_FILE = path.join(__dirname, 'message_history.json');
let messageHistory = [];
const MAX_HISTORY = 500; // Increased from 200 to 500 for better persistence

// Load message history
function loadMessageHistory() {
  try {
    if (fs.existsSync(MESSAGE_HISTORY_FILE)) {
      const data = fs.readFileSync(MESSAGE_HISTORY_FILE, 'utf8');
      messageHistory = JSON.parse(data);
      log(`Loaded ${messageHistory.length} messages from history file`);
    }
  } catch (error) {
    log(`Failed to load message history: ${error.message}`, 'ERROR');
    messageHistory = [];
  }
}

// Save message history
function saveMessageHistory() {
  try {
    // Create backup of existing history file
    if (fs.existsSync(MESSAGE_HISTORY_FILE)) {
      const backupFile = `${MESSAGE_HISTORY_FILE}.bak`;
      fs.copyFileSync(MESSAGE_HISTORY_FILE, backupFile);
    }
    
    // Write new history file
    fs.writeFileSync(MESSAGE_HISTORY_FILE, JSON.stringify(messageHistory), 'utf8');
    log(`Saved ${messageHistory.length} messages to history file`);
  } catch (error) {
    log(`Failed to save message history: ${error.message}`, 'ERROR');
  }
}

// Clear message history
function clearMessageHistory() {
  log('Clearing message history', 'INFO');
  messageHistory = [];
  saveMessageHistory();
  
  // Notify all clients that history has been cleared
  const clearMessage = {
    type: 'system',
    status: 'HistoryCleared',
    message: 'Message history has been cleared',
    timestamp: new Date().toISOString()
  };
  
  broadcastToAll(clearMessage);
}

// Broadcast message to all connected clients
function broadcastToAll(message) {
  const broadcastMessage = JSON.stringify(message);
  let sentCount = 0;
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(broadcastMessage);
        sentCount++;
      } catch (error) {
        log(`Error broadcasting message: ${error.message}`, 'ERROR');
      }
    }
  });
  
  log(`System message broadcast to ${sentCount} clients`, 'INFO');
  return sentCount;
}

// Add message to history
function addMessageToHistory(message) {
  // Don't store ping/pong messages
  if (message.type === 'ping' || message.type === 'pong') {
    return;
  }
  
  // Check for duplicates before adding
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
    
    // Save to file - but not on every message to reduce disk I/O
    // Instead, save every 10 messages or when specific types are received
    if (messageHistory.length % 10 === 0 || 
        message.type === 'image' || 
        message.type === 'system') {
      saveMessageHistory();
    }
  }
}

// Simple encryption/decryption with error handling
function encrypt(text) {
  try {
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
  } catch (error) {
    log(`Encryption error: ${error.message}`, 'ERROR');
    return { error: 'Encryption failed' };
  }
}

function decrypt(encryptedData) {
  try {
    if (encryptedData.error) return '[Encrypted message]';
    
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
  } catch (error) {
    log(`Decryption error: ${error.message}`, 'ERROR');
    return '[Encrypted message]';
  }
}

// Server configuration
const port = 8080;
const addresses = getLocalIpAddresses();

// Load message history on startup
loadMessageHistory();

// Print detailed network information
log('Starting Local Chat Server...');
log('Network Interfaces:');
addresses.forEach(addr => {
  log(`- ${addr.interface}: ${addr.address} (${addr.family})`);
});

// Get hostname
dns.lookup(os.hostname(), (err, address, family) => {
  if (err) {
    log(`Error getting hostname: ${err.message}`, 'ERROR');
  } else {
    log(`Hostname: ${os.hostname()}`);
    log(`Primary address: ${address} (IPv${family})`);
  }
});

// Create WebSocket server with error handling
let wss;
let serverCreated = false;
let retryCount = 0;
const maxRetries = 3;

function createServer() {
  try {
    wss = new WebSocket.Server({ 
      port,
      host: '0.0.0.0', // Listen on all interfaces
      perMessageDeflate: false, // Disable compression for better compatibility
      clientTracking: true // Track connected clients
    });
    
    log(`WebSocket server created on port ${port}`);
    log('Server is accessible at:');
    log(`ws://localhost:${port}`);
    addresses.forEach(addr => {
      log(`ws://${addr.address}:${port}`);
    });
    
    serverCreated = true;
    
    // Set up server error handler
    wss.on('error', (error) => {
      log(`WebSocket server error: ${error.message}`, 'ERROR');
      if (!serverCreated && retryCount < maxRetries) {
        retryCount++;
        log(`Retrying server creation (${retryCount}/${maxRetries})...`, 'WARN');
        setTimeout(createServer, 1000);
      }
    });
    
    return true;
  } catch (error) {
    log(`Failed to create WebSocket server: ${error.message}`, 'ERROR');
    if (retryCount < maxRetries) {
      retryCount++;
      log(`Retrying server creation (${retryCount}/${maxRetries})...`, 'WARN');
      setTimeout(createServer, 1000);
      return false;
    } else {
      log(`Maximum retry attempts reached. Server creation failed.`, 'ERROR');
      process.exit(1);
    }
  }
}

// Try to create the server
createServer();

// Store connected clients with additional metadata
const clients = new Map(); // Using Map instead of Set to store client metadata

// Auto-save message history periodically (every 5 minutes)
setInterval(() => {
  saveMessageHistory();
  log('Auto-saved message history', 'INFO');
}, 5 * 60 * 1000);

// Handle new connections
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  log(`New client connected from ${clientIp}`);
  
  // Store client with metadata
  clients.set(ws, {
    ip: clientIp,
    connectedAt: new Date(),
    lastActivity: new Date(),
    messagesSent: 0,
    messagesReceived: 0
  });

  // Send welcome message with all available addresses
  const welcomeMessage = {
    type: 'system',
    status: 'Connected',
    message: `Connected to chat server. Available at: ${addresses.map(a => a.address).join(', ')}:${port}`,
    timestamp: new Date().toISOString()
  };
  
  try {
    ws.send(JSON.stringify(welcomeMessage));
    
    // Send recent message history to new client
    if (messageHistory.length > 0) {
      const historyMessage = {
        type: 'system',
        status: 'History',
        message: 'Loading message history...',
        timestamp: new Date().toISOString()
      };
      ws.send(JSON.stringify(historyMessage));
      
      // Send all messages in batches to avoid overwhelming the client
      const batchSize = 20;
      for (let i = 0; i < messageHistory.length; i += batchSize) {
        const batch = messageHistory.slice(i, i + batchSize);
        batch.forEach(msg => {
          try {
            ws.send(JSON.stringify(msg));
          } catch (error) {
            log(`Error sending history message: ${error.message}`, 'ERROR');
          }
        });
        
        // Small delay between batches to prevent overwhelming the client
        if (i + batchSize < messageHistory.length) {
          setTimeout(() => {}, 100);
        }
      }
    }
  } catch (error) {
    log(`Error sending welcome message: ${error.message}`, 'ERROR');
  }

  // Set up ping interval for this client
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.ping();
      } catch (error) {
        log(`Error sending ping to ${clientIp}: ${error.message}`, 'ERROR');
        clearInterval(pingInterval);
      }
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      log(`Received ${data.type} message from ${clientIp}`);
      
      // Update client activity timestamp
      const clientData = clients.get(ws);
      if (clientData) {
        clientData.lastActivity = new Date();
        clients.set(ws, clientData);
      }
      
      // Handle ping messages
      if (data.type === 'ping') {
        log(`Received ping message from ${clientIp}`, 'INFO');
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        return;
      }
      
      // Handle clear history command
      if (data.type === 'clearHistory') {
        log(`Received clear history command from ${clientIp}`, 'INFO');
        clearMessageHistory();
        return;
      }
      
      // Handle sendMessage type (convert to chat type)
      if (data.type === 'sendMessage' && data.message) {
        data.type = 'chat';
        log(`Converting sendMessage to chat message from ${clientIp}: ${data.message}`, 'INFO');
      }

      // Handle chat messages
      if (data.type === 'chat' && data.message) {
        // Encrypt the message
        const encryptedData = encrypt(data.message);
        
        // Create message object
        const messageObj = {
          type: 'chat',
          message: data.message,
          from: clientIp,
          username: data.username || 'Anonymous',
          timestamp: new Date().toISOString(),
          encrypted: encryptedData
        };
        
        // Log the message for debugging
        log(`Chat message from ${clientIp}: ${data.message}`, 'INFO');
        
        // Add to history
        addMessageToHistory(messageObj);
        
        // Broadcast to all clients (including sender for confirmation)
        const broadcastMessage = JSON.stringify(messageObj);

        // Send to all clients
        let sentCount = 0;
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(broadcastMessage);
              sentCount++;
              log(`Message sent to client: ${client._socket ? client._socket.remoteAddress : 'unknown'}`, 'DEBUG');
              
              // Update client stats
              const clientData = clients.get(client);
              if (clientData) {
                if (client === ws) {
                  clientData.messagesSent++;
                } else {
                  clientData.messagesReceived++;
                }
                clients.set(client, clientData);
              }
            } catch (error) {
              log(`Error broadcasting message: ${error.message}`, 'ERROR');
            }
          }
        });
        
        log(`Message broadcast to ${sentCount} clients`, 'INFO');
        
        // Send confirmation back to sender
        try {
          ws.send(JSON.stringify({
            type: 'system',
            status: 'MessageSent',
            message: `Message sent to ${sentCount} clients`,
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          log(`Error sending confirmation: ${error.message}`, 'ERROR');
        }
      }
      
      // Handle image messages
      if (data.type === 'sendImageMessage' && data.imageData) {
        log(`Image message received from ${clientIp}`, 'INFO');
        
        // Create message object
        const messageObj = {
          type: 'image',
          imageData: data.imageData,
          from: clientIp,
          username: data.username || 'Anonymous',
          timestamp: new Date().toISOString()
        };
        
        // Add to history
        addMessageToHistory(messageObj);
        
        // Broadcast to all clients
        const broadcastMessage = JSON.stringify(messageObj);

        // Send to all clients
        let sentCount = 0;
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(broadcastMessage);
              sentCount++;
              
              // Update client stats
              const clientData = clients.get(client);
              if (clientData) {
                if (client === ws) {
                  clientData.messagesSent++;
                } else {
                  clientData.messagesReceived++;
                }
                clients.set(client, clientData);
              }
            } catch (error) {
              log(`Error broadcasting image: ${error.message}`, 'ERROR');
            }
          }
        });
        
        log(`Image broadcast to ${sentCount} clients`, 'INFO');
      }
      
      // Handle typing indicators
      if (data.type === 'typing' && data.username) {
        // Broadcast typing indicator to all other clients
        const typingMessage = {
          type: 'typing',
          username: data.username,
          from: clientIp,
          timestamp: new Date().toISOString()
        };
        
        // Send to all clients except sender
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            try {
              client.send(JSON.stringify(typingMessage));
            } catch (error) {
              log(`Error broadcasting typing indicator: ${error.message}`, 'ERROR');
            }
          }
        });
      }
      
      // Handle stopped typing indicators
      if (data.type === 'stoppedTyping') {
        // Broadcast stopped typing indicator to all other clients
        const stoppedTypingMessage = {
          type: 'stoppedTyping',
          from: clientIp,
          timestamp: new Date().toISOString()
        };
        
        // Send to all clients except sender
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            try {
              client.send(JSON.stringify(stoppedTypingMessage));
            } catch (error) {
              log(`Error broadcasting stopped typing indicator: ${error.message}`, 'ERROR');
            }
          }
        });
      }
    } catch (error) {
      log(`Error processing message: ${error.message}`, 'ERROR');
      try {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
          timestamp: new Date().toISOString()
        }));
      } catch (e) {
        log(`Error sending error message: ${e.message}`, 'ERROR');
      }
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    log(`Client ${clientIp} disconnected`);
    clients.delete(ws);
    clearInterval(pingInterval);
    
    // Save message history on client disconnect
    saveMessageHistory();
  });

  // Handle errors
  ws.on('error', (error) => {
    log(`WebSocket error for ${clientIp}: ${error.message}`, 'ERROR');
    clients.delete(ws);
    clearInterval(pingInterval);
  });
  
  // Handle pong responses
  ws.on('pong', () => {
    log(`Received pong from ${clientIp}`, 'DEBUG');
  });
});

// Handle server errors
wss.on('error', (error) => {
  log(`WebSocket server error: ${error.message}`, 'ERROR');
});

// Keep track of server status
let isShuttingDown = false;

// Graceful shutdown
function shutdown() {
  if (isShuttingDown) return;
  
  log('Shutting down server...', 'WARN');
  isShuttingDown = true;
  
  // Save message history
  saveMessageHistory();
  
  // Send shutdown message to all clients
  const shutdownMessage = JSON.stringify({
    type: 'system',
    status: 'Shutdown',
    message: 'Server is shutting down',
    timestamp: new Date().toISOString()
  });
  
  wss.clients.forEach((client) => {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(shutdownMessage);
        client.close();
      }
    } catch (error) {
      log(`Error closing client connection: ${error.message}`, 'ERROR');
    }
  });
  
  // Close the server
  wss.close(() => {
    log('Server shutdown complete');
    process.exit(0);
  });
  
  // Force exit after 5 seconds if server doesn't close gracefully
  setTimeout(() => {
    log('Forcing server shutdown', 'WARN');
    process.exit(1);
  }, 5000);
}

// Handle process signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, 'ERROR');
  log(error.stack, 'ERROR');
  shutdown();
});

// Print active connections every 30 seconds
setInterval(() => {
  const activeClients = Array.from(wss.clients).filter(c => c.readyState === WebSocket.OPEN);
  log(`Active connections: ${activeClients.length}`);
  activeClients.forEach((client, i) => {
    if (client._socket) {
      log(`- Client ${i + 1}: ${client._socket.remoteAddress}`);
    }
  });
}, 30000);

log('Server setup complete');
