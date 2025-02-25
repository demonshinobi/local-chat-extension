/**
 * Popup script for the Local Chat Pro extension
 */

// Global variables
let uiManager;
let messageHistory = [];
let isConnected = false;
let serverIp = 'localhost';
let username = '';
let typingUsers = {};

// Initialize popup
async function initializePopup() {
  console.log('Initializing popup...');
  
  // Create UI manager
  uiManager = new UIManager();
  
  // Load settings
  await uiManager.loadSettings();
  
  // Get username
  username = uiManager.getUsername();
  
  // Set up event listeners
  setupEventListeners();
  
  // Get connection status from background script
  chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
    if (response && response.status) {
      updateConnectionStatus(response.status, response.message, response.serverIp);
    }
  });
  
  // Load message history from background script
  loadMessageHistory();
  
  console.log('Popup initialization complete');
}

// Load message history
function loadMessageHistory() {
  console.log('Loading message history from background...');
  chrome.runtime.sendMessage({ type: 'getHistory' }, (response) => {
    if (response && response.messages) {
      console.log('Received message history:', response.messages.length, 'messages');
      messageHistory = response.messages;
      
      // Display messages
      uiManager.displayMessages(messageHistory);
      
      // Mark all messages as read
      const messageIds = messageHistory
        .filter(msg => !msg.read)
        .map(msg => msg.timestamp);
      
      if (messageIds.length > 0) {
        chrome.runtime.sendMessage({
          type: 'markAsRead',
          messageIds: messageIds
        });
      }
    }
  });
}

// Set up event listeners
function setupEventListeners() {
  // Connect button
  uiManager.ui.connectButton.addEventListener('click', () => {
    const ip = uiManager.ui.serverIpInput.value.trim();
    if (ip) {
      // Update connection status
      updateConnectionStatus('Connecting', 'Connecting to ' + ip);
      
      // Send connection request to background script
      chrome.runtime.sendMessage({
        type: 'connectTo',
        ip: ip
      });
    }
  });
  
  // Send button
  uiManager.ui.sendButton.addEventListener('click', sendMessage);
  
  // Enter key in message input
  uiManager.ui.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Clear history button
  uiManager.ui.clearHistoryButton.addEventListener('click', () => {
    // Send clear history request to background script
    chrome.runtime.sendMessage({ type: 'clearHistory' }, () => {
      // Clear message history
      messageHistory = [];
      
      // Display empty message history
      uiManager.displayMessages(messageHistory);
    });
  });
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    // Handle connection status updates
    if (message.type === 'connectionStatus') {
      updateConnectionStatus(message.status, message.message, message.serverIp);
    }
    
    // Handle chat messages
    else if (message.type === 'chat') {
      // Add message to history
      messageHistory.push(message);
      
      // Display messages
      uiManager.displayMessages(messageHistory);
    }
    
    // Handle image messages
    else if (message.type === 'image') {
      // Add message to history
      messageHistory.push(message);
      
      // Display messages
      uiManager.displayMessages(messageHistory);
    }
    
    // Handle system messages
    else if (message.type === 'system') {
      // Check if it's a history cleared message
      if (message.status === 'HistoryCleared') {
        // Clear message history
        messageHistory = [];
      } else {
        // Add message to history
        messageHistory.push(message);
      }
      
      // Display messages
      uiManager.displayMessages(messageHistory);
    }
    
    // Handle typing indicators
    else if (message.type === 'typing') {
      // Show typing indicator
      uiManager.showTypingIndicator(message.username);
      
      // Store typing user
      typingUsers[message.from] = {
        username: message.username,
        timestamp: Date.now()
      };
    }
    
    // Handle stopped typing indicators
    else if (message.type === 'stoppedTyping') {
      // Remove typing user
      delete typingUsers[message.from];
      
      // Check if there are still typing users
      const typingUsernames = Object.values(typingUsers)
        .filter(user => Date.now() - user.timestamp < 3000)
        .map(user => user.username);
      
      if (typingUsernames.length > 0) {
        // Show typing indicator for the first user
        uiManager.showTypingIndicator(typingUsernames[0]);
      } else {
        // Hide typing indicator
        uiManager.hideTypingIndicator();
      }
    }
  });
}

