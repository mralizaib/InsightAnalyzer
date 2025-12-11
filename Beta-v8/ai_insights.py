import os
import json
import logging
import requests
from config import Config

# the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
# do not change this unless explicitly requested by the user
from openai import OpenAI

logger = logging.getLogger(__name__)

class AIInsights:
    def __init__(self, model_type="openai"):
        self.model_type = model_type
        
        # Initialize model-specific clients
        self.openai = None
        if model_type == "openai" and Config.OPENAI_API_KEY:
            self.openai = OpenAI(api_key=Config.OPENAI_API_KEY)
    
    def ask_wazuh_question(self, question, context_data=None, language=None):
        """
        Answer a question about Wazuh, security alerts, or the system.
        Supports multi-language responses - responds in the same language as the question.
        
        Args:
            question: The user's question (in any language)
            context_data: Optional alert data or context to include
            language: Optional language hint (auto-detected if not provided)
            
        Returns:
            Dictionary with the answer and summary
        """
        system_prompt = """You are an expert cybersecurity assistant specializing in Wazuh SIEM (Security Information and Event Management), OpenSearch, and security alert analysis.

Your capabilities include:
- Explaining Wazuh concepts, rules, decoders, and configurations
- Analyzing security alerts and identifying threats
- Providing recommendations for security improvements
- Helping with incident response and threat hunting
- Explaining MITRE ATT&CK techniques and tactics

IMPORTANT LANGUAGE RULE: Always respond in the SAME LANGUAGE as the user's question. If they ask in Spanish, respond in Spanish. If they ask in French, respond in French. If they ask in Japanese, respond in Japanese. Match their language exactly.

When analyzing data, provide:
1. A clear, concise answer to the question
2. Relevant context and explanation
3. Actionable recommendations when applicable
4. A brief summary at the end

Be helpful, accurate, and security-focused in your responses."""

        user_content = question
        if context_data:
            if isinstance(context_data, (list, dict)):
                context_str = json.dumps(context_data, indent=2)
            else:
                context_str = str(context_data)
            user_content = f"Context data:\n{context_str}\n\nQuestion: {question}"
        
        if self.model_type == "openai":
            return self._ask_with_openai(system_prompt, user_content)
        elif self.model_type == "deepseek":
            return self._ask_with_deepseek(system_prompt, user_content)
        elif self.model_type == "ollama":
            return self._ask_with_ollama(system_prompt, user_content)
        else:
            return {"error": f"Unsupported AI model type: {self.model_type}"}
    
    def _ask_with_openai(self, system_prompt, user_content):
        """Ask a question using OpenAI"""
        if not self.openai:
            if not Config.OPENAI_API_KEY:
                return {"error": "OpenAI API key not configured"}
            self.openai = OpenAI(api_key=Config.OPENAI_API_KEY)
        
        try:
            response = self.openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                max_tokens=2000
            )
            
            answer = response.choices[0].message.content
            
            summary_response = self.openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Create a brief 1-2 sentence summary of this answer. Use the same language as the original answer."},
                    {"role": "user", "content": answer}
                ],
                max_tokens=150
            )
            
            summary = summary_response.choices[0].message.content
            
            return {
                "success": True,
                "answer": answer,
                "summary": summary,
                "model": "gpt-4o",
                "provider": "openai"
            }
        except Exception as e:
            logger.error(f"Error with OpenAI Q&A: {str(e)}")
            return {"error": str(e)}
    
    def _ask_with_deepseek(self, system_prompt, user_content):
        """Ask a question using DeepSeek"""
        if not Config.DEEPSEEK_API_KEY:
            return {"error": "DeepSeek API key not configured"}
        
        try:
            headers = {
                "Authorization": f"Bearer {Config.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                "max_tokens": 2000
            }
            
            response = requests.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers=headers,
                json=data
            )
            
            if response.status_code == 200:
                result = response.json()
                answer = result["choices"][0]["message"]["content"]
                
                summary_data = {
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": "Create a brief 1-2 sentence summary of this answer. Use the same language as the original answer."},
                        {"role": "user", "content": answer}
                    ],
                    "max_tokens": 150
                }
                
                summary_response = requests.post(
                    "https://api.deepseek.com/v1/chat/completions",
                    headers=headers,
                    json=summary_data
                )
                
                summary = ""
                if summary_response.status_code == 200:
                    summary = summary_response.json()["choices"][0]["message"]["content"]
                
                return {
                    "success": True,
                    "answer": answer,
                    "summary": summary,
                    "model": "deepseek-chat",
                    "provider": "deepseek"
                }
            else:
                logger.error(f"DeepSeek API error: {response.text}")
                return {"error": f"DeepSeek API error: {response.text}"}
        except Exception as e:
            logger.error(f"Error with DeepSeek Q&A: {str(e)}")
            return {"error": str(e)}
    
    def _ask_with_ollama(self, system_prompt, user_content):
        """Ask a question using Ollama local LLM"""
        ollama_url = Config.OLLAMA_API_URL
        
        try:
            data = {
                "model": "llama3",
                "prompt": f"{system_prompt}\n\nUser: {user_content}",
                "stream": False
            }
            
            response = requests.post(
                f"{ollama_url}/api/generate",
                json=data
            )
            
            if response.status_code == 200:
                result = response.json()
                answer = result["response"]
                
                summary_data = {
                    "model": "llama3",
                    "prompt": f"Create a brief 1-2 sentence summary of this answer. Use the same language as the original answer:\n\n{answer}",
                    "stream": False
                }
                
                summary_response = requests.post(
                    f"{ollama_url}/api/generate",
                    json=summary_data
                )
                
                summary = ""
                if summary_response.status_code == 200:
                    summary = summary_response.json()["response"]
                
                return {
                    "success": True,
                    "answer": answer,
                    "summary": summary,
                    "model": "llama3",
                    "provider": "ollama"
                }
            else:
                logger.error(f"Ollama API error: {response.text}")
                return {"error": f"Ollama API error: {response.text}"}
        except Exception as e:
            logger.error(f"Error with Ollama Q&A: {str(e)}")
            return {"error": str(e)}
        
    def analyze_alerts(self, alerts_data, analysis_prompt=None, fields=None):
        """
        Analyze security alerts using the specified AI model
        
        Args:
            alerts_data: List of alert data or text to analyze
            analysis_prompt: Custom prompt for the analysis
            fields: Specific fields to include in the analysis
            
        Returns:
            Dictionary with analysis results
        """
        if not analysis_prompt:
            analysis_prompt = "Analyze these security alerts for patterns, potential threats, and recommended actions:"
        
        # Extract specified fields if needed
        if fields and isinstance(alerts_data, list):
            filtered_data = []
            for alert in alerts_data:
                filtered_alert = {}
                for field in fields:
                    if field in alert:
                        filtered_alert[field] = alert[field]
                filtered_data.append(filtered_alert)
            alerts_data = filtered_data
        
        # Convert to string if it's not already
        if isinstance(alerts_data, (list, dict)):
            content = json.dumps(alerts_data, indent=2)
        else:
            content = str(alerts_data)
        
        # Combine prompt and data
        full_prompt = f"{analysis_prompt}\n\n{content}"
        
        # Choose the AI model based on the configuration
        if self.model_type == "openai":
            return self._analyze_with_openai(full_prompt)
        elif self.model_type == "deepseek":
            return self._analyze_with_deepseek(full_prompt)
        elif self.model_type == "ollama":
            return self._analyze_with_ollama(full_prompt)
        else:
            return {"error": f"Unsupported AI model type: {self.model_type}"}
    
    def _analyze_with_openai(self, prompt):
        """Analyze using OpenAI models"""
        if not self.openai:
            if not Config.OPENAI_API_KEY:
                return {"error": "OpenAI API key not configured"}
            self.openai = OpenAI(api_key=Config.OPENAI_API_KEY)
        
        try:
            response = self.openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a cybersecurity expert analyzing security alerts from Wazuh. Provide insightful analysis, identify patterns or suspicious activities, and suggest actionable recommendations."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1500
            )
            
            return {
                "analysis": response.choices[0].message.content,
                "model": "gpt-4o",
                "provider": "openai"
            }
        except Exception as e:
            logger.error(f"Error with OpenAI analysis: {str(e)}")
            return {"error": str(e)}
    
    def _analyze_with_deepseek(self, prompt):
        """Analyze using DeepSeek models"""
        if not Config.DEEPSEEK_API_KEY:
            return {"error": "DeepSeek API key not configured"}
        
        try:
            headers = {
                "Authorization": f"Bearer {Config.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "You are a cybersecurity expert analyzing security alerts from Wazuh. Provide insightful analysis, identify patterns or suspicious activities, and suggest actionable recommendations."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 1500
            }
            
            response = requests.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers=headers,
                json=data
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "analysis": result["choices"][0]["message"]["content"],
                    "model": "deepseek-chat",
                    "provider": "deepseek"
                }
            else:
                logger.error(f"DeepSeek API error: {response.text}")
                return {"error": f"DeepSeek API error: {response.text}"}
        except Exception as e:
            logger.error(f"Error with DeepSeek analysis: {str(e)}")
            return {"error": str(e)}
    
    def _analyze_with_ollama(self, prompt):
        """Analyze using Ollama local LLM"""
        ollama_url = Config.OLLAMA_API_URL
        
        try:
            data = {
                "model": "llama3",  # Default model, change as needed
                "prompt": prompt,
                "stream": False
            }
            
            response = requests.post(
                f"{ollama_url}/api/generate",
                json=data
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "analysis": result["response"],
                    "model": "llama3",
                    "provider": "ollama"
                }
            else:
                logger.error(f"Ollama API error: {response.text}")
                return {"error": f"Ollama API error: {response.text}"}
        except Exception as e:
            logger.error(f"Error with Ollama analysis: {str(e)}")
            return {"error": str(e)}
    
    def follow_up_question(self, previous_context, question, model_type=None):
        """
        Ask a follow-up question based on previous analysis
        
        Args:
            previous_context: Previous analysis or conversation
            question: Follow-up question
            model_type: Override the model type (optional)
            
        Returns:
            Dictionary with follow-up analysis
        """
        model = model_type or self.model_type
        
        prompt = f"""Previous analysis:
{previous_context}

Follow-up question:
{question}

Please provide a detailed answer to the follow-up question based on the previous analysis:"""
        
        if model == "openai":
            return self._analyze_with_openai(prompt)
        elif model == "deepseek":
            return self._analyze_with_deepseek(prompt)
        elif model == "ollama":
            return self._analyze_with_ollama(prompt)
        else:
            return {"error": f"Unsupported AI model type: {model}"}
