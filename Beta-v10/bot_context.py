import logging
import json
from datetime import datetime, timedelta
from opensearch_api import OpenSearchAPI
from wazuh_api import WazuhAPI
from ai_insights import AIInsights
from langdetect import detect, LangDetectException

logger = logging.getLogger(__name__)


class BotContextProvider:
    """Provides context-aware data from Wazuh, OpenSearch, and Database for the AI bot."""
    
    def __init__(self):
        self.opensearch = OpenSearchAPI()
        self.wazuh = WazuhAPI()
        self.ai = AIInsights(model_type="openai")
    
    def get_recent_alerts_context(self, hours=24, limit=10):
        """Get recent alerts as context for bot responses."""
        try:
            end_time = datetime.utcnow().isoformat()
            start_time = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
            
            result = self.opensearch.search_alerts(
                start_time=start_time,
                end_time=end_time,
                limit=limit
            )
            
            alerts = result.get('results', [])
            if not alerts:
                return {"count": 0, "alerts": [], "summary": "No recent alerts"}
            
            formatted_alerts = []
            for alert in alerts[:5]:  # Limit to 5 for context
                source = alert.get('source', {})
                formatted_alerts.append({
                    "timestamp": source.get('@timestamp'),
                    "agent": source.get('agent', {}).get('name'),
                    "rule": source.get('rule', {}).get('description'),
                    "level": source.get('rule', {}).get('level'),
                    "ip": source.get('agent', {}).get('ip')
                })
            
            return {
                "count": len(alerts),
                "alerts": formatted_alerts,
                "summary": f"Found {len(alerts)} alerts in the last {hours} hours"
            }
        except Exception as e:
            logger.error(f"Error getting alerts context: {str(e)}")
            return {"count": 0, "alerts": [], "error": str(e)}
    
    def get_critical_alerts_context(self):
        """Get critical and high severity alerts."""
        try:
            end_time = datetime.utcnow().isoformat()
            start_time = (datetime.utcnow() - timedelta(hours=24)).isoformat()
            
            result = self.opensearch.search_alerts(
                severity_levels=['critical', 'high'],
                start_time=start_time,
                end_time=end_time,
                limit=5
            )
            
            alerts = result.get('results', [])
            return {
                "count": len(alerts),
                "alerts": [a.get('source', {}) for a in alerts],
                "summary": f"{len(alerts)} critical/high alerts found"
            }
        except Exception as e:
            logger.error(f"Error getting critical alerts: {str(e)}")
            return {"count": 0, "alerts": [], "error": str(e)}
    
    def get_agent_context(self):
        """Get agent status information."""
        try:
            agents_data = self.wazuh.get_agents({"limit": 100})
            
            if not agents_data or 'data' not in agents_data:
                return {"total": 0, "active": 0, "disconnected": 0}
            
            agents = agents_data.get('data', {}).get('affected_items', [])
            active = sum(1 for a in agents if a.get('status') == 'active')
            disconnected = sum(1 for a in agents if a.get('status') == 'disconnected')
            
            return {
                "total": len(agents),
                "active": active,
                "disconnected": disconnected,
                "summary": f"{active} active agents, {disconnected} disconnected out of {len(agents)} total"
            }
        except Exception as e:
            logger.error(f"Error getting agent context: {str(e)}")
            return {"total": 0, "active": 0, "disconnected": 0, "error": str(e)}
    
    def get_security_summary(self):
        """Get a comprehensive security summary."""
        try:
            end_time = datetime.utcnow().isoformat()
            start_time = (datetime.utcnow() - timedelta(days=1)).isoformat()
            
            alert_counts = self.opensearch.get_alert_count_by_severity(start_time, end_time)
            agents_info = self.get_agent_context()
            
            summary = f"""Security Summary (Last 24 hours):
- Critical Alerts: {alert_counts.get('critical', 0)}
- High Severity: {alert_counts.get('high', 0)}
- Medium Severity: {alert_counts.get('medium', 0)}
- Low Severity: {alert_counts.get('low', 0)}
- Agent Status: {agents_info.get('active', 0)} active, {agents_info.get('disconnected', 0)} disconnected
"""
            
            return {
                "success": True,
                "summary": summary,
                "alert_counts": alert_counts,
                "agent_info": agents_info
            }
        except Exception as e:
            logger.error(f"Error getting security summary: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def get_database_alerts(self, hours=24, limit=10, severity=None):
        """Get alerts from the local database."""
        try:
            from models import Alert
            
            alerts = Alert.get_recent_alerts(hours=hours, limit=limit, severity=severity)
            formatted_alerts = [alert.to_dict() for alert in alerts]
            
            return {
                "count": len(formatted_alerts),
                "alerts": formatted_alerts,
                "source": "database",
                "summary": f"Found {len(formatted_alerts)} alerts in database from last {hours} hours"
            }
        except Exception as e:
            logger.error(f"Error getting database alerts: {str(e)}")
            return {"count": 0, "alerts": [], "error": str(e), "source": "database"}
    
    def get_database_alerts_by_severity(self, severity, hours=24, limit=10):
        """Get alerts from database by severity level."""
        try:
            from models import Alert
            
            if isinstance(severity, str):
                severity = [severity]
            
            alerts = Alert.get_recent_alerts(hours=hours, limit=limit, severity=severity)
            formatted_alerts = [alert.to_dict() for alert in alerts]
            
            return {
                "count": len(formatted_alerts),
                "alerts": formatted_alerts,
                "severity": severity,
                "summary": f"Found {len(formatted_alerts)} {severity} severity alerts in database"
            }
        except Exception as e:
            logger.error(f"Error getting database alerts by severity: {str(e)}")
            return {"count": 0, "alerts": [], "error": str(e)}
    
    def get_database_alert_statistics(self, hours=24):
        """Get alert statistics from database."""
        try:
            from models import Alert
            
            counts = Alert.get_alert_count_by_severity(hours=hours)
            total = sum(counts.values())
            
            return {
                "total": total,
                "critical": counts.get('critical', 0),
                "high": counts.get('high', 0),
                "medium": counts.get('medium', 0),
                "low": counts.get('low', 0),
                "period_hours": hours,
                "source": "database"
            }
        except Exception as e:
            logger.error(f"Error getting database alert statistics: {str(e)}")
            return {"error": str(e), "source": "database"}
    
    def save_alert_to_database(self, alert_data):
        """Save an alert to the database."""
        try:
            from models import Alert, db
            
            # Check if alert already exists
            existing = Alert.query.filter_by(alert_id=alert_data.get('alert_id')).first()
            if existing:
                return {"success": False, "message": "Alert already exists in database"}
            
            alert = Alert(
                alert_id=alert_data.get('alert_id'),
                timestamp=datetime.fromisoformat(alert_data.get('timestamp', datetime.utcnow().isoformat())),
                severity=alert_data.get('severity', 'low'),
                rule_id=alert_data.get('rule_id'),
                rule_description=alert_data.get('rule_description'),
                agent_name=alert_data.get('agent_name'),
                agent_ip=alert_data.get('agent_ip'),
                agent_id=alert_data.get('agent_id'),
                source=alert_data.get('source', 'manual'),
                full_alert=json.dumps(alert_data) if alert_data else None
            )
            
            db.session.add(alert)
            db.session.commit()
            
            return {"success": True, "alert_id": alert.id, "message": "Alert saved to database"}
        except Exception as e:
            logger.error(f"Error saving alert to database: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def detect_language(self, text):
        """Detect the language of the input text."""
        try:
            lang_code = detect(text)
            # Map language codes to full names (includes Punjabi, Sindhi, Urdu)
            lang_map = {
                'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
                'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
                'zh-cn': 'Simplified Chinese', 'zh-tw': 'Traditional Chinese', 'ar': 'Arabic',
                'hi': 'Hindi', 'ko': 'Korean', 'tr': 'Turkish', 'vi': 'Vietnamese',
                'pa': 'Punjabi', 'sd': 'Sindhi', 'ur': 'Urdu'
            }
            return lang_code, lang_map.get(lang_code, lang_code)
        except LangDetectException:
            return 'en', 'English'
    
    def translate_text(self, text, target_language):
        """Translate text to target language using OpenAI."""
        try:
            if target_language.lower() == 'english' or target_language == 'en':
                return text  # No translation needed
            
            prompt = f"Translate the following text to {target_language}. Only provide the translation, nothing else:\n\n{text}"
            response = self.ai.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1000
            )
            
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Error translating text: {str(e)}")
            return text  # Return original if translation fails
    
    def answer_security_question(self, question, language=None):
        """Answer a security question using AI with context from Wazuh/OpenSearch/Database."""
        try:
            # Detect language if not provided
            if not language:
                lang_code, language = self.detect_language(question)
            else:
                lang_code = language
            
            # Gather context from all sources
            context = {
                "database_alerts": self.get_database_alerts(hours=24, limit=5),
                "database_stats": self.get_database_alert_statistics(hours=24),
                "recent_alerts": self.get_recent_alerts_context(hours=24, limit=5),
                "critical_alerts": self.get_critical_alerts_context(),
                "agent_status": self.get_agent_context()
            }
            
            # Ask AI with context (in English for better AI responses)
            response = self.ai.ask_wazuh_question(question, context_data=context)
            
            # Translate response to user's language if needed
            if language and language.lower() != 'english':
                if 'answer' in response:
                    response['answer'] = self.translate_text(response['answer'], language)
                if 'summary' in response:
                    response['summary'] = self.translate_text(response['summary'], language)
            
            # Add language info to response
            response['detected_language'] = language
            response['language_code'] = lang_code
            
            return response
        except Exception as e:
            logger.error(f"Error answering question: {str(e)}")
            return {"error": str(e)}


# Create a global instance
bot_context = BotContextProvider()
