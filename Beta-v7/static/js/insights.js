/**
 * Insights JavaScript - AZ Sentinel X
 * Handles AI-driven insights, analysis templates, and results
 */

document.addEventListener('DOMContentLoaded', function() {
    // Load insight templates
    loadInsightTemplates();
    
    // Set up event listeners
    const createTemplateForm = document.getElementById('create-template-form');
    if (createTemplateForm) {
        createTemplateForm.addEventListener('submit', handleCreateTemplate);
    }
    
    const analyzeForm = document.getElementById('analyze-form');
    if (analyzeForm) {
        analyzeForm.addEventListener('submit', handleAnalyze);
    }
    
    // Toggle model-specific options
    const modelSelect = document.getElementById('model-type');
    if (modelSelect) {
        modelSelect.addEventListener('change', function() {
            toggleModelOptions(this.value);
        });
    }
    
    // Quick analyze button
    const quickAnalyzeBtn = document.getElementById('quick-analyze-btn');
    if (quickAnalyzeBtn) {
        quickAnalyzeBtn.addEventListener('click', function() {
            prepareQuickAnalyze();
        });
    }
});

/**
 * Load insight templates from the API
 */
function loadInsightTemplates() {
    const templatesTable = document.getElementById('templates-table-body');
    if (!templatesTable) return;
    
    // Show loading indicator
    templatesTable.innerHTML = `
        <tr>
            <td colspan="5" class="text-center">
                <div class="d-flex justify-content-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </td>
        </tr>
    `;
    
    fetch('/api/insights/templates')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(templates => {
            displayTemplates(templates, templatesTable);
        })
        .catch(error => {
            console.error('Error loading templates:', error);
            templatesTable.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Error loading insight templates: ${error.message}
                        </div>
                    </td>
                </tr>
            `;
        });
}

/**
 * Display insight templates in the table
 */
function displayTemplates(templates, container) {
    // Clear container
    container.innerHTML = '';
    
    if (!templates || templates.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div class="alert alert-info">
                        No insight templates found. Create one to get started.
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Loop through templates and create table rows
    templates.forEach(template => {
        const row = document.createElement('tr');
        
        // Format fields
        const fields = Array.isArray(template.fields) 
            ? template.fields.map(field => `<span class="badge bg-secondary">${field}</span>`).join(' ')
            : 'No fields selected';
        
        // Format created date
        const createdDate = new Date(template.created_at).toLocaleString();
        
        row.innerHTML = `
            <td>${template.name}</td>
            <td>${template.description || 'No description'}</td>
            <td>${fields}</td>
            <td><span class="badge bg-primary">${template.model_type}</span></td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-primary btn-use" data-id="${template.id}" title="Use Template">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn btn-warning btn-edit" data-id="${template.id}" title="Edit Template">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-delete" data-id="${template.id}" title="Delete Template">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        container.appendChild(row);
    });
    
    // Add event listeners to buttons
    addTemplateButtonListeners();
}

/**
 * Add event listeners to template action buttons
 */
function addTemplateButtonListeners() {
    // Use template buttons
    document.querySelectorAll('.btn-use').forEach(button => {
        button.addEventListener('click', function() {
            const templateId = this.getAttribute('data-id');
            useTemplate(templateId);
        });
    });
    
    // Edit template buttons
    document.querySelectorAll('.btn-edit').forEach(button => {
        button.addEventListener('click', function() {
            const templateId = this.getAttribute('data-id');
            editTemplate(templateId);
        });
    });
    
    // Delete template buttons
    document.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', function() {
            const templateId = this.getAttribute('data-id');
            deleteTemplate(templateId);
        });
    });
}

/**
 * Use an existing template for analysis
 */
