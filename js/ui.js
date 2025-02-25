/**
 * UI-related functionality for the Local Chat Pro extension
 */

// UI Components
class UIComponents {
  constructor() {
    // DOM Elements
    this.connectionStatus = document.getElementById("connection-status");
    this.serverIpInput = document.getElementById("server-ip");
    this.connectButton = document.getElementById("connect-button");
    this.messagesContainer = document.getElementById("messages");
    this.messageInput = document.getElementById("message-input");
    this.sendButton = document.getElementById("send-button");
    this.clearHistoryButton = document.getElementById("clear-history");
    this.settingsToggle = document.getElementById("settings-toggle");
    this.closeSettings = document.getElementById("close-settings");
    this.settingsPanel = document.getElementById("settings-panel");
    this.notificationToggle = document.getElementById("notification-toggle");
    this.darkModeToggle = document.getElementById("dark-mode-toggle");
    this.usernameInput = document.getElementById("username-input");
    this.emojiButton = document.getElementById("emoji-button");
    this.emojiPicker = document.getElementById("emoji-picker");
    this.typingIndicator = document.querySelector(".typing-indicator");
    this.typingUser = document.querySelector(".typing-user");
    
    // Create image preview elements
    this.imagePreviewContainer = document.createElement('div');
    this.imagePreviewContainer.className = 'image-preview';
    this.imagePreviewContainer.style.display = 'none';
    
    this.previewImage = document.createElement('img');
    this.previewImage.style.maxWidth = '100%';
    this.previewImage.style.maxHeight = '150px';
    this.previewImage.style.borderRadius = '8px';
    this.previewImage.style.marginBottom = '8px';
    
    this.removeImageButton = document.createElement('button');
    this.removeImageButton.textContent = '✕';
    this.removeImageButton.className = 'action-button';
    this.removeImageButton.style.position = 'absolute';
    this.removeImageButton.style.top = '4px';
    this.removeImageButton.style.right = '4px';
    this.removeImageButton.style.width = '24px';
    this.removeImageButton.style.height = '24px';
    this.removeImageButton.style.borderRadius = '50%';
    this.removeImageButton.style.padding = '0';
    this.removeImageButton.style.background = 'rgba(0,0,0,0.5)';
    this.removeImageButton.style.color = 'white';
    this.removeImageButton.title = 'Remove image';
    
    this.imagePreviewContainer.appendChild(this.previewImage);
    this.imagePreviewContainer.appendChild(this.removeImageButton);
    
    // Add image preview to input container
    // We'll add this after the DOM is fully loaded to avoid errors
    setTimeout(() => {
      try {
        const inputContainer = document.querySelector('.input-container');
        const messageInputRow = document.querySelector('.message-input-row');
        if (inputContainer && messageInputRow) {
          inputContainer.insertBefore(this.imagePreviewContainer, messageInputRow);
        } else {
          console.error('Could not find input container or message input row');
        }
      } catch (error) {
        console.error('Error adding image preview container:', error);
      }
    }, 0);
  }
}

