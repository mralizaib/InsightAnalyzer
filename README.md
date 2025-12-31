# InsightAnalyzer
ByteIT Security Alert Management System
Overview
This is a Flask-based security alert management system (Beta-v13) that connects to Wazuh and OpenSearch for security monitoring, providing AI-driven insights and customizable reporting.

Project Architecture
Framework: Python Flask with Flask-Login for authentication
Database: PostgreSQL (Replit-provided) or SQLite fallback
Package Manager: uv (Python)
Port: 5000 (frontend and backend combined)
Key Directories
Beta-v12/ - Current active version
routes/ - Flask blueprints for different features (auth, dashboard, alerts, reports, etc.)
templates/ - Jinja2 HTML templates
static/ - CSS and JavaScript assets
models.py - SQLAlchemy database models
app.py - Flask application setup
main.py - Entry point
Running the Application
The app runs via the Flask App workflow:

cd Beta-v13 && python main.py
Default Credentials
Username: admin
Password: admin123
AI Platform Integration
The app now supports multiple AI providers with intelligent fallback routing:

Supported Providers
OpenAI (GPT-4o) - Requires OPENAI_API_KEY environment variable
Gemini (2.5-flash) - Via Replit AI Integrations (no API key required, free via credits)
DeepSeek - Requires DEEPSEEK_API_KEY environment variable
Ollama - Local LLM deployment, requires OLLAMA_API_URL
Features
Configurable Default Provider: Admin can set the preferred AI platform via /admin/ai-config
Intelligent Fallback: If the default provider fails, system automatically tries alternatives (OpenAI → Gemini → DeepSeek → Ollama)
Provider Detection: System auto-detects available providers based on configured credentials
Session Tracking: Responses indicate which provider was used, including fallback notifications
Admin Configuration
Navigate to /admin/ai-config to change the default AI provider
Available providers are automatically displayed based on configuration
System maintains fallback order automatically
AI Security Search - Conversation Mode
The AI Security Search now supports conversation mode for continuous session-based interactions:

How It Works
Session-Based Conversations: Each browser session gets a unique conversation ID
Persistent Messages: Messages are stored in the database during the session
Auto-Clear on Close: Conversations automatically clear when the user closes the browser or navigates away
Follow-Up Questions: Users can ask follow-up questions about alerts without repeating context
Message History: All messages within a session are preserved and displayed in conversation UI
User Experience
Users can continue chatting about the same alerts without starting a new conversation
Each message shows which AI provider was used (important for tracking fallbacks)
When closing the AI Insights page and reopening it later, a fresh conversation starts
Conversation history is cleared automatically to protect user privacy
Dependencies
Flask, Flask-Login, Flask-SQLAlchemy
OpenAI for AI insights
Google Genai for Gemini integration (via Replit AI Integrations)
WeasyPrint for PDF generation
SendGrid for email alerts
APScheduler for background tasks
Environment Variables
DATABASE_URL - PostgreSQL connection string (auto-set by Replit)
SESSION_SECRET - Flask session secret key
AI_INTEGRATIONS_GEMINI_API_KEY
AI_INTEGRATIONS_GEMINI_BASE_URL
OPENAI_API_KEY - For OpenAI provider
DEEPSEEK_API_KEY - For DeepSeek provider
OLLAMA_API_URL - For Ollama provider
External API credentials as needed for Wazuh, OpenSearch, SendGrid, etc.
