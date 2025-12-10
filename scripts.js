// ==================== CONFIGURACIÓN ==================== 
const N8N_WEBHOOK_URL = "https://n8n.srv1161635.hstgr.cloud/webhook/6b4f38ff-0de0-49f0-843f-a277a55bdfd5";
const STORAGE_KEY_SESSION = "sessionId";
const STORAGE_KEY_CHATS = "chats";

// ==================== ESTADO DE SESSION ==================== 
let sessionId = localStorage.getItem(STORAGE_KEY_SESSION) || crypto.randomUUID();
let currentChatId = generateChatId();
let chats = loadChatsFromStorage();
let isLoading = false;

// ==================== INICIALIZACIÓN ==================== 
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    localStorage.setItem(STORAGE_KEY_SESSION, sessionId);
    setupEventListeners();
    loadChatHistory();
    addWelcomeMessage();
}

function setupEventListeners() {
    // ENVIAR MENSAJES
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', autoResizeTextarea);

    // Sidebar buttons
    document.getElementById('newChatBtn').addEventListener('click', newChat);
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
}

// ==================== AUTO-RESIZE TEXTAREA ==================== 
function autoResizeTextarea() {
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 100);
    textarea.style.height = newHeight + 'px';
}

// ==================== MESSAGE HANDLING ==================== 
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || isLoading) return;

    // Add user message
    addMessageToChat('user', message);
    input.value = '';
    input.style.height = 'auto';
    
    // Update chat title if it's the first message
    if (!getCurrentChat().messages.length) {
        const title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
        getCurrentChat().title = title;
        document.getElementById('chatTitle').textContent = title;
        saveChatsToStorage();
    }

    // Show loading indicator
    showLoadingIndicator();
    isLoading = true;

    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: message, 
                sessionId: sessionId 
            })
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const botResponse = data.output || data.message || 'Sin respuesta del servidor';
        
        removeLoadingIndicator();
        addMessageToChat('assistant', botResponse);

    } catch (error) {
        removeLoadingIndicator();
        addMessageToChat('assistant', `Error: ${error.message}. Por favor, intenta de nuevo.`);
        console.error('Error sending message:', error);
    } finally {
        isLoading = false;
    }
}

function addMessageToChat(sender, text) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${sender}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    
    messageDiv.appendChild(bubble);
    
    // Add timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.textContent = getTimeString();
    messageDiv.appendChild(timestamp);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Save to chat history
    getCurrentChat().messages.push({
        sender: sender,
        text: text,
        timestamp: new Date().toISOString()
    });
    saveChatsToStorage();
}

function showLoadingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-loading message-assistant';
    messageDiv.id = 'loading-indicator';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = '<div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div>';
    
    messageDiv.appendChild(bubble);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoadingIndicator() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function addWelcomeMessage() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages.children.length === 0) {
        addMessageToChat('assistant', '¡Hola! Soy Copilot, tu asistente de IA. ¿En qué puedo ayudarte hoy?');
    }
}

// ==================== CHAT MANAGEMENT ==================== 
function newChat() {
    currentChatId = generateChatId();
    sessionId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY_SESSION, sessionId);
    
    // Create new chat
    const newChatObj = {
        id: currentChatId,
        title: 'Nuevo Chat',
        messages: [],
        createdAt: new Date().toISOString()
    };
    
    chats.push(newChatObj);
    saveChatsToStorage();
    
    // Clear UI
    document.getElementById('chatMessages').innerHTML = '';
    document.getElementById('messageInput').value = '';
    document.getElementById('chatTitle').textContent = 'Nuevo Chat';
    
    addWelcomeMessage();
    loadChatHistory();
}

function getCurrentChat() {
    return chats.find(chat => chat.id === currentChatId) || 
           chats[chats.length - 1] || 
           createEmptyChat();
}

function createEmptyChat() {
    const chat = {
        id: generateChatId(),
        title: 'Nuevo Chat',
        messages: [],
        createdAt: new Date().toISOString()
    };
    chats.push(chat);
    return chat;
}

function loadChatHistory() {
    const historyList = document.getElementById('chatHistoryList');
    historyList.innerHTML = '';
    
    // Show most recent chats first
    const sortedChats = [...chats].reverse();
    
    sortedChats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = chat.title;
        item.title = chat.title;
        item.addEventListener('click', () => switchToChat(chat.id));
        historyList.appendChild(item);
    });
}

function switchToChat(chatId) {
    currentChatId = chatId;
    const chat = getCurrentChat();
    
    // Update header
    document.getElementById('chatTitle').textContent = chat.title;
    
    // Load messages
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    chat.messages.forEach(msg => {
        addMessageToChat(msg.sender, msg.text);
    });
    
    if (chat.messages.length === 0) {
        addWelcomeMessage();
    }
}

// ==================== STORAGE MANAGEMENT ==================== 
function saveChatsToStorage() {
    // Keep only last 20 chats to avoid storage issues
    const recentChats = chats.slice(-20);
    localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(recentChats));
}

function loadChatsFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY_CHATS);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error loading chats:', e);
            return [];
        }
    }
    return [];
}

// ==================== UTILITY FUNCTIONS ==================== 
function generateChatId() {
    return 'chat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getTimeString() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function openSettings() {
    // Placeholder for settings functionality
    console.log('Settings clicked');
    // You can expand this to show a settings modal
    alert('Configuración - Próximamente disponible');
}
