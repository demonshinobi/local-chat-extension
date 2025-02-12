document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const statusEl = document.getElementById('connection-status');
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('message-input');
  const sendImageButton = document.getElementById('send-image-button');
  const imageInput = document.getElementById('image-input');
  const imagePreview = document.getElementById('image-preview');
  const previewImg = document.getElementById('preview-img');
  const removeImageBtn = document.getElementById('remove-image');
  const sendButton = document.getElementById('send-button');
  const serverIpInput = document.getElementById('server-ip');
  const connectButton = document.getElementById('connect-button');
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const notificationToggle = document.getElementById('notification-toggle');
  const clearHistoryButton = document.getElementById('clear-history');
  const darkModeToggle = document.getElementById('dark-mode-toggle');

  let connected = false;
  let unreadMessages = new Set();
  let currentImageData = null;

  // Load settings
  chrome.storage.local.get(['notificationsEnabled', 'darkMode'], (result) => {
    const { notificationsEnabled = false, darkMode = false } = result;
    notificationToggle.checked = notificationsEnabled || false;
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    darkModeToggle.checked = darkMode;
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

  darkModeToggle.addEventListener('change', () => {
    const isDarkMode = darkModeToggle.checked;
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    chrome.storage.local.set({ darkMode: isDarkMode });
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
      case 'system':
        statusEl.style.color = 'var(--success-color)';
        connected = true;
        statusEl.textContent = message || (serverIp ? `Connected to ${serverIp}` : 'Connected');
        inputEl.disabled = false;
        sendButton.disabled = false;
        sendImageButton.disabled = false;
        serverIpInput.value = serverIp || 'localhost';
        break;
        
      case 'Connecting':
        statusEl.style.color = 'var(--primary-color)';
        connected = false;
        statusEl.textContent = message || 'Connecting...';
        inputEl.disabled = true;
        sendButton.disabled = true;
        sendImageButton.disabled = true;
        break;
        
      case 'Disconnected':
        statusEl.style.color = 'var(--danger-color)';
        connected = false;
        statusEl.textContent = 'Disconnected';
        inputEl.disabled = true;
        sendButton.disabled = true;
        sendImageButton.disabled = true;
        break;
        
      case 'Error':
        statusEl.style.color = 'var(--danger-color)';
        connected = false;
        statusEl.textContent = message || 'Connection error';
        inputEl.disabled = true;
        sendButton.disabled = true;
        sendImageButton.disabled = true;
        break;
        
      default:
        statusEl.style.color = 'var(--danger-color)';
        connected = false;
        statusEl.textContent = message || status;
        inputEl.disabled = true;
        sendButton.disabled = true;
        sendImageButton.disabled = true;
        break;
    }
  }

  // Show notification
  function showNotification(message, from) {
    chrome.storage.local.get(['notificationsEnabled'], (result) => {
      if (result.notificationsEnabled && document.hidden) {
      if (chrome.notifications) {
        const options = {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Local Chat Pro',
          message: `${from}: ${message}`
        };
        chrome.notifications.create('', options, (notificationId) => {
          // Auto-clear after 4 seconds.
          setTimeout(() => { chrome.notifications.clear(notificationId); }, 4000);
        });
      } else {
        // Fallback to Web Notifications.
          const notification = new Notification('Local Chat Pro', {
            body: `${from}: ${message}`,
            icon: 'icons/icon128.png'
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };
      };
      }
    });
  }

  // Add a message to the chat
  function addMessage(message, fromSelf = false, from = null, timestamp = null, read = true) {
    const div = document.createElement('div');
    div.classList.add('message');
    let content = message;
    
    if (fromSelf) {
      div.classList.add('self');
    }

    if (!read) {
      div.classList.add('unread');
      unreadMessages.add(timestamp);
    }

    const messageText = document.createElement('div');
    messageText.classList.add('message-text');

    if (typeof message === 'object' && message.image) {
      // Handle image message
      const img = document.createElement('img');
      img.src = message.image;
      img.style.maxWidth = '200px';
      img.style.maxHeight = '200px';
      img.style.borderRadius = '8px';
      messageText.appendChild(img);
      
      // Add text if present
      if (message.message_text) {
        const textDiv = document.createElement('div');
        textDiv.style.marginTop = '8px';
        textDiv.textContent = message.message_text;
        messageText.appendChild(textDiv);
      }
      
      content = message.message_text || 'Sent an image';
    } else {
      // Handle text message
      if (fromSelf) {
        messageText.textContent = `You: ${message}`;
      } else if (from) {
        messageText.textContent = `${from}: ${message}`;
        showNotification(message, from);
      }
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
    if (!ip && ip !== 'localhost') {
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
    if (!text && !currentImageData) {
      return;
    }

    console.log('Sending message:', text, currentImageData ? '[with image]' : '');

    try {
      let response;
      
      // Store text before clearing input
      const messageText = text;
      inputEl.value = '';
      
      if (currentImageData) {
        response = await chrome.runtime.sendMessage({
          type: 'sendImageMessage',
          imageData: currentImageData,
          text: messageText
        });
        // Clear the image preview after sending
        addMessage({ image: currentImageData, message_text: messageText || '' }, true, null, new Date().toISOString(), true);
        clearImagePreview();
      } else {
        response = await chrome.runtime.sendMessage({
          type: 'sendMessage',
          text: messageText
        });

        // Add message immediately to UI
        addMessage(messageText, true, null, new Date().toISOString(), true);
      }
      console.log('Send response:', response);

      if (response && response.error) {
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

  // Function to show image preview
  function showImagePreview(imageData) {
    currentImageData = imageData;
    previewImg.src = imageData;
    inputEl.placeholder = "Add a caption to your image...";
    imagePreview.classList.add('visible');
  }

  // Function to clear image preview
  function clearImagePreview() {
    currentImageData = null;
    previewImg.src = '';
    inputEl.placeholder = "Type a message...";
    imagePreview.classList.remove('visible');
  }

  // Handle paste events for images
  inputEl.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = (e) => showImagePreview(e.target.result);
        reader.readAsDataURL(file);
        break;
      }
    }
  });

  // Handle drag and drop for images
  inputEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    inputEl.classList.add('drag-over');
  });

  inputEl.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files[0] && files[0].type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => showImagePreview(e.target.result);
      reader.readAsDataURL(files[0]);
    }
    inputEl.classList.remove('drag-over');
  });

  // Remove drag-over class when dragging leaves the input
  inputEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    inputEl.classList.remove('drag-over');
  });

  inputEl.addEventListener('dragend', (e) => {
    e.preventDefault();
    inputEl.classList.remove('drag-over');
  });

  // Remove image button handler
  removeImageBtn.addEventListener('click', () => {
    clearImagePreview();
  });

  // Add functionality for sending image messages
  if (sendImageButton) {
    sendImageButton.addEventListener('click', () => {
      imageInput.click();
    });
  }

  imageInput.addEventListener('change', () => {
    if (imageInput.files && imageInput.files[0]) {
      const file = imageInput.files[0];
      const reader = new FileReader();
      reader.onload = (e) => showImagePreview(e.target.result);
      reader.readAsDataURL(file);
      imageInput.value = '';
    }
    // Reset the file input for future uploads
    imageInput.value = '';
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
  serverIpInput.value = 'localhost';
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