function useTemplate(templateId) {
    // Show loading modal
    const loadingModal = new bootstrap.Modal(document.getElementById('loading-modal'));
    loadingModal.show();
    
    // Fetch the template
    fetch('/api/insights/templates')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(templates => {
            const template = templates.find(t => t.id.toString() === templateId.toString());
            if (!template) {
                throw new Error('Template not found');
            }
            
            loadingModal.hide();
            
            // Go to analyze tab and populate fields
            const analyzeTab = document.getElementById('analyze-tab');
            if (analyzeTab) {
                const tabInstance = new bootstrap.Tab(analyzeTab);
                tabInstance.show();
            }
            
            // Populate the form
            document.getElementById('template-id').value = template.id;
            
            // Set severity levels based on template
            document.querySelectorAll('input[name="severity-level"]').forEach(checkbox => {
                checkbox.checked = true; // Default to all selected
            });
            
            // Set model type
            const modelTypeSelect = document.getElementById('model-type');
            if (modelTypeSelect) {
                modelTypeSelect.value = template.model_type;
                toggleModelOptions(template.model_type);
            }
            
            // Show template name in the form
            const selectedTemplateName = document.getElementById('selected-template-name');
            if (selectedTemplateName) {
                selectedTemplateName.textContent = template.name;
                document.getElementById('selected-template-container').classList.remove('d-none');
            }
        })
        .catch(error => {
            console.error('Error loading template:', error);
            loadingModal.hide();
            
            // Show error message
            const errorModal = new bootstrap.Modal(document.getElementById('error-modal'));
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) {
                errorMessage.textContent = `Error loading template: ${error.message}`;
            }
            errorModal.show();
        });
}

/**
 * Edit an existing template
 */
function editTemplate(templateId) {
    // Show loading modal
    const loadingModal = new bootstrap.Modal(document.getElementById('loading-modal'));
    loadingModal.show();
    
    // Fetch the template
    fetch('/api/insights/templates')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(templates => {
            const template = templates.find(t => t.id.toString() === templateId.toString());
            if (!template) {
                throw new Error('Template not found');
            }
            
            loadingModal.hide();
            
            // Populate the form
            const form = document.getElementById('edit-template-form');
            if (!form) return;
            
            document.getElementById('edit-template-id').value = template.id;
            document.getElementById('edit-template-name').value = template.name;
            document.getElementById('edit-template-description').value = template.description || '';
            
            // Set field checkboxes
            const fieldChecks = document.querySelectorAll('input[name="edit-field"]');
            fieldChecks.forEach(checkbox => {
                checkbox.checked = template.fields.includes(checkbox.value);
            });
            
            // Set model type
            document.getElementById('edit-model-type').value = template.model_type;
            
            // Show the modal
            const editModal = new bootstrap.Modal(document.getElementById('edit-template-modal'));
            editModal.show();
        })
        .catch(error => {
            console.error('Error loading template for editing:', error);
            loadingModal.hide();
            
            // Show error message
            const errorModal = new bootstrap.Modal(document.getElementById('error-modal'));
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) {
                errorMessage.textContent = `Error loading template: ${error.message}`;
            }
            errorModal.show();
        });
    
    // Set up form submit handler if not already set
    const editForm = document.getElementById('edit-template-form');
    if (editForm && !editForm.hasAttribute('data-handler-attached')) {
        editForm.setAttribute('data-handler-attached', 'true');
        editForm.addEventListener('submit', handleEditTemplate);
    }
}

/**
 * Delete a template
 */
function deleteTemplate(templateId) {
    // Show confirmation dialog
    if (!confirm('Are you sure you want to delete this template? This will also delete all associated insight results.')) {
        return;
    }
    
    fetch(`/api/insights/templates/${templateId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `HTTP error! Status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            // Reload templates
            loadInsightTemplates();
            
            // Show success message
            const successModal = new bootstrap.Modal(document.getElementById('success-modal'));
            const successMessage = document.getElementById('success-message');
            if (successMessage) {
                successMessage.textContent = data.message || 'Template deleted successfully!';
            }
            successModal.show();
        })
        .catch(error => {
            console.error('Error deleting template:', error);
            
            // Show error message
            const errorModal = new bootstrap.Modal(document.getElementById('error-modal'));
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) {
                errorMessage.textContent = `Error deleting template: ${error.message}`;
            }
            errorModal.show();
        });
}

/**
 * Toggle model-specific options based on selected AI model
 */
function toggleModelOptions(modelType) {
    const openaiOptions = document.getElementById('openai-options');
    const deepseekOptions = document.getElementById('deepseek-options');
    const ollamaOptions = document.getElementById('ollama-options');
    
    if (openaiOptions) {
        openaiOptions.style.display = modelType === 'openai' ? 'block' : 'none';
    }
    
    if (deepseekOptions) {
        deepseekOptions.style.display = modelType === 'deepseek' ? 'block' : 'none';
    }
    
    if (ollamaOptions) {
        ollamaOptions.style.display = modelType === 'ollama' ? 'block' : 'none';
    }
}

/**
 * Handle create template form submission
 */
