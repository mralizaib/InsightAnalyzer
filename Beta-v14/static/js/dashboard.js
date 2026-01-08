/**
 * Dashboard JavaScript - AZ Sentinel X
 * Handles dashboard functionality, charts, and data loading
 */

document.addEventListener('DOMContentLoaded', function() {
    // Load initial dashboard data
    loadDashboardStatsForTimeRange(1); // Use the new function for consistency
    loadAlertsTimeline(1);
    loadTopRules(1);
    loadThreatAnalysis();

    // Set up refresh interval (every 5 minutes)
    setInterval(function() {
        // Get current active time range
        const activeTimeRange = document.querySelector('.timeline-range.active');
        const days = activeTimeRange ? activeTimeRange.getAttribute('data-days') : '1';

        // Refresh with current time range
        loadDashboardStatsForTimeRange(days);
        loadAlertsTimeline(days);
        loadTopRules(days);
        loadThreatAnalysis();
    }, 300000);

    // Set up event listeners for time range buttons
    document.querySelectorAll('.timeline-range').forEach(item => {
        item.addEventListener('click', function() {
            const days = this.getAttribute('data-days');
            console.log(`Time range button clicked: ${days} days`);

            // Update active state first
            document.querySelectorAll('.timeline-range').forEach(el => {
                el.classList.remove('active');
            });
            this.classList.add('active');

            // Load data for the selected time range
            loadDashboardStatsForTimeRange(days);
            loadAlertsTimeline(days);
            loadTopRules(days);
            loadThreatAnalysis();
        });
    });

    // Initialize clickable cards for severity filtering
    document.querySelectorAll('.clickable-card').forEach(card => {
        card.addEventListener('click', function() {
            const severity = this.getAttribute('data-severity');
            console.log(`Filtering dashboard for severity: ${severity}`);
            
            // Redirect to alerts page with severity filter
            window.location.href = `/alerts?severity=${severity}`;
        });
    });

    // Initialize refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
        console.log('Refresh button clicked');
        // Get current active time range
        const activeTimeRange = document.querySelector('.timeline-range.active');
        const days = activeTimeRange ? activeTimeRange.getAttribute('data-days') : '1';
        console.log('Refreshing with days:', days);

        // Refresh data with current time range
        loadDashboardStatsForTimeRange(days);
        loadAlertsTimeline(days);
        loadTopRules(days);
        loadThreatAnalysis();
        });
    }
});

/**
 * Load dashboard statistics for specific time range
 */
function loadDashboardStatsForTimeRange(days = 1) {
    console.log(`Loading dashboard stats for ${days} days`);
    const statsContainer = document.getElementById('dashboard-stats');
    const loadingIndicator = document.getElementById('stats-loading');

    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }

    fetch(`/api/dashboard/stats?days=${days}`)
        .then(response => {
            console.log(`Dashboard stats response status: ${response.status}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Dashboard stats data received:', data);
            updateAlertCountCards(data.alert_counts);
            updateAgentCards(data.agent_stats);
            updateRecentAlerts(data.recent_alerts);

            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error loading dashboard stats:', error);

            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }

            // Show error message
            if (statsContainer) {
                statsContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Error loading dashboard statistics: ${error.message}
                    </div>
                `;
            }
        });
}



/**
 * Update alert count cards with current data
 */
function updateAlertCountCards(alertCounts) {
    if (!alertCounts) return;

    // Update count cards
    const criticalCount = document.getElementById('critical-count');
    const highCount = document.getElementById('high-count');
    const mediumCount = document.getElementById('medium-count');
    const lowCount = document.getElementById('low-count');
    const eventsCount = document.getElementById('events-count');

    if (criticalCount) criticalCount.textContent = alertCounts.critical || 0;
    if (highCount) highCount.textContent = alertCounts.high || 0;
    if (mediumCount) mediumCount.textContent = alertCounts.medium || 0;
    if (lowCount) lowCount.textContent = alertCounts.low || 0;
    if (eventsCount) eventsCount.textContent = alertCounts.events || 0;
}

/**
 * Update agent statistics cards
 */