// Send message
function sendMessage() {
  if (!isConnected) return;
  
  const messageText = uiManager.ui.messageInput.value.trim();
  const imageData = uiManager.getImageData();
  
  // Check if there's a message or image to send
  if (!messageText && !imageData) return;
  
  // Get username
  const currentUsername = uiManager.getUsername() || 'Anonymous';
  
  if (imageData) {
    // Send image message
    chrome.runtime.sendMessage({
      type: 'sendImageMessage',
      imageData: imageData,
      username: currentUsername
    }, (response) => {
      if (response && response.success) {
        // Clear image data
        uiManager.clearImageData();
      }
    });
  }
  
  if (messageText) {
    // Send text message
    chrome.runtime.sendMessage({
      type: 'sendMessage',
      message: messageText,
      username: currentUsername
    });
    
    // Clear message input
    uiManager.ui.messageInput.value = '';
  }
  
  // Focus on message input
  uiManager.ui.messageInput.focus();
}

// Update connection status
function updateConnectionStatus(status, message = '', serverIp = '') {
  // Update UI
  uiManager.updateConnectionStatus(status, message);
  
  // Update connection state
  isConnected = status === 'Connected';
  
  // Update server IP input if connected
  if (isConnected && serverIp) {
    uiManager.ui.serverIpInput.value = serverIp;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);

// Add support for GIF selection
function setupGifSupport() {
  // Create GIF button
  const gifButton = document.createElement('button');
  gifButton.id = 'gif-button';
  gifButton.className = 'action-button';
  gifButton.innerHTML = 'GIF';
  gifButton.title = 'Send a GIF';
  
  // Create GIF picker
  const gifPicker = document.createElement('div');
  gifPicker.id = 'gif-picker';
  gifPicker.className = 'gif-picker';
  
  // Add GIF picker to body
  document.body.appendChild(gifPicker);
  
  // Add GIF button to message input row
  const messageInputRow = document.querySelector('.message-input-row');
  if (messageInputRow) {
    messageInputRow.insertBefore(gifButton, messageInputRow.firstChild);
  }
  
  // Popular GIFs
  const popularGifs = [
    'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif',
    'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/3ohhweiVB36rAlqVCE/giphy.gif',
    'https://media.giphy.com/media/26FPqAHtgCBzKG9mo/giphy.gif',
    'https://media.giphy.com/media/l4FGni1RBAR2OWsGk/giphy.gif',
  ];
  
  // Populate GIF picker with some popular GIFs
  popularGifs.forEach(gifUrl => {
    const gifElement = document.createElement('img');
    gifElement.src = gifUrl;
    gifElement.className = 'gif-item';
    gifElement.addEventListener('click', () => {
      // Send GIF as image
      sendGif(gifUrl);
      toggleGifPicker(false);
    });
    gifPicker.appendChild(gifElement);
  });
  
  // Toggle GIF picker
  function toggleGifPicker(show) {
    if (show === undefined) {
      gifPicker.classList.toggle('visible');
    } else {
      if (show) {
        gifPicker.classList.add('visible');
      } else {
        gifPicker.classList.remove('visible');
      }
    }
  }
  
  // Send GIF
  function sendGif(gifUrl) {
    if (!isConnected) return;
    
    // Get username
    const currentUsername = uiManager.getUsername() || 'Anonymous';
    
    // Send GIF directly without trying to convert to base64
    chrome.runtime.sendMessage({
      type: 'sendImageMessage',
      imageData: gifUrl,
      username: currentUsername,
      isGif: true,
      originalUrl: gifUrl
    });
  }
  
  // Add event listener to GIF button
  gifButton.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleGifPicker();
  });
  
  // Close GIF picker when clicking outside
  document.addEventListener('click', (e) => {
    if (!gifButton.contains(e.target) && !gifPicker.contains(e.target)) {
      toggleGifPicker(false);
    }
  });
}

// Initialize GIF support when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait for UI to be initialized
  setTimeout(setupGifSupport, 500);
});
