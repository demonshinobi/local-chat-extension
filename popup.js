const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const connectionStatus = document.getElementById('connection-status');

// Update UI with connection status
function updateConnectionStatus(status) {
  connectionStatus.textContent = status;
  connectionStatus.className = status.toLowerCase();
}

// Add a message to the chat
function addMessage(text, isSent) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
  messageDiv.textContent = text;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send a message
async function sendMessage(text) {
  if (!text.trim()) return;

  chrome.runtime.sendMessage(
    { type: 'sendMessage', text },
    (response) => {
      if (response.success) {
        addMessage(text, true);
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
  if (message.type === 'connectionStatus') {
    updateConnectionStatus(message.status);
  } else if (message.type === 'messageReceived') {
    addMessage(message.message, false);
  }
});

// Add some styles
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
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