function updateAgentCards(agentStats) {
    if (!agentStats) return;

    const totalAgents = document.getElementById('total-agents');
    const activeAgents = document.getElementById('active-agents');
    const disconnectedAgents = document.getElementById('disconnected-agents');

    if (totalAgents) totalAgents.textContent = agentStats.total || 0;
    if (activeAgents) activeAgents.textContent = agentStats.active || 0;
    if (disconnectedAgents) disconnectedAgents.textContent = agentStats.disconnected || 0;
}

/**
 * Update recent alerts table
 */
function updateRecentAlerts(alerts) {
    const alertsTableBody = document.getElementById('recent-alerts-body');
    if (!alertsTableBody || !alerts) return;

    // Clear existing rows
    alertsTableBody.innerHTML = '';

    if (alerts.length === 0) {
        // No alerts
        alertsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">No recent alerts found</td>
            </tr>
        `;
        return;
    }

    // Add new rows
    alerts.forEach(alert => {
        const source = alert.source;
        if (!source) return;

        // Get values with fallbacks
        const timestamp = source['@timestamp'] || 'N/A';
        const ruleId = source.rule?.id || 'N/A';
        const level = source.rule?.level || 0;
        const description = source.rule?.description || 'N/A';
        const agentName = source.agent?.name || 'N/A';

        // Check if it's a Misc Event
        const desc = description.toLowerCase();
        const ruleIdInt = parseInt(ruleId);
        const miscRuleIds = [750, 60642, 752, 550, 60106];
        const isMiscEvent = miscRuleIds.includes(ruleIdInt) || 
                            desc.includes('sonicwall warning') || 
                            desc.includes('sonicwall error') || 
                            desc.includes('integrity checksum changed') || 
                            desc.includes('registry value integrity checksum changed');

        // Determine severity class based on config.py levels
        let severityClass = 'severity-low';
        let displayLevel = level;

        if (isMiscEvent) {
            severityClass = 'text-info';
            displayLevel = 'Event';
        } else if (level >= 15) {
            severityClass = 'severity-critical';  // Level 15
        } else if (level >= 12 && level <= 14) {
            severityClass = 'severity-high';      // Levels 12-14
        } else if (level >= 7 && level <= 11) {
            severityClass = 'severity-medium';    // Levels 7-11
        } else if (level >= 1 && level <= 6) {
            severityClass = 'severity-low';       // Levels 1-6
        }

        // Format date nicely with explicit time zone information
        let formattedDate = timestamp;
        try {
            const date = new Date(timestamp);
            // Add time zone indicator for clarity (UTC)
            formattedDate = date.toLocaleString() + ' (UTC)';
        } catch (e) {
            console.error('Error formatting date:', e);
        }

        // Create row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${agentName}</td>
            <td>${ruleId}</td>
            <td class="${severityClass}">${displayLevel}</td>
            <td>${description}</td>
        `;

        alertsTableBody.appendChild(row);
    });
}

/**
 * Load alerts timeline chart
 */
function loadAlertsTimeline(days = 1) {
    const chartContainer = document.getElementById('alerts-timeline-chart');
    if (!chartContainer) return;

    fetch(`/api/dashboard/alerts_timeline?days=${days}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            renderTimelineChart(data, chartContainer);
        })
        .catch(error => {
            console.error('Error loading alerts timeline:', error);

            // Show error message
            chartContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error loading timeline data: ${error.message}
                </div>
            `;
        });
}

/**
 * Render timeline chart with Chart.js
 */
function renderTimelineChart(data, container) {
    // Clear the container first
    container.innerHTML = '';

    // Create canvas element
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No timeline data available</div>';
        return;
    }

    // Prepare data for chart
    const labels = data.map(item => {
        // Format date for display with time zone information
        const date = new Date(item.timestamp);
        return date.toLocaleString() + ' (UTC)';
    });

    const criticalData = data.map(item => item.critical || 0);
    const highData = data.map(item => item.high || 0);
    const mediumData = data.map(item => item.medium || 0);
    const lowData = data.map(item => item.low || 0);

    // Create chart
    new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Critical',
                    data: criticalData,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'High',
                    data: highData,
                    borderColor: '#fd7e14',
                    backgroundColor: 'rgba(253, 126, 20, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Medium',
                    data: mediumData,
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Low',
                    data: lowData,
                    borderColor: '#6c757d',
                    backgroundColor: 'rgba(108, 117, 125, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'rgba(255, 255, 255, 0.8)'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

/**
 * Load top rules
 */
