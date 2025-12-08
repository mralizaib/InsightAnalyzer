class VoiceCommandManager {
    constructor() {
        this.isListening = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recognition = null;
        this.useBrowserSTT = true;
        this.synthesis = window.speechSynthesis;
        
        this.initializeSpeechRecognition();
        this.checkVoiceStatus();
    }
    
    initializeSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            
            this.recognition.onstart = () => {
                this.updateUI('listening');
                this.showFeedback('Listening...', 'info');
            };
            
            this.recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                
                this.updateTranscript(transcript);
                
                if (event.results[0].isFinal) {
                    this.processCommand(transcript);
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.updateUI('idle');
                
                if (event.error === 'not-allowed') {
                    this.showFeedback('Microphone access denied. Please allow microphone access.', 'error');
                } else if (event.error === 'no-speech') {
                    this.showFeedback('No speech detected. Try again.', 'warning');
                } else {
                    this.showFeedback(`Error: ${event.error}`, 'error');
                }
            };
            
            this.recognition.onend = () => {
                this.isListening = false;
                this.updateUI('idle');
            };
        } else {
            console.log('Web Speech API not supported, will use server-side transcription');
            this.useBrowserSTT = false;
        }
    }
    
    async checkVoiceStatus() {
        try {
            const response = await fetch('/api/voice/status');
            const status = await response.json();
            
            if (status.success) {
                this.serverSTTAvailable = status.stt_available;
                this.serverTTSAvailable = status.tts_available;
                console.log('Voice status:', status);
            }
        } catch (error) {
            console.error('Error checking voice status:', error);
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
        if (this.isListening) return;
        
        this.isListening = true;
        this.audioChunks = [];
        
        if (this.useBrowserSTT && this.recognition) {
            try {
                this.recognition.start();
            } catch (error) {
                console.error('Error starting recognition:', error);
                this.fallbackToServerSTT();
            }
        } else {
            this.fallbackToServerSTT();
        }
    }
    
    stopListening() {
        this.isListening = false;
        
        if (this.recognition) {
            this.recognition.stop();
        }
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        this.updateUI('idle');
    }
    
    async fallbackToServerSTT() {
        try {
            this.updateUI('listening');
            this.showFeedback('Recording...', 'info');
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                await this.sendAudioToServer(audioBlob);
            };
            
            this.mediaRecorder.start();
            
            setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            }, 10000);
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.showFeedback('Could not access microphone. Please check permissions.', 'error');
            this.updateUI('idle');
        }
    }
    
    async sendAudioToServer(audioBlob) {
        this.updateUI('processing');
        this.showFeedback('Processing audio...', 'info');
        
        try {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            
            reader.onloadend = async () => {
                const base64Audio = reader.result;
                
                const response = await fetch('/api/voice/transcribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audio_data: base64Audio,
                        format: 'webm'
                    })
                });
                
                const result = await response.json();
                
                if (result.success && result.text) {
                    this.updateTranscript(result.text);
                    await this.processCommand(result.text);
                } else {
                    this.showFeedback(result.error || 'Could not transcribe audio', 'error');
                }
                
                this.updateUI('idle');
            };
        } catch (error) {
            console.error('Error sending audio to server:', error);
            this.showFeedback('Error processing audio', 'error');
            this.updateUI('idle');
        }
    }
    
    async processCommand(text) {
        this.updateUI('processing');
        this.showFeedback('Processing command...', 'info');
        
        try {
            const response = await fetch('/api/voice/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });
            
            const result = await response.json();
            
            if (result.success) {
                await this.executeAction(result);
            } else {
                this.showFeedback(result.error || 'Could not process command', 'error');
            }
        } catch (error) {
            console.error('Error processing command:', error);
            this.showFeedback('Error processing command', 'error');
        }
        
        this.updateUI('idle');
    }
    
    async executeAction(commandResult) {
        const { intent, action, target, requires_confirmation, response_text, parameters } = commandResult;
        
        if (requires_confirmation) {
            const confirmed = await this.showConfirmation(response_text || `Execute ${intent}?`);
            if (!confirmed) {
                this.speak('Command cancelled.');
                return;
            }
        }
        
        if (action === 'navigate' && target) {
            this.speak(response_text || `Navigating to ${intent.replace('_', ' ')}`);
            setTimeout(() => {
                window.location.href = target;
            }, 1000);
            return;
        }
        
        if (action === 'query' || action === 'action') {
            try {
                const response = await fetch('/api/voice/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ intent, parameters })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    this.showFeedback(result.response_text, 'success');
                    this.speak(result.response_text);
                    
                    if (result.data) {
                        this.displayData(intent, result.data);
                    }
                } else {
                    this.showFeedback(result.error || 'Command failed', 'error');
                    this.speak(result.response_text || 'The command could not be executed.');
                }
            } catch (error) {
                console.error('Error executing command:', error);
                this.showFeedback('Error executing command', 'error');
            }
            return;
        }
        
        if (action === 'info') {
            this.showFeedback(response_text, 'info');
            this.speak(response_text);
            return;
        }
        
        if (intent === 'unknown') {
            this.showFeedback(response_text || "I didn't understand that command.", 'warning');
            this.speak(response_text || "I didn't understand that command. Say help for available commands.");
        }
    }
    
    speak(text) {
        if (!text) return;
        
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        this.synthesis.speak(utterance);
    }
    
    async showConfirmation(message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('voice-confirm-modal');
            const messageEl = document.getElementById('voice-confirm-message');
            const confirmBtn = document.getElementById('voice-confirm-yes');
            const cancelBtn = document.getElementById('voice-confirm-no');
            
            if (!modal) {
                resolve(confirm(message));
                return;
            }
            
            messageEl.textContent = message;
            const bsModal = new bootstrap.Modal(modal);
            
            const handleConfirm = () => {
                bsModal.hide();
                cleanup();
                resolve(true);
            };
            
            const handleCancel = () => {
                bsModal.hide();
                cleanup();
                resolve(false);
            };
            
            const cleanup = () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
            };
            
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            
            bsModal.show();
        });
    }
    
    displayData(intent, data) {
        const resultsContainer = document.getElementById('voice-results');
        if (!resultsContainer) return;
        
        let html = '';
        
        if (intent === 'get_stats' && data.alert_counts) {
            html = `
                <div class="card bg-dark border-secondary">
                    <div class="card-header">Dashboard Statistics</div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3"><strong>Critical:</strong> ${data.alert_counts.critical || 0}</div>
                            <div class="col-md-3"><strong>High:</strong> ${data.alert_counts.high || 0}</div>
                            <div class="col-md-3"><strong>Medium:</strong> ${data.alert_counts.medium || 0}</div>
                            <div class="col-md-3"><strong>Low:</strong> ${data.alert_counts.low || 0}</div>
                        </div>
                    </div>
                </div>
            `;
        } else if (intent === 'get_agent_status') {
            html = `
                <div class="card bg-dark border-secondary">
                    <div class="card-header">Agent Status</div>
                    <div class="card-body">
                        <p><strong>Active:</strong> ${data.active || 0}</p>
                        <p><strong>Disconnected:</strong> ${data.disconnected || 0}</p>
                        <p><strong>Total:</strong> ${data.total || 0}</p>
                    </div>
                </div>
            `;
        } else if (data.analysis) {
            html = `
                <div class="card bg-dark border-secondary">
                    <div class="card-header">AI Analysis</div>
                    <div class="card-body">
                        <pre class="text-wrap">${data.analysis}</pre>
                    </div>
                </div>
            `;
        }
        
        if (html) {
            resultsContainer.innerHTML = html;
            resultsContainer.style.display = 'block';
        }
    }
    
    updateUI(state) {
        const button = document.getElementById('voice-button');
        const indicator = document.getElementById('voice-indicator');
        
        if (!button) return;
        
        button.classList.remove('listening', 'processing');
        
        switch (state) {
            case 'listening':
                button.classList.add('listening');
                if (indicator) indicator.textContent = 'Listening...';
                break;
            case 'processing':
                button.classList.add('processing');
                if (indicator) indicator.textContent = 'Processing...';
                break;
            default:
                if (indicator) indicator.textContent = '';
        }
    }
    
    updateTranscript(text) {
        const transcriptEl = document.getElementById('voice-transcript');
        if (transcriptEl) {
            transcriptEl.textContent = text;
            transcriptEl.style.display = text ? 'block' : 'none';
        }
    }
    
    showFeedback(message, type = 'info') {
        const feedbackEl = document.getElementById('voice-feedback');
        if (!feedbackEl) {
            console.log(`Voice feedback (${type}):`, message);
            return;
        }
        
        feedbackEl.textContent = message;
        feedbackEl.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info'}`;
        feedbackEl.style.display = 'block';
        
        if (type !== 'error') {
            setTimeout(() => {
                feedbackEl.style.display = 'none';
            }, 5000);
        }
    }
}

let voiceManager = null;

document.addEventListener('DOMContentLoaded', function() {
    const voiceButton = document.getElementById('voice-button');
    
    if (voiceButton) {
        voiceManager = new VoiceCommandManager();
        
        voiceButton.addEventListener('click', function() {
            voiceManager.toggleListening();
        });
    }
});

function toggleVoicePanel() {
    const panel = document.getElementById('voice-panel');
    if (panel) {
        panel.classList.toggle('show');
    }
}
