// Messaging functionality
class MessagingSystem {
    constructor() {
        // Get the initial partner ID from the hidden input if it exists
        const receiverInput = document.getElementById('receiver_id');
        this.currentConversation = receiverInput ? receiverInput.value : null;
        this.refreshInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        if (document.getElementById('conversation-list')) {
            this.loadConversations();
        }
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Send message
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'message-form') {
                e.preventDefault();
                this.sendMessage(e.target);
            }
        });

        // Load conversation
        document.addEventListener('click', (e) => {
            if (e.target.matches('.conversation-item')) {
                e.preventDefault();
                const userId = e.target.dataset.userId;
                this.loadConversation(userId);
            }
        });

        // Auto-resize message input
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('input', this.autoResizeTextarea);
        }

        // Handle Enter key for sending messages
        document.addEventListener('keydown', (e) => {
            if (e.target.id === 'message-input' && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const form = document.getElementById('message-form');
                if (form) {
                    this.sendMessage(form);
                }
            }
        });
    }

    async loadConversations() {
        try {
            const response = await fetch('/api/messages', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.renderConversationsList(data.conversations || []);
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
            window.agriApp.showMessage('Failed to load conversations', 'error');
        }
    }

    renderConversationsList(conversations) {
        const container = document.getElementById('conversation-list');
        if (!container) return;

        if (conversations.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-comments fa-3x text-muted mb-3"></i>
                    <h5>No conversations yet</h5>
                    <p class="text-muted">Start a conversation by contacting a farmer or buyer</p>
                </div>
            `;
            return;
        }

        container.innerHTML = conversations.map(conv => `
            <div class="conversation-item list-group-item list-group-item-action d-flex justify-content-between align-items-start"
                 data-user-id="${conv.partner_id}">
                <div class="ms-2 me-auto">
                    <div class="fw-bold">${conv.partner_name}</div>
                    <p class="mb-1 text-muted">${this.truncateMessage(conv.last_message, 50)}</p>
                    <small class="text-muted">${window.agriApp.formatDateTime(conv.last_message_time)}</small>
                </div>
                ${conv.unread_count > 0 ? `
                    <span class="badge bg-primary rounded-pill">${conv.unread_count}</span>
                ` : ''}
            </div>
        `).join('');
    }

    async loadConversation(userId) {
        try {
            this.currentConversation = userId;
            
            const response = await fetch(`/api/messages?user_id=${userId}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.renderMessages(data.messages || []);
                this.updateConversationHeader(userId);
                this.showMessageForm();
            }
        } catch (error) {
            console.error('Failed to load conversation:', error);
            window.agriApp.showMessage('Failed to load conversation', 'error');
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('messages-container');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="fas fa-comment-dots fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No messages yet. Start the conversation!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = messages.map(message => `
            <div class="mb-3 ${message.is_mine ? 'text-end' : ''}">
                <div class="message-bubble ${message.is_mine ? 'message-sent' : 'message-received'}">
                    ${this.formatMessageContent(message.content)}
                </div>
                <div class="message-meta small text-muted">
                    <strong>${message.sender_name}</strong> • 
                    ${window.agriApp.formatDateTime(message.created_at)}
                    ${message.read_at ? '<i class="fas fa-check-double text-primary" title="Read"></i>' : ''}
                </div>
            </div>
        `).join('');

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    updateConversationHeader(userId) {
        const header = document.getElementById('conversation-header');
        if (!header) return;

        // Find user name from conversations list
        const conversationItem = document.querySelector(`[data-user-id="${userId}"]`);
        const userName = conversationItem ? conversationItem.querySelector('.fw-bold').textContent : 'User';

        header.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-user-circle fa-2x text-muted me-3"></i>
                <div>
                    <h5 class="mb-0">${userName}</h5>
                    <small class="text-muted">Active conversation</small>
                </div>
            </div>
        `;
    }

    showMessageForm() {
        const form = document.getElementById('message-form');
        if (form) {
            form.querySelector('#receiver_id').value = this.currentConversation;
        }
    }

    async sendMessage(form) {
        const formData = new FormData(form);
        const content = formData.get('content');
        
        if (!content || !content.trim()) {
            return;
        }

        const data = {
            receiver_id: this.currentConversation,
            content: content.trim(),
            order_id: formData.get('order_id') || null
        };

        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            const result = await response.json();
            
            if (result.success) {
                form.reset();
                this.loadConversation(this.currentConversation); // Refresh messages
                this.loadConversations(); // Update conversations list
            } else {
                window.agriApp.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            window.agriApp.showMessage('Failed to send message', 'error');
        }
    }

    formatMessageContent(content) {
        // Basic text formatting
        return content
            .replace(/\n/g, '<br>')
            .replace(/\b(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    }

    truncateMessage(message, length) {
        if (message.length <= length) return message;
        return message.substring(0, length) + '...';
    }

    autoResizeTextarea(e) {
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    startAutoRefresh() {
        // Refresh messages every 30 seconds if in an active conversation
        this.refreshInterval = setInterval(() => {
            if (this.currentConversation) {
                this.loadConversation(this.currentConversation);
            }
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Message templates for common scenarios
    getMessageTemplate(type, data = {}) {
        const templates = {
            order_inquiry: `Hi! I'm interested in your ${data.cropName}. Is it still available?`,
            delivery_inquiry: `When can you deliver the ${data.cropName} I ordered?`,
            quality_inquiry: `Can you tell me more about the quality of your ${data.cropName}?`,
            price_negotiation: `Is there any room for negotiation on the price for ${data.cropName}?`
        };

        return templates[type] || '';
    }

    // Quick response buttons
    renderQuickResponses() {
        const container = document.getElementById('quick-responses');
        if (!container) return;

        const responses = [
            'Thank you!',
            'Yes, available',
            'Let me check',
            'Can we discuss price?',
            'When do you need it?'
        ];

        container.innerHTML = responses.map(response => `
            <button class="btn btn-sm btn-outline-secondary me-1 mb-1 quick-response-btn"
                    data-response="${response}">
                ${response}
            </button>
        `).join('');

        // Handle quick response clicks
        container.addEventListener('click', (e) => {
            if (e.target.matches('.quick-response-btn')) {
                const messageInput = document.getElementById('message-content');
                if (messageInput) {
                    messageInput.value = e.target.dataset.response;
                    messageInput.focus();
                }
            }
        });
    }
}

// Initialize messaging system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize if we are on a page with a chat interface (e.g., chat.html)
    if (document.getElementById('message-form')) {
        window.messagingSystem = new MessagingSystem();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
     if (window.messagingSystem) {
         window.messagingSystem.stopAutoRefresh();
     }
});
