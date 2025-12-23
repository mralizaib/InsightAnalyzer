from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.orm import DeclarativeBase
import json

class Base(DeclarativeBase):
    pass

# Initialize SQLAlchemy with the Base class
db = SQLAlchemy(model_class=Base)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    role = db.Column(db.String(20), default='agent')  # 'admin' or 'agent'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship with other models
    alert_configs = db.relationship('AlertConfig', backref='user', lazy='dynamic')
    report_configs = db.relationship('ReportConfig', backref='user', lazy='dynamic')
    ai_templates = db.relationship('AiInsightTemplate', backref='user', lazy='dynamic')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def is_admin(self):
        return self.role == 'admin'
    
    def __repr__(self):
        return f'<User {self.username}>'

class AlertConfig(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    alert_levels = db.Column(db.String(100), nullable=False)  # JSON string of levels: ['critical', 'high', etc.]
    email_recipient = db.Column(db.String(120), nullable=False)
    notify_time = db.Column(db.String(50))  # Time of day for notification
    enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    include_fields = db.Column(db.String(500))  # JSON string of fields to include in the alert
    
    def get_alert_levels(self):
        if self.alert_levels:
            return json.loads(self.alert_levels)
        return []
    
    def set_alert_levels(self, levels):
        self.alert_levels = json.dumps(levels)
        
    def get_include_fields(self):
        if self.include_fields:
            return json.loads(self.include_fields)
        return ["@timestamp", "agent.ip", "agent.labels.location.set", "agent.name", "rule.description", "rule.id"]
    
    def set_include_fields(self, fields):
        self.include_fields = json.dumps(fields)
    
    def __repr__(self):
        return f'<AlertConfig {self.name}>'

class ReportConfig(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    severity_levels = db.Column(db.String(100), nullable=False)  # JSON string
    format = db.Column(db.String(10), default='pdf')  # 'pdf' or 'html'
    schedule = db.Column(db.String(50))  # 'daily', 'weekly', etc.
    schedule_time = db.Column(db.String(50))  # Time of day
    recipients = db.Column(db.String(500))  # JSON string of email addresses
    enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def get_severity_levels(self):
        return json.loads(self.severity_levels)
    
    def set_severity_levels(self, levels):
        self.severity_levels = json.dumps(levels)
    
    def get_recipients(self):
        return json.loads(self.recipients)
    
    def set_recipients(self, recipients):
        self.recipients = json.dumps(recipients)
    
    def __repr__(self):
        return f'<ReportConfig {self.name}>'

class AiInsightTemplate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    fields = db.Column(db.Text)  # JSON string of fields to analyze
    model_type = db.Column(db.String(50), default='openai')  # 'openai', 'deepseek', 'ollama'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def get_fields(self):
        return json.loads(self.fields)
    
    def set_fields(self, fields):
        self.fields = json.dumps(fields)
    
    def __repr__(self):
        return f'<AiInsightTemplate {self.name}>'

class AiInsightResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('ai_insight_template.id'), nullable=False)
    data_source = db.Column(db.Text)  # Source data used for analysis
    result = db.Column(db.Text)  # AI analysis result
    rating = db.Column(db.Float)  # User-provided rating
    follow_up_questions = db.Column(db.Text)  # JSON string of follow-up questions and answers
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    template = db.relationship('AiInsightTemplate', backref='results')
    
    def get_follow_up_questions(self):
        if self.follow_up_questions:
            return json.loads(self.follow_up_questions)
        return []
    
    def add_follow_up(self, question, answer):
        follow_ups = self.get_follow_up_questions()
        follow_ups.append({'question': question, 'answer': answer, 'timestamp': datetime.utcnow().isoformat()})
        self.follow_up_questions = json.dumps(follow_ups)
    
    def __repr__(self):
        return f'<AiInsightResult for template {self.template_id}>'


class RetentionPolicy(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    
    # Data Source
    source_type = db.Column(db.String(20), nullable=False)  # 'wazuh', 'opensearch', 'database'
    
    # Retention settings
    retention_days = db.Column(db.Integer, nullable=False)  # Number of days to retain data
    
    # Data filtering
    severity_levels = db.Column(db.String(100))  # JSON string ['critical', 'high', etc.]
    rule_ids = db.Column(db.Text)  # JSON string of rule IDs to include
    
    # Schedule
    cron_schedule = db.Column(db.String(100))  # Cron expression for scheduling
    last_run = db.Column(db.DateTime)  # Last execution timestamp
    
    # Status
    enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship back to user
    user = db.relationship('User', backref='retention_policies')
    
    def get_severity_levels(self):
        if self.severity_levels:
            return json.loads(self.severity_levels)
        return []
    
    def set_severity_levels(self, levels):
        self.severity_levels = json.dumps(levels)
    
    def get_rule_ids(self):
        if self.rule_ids:
            return json.loads(self.rule_ids)
        return []
    
    def set_rule_ids(self, rule_ids):
        self.rule_ids = json.dumps(rule_ids)
    
    def __repr__(self):
        return f'<RetentionPolicy {self.name} for {self.source_type}>'


class SentAlert(db.Model):
    """Track already sent alerts to prevent duplicates"""
    id = db.Column(db.Integer, primary_key=True)
    alert_config_id = db.Column(db.Integer, db.ForeignKey('alert_config.id'), nullable=False)
    alert_identifier = db.Column(db.String(500), nullable=False)  # Hash of unique alert identifiers
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Define relationship to AlertConfig
    alert_config = db.relationship('AlertConfig', backref='sent_alerts')
    
    def __repr__(self):
        return f'<SentAlert {self.alert_identifier[:10]}... for config {self.alert_config_id}>'


class RemediationPolicy(db.Model):
    """
    Define automatic remediation policies for high/critical alerts
    Triggers n8n workflows when matching alerts are detected
    """
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    
    # Alert matching criteria
    severity_levels = db.Column(db.String(100), nullable=False)  # JSON: ['critical', 'high']
    rule_ids = db.Column(db.Text)  # JSON: comma-separated rule IDs (optional)
    agent_names = db.Column(db.Text)  # JSON: agent name patterns (optional)
    
    # n8n Workflow configuration
    n8n_webhook_url = db.Column(db.String(500), nullable=False)  # n8n webhook URL
    action_type = db.Column(db.String(50), nullable=False)  # isolate, stop_service, block_connections, etc.
    action_parameters = db.Column(db.Text)  # JSON: Additional parameters for the action
    
    # Execution settings
    auto_execute = db.Column(db.Boolean, default=False)  # Auto-execute or require approval
    enabled = db.Column(db.Boolean, default=True)
    
    # Status tracking
    last_triggered = db.Column(db.DateTime)
    execution_count = db.Column(db.Integer, default=0)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    user = db.relationship('User', backref='remediation_policies')
    
    def get_severity_levels(self):
        if self.severity_levels:
            return json.loads(self.severity_levels)
        return []
    
    def set_severity_levels(self, levels):
        self.severity_levels = json.dumps(levels)
    
    def get_action_parameters(self):
        if self.action_parameters:
            return json.loads(self.action_parameters)
        return {}
    
    def set_action_parameters(self, params):
        self.action_parameters = json.dumps(params)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'severity_levels': self.get_severity_levels(),
            'action_type': self.action_type,
            'auto_execute': self.auto_execute,
            'enabled': self.enabled,
            'execution_count': self.execution_count,
            'last_triggered': self.last_triggered.isoformat() if self.last_triggered else None
        }
    
    def __repr__(self):
        return f'<RemediationPolicy {self.name} - {self.action_type}>'


class RemediationExecution(db.Model):
    """
    Track remediation workflow executions for auditing and history
    """
    id = db.Column(db.Integer, primary_key=True)
    policy_id = db.Column(db.Integer, db.ForeignKey('remediation_policy.id'), nullable=False)
    alert_id = db.Column(db.String(200))
    
    status = db.Column(db.String(50))  # pending, in_progress, success, failed
    n8n_execution_id = db.Column(db.String(200))
    
    request_payload = db.Column(db.Text)  # JSON
    response_payload = db.Column(db.Text)  # JSON
    error_message = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    # Relationship
    policy = db.relationship('RemediationPolicy', backref='executions')
    
    def __repr__(self):
        return f'<RemediationExecution {self.id} - {self.status}>'


class Alert(db.Model):
    """
    Store security alerts from Wazuh/OpenSearch in the database.
    
    This allows the AI bot to query alerts directly from the database
    and provide context-aware responses based on actual alert logs.
    """
    id = db.Column(db.Integer, primary_key=True)
    alert_id = db.Column(db.String(200), unique=True)  # Unique ID from OpenSearch/Wazuh
    timestamp = db.Column(db.DateTime, nullable=False, index=True)
    severity = db.Column(db.String(20), nullable=False, index=True)  # critical, high, medium, low
    rule_id = db.Column(db.String(100), index=True)
    rule_description = db.Column(db.Text)
    agent_name = db.Column(db.String(200), index=True)
    agent_ip = db.Column(db.String(50), index=True)
    agent_id = db.Column(db.String(100), index=True)
    
    # Alert details as JSON for flexibility
    full_alert = db.Column(db.Text)  # JSON string of complete alert data
    
    # Metadata
    source = db.Column(db.String(50), default='opensearch')  # 'wazuh' or 'opensearch'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        """Convert alert to dictionary"""
        try:
            full_data = json.loads(self.full_alert) if self.full_alert else {}
        except:
            full_data = {}
        
        return {
            'id': self.id,
            'alert_id': self.alert_id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'severity': self.severity,
            'rule_id': self.rule_id,
            'rule_description': self.rule_description,
            'agent_name': self.agent_name,
            'agent_ip': self.agent_ip,
            'agent_id': self.agent_id,
            'source': self.source,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'full_alert': full_data
        }
    
    @staticmethod
    def get_recent_alerts(hours=24, limit=10, severity=None):
        """Get recent alerts from the database"""
        query = Alert.query
        
        if severity:
            if isinstance(severity, list):
                query = query.filter(Alert.severity.in_(severity))
            else:
                query = query.filter(Alert.severity == severity)
        
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        query = query.filter(Alert.timestamp >= cutoff_time)
        
        return query.order_by(Alert.timestamp.desc()).limit(limit).all()
    
    @staticmethod
    def get_alerts_by_severity(severity, hours=24, limit=10):
        """Get alerts by severity level"""
        return Alert.get_recent_alerts(hours=hours, limit=limit, severity=severity)
    
    @staticmethod
    def get_alert_count_by_severity(hours=24):
        """Get count of alerts by severity level"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        return {
            'critical': Alert.query.filter(Alert.severity == 'critical', Alert.timestamp >= cutoff_time).count(),
            'high': Alert.query.filter(Alert.severity == 'high', Alert.timestamp >= cutoff_time).count(),
            'medium': Alert.query.filter(Alert.severity == 'medium', Alert.timestamp >= cutoff_time).count(),
            'low': Alert.query.filter(Alert.severity == 'low', Alert.timestamp >= cutoff_time).count(),
        }
    
    def __repr__(self):
        return f'<Alert {self.alert_id} - {self.severity} at {self.timestamp}>'


class SystemConfig(db.Model):
    """
    Store global system configuration settings
    
    This model stores key-value pairs for system-wide configuration settings
    like refresh intervals, default values, and other app settings.
    """
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @staticmethod
    def get_value(key, default=None):
        """Get a configuration value by key with an optional default"""
        config = SystemConfig.query.filter_by(key=key).first()
        if config:
            return config.value
        return default
    
    @staticmethod
    def set_value(key, value, description=None):
        """Set a configuration value, creating it if it doesn't exist"""
        config = SystemConfig.query.filter_by(key=key).first()
        if config:
            config.value = value
            config.updated_at = datetime.utcnow()
        else:
            config = SystemConfig(key=key, value=value, description=description)
            db.session.add(config)
        db.session.commit()
        return config
    
    def __repr__(self):
        return f'<SystemConfig {self.key}={self.value}>'
