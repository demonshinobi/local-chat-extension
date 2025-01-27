const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const connectionStatus = document.getElementById('connection-status');

// Update UI with connection status
function updateConnectionStatus(status, message = '', serverIp = '') {
  let statusText = status;
  if (serverIp) {
    statusText += ` (${serverIp})`;
  }
  if (message) {
    statusText += `: ${message}`;
  }
  connectionStatus.textContent = statusText;
  connectionStatus.className = status.toLowerCase();
}

// Add a message to the chat
function addMessage(text, isSent, messageId = null, from = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
  
  // Create message content
  const contentSpan = document.createElement('span');
  contentSpan.textContent = text;
  messageDiv.appendChild(contentSpan);

  // Add sender info for received messages
  if (!isSent && from) {
    const fromSpan = document.createElement('span');
    fromSpan.className = 'message-from';
    fromSpan.textContent = ` from ${from}`;
    messageDiv.appendChild(fromSpan);
  }

  // Add status indicator for sent messages
  if (isSent && messageId) {
    const statusSpan = document.createElement('span');
    statusSpan.className = 'message-status';
    statusSpan.dataset.messageId = messageId;
    statusSpan.textContent = ' ⌛'; // Pending
    messageDiv.appendChild(statusSpan);
  }

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update message status
function updateMessageStatus(messageId, status) {
  const statusSpan = messagesContainer.querySelector(`.message-status[data-message-id="${messageId}"]`);
  if (statusSpan) {
    switch (status) {
      case 'sent':
        statusSpan.textContent = ' ✓'; // Sent
        break;
      case 'delivered':
        statusSpan.textContent = ' ✓✓'; // Delivered
        break;
      case 'undelivered':
        statusSpan.textContent = ' ⚠️'; // Failed
        break;
    }
  }
}

// Send a message
async function sendMessage(text) {
  if (!text.trim()) return;

  chrome.runtime.sendMessage(
    { type: 'sendMessage', text },
    (response) => {
      if (response.success) {
        addMessage(text, true, response.messageId);
        updateMessageStatus(response.messageId, 'sent');
        messageInput.value = '';
      } else {
        console.error('Failed to send message:', response.error);
        alert('Failed to send message. Please try again.');
      }
    }
  );
}

// Event listeners
sendButton.addEventListener('click', () => {
  sendMessage(messageInput.value);
});

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(messageInput.value);
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'connectionStatus':
      updateConnectionStatus(message.status, message.message, message.serverIp);
      break;
    case 'messageReceived':
      addMessage(message.message, false, null, message.from);
      break;
    case 'messageDelivered':
      updateMessageStatus(message.messageId, 'delivered');
      break;
    case 'messageStatus':
      updateMessageStatus(message.messageId, message.status);
      break;
  }
});

// Add styles
const styles = `
  #connection-status {
    padding: 5px;
    margin-bottom: 10px;
    text-align: center;
    font-weight: bold;
  }
  #connection-status.connected {
    color: green;
  }
  #connection-status.disconnected,
  #connection-status.error {
    color: red;
  }
  .message {
    margin-bottom: 5px;
    word-wrap: break-word;
    padding: 5px;
    border-radius: 5px;
  }
  .message.sent {
    color: blue;
    text-align: right;
    background-color: #e3f2fd;
  }
  .message.received {
    color: green;
    text-align: left;
    background-color: #f1f8e9;
  }
  .message-status {
    font-size: 0.8em;
    margin-left: 5px;
    opacity: 0.7;
  }
  .message-from {
    font-size: 0.8em;
    color: #666;
  }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
