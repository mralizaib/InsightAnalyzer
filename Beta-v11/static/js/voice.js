class AISearchEngine {
    constructor() {
        this.isSearching = false;
        this.initElements();
        this.bindEvents();
    }
    
    initElements() {
        this.toggleBtn = document.getElementById('search-toggle');
        this.panel = document.getElementById('search-panel');
        this.input = document.getElementById('search-input');
        this.searchBtn = document.getElementById('search-btn');
        this.resultsContainer = document.getElementById('search-results');
    }
    
    bindEvents() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
        
        if (this.searchBtn) {
            this.searchBtn.addEventListener('click', () => {
                const query = this.input.value.trim();
                if (query) {
                    this.search(query);
                }
            });
        }
        
        if (this.input) {
            this.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = this.input.value.trim();
                    if (query) {
                        this.search(query);
                    }
                }
            });
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
    
    async search(query) {
        if (this.isSearching) return;
        
        this.isSearching = true;
        this.showLoading();
        
        try {
            const response = await fetch('/api/insights/voice-qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: query,
                    include_context: true,
                    model_type: 'openai'
                })
            });
            
            const result = await response.json();
            this.isSearching = false;
            
            if (result.error) {
                this.displayError(result.error);
            } else if (result.success && result.answer) {
                this.displayResult(query, result.answer, result.summary);
            } else {
                this.displayError('Unable to process your search. Please try again.');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.isSearching = false;
            this.displayError('Search failed. Please check your connection and try again.');
        }
    }
    
    showLoading() {
        this.resultsContainer.innerHTML = `
            <div class="search-loading">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Searching...</span>
                </div>
                <span class="text-muted">Searching your security alerts...</span>
            </div>
        `;
    }
    
    displayResult(query, answer, summary) {
        const formattedAnswer = this.formatText(answer);
        
        let html = `
            <div class="search-result-item">
                <div class="search-result-title">
                    <i class="fas fa-check-circle me-2" style="color: #48bb78;"></i>
                    Your Query
                </div>
                <div class="search-result-content">
                    <em>${this.escapeHtml(query)}</em>
                </div>
            </div>
        `;
        
        if (summary) {
            html += `
                <div class="search-result-item">
                    <div class="search-result-title">
                        <i class="fas fa-lightbulb me-2" style="color: #f6ad55;"></i>
                        Summary
                    </div>
                    <div class="search-result-content">
                        ${this.escapeHtml(summary)}
                    </div>
                </div>
            `;
        }
        
        html += `
            <div class="search-result-item">
                <div class="search-result-title">
                    <i class="fas fa-book me-2" style="color: #667eea;"></i>
                    Detailed Answer
                </div>
                <div class="search-result-content">
                    ${formattedAnswer}
                </div>
            </div>
        `;
        
        this.resultsContainer.innerHTML = html;
    }
    
    displayError(errorMessage) {
        this.resultsContainer.innerHTML = `
            <div class="search-result-item" style="border-left-color: #f56565;">
                <div class="search-result-title" style="color: #f56565;">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Error
                </div>
                <div class="search-result-content">
                    ${this.escapeHtml(errorMessage)}
                </div>
            </div>
        `;
    }
    
    formatText(text) {
        if (!text) return '';
        
        let formatted = this.escapeHtml(text);
        
        // Convert markdown-like formatting
        formatted = formatted
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background: #2d3748; padding: 2px 6px; border-radius: 3px;">$1</code>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // Add paragraph tags
        formatted = `<p>${formatted}</p>`;
        
        return formatted;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

let searchEngine = null;

function toggleSearch() {
    if (searchEngine) {
        searchEngine.toggle();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const searchToggle = document.getElementById('search-toggle');
    
    if (searchToggle) {
        searchEngine = new AISearchEngine();
    }
});