function handleCreateTemplate(event) {
    event.preventDefault();
    
    // Get form values
    const templateName = document.getElementById('template-name').value;
    const templateDescription = document.getElementById('template-description').value;
    const modelType = document.getElementById('create-model-type').value;
    
    // Get selected fields
    const fields = [];
    document.querySelectorAll('input[name="field"]:checked').forEach(checkbox => {
        fields.push(checkbox.value);
    });
    
    // Validate
    if (!templateName) {
        alert('Please enter a template name');
        return;
    }
    
    if (fields.length === 0) {
        alert('Please select at least one field to analyze');
        return;
    }
    
    // Create template data
    const templateData = {
        name: templateName,
        description: templateDescription,
        fields: fields,
        model_type: modelType
    };
    
    // Show loading modal
    const loadingModal = new bootstrap.Modal(document.getElementById('loading-modal'));
    loadingModal.show();
    
    // Submit to API
    fetch('/api/insights/templates', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `HTTP error! Status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            loadingModal.hide();
            
            // Reset form
            document.getElementById('create-template-form').reset();
            
            // Hide the modal
            const createModal = bootstrap.Modal.getInstance(document.getElementById('create-template-modal'));
            if (createModal) {
                createModal.hide();
            }
            
            // Reload templates
            loadInsightTemplates();
            
            // Show success message
            const successModal = new bootstrap.Modal(document.getElementById('success-modal'));
            const successMessage = document.getElementById('success-message');
            if (successMessage) {
                successMessage.textContent = data.message || 'Template created successfully!';
            }
            successModal.show();
        })
        .catch(error => {
            console.error('Error creating template:', error);
            loadingModal.hide();
            
            // Show error message
            const errorModal = new bootstrap.Modal(document.getElementById('error-modal'));
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) {
                errorMessage.textContent = `Error creating template: ${error.message}`;
            }
            errorModal.show();
        });
}

/**
 * Handle edit template form submission
 */
function handleEditTemplate(event) {
    event.preventDefault();
    
    // Get form values
    const templateId = document.getElementById('edit-template-id').value;
    const templateName = document.getElementById('edit-template-name').value;
    const templateDescription = document.getElementById('edit-template-description').value;
    const modelType = document.getElementById('edit-model-type').value;
    
    // Get selected fields
    const fields = [];
    document.querySelectorAll('input[name="edit-field"]:checked').forEach(checkbox => {
        fields.push(checkbox.value);
    });
    
    // Validate
    if (!templateName) {
        alert('Please enter a template name');
        return;
    }
    
    if (fields.length === 0) {
        alert('Please select at least one field to analyze');
        return;
    }
    
    // Create template data
    const templateData = {
        name: templateName,
        description: templateDescription,
        fields: fields,
        model_type: modelType
    };
    
    // Show loading modal
    const loadingModal = new bootstrap.Modal(document.getElementById('loading-modal'));
    loadingModal.show();
    
    // Submit to API
    fetch(`/api/insights/templates/${templateId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `HTTP error! Status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            loadingModal.hide();
            
            // Hide the modal
            const editModal = bootstrap.Modal.getInstance(document.getElementById('edit-template-modal'));
            if (editModal) {
                editModal.hide();
            }
            
            // Reload templates
            loadInsightTemplates();
            
            // Show success message
            const successModal = new bootstrap.Modal(document.getElementById('success-modal'));
            const successMessage = document.getElementById('success-message');
            if (successMessage) {
                successMessage.textContent = data.message || 'Template updated successfully!';
            }
            successModal.show();
        })
        .catch(error => {
            console.error('Error updating template:', error);
            loadingModal.hide();
            
            // Show error message
            const errorModal = new bootstrap.Modal(document.getElementById('error-modal'));
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) {
                errorMessage.textContent = `Error updating template: ${error.message}`;
            }
            errorModal.show();
        });
}

/**
 * Handle analyze form submission
 */
function handleAnalyze(event) {
    event.preventDefault();
    
    // Get form values
    const templateId = document.getElementById('template-id').value;
    const modelType = document.getElementById('model-type').value;
    const customPrompt = document.getElementById('custom-prompt').value;
    
    // Get selected severity levels
    const severityLevels = [];
    document.querySelectorAll('input[name="severity-level"]:checked').forEach(checkbox => {
        severityLevels.push(checkbox.value);
    });
    
    // Get time range
    const timeRange = document.getElementById('time-range').value;
    
    // Validate
    if (severityLevels.length === 0) {
        alert('Please select at least one severity level');
        return;
    }
    
    // Create analysis data
    const analysisData = {
        template_id: templateId || null,
        model_type: modelType,
        custom_prompt: customPrompt,
        severity_levels: severityLevels,
        time_range: timeRange
    };
    
    // Show loading modal
    const loadingModal = new bootstrap.Modal(document.getElementById('loading-modal'));
    loadingModal.show();
    
    // Submit to API
    fetch('/api/insights/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(analysisData)
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `HTTP error! Status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            loadingModal.hide();
            displayAnalysisResult(data);
        })
        .catch(error => {
            console.error('Error analyzing data:', error);
            loadingModal.hide();
            
            // Show error message
            const errorModal = new bootstrap.Modal(document.getElementById('error-modal'));
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) {
                errorMessage.textContent = `Error analyzing data: ${error.message}`;
            }
            errorModal.show();
        });
}

