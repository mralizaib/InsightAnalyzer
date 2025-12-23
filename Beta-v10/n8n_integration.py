"""
n8n Automatic Remediation Integration

Triggers n8n workflows for automatic mitigation when high/critical alerts are detected.
Supports isolating machines, stopping services, blocking connections, and custom actions.
"""

import logging
import requests
import json
from datetime import datetime

logger = logging.getLogger(__name__)


class N8nAutomationClient:
    """Client to trigger n8n workflows for alert remediation"""
    
    def __init__(self, webhook_url=None):
        """
        Initialize n8n client
        
        Args:
            webhook_url: Base URL for n8n instance (e.g., http://n8n.example.com)
        """
        self.webhook_url = webhook_url
        self.timeout = 10
    
    def trigger_remediation_workflow(self, alert_data, policy):
        """
        Trigger n8n workflow for alert remediation
        
        Args:
            alert_data: Alert data from OpenSearch/Wazuh
            policy: RemediationPolicy object with workflow configuration
            
        Returns:
            dict with success status and workflow execution ID
        """
        if not self.webhook_url or not policy.n8n_webhook_url:
            logger.warning("n8n webhook URL not configured")
            return {"success": False, "error": "n8n not configured"}
        
        try:
            payload = {
                "alert_id": alert_data.get("alert_id", ""),
                "severity": alert_data.get("severity", ""),
                "agent_name": alert_data.get("agent_name", ""),
                "agent_ip": alert_data.get("agent_ip", ""),
                "rule_description": alert_data.get("rule_description", ""),
                "timestamp": datetime.utcnow().isoformat(),
                "action": policy.action_type,
                "parameters": json.loads(policy.action_parameters) if policy.action_parameters else {},
                "policy_id": policy.id,
                "policy_name": policy.name
            }
            
            logger.info(f"Triggering n8n workflow: {policy.name} for alert {alert_data.get('alert_id')}")
            
            # POST to n8n webhook
            response = requests.post(
                policy.n8n_webhook_url,
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code in [200, 201]:
                result = response.json() if response.text else {}
                execution_id = result.get("execution_id", "pending")
                
                logger.info(f"✅ n8n workflow triggered successfully: {execution_id}")
                return {
                    "success": True,
                    "execution_id": execution_id,
                    "message": f"Remediation workflow '{policy.name}' triggered",
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                logger.error(f"n8n webhook returned status {response.status_code}: {response.text}")
                return {
                    "success": False,
                    "error": f"n8n returned {response.status_code}",
                    "timestamp": datetime.utcnow().isoformat()
                }
                
        except requests.exceptions.Timeout:
            logger.error("n8n webhook request timed out")
            return {"success": False, "error": "Request timeout"}
        except Exception as e:
            logger.error(f"Error triggering n8n workflow: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def test_webhook(self, webhook_url):
        """Test n8n webhook connectivity"""
        try:
            test_payload = {
                "test": True,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            response = requests.post(
                webhook_url,
                json=test_payload,
                timeout=5
            )
            
            return response.status_code in [200, 201]
        except Exception as e:
            logger.error(f"Webhook test failed: {str(e)}")
            return False


class RemediationActions:
    """Available remediation action types"""
    
    ISOLATE_MACHINE = "isolate_machine"
    STOP_SERVICE = "stop_service"
    BLOCK_CONNECTIONS = "block_connections"
    KILL_PROCESS = "kill_process"
    REVOKE_CREDENTIALS = "revoke_credentials"
    BACKUP_AND_QUARANTINE = "backup_and_quarantine"
    CUSTOM_SCRIPT = "custom_script"
    
    ALL = [
        ISOLATE_MACHINE,
        STOP_SERVICE,
        BLOCK_CONNECTIONS,
        KILL_PROCESS,
        REVOKE_CREDENTIALS,
        BACKUP_AND_QUARANTINE,
        CUSTOM_SCRIPT
    ]
    
    DESCRIPTIONS = {
        ISOLATE_MACHINE: "Isolate machine from network",
        STOP_SERVICE: "Stop a specific service/process",
        BLOCK_CONNECTIONS: "Block network connections to/from machine",
        KILL_PROCESS: "Kill a specific process",
        REVOKE_CREDENTIALS: "Revoke user credentials",
        BACKUP_AND_QUARANTINE: "Backup and quarantine affected files",
        CUSTOM_SCRIPT: "Execute custom remediation script"
    }


# Create global n8n client instance
n8n_client = None


def init_n8n_client(webhook_url):
    """Initialize global n8n client"""
    global n8n_client
    n8n_client = N8nAutomationClient(webhook_url)
    return n8n_client


def get_n8n_client():
    """Get global n8n client"""
    global n8n_client
    if n8n_client is None:
        n8n_client = N8nAutomationClient()
    return n8n_client