// UI Manager
class UIManager {
  constructor() {
    this.ui = new UIComponents();
    this.isConnected = false;
    this.darkModeEnabled = false;
    this.notificationsEnabled = false;
    this.username = '';
    this.unreadCount = 0;
    this.imageData = null;
    this.typingTimeout = null;
    this.lastTypingTime = 0;
    
    // Initialize emoji picker
    this.initializeEmojiPicker();
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  // Initialize emoji picker
  initializeEmojiPicker() {
    const commonEmojis = [
      '😊', '😂', '❤️', '👍', '😍', '🙏', '😎', '🔥', 
      '😁', '👏', '🎉', '🤔', '😢', '😭', '😘', '🤗',
      '😉', '🤣', '😋', '🤷‍♂️', '🤷‍♀️', '👌', '🙄', '😒',
      '😳', '🥳', '🤩', '😴', '🥺', '😬', '😅', '😱'
    ];
    
    // Populate emoji picker
    commonEmojis.forEach(emoji => {
      const emojiElement = document.createElement('div');
      emojiElement.className = 'emoji-item';
      emojiElement.textContent = emoji;
      emojiElement.addEventListener('click', () => {
        this.ui.messageInput.value += emoji;
        this.ui.messageInput.focus();
        this.toggleEmojiPicker(false);
      });
      this.ui.emojiPicker.appendChild(emojiElement);
    });
  }
  
  // Set up event listeners
  setupEventListeners() {
    // Toggle settings panel
    this.ui.settingsToggle.addEventListener("click", () => {
      if (this.ui.settingsPanel.style.display === 'none') {
        this.ui.settingsPanel.style.display = 'block';
      } else {
        this.ui.settingsPanel.style.display = 'none';
      }
    });
    
    // Close settings panel
    this.ui.closeSettings.addEventListener("click", () => {
      this.ui.settingsPanel.style.display = 'none';
    });
    
    // Handle notification toggle
    this.ui.notificationToggle.addEventListener("change", () => {
      this.notificationsEnabled = this.ui.notificationToggle.checked;
      this.saveSettings();
      
      if (this.notificationsEnabled) {
        // Request notification permission if needed
        Notification.requestPermission();
      }
    });
    
    // Handle dark mode toggle
    this.ui.darkModeToggle.addEventListener("change", () => {
      this.darkModeEnabled = this.ui.darkModeToggle.checked;
      this.saveSettings();
      
      if (this.darkModeEnabled) {
        document.body.setAttribute('data-theme', 'dark');
      } else {
        document.body.removeAttribute('data-theme');
      }
    });
    
    // Handle username input
    this.ui.usernameInput.addEventListener("change", () => {
      this.username = this.ui.usernameInput.value.trim();
      this.saveSettings();
    });
    
    // Handle remove image button
    this.ui.removeImageButton.addEventListener('click', () => {
      this.imageData = null;
      this.ui.imagePreviewContainer.style.display = 'none';
    });
    
    // Toggle emoji picker
    this.ui.emojiButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleEmojiPicker();
    });
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.ui.emojiButton.contains(e.target) && !this.ui.emojiPicker.contains(e.target)) {
        this.toggleEmojiPicker(false);
      }
    });
    
    // Handle paste event for images
    document.addEventListener('paste', (e) => {
      if (!this.isConnected) return;
      
      const items = e.clipboardData.items;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          // Get image from clipboard
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          
          reader.onload = (event) => {
            // Set image data
            this.imageData = event.target.result;
            
            // Show preview
            this.ui.previewImage.src = this.imageData;
            this.ui.imagePreviewContainer.style.display = 'block';
          };
          
          reader.readAsDataURL(blob);
          break;
        }
      }
    });
    
    // Handle drag and drop for images
    this.ui.messageInput.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.ui.messageInput.classList.add('drag-over');
    });
    
    this.ui.messageInput.addEventListener('dragleave', () => {
      this.ui.messageInput.classList.remove('drag-over');
    });
    
    this.ui.messageInput.addEventListener('drop', (e) => {
      e.preventDefault();
      this.ui.messageInput.classList.remove('drag-over');
      
      if (!this.isConnected) return;
      
      const files = e.dataTransfer.files;
      
      if (files.length > 0 && files[0].type.indexOf('image') !== -1) {
        const reader = new FileReader();
        
        reader.onload = (event) => {
          // Set image data
          this.imageData = event.target.result;
          
          // Show preview
          this.ui.previewImage.src = this.imageData;
          this.ui.imagePreviewContainer.style.display = 'block';
        };
        
        reader.readAsDataURL(files[0]);
      }
    });
    
    // Handle typing indicator
    this.ui.messageInput.addEventListener('input', () => {
      if (!this.isConnected) return;
      
      const now = Date.now();
      
      // Only send typing indicator if it's been more than 2 seconds since last one
      if (now - this.lastTypingTime > 2000) {
        this.lastTypingTime = now;
        
        // Send typing indicator to background script
        chrome.runtime.sendMessage({
          type: 'typing',
          username: this.username || 'Someone'
        });
      }
      
      // Clear previous timeout
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }
      
      // Set new timeout
      this.typingTimeout = setTimeout(() => {
        // Send stopped typing indicator
        chrome.runtime.sendMessage({
          type: 'stoppedTyping'
        });
      }, 2000);
    });
  }
  
  // Toggle emoji picker
  toggleEmojiPicker(show) {
    if (show === undefined) {
      this.ui.emojiPicker.classList.toggle('visible');
    } else {
      if (show) {
        this.ui.emojiPicker.classList.add('visible');
      } else {
        this.ui.emojiPicker.classList.remove('visible');
      }
    }
  }
  
  // Show typing indicator
  showTypingIndicator(username) {
    if (!username) return;
    
    this.ui.typingUser.textContent = username;
    this.ui.typingIndicator.classList.add('visible');
    
    // Hide after 3 seconds if no update
    setTimeout(() => {
      this.ui.typingIndicator.classList.remove('visible');
    }, 3000);
  }
  
  // Hide typing indicator
  hideTypingIndicator() {
    this.ui.typingIndicator.classList.remove('visible');
  }
  
  // Load settings
  loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['notificationsEnabled', 'darkModeEnabled', 'username'], (result) => {
        this.notificationsEnabled = result.notificationsEnabled !== undefined ? result.notificationsEnabled : true;
        this.darkModeEnabled = result.darkModeEnabled || false;
        this.username = result.username || '';
        
        this.ui.notificationToggle.checked = this.notificationsEnabled;
        this.ui.darkModeToggle.checked = this.darkModeEnabled;
        this.ui.usernameInput.value = this.username;
        
        if (this.darkModeEnabled) {
          document.body.setAttribute('data-theme', 'dark');
        } else {
          document.body.removeAttribute('data-theme');
        }
        
        // Save settings to ensure they're properly initialized
        this.saveSettings();
        
        resolve();
      });
    });
  }
  
  // Save settings
  saveSettings() {
    chrome.storage.local.set({
      notificationsEnabled: this.notificationsEnabled,
      darkModeEnabled: this.darkModeEnabled,
      username: this.username
    });
  }
  
  // Update connection status
  updateConnectionStatus(status, message = '') {
    this.isConnected = status === 'Connected';
    
    // Update UI elements
    this.ui.connectionStatus.textContent = message || status;
    this.ui.connectButton.disabled = status === 'Connecting';
    this.ui.messageInput.disabled = !this.isConnected;
    this.ui.sendButton.disabled = !this.isConnected;
    this.ui.emojiButton.disabled = !this.isConnected;
    
    // Set status color
    this.ui.connectionStatus.className = '';
    if (status === 'Connected') {
      this.ui.connectionStatus.classList.add('connected');
    } else if (status === 'Error') {
      this.ui.connectionStatus.classList.add('error');
    } else if (status === 'Connecting') {
      this.ui.connectionStatus.classList.add('connecting');
    }
    
    // Focus on message input if connected
    if (this.isConnected) {
      this.ui.messageInput.focus();
    }
  }
  
  // Create a message element
  createMessageElement(message) {
    console.log('Creating message element:', message.type, message.from, message.message);
    
    // Skip typing and stoppedTyping messages in the UI
    if (message.type === 'typing' || message.type === 'stoppedTyping') {
      return null;
    }
    
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
    
    // Create a single message with username, content, and timestamp
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Handle image messages
    if (message.type === 'image' && message.imageData) {
      // Add username if available and not self
      if (message.from !== 'self' && message.username) {
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.textContent = message.username;
        messageContent.appendChild(userInfo);
      }
      
      // Check if this is a GIF (either by isGif flag or by URL)
      const isGif = message.isGif || 
                   (typeof message.imageData === 'string' && 
                    (message.imageData.includes('.gif') || 
                     message.originalUrl && message.originalUrl.includes('.gif')));
      
      // For GIFs, use the original URL directly to preserve animation
      if (isGif && (message.originalUrl || (typeof message.imageData === 'string' && message.imageData.startsWith('http')))) {
        const img = document.createElement('img');
        img.src = message.originalUrl || message.imageData;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        img.style.marginBottom = '8px';
        messageContent.appendChild(img);
      } else {
        // For regular images or base64 data
        const img = document.createElement('img');
        img.src = message.imageData;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        img.style.marginBottom = '8px';
        messageContent.appendChild(img);
      }
    } else {
      // Regular text message
      // Combine username and message in one element
      if (message.from !== 'self' && message.username) {
        const messageText = document.createElement('div');
        messageText.innerHTML = `<strong>${message.username}</strong>: ${message.message}`;
        messageContent.appendChild(messageText);
      } else {
        const messageText = document.createElement('div');
        messageText.textContent = message.message;
        messageContent.appendChild(messageText);
      }
    }
    
    messageDiv.appendChild(messageContent);
    
    // Add timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    
    // Format timestamp
    const date = new Date(message.timestamp);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timestamp.textContent = timeString;
    
    messageDiv.appendChild(timestamp);
    return messageDiv;
  }
  
  // Display messages in the UI
  displayMessages(messageHistory) {
    console.log('Displaying messages:', messageHistory.length);
    this.ui.messagesContainer.innerHTML = '';
    
    if (!messageHistory || messageHistory.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'No messages yet. Start chatting!';
      this.ui.messagesContainer.appendChild(emptyMessage);
      return;
    }
    
    messageHistory.forEach((msg) => {
      const messageElement = this.createMessageElement(msg);
      if (messageElement) {
        this.ui.messagesContainer.appendChild(messageElement);
      }
    });
    
    // Scroll to bottom
    this.ui.messagesContainer.scrollTop = this.ui.messagesContainer.scrollHeight;
  }
  
  // Update unread badge
  updateUnreadBadge() {
    // Remove existing badge if any
    const existingBadge = document.querySelector('.notification-badge');
    if (existingBadge) {
      existingBadge.remove();
    }
    
    // Add badge if there are unread messages
    if (this.unreadCount > 0) {
      const badge = document.createElement('div');
      badge.className = 'notification-badge';
      badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
      document.body.appendChild(badge);
    }
  }
  
  // Show notification
  showNotification(title, body, icon = 'icons/icon128.png') {
    if (!this.notificationsEnabled) return;
    
    try {
      // First try to use the Chrome notifications API
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: icon,
          title: title,
          message: body,
          priority: 2
        });
      } else {
        // Fall back to the Web Notifications API
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body: body,
            icon: icon
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification(title, {
                body: body,
                icon: icon
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }
  
  // Reset unread count
  resetUnreadCount() {
    this.unreadCount = 0;
    this.updateUnreadBadge();
  }
  
  // Increment unread count
  incrementUnreadCount() {
    this.unreadCount++;
    this.updateUnreadBadge();
  }
  
  // Get image data
  getImageData() {
    return this.imageData;
  }
  
  // Clear image data
  clearImageData() {
    this.imageData = null;
    this.ui.imagePreviewContainer.style.display = 'none';
  }
  
  // Get username
  getUsername() {
    return this.username;
  }
}

// Export the UIManager
window.UIManager = UIManager;