/**
 * Directly analyze a specific alert without showing form
 */
function directAnalyze(alertData) {
    if (!alertData || !alertData.id) {
        console.error('No valid alert data provided');
        return;
    }
    
    // Create analysis data
    const analysisData = {
        alert_ids: [alertData.id],
        model_type: 'openai'
    };
    
    // Show loading modal
    const loadingModal = new bootstrap.Modal(document.getElementById('loading-modal'));
    loadingModal.show();
    
    // Submit to API
    fetch('/api/insights/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(analysisData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Hide loading modal
        loadingModal.hide();
        
        // Display analysis results
        displayAnalysisResult(data);
        
        // Hide the analysis form
        const analyzeFormContainer = document.querySelector('.col-lg-5');
        if (analyzeFormContainer) {
            analyzeFormContainer.style.display = 'none';
        }
        
        // Make the results container full width
        const resultsContainer = document.querySelector('.col-lg-7');
        if (resultsContainer) {
            resultsContainer.classList.remove('col-lg-7');
            resultsContainer.classList.add('col-lg-12');
        }
    })
    .catch(error => {
        console.error('Error analyzing alert:', error);
        loadingModal.hide();
        
        // Show error message
        const errorModal = new bootstrap.Modal(document.getElementById('error-modal'));
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = `Error analyzing alert: ${error.message}`;
        }
        errorModal.show();
    });
}

/**
 * Display analysis result
 */
