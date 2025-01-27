document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const statusEl = document.getElementById('connection-status');
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');

  let connected = false;

  // Update UI with connection status
  function updateStatus(status, message = '', serverIp = '') {
    console.log('Status update:', { status, message, serverIp });
    
    switch(status) {
      case 'Connected':
        statusEl.style.color = 'green';
        connected = true;
        statusEl.textContent = serverIp ? `Connected to ${serverIp}` : 'Connected';
        inputEl.disabled = false;
        sendButton.disabled = false;
        break;
        
      case 'Connecting':
        statusEl.style.color = 'orange';
        connected = false;
        statusEl.textContent = message || 'Connecting...';
        inputEl.disabled = true;
        sendButton.disabled = true;
        break;
        
      case 'Disconnected':
        statusEl.style.color = 'red';
        connected = false;
        statusEl.textContent = 'Disconnected';
        inputEl.disabled = true;
        sendButton.disabled = true;
        break;
        
      case 'Error':
        statusEl.style.color = 'red';
        connected = false;
        statusEl.textContent = message || 'Connection error';
        inputEl.disabled = true;
        sendButton.disabled = true;
        break;
        
      default:
        statusEl.style.color = 'red';
        connected = false;
        statusEl.textContent = message || status;
        inputEl.disabled = true;
        sendButton.disabled = true;
        break;
    }
  }

  // Add a message to the chat
  function addMessage(text, fromSelf = false, from = null) {
    const div = document.createElement('div');
    div.classList.add('message');
    if (fromSelf) {
      div.classList.add('self');
      text = `You: ${text}`;
    } else if (from) {
      text = `${from}: ${text}`;
    }
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Load message history
  function loadHistory(messages) {
    messages.forEach(msg => {
      if (msg.from === 'self') {
        addMessage(msg.message, true);
      } else {
        addMessage(msg.message, false, msg.from);
      }
    });
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

  // Set up event listeners
  sendButton.addEventListener('click', sendMessage);
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    console.log('Received message:', message);
    
    if (message.type === 'connectionStatus') {
      updateStatus(message.status, message.message, message.serverIp);
    } else if (message.type === 'messageReceived') {
      if (message.from === 'self') {
        addMessage(message.message, true);
      } else {
        addMessage(message.message, false, message.from);
      }
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
