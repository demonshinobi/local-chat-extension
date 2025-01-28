document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const statusEl = document.getElementById('connection-status');
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const serverIpInput = document.getElementById('server-ip');
  const connectButton = document.getElementById('connect-button');
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const notificationToggle = document.getElementById('notification-toggle');
  const clearHistoryButton = document.getElementById('clear-history');

  let connected = false;
  let unreadMessages = new Set();

  // Load settings
  chrome.storage.local.get(['notificationsEnabled'], (result) => {
    notificationToggle.checked = result.notificationsEnabled || false;
  });

  // Settings toggle
  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('visible');
  });

  // Notification toggle
  notificationToggle.addEventListener('change', () => {
    const enabled = notificationToggle.checked;
    chrome.storage.local.set({ notificationsEnabled: enabled });

    if (enabled) {
      // Request notification permission if needed
      Notification.requestPermission().then(permission => {
        if (permission !== 'granted') {
          notificationToggle.checked = false;
          chrome.storage.local.set({ notificationsEnabled: false });
        }
      });
    }
  });

  // Clear history
  clearHistoryButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all chat history?')) {
      chrome.runtime.sendMessage({ type: 'clearHistory' }, () => {
        messagesEl.innerHTML = '';
      });
    }
  });

  // Format timestamp
  function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Update UI with connection status
  function updateStatus(status, message = '', serverIp = '') {
    console.log('Status update:', { status, message, serverIp });
    
    switch(status) {
      case 'Connected':
        statusEl.style.color = 'var(--success-color)';
        connected = true;
        statusEl.textContent = serverIp ? `Connected to ${serverIp}` : 'Connected';
        inputEl.disabled = false;
        sendButton.disabled = false;
        serverIpInput.value = serverIp;
        break;
        
      case 'Connecting':
        statusEl.style.color = 'var(--primary-color)';
        connected = false;
        statusEl.textContent = message || 'Connecting...';
        inputEl.disabled = true;
        sendButton.disabled = true;
        break;
        
      case 'Disconnected':
        statusEl.style.color = 'var(--danger-color)';
        connected = false;
        statusEl.textContent = 'Disconnected';
        inputEl.disabled = true;
        sendButton.disabled = true;
        break;
        
      case 'Error':
        statusEl.style.color = 'var(--danger-color)';
        connected = false;
        statusEl.textContent = message || 'Connection error';
        inputEl.disabled = true;
        sendButton.disabled = true;
        break;
        
      default:
        statusEl.style.color = 'var(--danger-color)';
        connected = false;
        statusEl.textContent = message || status;
        inputEl.disabled = true;
        sendButton.disabled = true;
        break;
    }
  }

  // Show notification
  function showNotification(message, from) {
    chrome.storage.local.get(['notificationsEnabled'], (result) => {
      if (result.notificationsEnabled && document.hidden) {
        const notification = new Notification('Local Chat Pro', {
          body: `${from}: ${message}`,
          icon: 'icons/icon128.png'
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    });
  }

  // Add a message to the chat
  function addMessage(message, fromSelf = false, from = null, timestamp = null, read = true) {
    const div = document.createElement('div');
    div.classList.add('message');
    
    if (fromSelf) {
      div.classList.add('self');
    }

    if (!read) {
      div.classList.add('unread');
      unreadMessages.add(timestamp);
    }

    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    if (fromSelf) {
      messageText.textContent = `You: ${message}`;
    } else if (from) {
      messageText.textContent = `${from}: ${message}`;
      showNotification(message, from);
    } else {
      messageText.textContent = message;
    }
    div.appendChild(messageText);

    if (timestamp) {
      const timeDiv = document.createElement('div');
      timeDiv.classList.add('timestamp');
      timeDiv.textContent = formatTimestamp(timestamp);
      timeDiv.dataset.timestamp = timestamp;
      div.appendChild(timeDiv);
    }

    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Mark as read if message is visible
    if (!read && isElementVisible(div)) {
      markMessageAsRead(timestamp);
    }
  }

  // Check if element is visible in scroll container
  function isElementVisible(el) {
    const rect = el.getBoundingClientRect();
    const containerRect = messagesEl.getBoundingClientRect();
    return rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
  }

  // Mark message as read
  function markMessageAsRead(timestamp) {
    if (unreadMessages.has(timestamp)) {
      unreadMessages.delete(timestamp);
      chrome.runtime.sendMessage({
        type: 'markAsRead',
        messageIds: [timestamp]
      });
    }
  }

  // Load message history
  function loadHistory(messages) {
    messagesEl.innerHTML = ''; // Clear existing messages
    messages.forEach(msg => {
      addMessage(
        msg.message,
        msg.from === 'self',
        msg.from !== 'self' ? msg.from : null,
        msg.timestamp,
        msg.read
      );
    });
  }

  // Connect to server
  async function connectToServer() {
    const ip = serverIpInput.value.trim();
    if (!ip) {
      updateStatus('Error', 'Please enter a server IP');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'connectTo',
        ip: ip
      });
      console.log('Connect response:', response);
    } catch (error) {
      console.error('Error connecting:', error);
      updateStatus('Error', 'Failed to connect: ' + error.message);
    }
  }

  // Send a message
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    console.log('Sending message:', text);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'sendMessage',
        text: text
      });

      console.log('Send response:', response);

      if (response && response.success) {
        inputEl.value = '';
      } else if (response && response.error) {
        console.error('Failed to send message:', response.error);
        updateStatus('Error', 'Failed to send message: ' + response.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      updateStatus('Error', 'Failed to send message: ' + error.message);
    }
  }

  // Set up scroll handler to mark messages as read
  messagesEl.addEventListener('scroll', () => {
    const unreadElements = messagesEl.querySelectorAll('.message.unread');
    unreadElements.forEach(el => {
      if (isElementVisible(el)) {
        const timestamp = el.querySelector('.timestamp')?.dataset.timestamp;
        if (timestamp) {
          markMessageAsRead(timestamp);
          el.classList.remove('unread');
        }
      }
    });
  });

  // Set up event listeners
  connectButton.addEventListener('click', connectToServer);
  serverIpInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      connectToServer();
    }
  });

  sendButton.addEventListener('click', sendMessage);
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Listen for visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Mark all visible messages as read when popup becomes visible
      const unreadElements = messagesEl.querySelectorAll('.message.unread');
      unreadElements.forEach(el => {
        if (isElementVisible(el)) {
          const timestamp = el.querySelector('.timestamp')?.dataset.timestamp;
          if (timestamp) {
            markMessageAsRead(timestamp);
            el.classList.remove('unread');
          }
        }
      });
    }
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    console.log('Received message:', message);
    
    if (message.type === 'connectionStatus') {
      updateStatus(message.status, message.message, message.serverIp);
    } else if (message.type === 'messageReceived') {
      addMessage(
        message.message,
        message.from === 'self',
        message.from !== 'self' ? message.from : null,
        message.timestamp,
        message.read
      );
    } else {
      console.log('Unknown message type:', message.type);
    }
  });

  // Start with disabled input until connected
  inputEl.disabled = true;
  sendButton.disabled = true;
  updateStatus('Connecting', 'Initializing connection...');

  // Request initial connection status and message history
  console.log('Popup loaded, requesting connection status and history...');
  chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
    console.log('Received initial status:', response);
    if (response) {
      updateStatus(response.status, response.message, response.serverIp);
    }
  });

  chrome.runtime.sendMessage({ type: 'getHistory' }, (response) => {
    console.log('Received message history:', response);
    if (response && response.messages) {
      loadHistory(response.messages);
    }
  });
});