function displayAnalysisResult(result) {
    const resultContainer = document.getElementById('analysis-result');
    if (!resultContainer) return;
    
    // Clear previous results
    resultContainer.innerHTML = '';
    
    // Create result section
    const resultSection = document.createElement('div');
    resultSection.className = 'card mb-4';
    
    // Card header with model info
    resultSection.innerHTML = `
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">
                <i class="fas fa-robot me-2"></i>
                Analysis Result <small class="text-muted">(${result.model}, ${result.provider})</small>
            </h5>
            <div class="rating-container">
                <div class="rating" id="rating-stars">
                    <div class="rating-upper" style="width: 0%">
                        <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                    </div>
                    <div class="rating-lower">
                        <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="card-body">
            <div class="insight-result mb-4">
                ${formatAnalysisText(result.analysis)}
            </div>
            
            <div class="follow-up-container">
                <h6><i class="fas fa-question-circle me-2"></i>Follow-up Questions</h6>
                <div id="follow-up-questions" class="mb-3">
                    <!-- Follow-up questions will appear here -->
                </div>
                
                <div class="input-group">
                    <input type="text" class="form-control" id="follow-up-input" placeholder="Ask a follow-up question...">
                    <button class="btn btn-primary" type="button" id="ask-follow-up-btn">
                        <i class="fas fa-paper-plane"></i> Ask
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add result to the container
    resultContainer.appendChild(resultSection);
    
    // Store result data for follow-up questions
    if (result.result_id) {
        // If it's a saved result
        resultContainer.setAttribute('data-result-id', result.result_id);
        
        // Initialize rating system for saved results
        initRating(result.result_id);
    } else {
        // For ad-hoc analysis, store the analysis text to use for follow-up
        resultContainer.setAttribute('data-analysis', result.analysis);
    }
    
    // Add follow-up question handler
    const followUpBtn = document.getElementById('ask-follow-up-btn');
    const followUpInput = document.getElementById('follow-up-input');
    
    if (followUpBtn && followUpInput) {
        followUpBtn.addEventListener('click', function() {
            const question = followUpInput.value.trim();
            if (!question) return;
            
            const resultContainer = document.getElementById('analysis-result');
            const resultId = resultContainer ? resultContainer.getAttribute('data-result-id') : null;
            const analysisText = resultContainer ? resultContainer.getAttribute('data-analysis') : null;
            
            askFollowUpQuestion(question, resultId, analysisText || result.analysis);
            followUpInput.value = '';
        });
        
        followUpInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const question = followUpInput.value.trim();
                if (!question) return;
                
                const resultContainer = document.getElementById('analysis-result');
                const resultId = resultContainer ? resultContainer.getAttribute('data-result-id') : null;
                const analysisText = resultContainer ? resultContainer.getAttribute('data-analysis') : null;
                
                askFollowUpQuestion(question, resultId, analysisText || result.analysis);
                followUpInput.value = '';
            }
        });
    }
    
    // Initialize follow-up questions container if there are existing questions
    if (result.follow_up_questions && result.follow_up_questions.length > 0) {
        const followUpContainer = document.getElementById('follow-up-questions');
        result.follow_up_questions.forEach(qa => {
            appendFollowUpQA(qa.question, qa.answer, followUpContainer);
        });
    }
}

/**
 * Format analysis text with proper styling
 */
function formatAnalysisText(text) {
    if (!text) return '<p>No analysis available.</p>';
    
    // Replace markdown-style headers
    text = text.replace(/^#{1,6}\s+(.*?)$/gm, function(match, p1) {
        const level = match.indexOf(' ');
        return `<h${level + 2}>${p1}</h${level + 2}>`;
    });
    
    // Replace markdown-style bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Replace markdown-style italic
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Replace double newlines with paragraph breaks
    text = text.replace(/\n\n/g, '</p><p>');
    
    // Wrap everything in paragraphs
    return `<p>${text}</p>`;
}

/**
 * Initialize rating system
 */
function initRating(resultId) {
    const ratingStars = document.getElementById('rating-stars');
    if (!ratingStars) return;
    
    const ratingUpper = ratingStars.querySelector('.rating-upper');
    const stars = ratingStars.querySelectorAll('.rating-lower span');
    
    stars.forEach((star, index) => {
        star.addEventListener('click', function() {
            const rating = index + 1;
            ratingUpper.style.width = `${(rating / 5) * 100}%`;
            
            // Submit rating to API
            submitRating(resultId, rating);
        });
        
        star.addEventListener('mouseover', function() {
            const rating = index + 1;
            ratingUpper.style.width = `${(rating / 5) * 100}%`;
        });
        
        star.addEventListener('mouseout', function() {
            // Restore to the current rating or 0 if none
            const currentRating = ratingStars.getAttribute('data-rating') || 0;
            ratingUpper.style.width = `${(currentRating / 5) * 100}%`;
        });
    });
}

/**
 * Submit a rating for an analysis result
 */
function submitRating(resultId, rating) {
    if (!resultId) return;
    
    fetch(`/api/insights/results/${resultId}/rate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: rating })
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `HTTP error! Status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            // Store the current rating
            const ratingStars = document.getElementById('rating-stars');
            if (ratingStars) {
                ratingStars.setAttribute('data-rating', rating);
            }
            
            // Show a brief success message
            const toast = document.createElement('div');
            toast.className = 'position-fixed bottom-0 end-0 p-3';
            toast.style.zIndex = 5;
            toast.innerHTML = `
                <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-header">
                        <strong class="me-auto">Rating Submitted</strong>
                        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                    <div class="toast-body">
                        Rating of ${rating} stars has been saved.
                    </div>
                </div>
            `;
            
            document.body.appendChild(toast);
            const toastElement = toast.querySelector('.toast');
            const bsToast = new bootstrap.Toast(toastElement);
            bsToast.show();
            
            // Remove toast after it's hidden
            toastElement.addEventListener('hidden.bs.toast', function() {
                document.body.removeChild(toast);
            });
        })
        .catch(error => {
            console.error('Error submitting rating:', error);
            // Show error toast
            const toast = document.createElement('div');
            toast.className = 'position-fixed bottom-0 end-0 p-3';
            toast.style.zIndex = 5;
            toast.innerHTML = `
                <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-header bg-danger text-white">
                        <strong class="me-auto">Error</strong>
                        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                    <div class="toast-body">
                        Error submitting rating: ${error.message}
                    </div>
                </div>
            `;
            
            document.body.appendChild(toast);
            const toastElement = toast.querySelector('.toast');
            const bsToast = new bootstrap.Toast(toastElement);
            bsToast.show();
            
            // Remove toast after it's hidden
            toastElement.addEventListener('hidden.bs.toast', function() {
                document.body.removeChild(toast);
            });
        });
}

/**
 * Ask a follow-up question
 */
function askFollowUpQuestion(question, resultId, previousContext) {
    const followUpContainer = document.getElementById('follow-up-questions');
    if (!followUpContainer) return;
    
    // Create a placeholder for the answer
    const questionElement = document.createElement('div');
    questionElement.className = 'insight-question';
    questionElement.innerHTML = `
        <strong><i class="fas fa-question me-2"></i>You:</strong>
        <p>${question}</p>
    `;
    
    const answerElement = document.createElement('div');
    answerElement.className = 'insight-answer';
    answerElement.innerHTML = `
        <strong><i class="fas fa-robot me-2"></i>AI:</strong>
        <div class="d-flex justify-content-center my-3">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
    
    followUpContainer.appendChild(questionElement);
    followUpContainer.appendChild(answerElement);
    
    // Scroll to the new question
    answerElement.scrollIntoView({ behavior: 'smooth' });
    
    const data = {
        question: question
    };
    
    // Use result ID if available, otherwise pass the context
    let endpoint;
    if (resultId) {
        endpoint = `/api/insights/results/${resultId}/follow-up`;
    } else {
        endpoint = '/api/insights/follow-up';
        data.context = previousContext;
    }
    
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(response => {
            if (!response.ok) {
                // First check if the response is valid JSON
                return response.text().then(text => {
                    try {
                        // Try to parse as JSON
                        const data = JSON.parse(text);
                        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
                    } catch (e) {
                        // If not valid JSON, return the text as the error
                        throw new Error(`Error: ${text}`);
                    }
                });
            }
            
            // First get as text to check if valid JSON
            return response.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
                }
            });
        })
        .then(data => {
            // Display the answer
            answerElement.innerHTML = `
                <strong><i class="fas fa-robot me-2"></i>AI:</strong>
                <div>${formatAnalysisText(data.answer)}</div>
            `;
            
            // Scroll to the answer
            answerElement.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            console.error('Error getting follow-up answer:', error);
            
            // Display error
            answerElement.innerHTML = `
                <strong><i class="fas fa-robot me-2"></i>AI:</strong>
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error getting answer: ${error.message}
                </div>
            `;
        });
}