function loadTopRules(days = 1) {
    const topRulesContainer = document.getElementById('top-rules-body');
    if (!topRulesContainer) return;

    fetch(`/api/dashboard/top_rules?days=${days}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            updateTopRulesTable(data, topRulesContainer);
        })
        .catch(error => {
            console.error('Error loading top rules:', error);

            // Show error message
            topRulesContainer.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">
                        <div class="alert alert-danger">
                            Error loading top rules: ${error.message}
                        </div>
                    </td>
                </tr>
            `;
        });
}

/**
 * Load high severity threat analysis data
 */
function loadThreatAnalysis() {
    const threatTypesContainer = document.getElementById('threat-types-chart');
    const locationsContainer = document.getElementById('locations-chart');

    if (!threatTypesContainer || !locationsContainer) return;

    fetch('/api/dashboard/threat_analysis')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            renderThreatTypesChart(data.threat_types, threatTypesContainer);
            renderLocationsChart(data.locations, locationsContainer);
        })
        .catch(error => {
            console.error('Error loading threat analysis:', error);

            // Show error message in both containers
            const errorMessage = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error loading threat data: ${error.message}
                </div>
            `;

            threatTypesContainer.innerHTML = errorMessage;
            locationsContainer.innerHTML = errorMessage;
        });
}

/**
 * Render threat types chart
 */
function renderThreatTypesChart(threatTypes, container) {
    // Clear the container first
    container.innerHTML = '';

    // Create canvas element
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    if (!threatTypes || threatTypes.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No high severity threats detected</div>';
        return;
    }

    // Prepare data for chart
    const labels = threatTypes.map(item => item.name);
    const counts = threatTypes.map(item => item.count);
    const backgroundColors = [
        '#dc3545', '#fd7e14', '#ffc107', '#20c997', '#0dcaf0',
        '#6610f2', '#6f42c1', '#d63384', '#198754', '#0d6efd'
    ];

    // Create chart
    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'High Severity Threats',
                data: counts,
                backgroundColor: backgroundColors,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Count: ${context.parsed.x}`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Render locations chart
 */
function renderLocationsChart(locations, container) {
    // Clear the container first
    container.innerHTML = '';

    // Create canvas element
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    if (!locations || locations.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No location data available</div>';
        return;
    }

    // Prepare data for chart
    const labels = locations.map(item => item.name);
    const data = locations.map(item => item.count);
    const backgroundColors = [
        'rgba(220, 53, 69, 0.8)',  // Red
        'rgba(253, 126, 20, 0.8)',  // Orange
        'rgba(255, 193, 7, 0.8)',   // Yellow
        'rgba(32, 201, 151, 0.8)',  // Teal
        'rgba(13, 202, 240, 0.8)',  // Cyan
        'rgba(102, 16, 242, 0.8)',  // Purple
        'rgba(111, 66, 193, 0.8)',  // Indigo
        'rgba(214, 51, 132, 0.8)',  // Pink
        'rgba(25, 135, 84, 0.8)',   // Green
        'rgba(13, 110, 253, 0.8)'   // Blue
    ];

    // Create chart
    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        padding: 10,
                        font: {
                            size: 12
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Vulnerable Locations',
                    color: 'rgba(255, 255, 255, 0.8)',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updateTopRulesTable(rules, container) {
    // Clear existing rows
    container.innerHTML = '';

    if (!rules || rules.length === 0) {
        // No rules
        container.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">No rules data available</td>
            </tr>
        `;
        return;
    }

    // Add new rows
    rules.forEach(rule => {
        // Determine severity class based on config.py levels
        let severityClass = 'severity-low';
        const level = rule.level || 0;

        if (level >= 15) {
            severityClass = 'severity-critical';  // Level 15
        } else if (level >= 12 && level <= 14) {
            severityClass = 'severity-high';      // Levels 12-14
        } else if (level >= 7 && level <= 11) {
            severityClass = 'severity-medium';    // Levels 7-11
        } else if (level >= 1 && level <= 6) {
            severityClass = 'severity-low';       // Levels 1-6
        }

        // Create row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${rule.rule_id}</td>
            <td class="${severityClass}">${level}</td>
            <td>${rule.description}</td>
            <td><strong>${rule.count}</strong></td>
        `;

        container.appendChild(row);
    });
}