from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from flask_login import login_required, current_user
import logging
from datetime import datetime, timedelta
import json
from app import db
from models import AiInsightTemplate, AiInsightResult
from ai_insights import AIInsights
from opensearch_api import OpenSearchAPI

logger = logging.getLogger(__name__)

insights_bp = Blueprint('insights', __name__)

@insights_bp.route('/insights')
@login_required
def index():
    # Check if there's an action parameter indicating we should analyze
    action = request.args.get('action')
    
    # Get user's insight templates
    templates = AiInsightTemplate.query.filter_by(user_id=current_user.id).all()
    
    # If action is analyze, we should show the analyze form directly
    show_analyze_form = (action == 'analyze')
    
    return render_template('insights.html', 
                          templates=templates, 
                          show_analyze_form=show_analyze_form,
                          active_tab='analyze' if show_analyze_form else 'templates')

@insights_bp.route('/api/insights/templates', methods=['GET'])
@login_required
def get_templates():
    """Get all AI insight templates for the current user"""
    try:
        templates = AiInsightTemplate.query.filter_by(user_id=current_user.id).all()
        
        templates_list = []
        for template in templates:
            templates_list.append({
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'fields': template.get_fields(),
                'model_type': template.model_type,
                'created_at': template.created_at.isoformat()
            })
        
        return jsonify(templates_list)
    except Exception as e:
        logger.error(f"Error getting insight templates: {str(e)}")
        return jsonify({'error': str(e)}), 500