/**
 * Append a question-answer pair to the follow-up container
 */
function appendFollowUpQA(question, answer, container) {
    // Create question element
    const questionElement = document.createElement('div');
    questionElement.className = 'insight-question';
    questionElement.innerHTML = `
        <strong><i class="fas fa-question me-2"></i>You:</strong>
        <p>${question}</p>
    `;
    
    // Create answer element
    const answerElement = document.createElement('div');
    answerElement.className = 'insight-answer';
    answerElement.innerHTML = `
        <strong><i class="fas fa-robot me-2"></i>AI:</strong>
        <div>${formatAnalysisText(answer)}</div>
    `;
    
    // Add to container
    container.appendChild(questionElement);
    container.appendChild(answerElement);
}

/**
 * Prepare quick analyze form
 */
function prepareQuickAnalyze() {
    // Go to analyze tab
    const analyzeTab = document.getElementById('analyze-tab');
    if (analyzeTab) {
        const tabInstance = new bootstrap.Tab(analyzeTab);
        tabInstance.show();
    }
    
    // Reset template ID
    document.getElementById('template-id').value = '';
    
    // Hide selected template name
    document.getElementById('selected-template-container').classList.add('d-none');
    
    // Set default options
    const modelTypeSelect = document.getElementById('model-type');
    if (modelTypeSelect) {
        modelTypeSelect.value = 'openai';
        toggleModelOptions('openai');
    }
    
    // Check all severity levels
    document.querySelectorAll('input[name="severity-level"]').forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // Set default time range
    document.getElementById('time-range').value = '24h';
    
    // Set focus on custom prompt
    document.getElementById('custom-prompt').focus();
    
    // Check if there's alert data from session storage to process
    const alertData = sessionStorage.getItem('alert_to_analyze');
    if (alertData) {
        try {
            // Clear the session storage
            sessionStorage.removeItem('alert_to_analyze');
            
            // Parse the data
            const parsedAlertData = JSON.parse(alertData);
            
            // Directly perform analysis instead of showing the form
            directAnalyze(parsedAlertData);
        } catch (e) {
            console.error('Error processing stored alert data:', e);
        }
    }
}
