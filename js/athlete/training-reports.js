/**
 * Training Reports Management
 * Lists and manages performance reports for completed sessions
 */

import { getSessionReports } from '../services/dbService.js';
import { getAuthUser } from '../core/auth-manager.js';

/**
 * Initialize training reports section
 */
export async function initTrainingReports() {
    try {
        const user = getAuthUser();
        if (!user || !user.uid) {
            console.warn('[Training Reports] User not authenticated');
            renderEmptyState();
            return;
        }

        // Always fetch fresh reports (skip cache) to show newly completed sessions
        console.log('[Training Reports] Fetching reports for user:', user.uid);
        const reports = await getSessionReports(user.uid, { limit: 20 });
        
        console.log('[Training Reports] Found reports:', reports?.length || 0);
        
        if (!reports || reports.length === 0) {
            console.log('[Training Reports] No reports found, showing empty state');
            renderEmptyState();
            return;
        }

        renderReportsList(reports);
    } catch (error) {
        console.error('[Training Reports] Error initializing:', error);
        console.error('[Training Reports] Error stack:', error.stack);
        renderErrorState(error);
    }
}

/**
 * Render list of reports
 * @param {Array} reports - Array of report summaries
 */
function renderReportsList(reports) {
    const container = document.getElementById('reports-list');
    if (!container) {
        console.warn('[Training Reports] Reports list container not found');
        return;
    }

    if (reports.length === 0) {
        renderEmptyState();
        return;
    }

    container.innerHTML = reports.map(report => {
        const sessionDate = new Date(report.sessionDate);
        const formattedDate = sessionDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const macroStats = report.macroStats || {};
        const totalVolume = macroStats.totalVolume || 0;
        const volumeChange = macroStats.volumeChange || '0%';
        const duration = macroStats.duration || 'N/A';
        
        const exerciseSummaries = report.exerciseSummaries || [];
        const prCount = exerciseSummaries.filter(ex => ex.isPR).length;
        const exerciseCount = exerciseSummaries.length;

        return `
            <div class="glass-strong rounded-2xl p-6 card-hover cursor-pointer transition-all duration-300 hover:scale-[1.02]" 
                 data-report-id="${report.id}" 
                 data-session-id="${report.sessionId}"
                 data-session-date="${report.sessionDate}">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-3">
                            <h4 class="text-xl font-semibold text-white">${formattedDate}</h4>
                            ${prCount > 0 ? `
                                <span class="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">
                                    ${prCount} PR${prCount !== 1 ? 's' : ''}
                                </span>
                            ` : ''}
                        </div>
                        <div class="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <span class="text-white/60">Volume</span>
                                <p class="text-white font-semibold">${formatVolume(totalVolume)}</p>
                            </div>
                            <div>
                                <span class="text-white/60">Change</span>
                                <p class="text-white font-semibold ${volumeChange.startsWith('+') ? 'text-green-400' : volumeChange.startsWith('-') ? 'text-red-400' : ''}">
                                    ${volumeChange}
                                </p>
                            </div>
                            <div>
                                <span class="text-white/60">Duration</span>
                                <p class="text-white font-semibold">${duration}</p>
                            </div>
                        </div>
                        <div class="mt-3 text-sm text-white/60">
                            ${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''} performed
                        </div>
                    </div>
                    <div class="ml-6">
                        <button class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors duration-200 flex items-center gap-2">
                            <i class="fas fa-chart-line"></i>
                            <span>View Report</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Attach click handlers
    container.querySelectorAll('[data-report-id]').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking the button (it will have its own handler)
            if (e.target.closest('button')) return;
            
            const reportId = card.dataset.reportId;
            const sessionId = card.dataset.sessionId;
            const sessionDate = card.dataset.sessionDate;
            
            openReportDetail(reportId, sessionId, sessionDate);
        });
    });

    // Attach button click handlers
    container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('[data-report-id]');
            if (card) {
                const reportId = card.dataset.reportId;
                const sessionId = card.dataset.sessionId;
                const sessionDate = card.dataset.sessionDate;
                
                openReportDetail(reportId, sessionId, sessionDate);
            }
        });
    });
}

/**
 * Format volume for display
 * @param {number} volume - Volume in kg
 * @returns {string} Formatted volume string
 */
function formatVolume(volume) {
    if (volume >= 1000) {
        return `${(volume / 1000).toFixed(1)}t`;
    }
    return `${Math.round(volume)}kg`;
}

/**
 * Open report detail view
 * @param {string} reportId - Report document ID
 * @param {string} sessionId - Session ID
 * @param {string} sessionDate - Session date
 */
function openReportDetail(reportId, sessionId, sessionDate) {
    // Import and initialize report detail view
    import('../ui/performance-report-view.js').then(({ initReportDetail }) => {
        initReportDetail(reportId, sessionId, sessionDate);
    }).catch(error => {
        console.error('[Training Reports] Error opening report detail:', error);
        alert('Error opening report. Please try again.');
    });
}

/**
 * Render empty state when no reports are available
 */
function renderEmptyState() {
    const container = document.getElementById('reports-list');
    if (!container) return;

    container.innerHTML = `
        <div class="glass-strong rounded-2xl p-12 text-center">
            <i class="fas fa-chart-line text-6xl text-white/20 mb-4"></i>
            <h3 class="text-xl font-semibold text-white mb-2">No Reports Yet</h3>
            <p class="text-white/60 mb-4">Complete your first workout session to generate a performance report</p>
        </div>
    `;
}

/**
 * Render error state
 * @param {Error} error - Error object
 */
function renderErrorState(error) {
    const container = document.getElementById('reports-list');
    if (!container) return;

    container.innerHTML = `
        <div class="glass-strong rounded-2xl p-12 text-center">
            <i class="fas fa-exclamation-triangle text-6xl text-red-500/50 mb-4"></i>
            <h3 class="text-xl font-semibold text-white mb-2">Error Loading Reports</h3>
            <p class="text-white/60 mb-4">${error.message || 'An error occurred while loading reports'}</p>
            <button onclick="location.reload()" class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors duration-200">
                Retry
            </button>
        </div>
    `;
}

