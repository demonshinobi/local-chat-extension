document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const connectionStatus = document.getElementById("connection-status");
  const serverIpInput = document.getElementById("server-ip");
  const connectButton = document.getElementById("connect-button");
  const messagesContainer = document.getElementById("messages");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const clearHistoryButton = document.getElementById("clear-history");
  const settingsToggle = document.getElementById("settings-toggle");
  const closeSettings = document.getElementById("close-settings");
  const settingsPanel = document.getElementById("settings-panel");
  const notificationToggle = document.getElementById("notification-toggle");
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  
  // State variables
  let isConnected = false;
  let messageHistory = [];
  let currentServerIp = '';
  let notificationsEnabled = false;
  let darkModeEnabled = false;
  let unreadCount = 0;
  let imageData = null;
  
  // Create image preview elements
  const imagePreviewContainer = document.createElement('div');
  imagePreviewContainer.className = 'image-preview';
  imagePreviewContainer.style.display = 'none';
  
  const previewImage = document.createElement('img');
  previewImage.style.maxWidth = '100%';
  previewImage.style.maxHeight = '150px';
  previewImage.style.borderRadius = '8px';
  previewImage.style.marginBottom = '8px';
  
  const removeImageButton = document.createElement('button');
  removeImageButton.textContent = '✕';
  removeImageButton.className = 'action-button';
  removeImageButton.style.position = 'absolute';
  removeImageButton.style.top = '4px';
  removeImageButton.style.right = '4px';
  removeImageButton.style.width = '24px';
  removeImageButton.style.height = '24px';
  removeImageButton.style.borderRadius = '50%';
  removeImageButton.style.padding = '0';
  removeImageButton.style.background = 'rgba(0,0,0,0.5)';
  removeImageButton.style.color = 'white';
  removeImageButton.title = 'Remove image';
  
  imagePreviewContainer.appendChild(previewImage);
  imagePreviewContainer.appendChild(removeImageButton);
  
  // Add image preview to input container
  const inputContainer = document.querySelector('.input-container');
  inputContainer.insertBefore(imagePreviewContainer, messageInput);
  
  // Handle remove image button
  removeImageButton.addEventListener('click', () => {
    imageData = null;
    imagePreviewContainer.style.display = 'none';
  });
  
  // Initialize settings
  function loadSettings() {
    chrome.storage.local.get(['notificationsEnabled', 'darkModeEnabled'], (result) => {
      notificationsEnabled = result.notificationsEnabled || false;
      darkModeEnabled = result.darkModeEnabled || false;
      
      notificationToggle.checked = notificationsEnabled;
      darkModeToggle.checked = darkModeEnabled;
      
      if (darkModeEnabled) {
        document.body.setAttribute('data-theme', 'dark');
      } else {
        document.body.removeAttribute('data-theme');
      }
    });
  }
  
  // Save settings
  function saveSettings() {
    chrome.storage.local.set({
      notificationsEnabled: notificationsEnabled,
      darkModeEnabled: darkModeEnabled
    });
  }
  
  // Toggle settings panel
  settingsToggle.addEventListener("click", () => {
    settingsPanel.classList.toggle("visible");
  });
  
  // Close settings panel
  closeSettings.addEventListener("click", () => {
    settingsPanel.classList.remove("visible");
  });
  
  // Handle notification toggle
  notificationToggle.addEventListener("change", () => {
    notificationsEnabled = notificationToggle.checked;
    saveSettings();
    
    if (notificationsEnabled) {
      // Request notification permission if needed
      Notification.requestPermission();
    }
  });
  
  // Handle dark mode toggle
  darkModeToggle.addEventListener("change", () => {
    darkModeEnabled = darkModeToggle.checked;
    saveSettings();
    
    if (darkModeEnabled) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  });
  
  // Load message history from storage
  function loadMessageHistory() {
    chrome.runtime.sendMessage({ type: 'getHistory' }, (response) => {
      if (response && response.messages) {
        messageHistory = response.messages;
        displayMessages();
      }
    });
  }
  
  // Display messages in the UI
  function displayMessages() {
    messagesContainer.innerHTML = '';
    
    messageHistory.forEach((msg) => {
      const messageElement = createMessageElement(msg);
      messagesContainer.appendChild(messageElement);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Mark all messages as read
    const unreadMessageIds = messageHistory
      .filter(msg => !msg.read)
      .map(msg => msg.timestamp);
    
    if (unreadMessageIds.length > 0) {
      chrome.runtime.sendMessage({
        type: 'markAsRead',
        messageIds: unreadMessageIds
      });
      
      // Reset unread count
      unreadCount = 0;
      updateUnreadBadge();
    }
  }
  
  // Create a message element
  function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    if (message.from === 'self') {
      messageDiv.classList.add('self');
    }
    
    if (!message.read) {
      messageDiv.classList.add('unread');
    }
    
    // Handle system messages
    if (message.type === 'system') {
      messageDiv.classList.add('system');
      messageDiv.textContent = message.message || message.status;
      return messageDiv;
    }
    
    // Handle image messages
    if (message.type === 'image' && message.imageData) {
      const img = document.createElement('img');
      img.src = message.imageData;
      img.style.maxWidth = '100%';
      img.style.borderRadius = '8px';
      img.style.marginBottom = '8px';
      messageDiv.appendChild(img);
    } else {
      // Regular text message
      const messageText = document.createElement('div');
      messageText.textContent = message.message;
      messageDiv.appendChild(messageText);
    }
    
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    
    // Format timestamp
    const date = new Date(message.timestamp);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timestamp.textContent = timeString;
    
    messageDiv.appendChild(timestamp);
    return messageDiv;
  }
  
  // Update unread badge
  function updateUnreadBadge() {
    // Remove existing badge if any
    const existingBadge = document.querySelector('.notification-badge');
    if (existingBadge) {
      existingBadge.remove();
    }
    
    // Add badge if there are unread messages
    if (unreadCount > 0) {
      const badge = document.createElement('div');
      badge.className = 'notification-badge';
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      document.body.appendChild(badge);
    }
  }
  
  // Connect to server
  function connectToServer() {
    const ip = serverIpInput.value.trim();
    if (!ip) return;
    
    // Save IP to storage for persistence
    chrome.storage.local.set({ serverIp: ip });
    currentServerIp = ip;
    
    // Update UI
    connectionStatus.textContent = 'Connecting...';
    connectButton.disabled = true;
    
    // Send connect message to background script
    chrome.runtime.sendMessage({
      type: 'connectTo',
      ip: ip
    });
  }
  
  // Send message
  function sendMessage() {
    const message = messageInput.value.trim();
    
    // Don't send if not connected or both message and image are empty
    if (!isConnected || (!message && !imageData)) return;
    
    if (imageData) {
      // Send image message
      const imageMessage = {
        type: 'sendImageMessage',
        imageData: imageData,
        timestamp: new Date().toISOString()
      };
      
      // Send to background script to relay to server
      chrome.runtime.sendMessage(imageMessage);
      
      // Add to local message history
      const localImageMessage = {
        type: 'image',
        imageData: imageData,
        from: 'self',
        timestamp: new Date().toISOString()
      };
      
      messageHistory.push(localImageMessage);
      displayMessages();
      
      // Clear image data
      imageData = null;
      imagePreviewContainer.style.display = 'none';
    }
    
    if (message) {
      // Send text message
      const messageObj = {
        type: 'chat',
        message: message,
        from: 'self',
        timestamp: new Date().toISOString()
      };
      
      // Send to background script to relay to server
      chrome.runtime.sendMessage({
        type: 'sendMessage',
        ...messageObj
      });
      
      // Add to local message history
      messageHistory.push(messageObj);
      displayMessages();
      
      // Clear input
      messageInput.value = '';
    }
    
    // Focus on message input
    messageInput.focus();
  }
  
  // Handle paste event for images
  document.addEventListener('paste', (e) => {
    if (!isConnected) return;
    
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        // Get image from clipboard
        const blob = items[i].getAsFile();
        const reader = new FileReader();
        
        reader.onload = (event) => {
          // Set image data
          imageData = event.target.result;
          
          // Show preview
          previewImage.src = imageData;
          imagePreviewContainer.style.display = 'block';
        };
        
        reader.readAsDataURL(blob);
        break;
      }
    }
  });
  
  // Handle drag and drop for images
  messageInput.addEventListener('dragover', (e) => {
    e.preventDefault();
    messageInput.classList.add('drag-over');
  });
  
  messageInput.addEventListener('dragleave', () => {
    messageInput.classList.remove('drag-over');
  });
  
  messageInput.addEventListener('drop', (e) => {
    e.preventDefault();
    messageInput.classList.remove('drag-over');
    
    if (!isConnected) return;
    
    const files = e.dataTransfer.files;
    
    if (files.length > 0 && files[0].type.indexOf('image') !== -1) {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        // Set image data
        imageData = event.target.result;
        
        // Show preview
        previewImage.src = imageData;
        imagePreviewContainer.style.display = 'block';
      };
      
      reader.readAsDataURL(files[0]);
    }
  });
  
  // Clear message history
  clearHistoryButton.addEventListener("click", () => {
    if (confirm('Are you sure you want to clear all message history?')) {
      chrome.runtime.sendMessage({ type: 'clearHistory' }, () => {
        messageHistory = [];
        displayMessages();
      });
    }
  });
  
  // Connect button event
  connectButton.addEventListener("click", connectToServer);
  
  // Server IP input enter key
  serverIpInput.addEventListener("keypress", (e) => {
    if (e.key === 'Enter') {
      connectToServer();
    }
  });
  
  // Send button event
  sendButton.addEventListener("click", sendMessage);
  
  // Message input enter key
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Handle connection status updates
  function updateConnectionStatus(status, message = '') {
    isConnected = status === 'Connected';
    
    // Update UI elements
    connectionStatus.textContent = message || status;
    connectButton.disabled = status === 'Connecting';
    messageInput.disabled = !isConnected;
    sendButton.disabled = !isConnected;
    
    // Set status color
    connectionStatus.className = '';
    if (status === 'Connected') {
      connectionStatus.classList.add('connected');
    } else if (status === 'Error') {
      connectionStatus.classList.add('error');
    }
    
    // Update server IP input if connected
    if (isConnected && currentServerIp) {
      serverIpInput.value = currentServerIp;
    }
    
    // Focus on message input if connected
    if (isConnected) {
      messageInput.focus();
    }
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    console.log('Received message in popup:', message);
    
    if (message.type === 'connectionStatus') {
      updateConnectionStatus(message.status, message.message);
      if (message.serverIp) {
        currentServerIp = message.serverIp;
        serverIpInput.value = currentServerIp;
      }
    } else if (message.type === 'chat' || message.type === 'system' || message.type === 'image') {
      // Add message to history
      messageHistory.push(message);
      
      // Update UI if popup is visible
      if (document.visibilityState === 'visible') {
        displayMessages();
      } else {
        // Increment unread count if popup is not visible
        unreadCount++;
        updateUnreadBadge();
        
        // Show notification if enabled
        if (notificationsEnabled) {
          let notificationBody = '';
          
          if (message.type === 'chat') {
            notificationBody = `${message.from}: ${message.message}`;
          } else if (message.type === 'image') {
            notificationBody = `${message.from} sent an image`;
          } else {
            notificationBody = message.message || message.status;
          }
          
          new Notification('Local Chat Pro', {
            body: notificationBody,
            icon: 'icons/icon128.png'
          });
        }
      }
    }
  });
  
  // Handle visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Mark messages as read when popup becomes visible
      displayMessages();
    }
  });
  
  // Initialize
  function initialize() {
    // Load settings
    loadSettings();
    
    // Load saved server IP
    chrome.storage.local.get(['serverIp'], (result) => {
      if (result.serverIp) {
        serverIpInput.value = result.serverIp;
        currentServerIp = result.serverIp;
      }
    });
    
    // Get current connection status
    chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
      if (response) {
        updateConnectionStatus(response.status, response.message);
      }
    });
    
    // Load message history
    loadMessageHistory();
  }
  
  // Start initialization
  initialize();
});