@insights_bp.route('/api/insights/templates', methods=['POST'])
@login_required
def create_template():
    """Create a new AI insight template"""
    try:
        data = request.json
        
        # Validate required fields
        if not data.get('name'):
            return jsonify({'error': 'Template name is required'}), 400
        
        if not data.get('fields'):
            return jsonify({'error': 'At least one field must be selected'}), 400
        
        # Create new template
        new_template = AiInsightTemplate(
            user_id=current_user.id,
            name=data.get('name'),
            description=data.get('description', ''),
            model_type=data.get('model_type', 'openai')
        )
        
        # Set JSON fields
        new_template.set_fields(data.get('fields'))
        
        # Save to database
        db.session.add(new_template)
        db.session.commit()
        
        return jsonify({
            'id': new_template.id,
            'name': new_template.name,
            'message': 'AI insight template created successfully'
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating insight template: {str(e)}")
        return jsonify({'error': str(e)}), 500

@insights_bp.route('/api/insights/templates/<int:template_id>', methods=['PUT'])
@login_required
def update_template(template_id):
    """Update an existing AI insight template"""
    try:
        template = AiInsightTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
        
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        data = request.json
        
        # Update fields if provided
        if 'name' in data:
            template.name = data['name']
        
        if 'description' in data:
            template.description = data['description']
        
        if 'fields' in data:
            template.set_fields(data['fields'])
        
        if 'model_type' in data:
            template.model_type = data['model_type']
        
        # Save changes
        db.session.commit()
        
        return jsonify({
            'id': template.id,
            'message': 'AI insight template updated successfully'
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating insight template: {str(e)}")
        return jsonify({'error': str(e)}), 500

@insights_bp.route('/api/insights/templates/<int:template_id>', methods=['DELETE'])
@login_required
def delete_template(template_id):
    """Delete an AI insight template"""
    try:
        template = AiInsightTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
        
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        # Get associated results
        results = AiInsightResult.query.filter_by(template_id=template_id).all()
        
        # Delete results first
        for result in results:
            db.session.delete(result)
        
        # Delete template
        db.session.delete(template)
        db.session.commit()
        
        return jsonify({
            'message': 'AI insight template deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting insight template: {str(e)}")
        return jsonify({'error': str(e)}), 500

@insights_bp.route('/api/insights/analyze', methods=['POST'])
@login_required
def analyze_data():
    """Analyze data using AI insights"""
    try:
        data = request.json
        
        # Get template if specified
        template_id = data.get('template_id')
        template = None
        
        if template_id:
            template = AiInsightTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
            
            if not template:
                return jsonify({'error': 'Template not found'}), 404
        
        # Get data to analyze
        alert_ids = data.get('alert_ids', [])
        severity_levels = data.get('severity_levels', [])
        time_range = data.get('time_range', '24h')
        custom_prompt = data.get('custom_prompt')
        
        # Choose analysis model
        model_type = data.get('model_type', 'openai')
        if template:
            model_type = template.model_type
        
        # Initialize AI insights
        ai = AIInsights(model_type=model_type)
        
        # Get data to analyze
        opensearch = OpenSearchAPI()
        alerts_data = []
        
        if alert_ids:
            # Get specific alerts by IDs
            for alert_id in alert_ids:
                alert = opensearch.get_alert_by_id(alert_id)
                if 'error' not in alert:
                    alerts_data.append(alert)
        elif severity_levels:
            # Get alerts by severity levels and time range
            end_time = datetime.utcnow().isoformat()
            
            if time_range == '1h':
                start_time = (datetime.utcnow() - timedelta(hours=1)).isoformat()
            elif time_range == '6h':
                start_time = (datetime.utcnow() - timedelta(hours=6)).isoformat()
            elif time_range == '24h':
                start_time = (datetime.utcnow() - timedelta(days=1)).isoformat()
            elif time_range == '7d':
                start_time = (datetime.utcnow() - timedelta(days=7)).isoformat()
            elif time_range == '30d':
                start_time = (datetime.utcnow() - timedelta(days=30)).isoformat()
            else:
                # Custom time range
                start_time = data.get('start_time')
                end_time = data.get('end_time', end_time)
            
            # Fetch alerts
            results = opensearch.search_alerts(
                severity_levels=severity_levels,
                start_time=start_time,
                end_time=end_time,
                limit=100
            )
            
            if 'error' not in results:
                alerts_data = results.get('results', [])
        else:
            return jsonify({'error': 'No data specified for analysis'}), 400
        
        if not alerts_data:
            return jsonify({'error': 'No alerts found matching criteria'}), 404
        
        # Extract fields if template is specified
        fields = None
        if template:
            fields = template.get_fields()
        
        # Run analysis
        analysis_result = ai.analyze_alerts(
            alerts_data=alerts_data,
            analysis_prompt=custom_prompt,
            fields=fields
        )
        
        if 'error' in analysis_result:
            return jsonify({'error': analysis_result['error']}), 500
        
        # Save result if template is specified
        if template:
            result = AiInsightResult(
                template_id=template.id,
                data_source=json.dumps(alerts_data),
                result=analysis_result['analysis']
            )
            
            db.session.add(result)
            db.session.commit()
            
            # Add result ID to response
            analysis_result['result_id'] = result.id
        
        return jsonify(analysis_result)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error analyzing data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@insights_bp.route('/api/insights/results/<int:result_id>', methods=['GET'])
@login_required
def get_result(result_id):
    """Get a specific analysis result"""
    try:
        # Get result and verify ownership
        result = AiInsightResult.query.join(AiInsightTemplate).filter(
            AiInsightResult.id == result_id,
            AiInsightTemplate.user_id == current_user.id
        ).first()
        
        if not result:
            return jsonify({'error': 'Result not found'}), 404
        
        # Get template
        template = AiInsightTemplate.query.get(result.template_id)
        
        response = {
            'id': result.id,
            'template_id': result.template_id,
            'template_name': template.name,
            'result': result.result,
            'rating': result.rating,
            'follow_up_questions': result.get_follow_up_questions(),
            'created_at': result.created_at.isoformat(),
            'model_type': template.model_type
        }
        
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error getting result: {str(e)}")
        return jsonify({'error': str(e)}), 500

@insights_bp.route('/api/insights/follow-up', methods=['POST'])
@login_required
def general_follow_up():
    """Ask a follow-up question without a specific saved result"""
    try:
        # Get question and context from request
        data = request.json
        question = data.get('question')
        previous_context = data.get('context')
        
        if not question:
            return jsonify({'error': 'Question is required'}), 400
            
        if not previous_context:
            return jsonify({'error': 'Previous context is required'}), 400
        
        # Initialize AI insights with default model
        ai = AIInsights(model_type='openai')
        
        # Get follow-up answer
        follow_up_result = ai.follow_up_question(
            previous_context=previous_context,
            question=question
        )
        
        if 'error' in follow_up_result:
            return jsonify({'error': follow_up_result['error']}), 500
        
        # Return answer
        return jsonify({
            'question': question,
            'answer': follow_up_result['analysis']
        })
    except Exception as e:
        logger.error(f"Error asking general follow-up: {str(e)}")
        return jsonify({'error': str(e)}), 500

@insights_bp.route('/api/insights/results/<int:result_id>/follow-up', methods=['POST'])
@login_required
def ask_follow_up(result_id):
    """Ask a follow-up question for an analysis result"""
    try:
        # Get result and verify ownership
        result = AiInsightResult.query.join(AiInsightTemplate).filter(
            AiInsightResult.id == result_id,
            AiInsightTemplate.user_id == current_user.id
        ).first()
        
        if not result:
            return jsonify({'error': 'Result not found'}), 404
        
        # Get question from request
        data = request.json
        question = data.get('question')
        
        if not question:
            return jsonify({'error': 'Question is required'}), 400
        
        # Get template for model type
        template = AiInsightTemplate.query.get(result.template_id)
        
        # Initialize AI insights with the same model
        ai = AIInsights(model_type=template.model_type)
        
        # Get follow-up answer
        follow_up_result = ai.follow_up_question(
            previous_context=result.result,
            question=question
        )
        
        if 'error' in follow_up_result:
            return jsonify({'error': follow_up_result['error']}), 500
        
        # Save follow-up to result
        result.add_follow_up(question, follow_up_result['analysis'])
        db.session.commit()
        
        # Return updated result
        return jsonify({
            'question': question,
            'answer': follow_up_result['analysis'],
            'follow_up_questions': result.get_follow_up_questions()
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error asking follow-up: {str(e)}")
        return jsonify({'error': str(e)}), 500

@insights_bp.route('/api/insights/results/<int:result_id>/rate', methods=['POST'])
@login_required
def rate_result(result_id):
    """Rate an analysis result"""
    try:
        # Get result and verify ownership
        result = AiInsightResult.query.join(AiInsightTemplate).filter(
            AiInsightResult.id == result_id,
            AiInsightTemplate.user_id == current_user.id
        ).first()
        
        if not result:
            return jsonify({'error': 'Result not found'}), 404
        
        # Get rating from request
        data = request.json
        rating = data.get('rating')
        
        if rating is None:
            return jsonify({'error': 'Rating is required'}), 400
        
        # Validate rating
        try:
            rating = float(rating)
            if rating < 0 or rating > 5:
                return jsonify({'error': 'Rating must be between 0 and 5'}), 400
        except ValueError:
            return jsonify({'error': 'Rating must be a number'}), 400
        
        # Update rating
        result.rating = rating
        db.session.commit()
        
        return jsonify({
            'id': result.id,
            'rating': result.rating,
            'message': 'Rating updated successfully'
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error rating result: {str(e)}")
        return jsonify({'error': str(e)}), 500
