from flask import Blueprint, render_template, jsonify, request, flash, current_app
from flask_login import login_required, current_user
import logging
from datetime import datetime, timedelta
from opensearch_api import OpenSearchAPI
from wazuh_api import WazuhAPI

logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/dashboard')
@login_required
def index():
    return render_template('dashboard.html')

@dashboard_bp.route('/api/dashboard/stats')
@login_required
def dashboard_stats():
    """Get dashboard statistics"""
    try:
        opensearch = OpenSearchAPI()
        wazuh = WazuhAPI()
        
        # Get days parameter from request (default to 1 day)
        days = int(request.args.get('days', 1))
        
        # Define time range
        end_time = datetime.utcnow().isoformat()
        start_time = (datetime.utcnow() - timedelta(days=days)).isoformat()
        
        # Get alert counts by severity
        alert_counts = opensearch.get_alert_count_by_severity(
            start_time=start_time,
            end_time=end_time
        )
        
        # Get recent alerts (with time range matching other dashboard elements)
        recent_alerts = opensearch.search_alerts(
            start_time=start_time,
            end_time=end_time,
            limit=10,
            sort_field="@timestamp",
            sort_order="desc"
        )
        
        # Get agents status
        agents_status = wazuh.get_agents({"limit": 500})
        
        # Calculate agent statistics
        agent_stats = {
            'total': 0,
            'active': 0,
            'disconnected': 0,
            'never_connected': 0
        }
        
        if 'data' in agents_status and 'affected_items' in agents_status['data']:
            agents = agents_status['data']['affected_items']
            agent_stats['total'] = len(agents)
            
            for agent in agents:
                status = agent.get('status', '')
                if status == 'active':
                    agent_stats['active'] += 1
                elif status == 'disconnected':
                    agent_stats['disconnected'] += 1
                elif status == 'never_connected':
                    agent_stats['never_connected'] += 1
        
        # Return combined data
        return jsonify({
            'alert_counts': alert_counts,
            'agent_stats': agent_stats,
            'recent_alerts': recent_alerts.get('results', []),
            'time_range': {
                'start': start_time,
                'end': end_time
            }
        })
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {str(e)}")
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/api/dashboard/threat_analysis')
@login_required
def threat_analysis():
    """Get high severity threats by type and location"""
    try:
        opensearch = OpenSearchAPI()
        
        # Define time range (last 24 hours)
        end_time = datetime.utcnow().isoformat()
        start_time = (datetime.utcnow() - timedelta(days=1)).isoformat()
        
        # Get high severity threats from OpenSearch
        threat_data = opensearch.get_high_severity_by_threat_type(
            start_time=start_time,
            end_time=end_time
        )
        
        return jsonify(threat_data)
        
    except Exception as e:
        logger.error(f"Error getting threat analysis: {str(e)}")
        return jsonify({"error": str(e)}), 500

@dashboard_bp.route('/api/dashboard/alerts_timeline')
@login_required
def alerts_timeline():
    """Get alert counts over time for the timeline chart"""
    try:
        opensearch = OpenSearchAPI()
        
        # Define time range (last 24 hours by default)
        days = int(request.args.get('days', 1))
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)
        
        interval = '1h'  # Default interval is 1 hour
        if days > 7:
            interval = '1d'  # Use 1 day interval for longer time periods
        
        # Build the search query
        body = {
            "size": 0,
            "query": {
                "bool": {
                    "filter": [
                        {
                            "range": {
                                "@timestamp": {
                                    "gte": start_time.isoformat(),
                                    "lte": end_time.isoformat()
                                }
                            }
                        }
                    ]
                }
            },
            "aggs": {
                "alerts_over_time": {
                    "date_histogram": {
                        "field": "@timestamp",
                        "interval": interval
                    },
                    "aggs": {
                        "severity": {
                            "range": {
                                "field": "rule.level",
                                "ranges": [
                                    {"to": 1, "key": "none"},
                                    {"from": 1, "to": 7, "key": "low"},     # Levels 1-6
                                    {"from": 7, "to": 12, "key": "medium"}, # Levels 7-11
                                    {"from": 12, "to": 15, "key": "high"},  # Levels 12-14
                                    {"from": 15, "key": "critical"}         # Level 15
                                ]
                            }
                        }
                    }
                }
            }
        }
        
        # Execute the search
        response = opensearch.client.search(
            body=body,
            index=opensearch.index_pattern
        )
        
        # Process the results
        timeline_data = []
        if 'aggregations' in response and 'alerts_over_time' in response['aggregations']:
            buckets = response['aggregations']['alerts_over_time']['buckets']
            
            for bucket in buckets:
                timestamp = bucket['key_as_string']
                severity_buckets = bucket['severity']['buckets']
                
                data_point = {
                    'timestamp': timestamp,
                    'total': bucket['doc_count']
                }
                
                # Add counts for each severity level
                for severity in severity_buckets:
                    data_point[severity['key']] = severity['doc_count']
                
                timeline_data.append(data_point)
        
        return jsonify(timeline_data)
    except Exception as e:
        logger.error(f"Error fetching alerts timeline: {str(e)}")
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/api/dashboard/top_rules')
@login_required
def top_rules():
    """Get top triggered rules"""
    try:
        opensearch = OpenSearchAPI()
        
        # Define time range (last 24 hours by default)
        days = int(request.args.get('days', 1))
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)
        
        # Build the search query
        body = {
            "size": 0,
            "query": {
                "bool": {
                    "filter": [
                        {
                            "range": {
                                "@timestamp": {
                                    "gte": start_time.isoformat(),
                                    "lte": end_time.isoformat()
                                }
                            }
                        }
                    ]
                }
            },
            "aggs": {
                "rule_id": {
                    "terms": {
                        "field": "rule.id",
                        "size": 10
                    },
                    "aggs": {
                        "rule_description": {
                            "terms": {
                                "field": "rule.description",
                                "size": 1
                            }
                        },
                        "rule_level": {
                            "terms": {
                                "field": "rule.level",
                                "size": 1
                            }
                        }
                    }
                }
            }
        }
        
        # Execute the search
        response = opensearch.client.search(
            body=body,
            index=opensearch.index_pattern
        )
        
        # Process the results
        top_rules = []
        if 'aggregations' in response and 'rule_id' in response['aggregations']:
            buckets = response['aggregations']['rule_id']['buckets']
            
            for bucket in buckets:
                rule_id = bucket['key']
                count = bucket['doc_count']
                
                # Get rule description and level from sub-aggregations
                description = "N/A"
                if bucket['rule_description']['buckets']:
                    description = bucket['rule_description']['buckets'][0]['key']
                
                level = 0
                if bucket['rule_level']['buckets']:
                    level = bucket['rule_level']['buckets'][0]['key']
                
                top_rules.append({
                    'rule_id': rule_id,
                    'description': description,
                    'level': level,
                    'count': count
                })
        
        return jsonify(top_rules)
    except Exception as e:
        logger.error(f"Error fetching top rules: {str(e)}")
        return jsonify({'error': str(e)}), 500
