class AIAssistant {
    constructor() {
        this.isListening = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.voiceModeEnabled = false;
        
        this.initElements();
        this.initSpeechRecognition();
        this.bindEvents();
    }
    
    initElements() {
        this.toggleBtn = document.getElementById('assistant-toggle');
        this.panel = document.getElementById('assistant-panel');
        this.messagesContainer = document.getElementById('assistant-messages');
        this.input = document.getElementById('assistant-input');
        this.sendBtn = document.getElementById('send-btn');
        this.voiceBtn = document.getElementById('voice-btn');
        this.voiceModeBtn = document.getElementById('voice-mode-btn');
        this.voiceIndicator = document.getElementById('voice-indicator');
    }
    
    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            
            this.recognition.onstart = () => {
                this.isListening = true;
                this.updateVoiceUI(true);
            };
            
            this.recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                
                this.input.value = transcript;
                
                if (event.results[0].isFinal) {
                    this.stopListening();
                    this.sendMessage(transcript);
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.stopListening();
                
                if (event.error === 'not-allowed') {
                    this.addMessage('Microphone access denied. Please allow microphone access in your browser settings.', 'assistant');
                }
            };
            
            this.recognition.onend = () => {
                this.stopListening();
            };
        }
    }
    
    bindEvents() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
        
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => {
                const text = this.input.value.trim();
                if (text) {
                    this.sendMessage(text);
                }
            });
        }
        
        if (this.input) {
            this.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const text = this.input.value.trim();
                    if (text) {
                        this.sendMessage(text);
                    }
                }
            });
        }
        
        if (this.voiceBtn) {
            this.voiceBtn.addEventListener('click', () => this.toggleListening());
        }
        
        if (this.voiceModeBtn) {
            this.voiceModeBtn.addEventListener('click', () => this.toggleVoiceMode());
        }
    }
    
    toggle() {
        if (this.panel) {
            this.panel.classList.toggle('show');
            this.toggleBtn.classList.toggle('active');
            
            if (this.panel.classList.contains('show')) {
                this.input.focus();
            }
        }
    }
    
    toggleVoiceMode() {
        this.voiceModeEnabled = !this.voiceModeEnabled;
        if (this.voiceModeBtn) {
            this.voiceModeBtn.classList.toggle('active', this.voiceModeEnabled);
            if (this.voiceModeEnabled) {
                this.voiceModeBtn.classList.remove('btn-outline-light');
                this.voiceModeBtn.classList.add('btn-light');
            } else {
                this.voiceModeBtn.classList.add('btn-outline-light');
                this.voiceModeBtn.classList.remove('btn-light');
            }
        }
    }
    
    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }
    
    startListening() {
        if (!this.recognition) {
            this.addMessage('Voice input is not supported in your browser. Please type your message instead.', 'assistant');
            return;
        }
        
        try {
            this.recognition.start();
        } catch (error) {
            console.error('Error starting recognition:', error);
        }
    }
    
    stopListening() {
        this.isListening = false;
        this.updateVoiceUI(false);
        
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {}
        }
    }
    
    updateVoiceUI(listening) {
        if (this.voiceBtn) {
            this.voiceBtn.classList.toggle('listening', listening);
        }
        if (this.voiceIndicator) {
            this.voiceIndicator.style.display = listening ? 'flex' : 'none';
        }
    }
    
    addMessage(text, type, isHtml = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const avatarIcon = type === 'assistant' ? 'fa-robot' : 'fa-user';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas ${avatarIcon}"></i>
            </div>
            <div class="message-content">
                ${isHtml ? text : `<p>${this.escapeHtml(text)}</p>`}
            </div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageDiv;
    }
    
    addTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message assistant-message typing';
        indicator.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        this.messagesContainer.appendChild(indicator);
        this.scrollToBottom();
        return indicator;
    }
    
    removeTypingIndicator(indicator) {
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }
    
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async sendMessage(text) {
        this.addMessage(text, 'user');
        this.input.value = '';
        
        const typingIndicator = this.addTypingIndicator();
        
        try {
            const response = await fetch('/api/insights/voice-qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    question: text,
                    model_type: 'openai'
                })
            });
            
            const result = await response.json();
            this.removeTypingIndicator(typingIndicator);
            
            if (result.error) {
                this.addMessage(result.error, 'assistant');
            } else if (result.answer) {
                const formattedAnswer = this.formatResponse(result.answer, result.summary);
                this.addMessage(formattedAnswer, 'assistant', true);
                
                if (this.voiceModeEnabled && result.summary) {
                    this.speak(result.summary);
                }
            } else {
                this.addMessage('I apologize, but I could not process your request. Please try again.', 'assistant');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.removeTypingIndicator(typingIndicator);
            this.addMessage('Sorry, there was an error processing your request. Please try again.', 'assistant');
        }
    }
    
    formatResponse(answer, summary) {
        let html = '';
        
        if (summary) {
            html += `<p class="mb-2"><strong>${this.escapeHtml(summary)}</strong></p>`;
        }
        
        const formattedAnswer = answer
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
        
        html += `<p>${formattedAnswer}</p>`;
        
        return html;
    }
    
    speak(text) {
        if (!text || !this.synthesis) return;
        
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        this.synthesis.speak(utterance);
    }
}

let aiAssistant = null;

function toggleAssistant() {
    if (aiAssistant) {
        aiAssistant.toggle();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const assistantToggle = document.getElementById('assistant-toggle');
    
    if (assistantToggle) {
        aiAssistant = new AIAssistant();
    }
});
