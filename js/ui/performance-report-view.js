/**
 * Performance Report View
 * Displays detailed performance report with charts and narrative
 */

import { loadTemplate, injectTemplate } from '../core/template-loader.js';
import { getSessionReport, getCompletedSessions } from '../services/dbService.js';
import { buildSessionReportData } from '../core/workout-metrics.js';
import { generatePerformanceReportNarrative } from '../services/performanceReportService.js';
import { Chart, registerables } from 'chart.js';
import html2pdf from 'html2pdf.js';

// Register Chart.js components
Chart.register(...registerables);

let macroChart = null;
let exerciseCharts = new Map();

/**
 * Initialize report detail view
 * @param {string} reportId - Report document ID
 * @param {string} sessionId - Session ID
 * @param {string} sessionDate - Session date
 */
export async function initReportDetail(reportId, sessionId, sessionDate) {
    try {
        // Load modal template if not already loaded
        let modal = document.getElementById('performance-report-modal');
        if (!modal) {
            // Inject modal into body
            const html = await loadTemplate('html/components/performance-report.html');
            document.body.insertAdjacentHTML('beforeend', html);
            modal = document.getElementById('performance-report-modal');
        }

        if (!modal) {
            throw new Error('Performance report modal not found');
        }

        // Store report IDs in modal for retry functionality
        modal.dataset.reportId = reportId;
        modal.dataset.sessionId = sessionId;
        modal.dataset.sessionDate = sessionDate;

        // Show modal
        modal.classList.remove('hidden');

        // Show loading state
        const loadingEl = document.getElementById('report-loading');
        const contentEl = document.getElementById('report-content');
        const errorEl = document.getElementById('report-error');
        
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (contentEl) contentEl.classList.add('hidden');
        if (errorEl) errorEl.classList.add('hidden');

        // Set up close button
        const closeBtn = document.getElementById('close-report-btn');
        if (closeBtn) {
            closeBtn.onclick = () => closeModal();
        }

        // Set up download button
        const downloadBtn = document.getElementById('download-pdf-btn');
        if (downloadBtn) {
            downloadBtn.onclick = () => downloadReportPdf();
        }

        // Load and render report
        await loadAndRenderReport(reportId, sessionId, sessionDate);

    } catch (error) {
        console.error('[Performance Report] Error initializing:', error);
        showError(error.message || 'Failed to load report');
    }
}

/**
 * Load report data and render
 */
async function loadAndRenderReport(reportId, sessionId, sessionDate) {
    try {
        const { getAuthUser } = await import('../core/auth-manager.js');
        const user = getAuthUser();
        if (!user || !user.uid) {
            throw new Error('User not authenticated');
        }

        // Load report summary from Firestore
        const reportSummary = await getSessionReport(user.uid, reportId);
        if (!reportSummary) {
            throw new Error('Report not found');
        }

        // Prefer using the rich reportData payload that was saved at session completion time.
        // This contains full exercise names, comparison metrics, etc.
        let reportData = reportSummary.reportData;

        if (!reportData) {
            // Fallback: rebuild reportData from the completed session if older reports
            // don't have the embedded reportData payload.
            const completedSessions = await getCompletedSessions(user.uid, {
                startDate: sessionDate,
                endDate: sessionDate,
                limit: 1
            });

            if (!completedSessions || completedSessions.length === 0) {
                throw new Error('Completed session not found');
            }

            const completedSession = completedSessions[0];

            // Rebuild session structure from completedSession document
            const session = {
                date: sessionDate,
                phases: {
                    warmup: completedSession.warmup?.blocks || [],
                    // Workout blocks may be stored under workoutPhase (new schema) or workout (legacy)
                    workout: (completedSession.workoutPhase?.blocks ||
                              completedSession.workout?.blocks ||
                              []),
                    cooldown: completedSession.cooldown?.blocks || []
                }
            };

            const sessionState = {
                startedAt: completedSession.startedAt,
                completedAt: completedSession.completedAt,
                duration: completedSession.duration,
                setData: extractSetDataFromCompletedSession(completedSession)
            };

            reportData = await buildSessionReportData({
                session,
                sessionState,
                userId: user.uid,
                sessionId: sessionId
            });

            if (!reportData) {
                throw new Error('Failed to build report data');
            }
        }

        // Transform reportData to match expected format for narrative generation
        const transformedReportData = transformReportDataForNarrative(reportData);

        // Update UI with macro stats
        updateMacroStats(transformedReportData.macroStats);

        // Generate or load narrative
        let narrative = reportSummary.narrative;
        if (!narrative) {
            // Generate narrative using LangGraph
            narrative = await generatePerformanceReportNarrative(transformedReportData);
            
            // Cache narrative in Firestore (optional - can be done async)
            // For now, we'll just use it in memory
        }

        // Render narrative
        renderNarrative(narrative);

        // Render exercises with charts
        await renderExercises(transformedReportData.exercises, narrative.exerciseInsights || {});

        // Render macro chart
        renderMacroChart(transformedReportData, reportSummary);

        // Hide loading, show content
        const loadingEl = document.getElementById('report-loading');
        const contentEl = document.getElementById('report-content');
        
        if (loadingEl) loadingEl.classList.add('hidden');
        if (contentEl) contentEl.classList.remove('hidden');

        // Update title and date
        const titleEl = document.getElementById('report-title');
        const dateEl = document.getElementById('report-date');
        
        if (titleEl && narrative.reportTitle) {
            titleEl.textContent = narrative.reportTitle;
        }
        
        if (dateEl) {
            const date = new Date(sessionDate);
            dateEl.textContent = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

    } catch (error) {
        console.error('[Performance Report] Error loading report:', error);
        showError(error.message || 'Failed to load report');
    }
}

/**
 * Update macro stats in UI
 */
function updateMacroStats(macroStats) {
    const totalVolumeEl = document.getElementById('macro-total-volume');
    const volumeChangeEl = document.getElementById('macro-volume-change');
    const durationEl = document.getElementById('macro-duration');

    if (totalVolumeEl) {
        const volume = macroStats.totalVolume || 0;
        totalVolumeEl.textContent = volume >= 1000 ? `${(volume / 1000).toFixed(1)}t` : `${Math.round(volume)}kg`;
    }

    if (volumeChangeEl) {
        const change = macroStats.volumeChange || '0%';
        volumeChangeEl.textContent = change;
        volumeChangeEl.className = `text-2xl font-bold ${
            change.startsWith('+') ? 'text-green-400' : 
            change.startsWith('-') ? 'text-red-400' : 
            'text-white'
        }`;
    }

    if (durationEl) {
        durationEl.textContent = macroStats.duration || 'N/A';
    }
}

/**
 * Render narrative summary
 */
function renderNarrative(narrative) {
    const summaryEl = document.getElementById('macro-summary');
    if (!summaryEl) return;

    // Convert markdown-like formatting to HTML
    let summary = narrative.macroSummary || '';
    
    // Simple markdown to HTML conversion
    summary = summary
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    summaryEl.innerHTML = `<p>${summary}</p>`;
}

/**
 * Render exercises with sparkline charts
 */
async function renderExercises(exercises, exerciseInsights) {
    const container = document.getElementById('exercise-list');
    if (!container) return;

    // Clear existing charts
    exerciseCharts.forEach(chart => chart.destroy());
    exerciseCharts.clear();

    container.innerHTML = exercises.map(exercise => {
        const insight = exerciseInsights[exercise.id] || exerciseInsights[`${exercise.exerciseId}-${exercise.variationId}`] || 
                      `Performance tracked for ${exercise.name}.`;

        return `
            <div class="glass-strong rounded-xl p-6">
                <div class="flex items-start justify-between gap-6">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <h4 class="text-lg font-semibold text-white">${exercise.name}</h4>
                            ${exercise.comparison.isPR ? `
                                <span class="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">
                                    PR
                                </span>
                            ` : ''}
                        </div>
                        <p class="text-white/80 mb-3">${insight}</p>
                        <div class="flex items-center gap-4 text-sm">
                            <div>
                                <span class="text-white/60">${exercise.comparison.metric}</span>
                                <span class="text-white font-semibold ml-2 ${exercise.comparison.improvement ? 'text-green-400' : 'text-red-400'}">
                                    ${exercise.comparison.delta}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="w-32 h-20">
                        <canvas id="sparkline-${exercise.id}" class="sparkline-chart"></canvas>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Render sparkline charts
    exercises.forEach(exercise => {
        const canvasId = `sparkline-${exercise.id}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Prepare data for sparkline
        const labels = exercise.history.map(h => {
            const date = new Date(h.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        // Use maxWeight if available, otherwise avgVolume
        const data = exercise.history.map(h => h.maxWeight || h.avgVolume || h.maxReps || 0);

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: exercise.comparison.metric,
                    data: data,
                    borderColor: exercise.comparison.improvement ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                    backgroundColor: exercise.comparison.improvement ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                }
            }
        });

        exerciseCharts.set(exercise.id, chart);
    });
}

/**
 * Render macro chart (radar or bar chart)
 */
function renderMacroChart(reportData, reportSummary) {
    const canvas = document.getElementById('macro-chart');
    if (!canvas) return;

    // Destroy existing chart
    if (macroChart) {
        macroChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const macroStats = reportData.macroStats;

    // Create a radar chart comparing current session vs average
    // For now, we'll use a simple bar chart with volume, intensity, and duration metrics
    const avgVolume = reportSummary.macroStats?.avgVolume || macroStats.totalVolume * 0.9; // Placeholder
    const currentVolume = macroStats.totalVolume;

    macroChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Volume', 'Intensity', 'Density', 'Consistency'],
            datasets: [
                {
                    label: 'This Session',
                    data: [
                        normalizeValue(currentVolume, 0, currentVolume * 1.5),
                        normalizeValue(macroStats.avgIntensity || 70, 0, 100),
                        80, // Placeholder for density
                        75  // Placeholder for consistency
                    ],
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(59, 130, 246)',
                },
                {
                    label: 'Average (Last 5 Sessions)',
                    data: [
                        normalizeValue(avgVolume, 0, currentVolume * 1.5),
                        70, // Placeholder
                        75, // Placeholder
                        70  // Placeholder
                    ],
                    backgroundColor: 'rgba(156, 163, 175, 0.2)',
                    borderColor: 'rgb(156, 163, 175)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(156, 163, 175)',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#fff',
                        padding: 15
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        display: false
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    pointLabels: {
                        color: '#fff'
                    }
                }
            }
        }
    });
}

/**
 * Normalize value to 0-100 scale
 */
function normalizeValue(value, min, max) {
    if (max === min) return 50;
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/**
 * Download report as PDF
 */
async function downloadReportPdf() {
    try {
        // Check if report is in error state
        const errorEl = document.getElementById('report-error');
        if (errorEl && !errorEl.classList.contains('hidden')) {
            alert('Cannot download PDF: Report failed to load. Please retry loading the report first.');
            return;
        }

        // Check if report is still loading
        const loadingEl = document.getElementById('report-loading');
        if (loadingEl && !loadingEl.classList.contains('hidden')) {
            alert('Please wait for the report to finish loading before downloading.');
            return;
        }

        const element = document.getElementById('performance-report-root');
        if (!element) {
            throw new Error('Report content not found');
        }

        // Verify that report content is actually loaded
        const contentEl = document.getElementById('report-content');
        if (!contentEl || contentEl.classList.contains('hidden')) {
            alert('Report content is not available. Please ensure the report has loaded successfully.');
            return;
        }

        // Check if narrative content exists
        const summaryEl = document.getElementById('macro-summary');
        if (!summaryEl || !summaryEl.textContent.trim()) {
            alert('Report narrative is not available. Please retry loading the report.');
            return;
        }

        // Wait a bit for charts to finish rendering
        await new Promise(resolve => setTimeout(resolve, 500));

        const opt = {
            margin: 10,
            filename: `Workout_Report_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                logging: false
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait' 
            }
        };

        await html2pdf().set(opt).from(element).save();
    } catch (error) {
        console.error('[Performance Report] Error downloading PDF:', error);
        alert(`Error downloading PDF: ${error.message || 'Unknown error'}. Please try again.`);
    }
}

/**
 * Show error state
 */
function showError(message) {
    const loadingEl = document.getElementById('report-loading');
    const contentEl = document.getElementById('report-content');
    const errorEl = document.getElementById('report-error');
    const errorMessageEl = document.getElementById('error-message');
    const retryBtn = document.getElementById('retry-btn');

    if (loadingEl) loadingEl.classList.add('hidden');
    if (contentEl) contentEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');
    if (errorMessageEl) errorMessageEl.textContent = message;

    if (retryBtn) {
        retryBtn.onclick = () => {
            // Reload current report
            const modal = document.getElementById('performance-report-modal');
            if (modal && modal.dataset.reportId) {
                initReportDetail(
                    modal.dataset.reportId,
                    modal.dataset.sessionId,
                    modal.dataset.sessionDate
                );
            }
        };
    }
}

/**
 * Extract set data from completed session structure
 */
function extractSetDataFromCompletedSession(completedSession) {
    const setData = {};
    const phases = ['warmup', 'workout', 'cooldown'];
    
    phases.forEach(phaseName => {
        const phase = completedSession[phaseName] || completedSession[phaseName === 'workout' ? 'workoutPhase' : phaseName];
        if (!phase || !phase.blocks) return;
        
        phase.blocks.forEach(block => {
            if (!block.sets || !Array.isArray(block.sets)) return;
            
            block.sets.forEach(set => {
                const key = `${block.exerciseId}-${block.variationId}-set-${set.setNumber}`;
                setData[key] = {
                    weight: set.weight,
                    reps: set.reps,
                    time: set.time,
                    notes: set.notes,
                    completed: set.completed
                };
            });
        });
    });
    
    return setData;
}

/**
 * Transform reportData to match expected format for narrative generation
 */
function transformReportDataForNarrative(reportData) {
    const rawMacro = reportData.macroStats || {};
    const volumeDeltaPercent = typeof rawMacro.volumeDeltaPercent === 'number'
        ? rawMacro.volumeDeltaPercent
        : null;

    const macroStats = {
        totalVolume: rawMacro.totalVolume || 0,
        volumeChange: volumeDeltaPercent !== null
            ? `${volumeDeltaPercent >= 0 ? '+' : ''}${volumeDeltaPercent}%`
            : '0%',
        duration: formatDuration(rawMacro.durationSeconds || 0),
        avgIntensity: calculateAvgIntensity(reportData.exercises)
    };

    const exercises = reportData.exercises.map(ex => {
        const history = (ex.history || []).map(h => ({
            date: h.date,
            maxWeight: h.maxWeight,
            avgVolume: h.avgVolume,
            maxReps: h.maxReps
        }));

        const hasMaxWeightDelta = ex.comparison.maxWeightDelta !== undefined &&
            ex.comparison.maxWeightDelta !== null;
        const hasVolumeDeltaPercent = ex.comparison.volumeDeltaPercent !== undefined &&
            ex.comparison.volumeDeltaPercent !== null;

        const comparison = {
            metric: hasMaxWeightDelta ? 'Max Weight' : 'Volume',
            delta: hasMaxWeightDelta
                ? `${ex.comparison.maxWeightDelta >= 0 ? '+' : ''}${ex.comparison.maxWeightDelta}kg`
                : hasVolumeDeltaPercent
                    ? `${ex.comparison.volumeDeltaPercent >= 0 ? '+' : ''}${ex.comparison.volumeDeltaPercent}%`
                    : 'N/A',
            improvement: ex.comparison.improvement === true,
            isPR: ex.comparison.isPR === true
        };

        return {
            name: ex.name,
            id: `${ex.exerciseId}-${ex.variationId}`,
            exerciseId: ex.exerciseId,
            variationId: ex.variationId,
            history,
            comparison
        };
    });

    return {
        sessionDate: reportData.sessionDate,
        macroStats,
        exercises
    };
}

/**
 * Format duration in seconds to readable string
 */
function formatDuration(seconds) {
    if (!seconds || seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) return `${minutes}m`;
    return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Calculate average intensity from exercises
 */
function calculateAvgIntensity(exercises) {
    if (!exercises || exercises.length === 0) return 0;
    
    let totalIntensity = 0;
    let count = 0;
    
    exercises.forEach(ex => {
        if (ex.current && ex.current.maxWeight) {
            totalIntensity += ex.current.maxWeight;
            count++;
        }
    });
    
    return count > 0 ? Math.round(totalIntensity / count) : 0;
}

/**
 * Close modal
 */
function closeModal() {
    const modal = document.getElementById('performance-report-modal');
    if (modal) {
        modal.classList.add('hidden');
    }

    // Clean up charts
    if (macroChart) {
        macroChart.destroy();
        macroChart = null;
    }
    exerciseCharts.forEach(chart => chart.destroy());
    exerciseCharts.clear();
}

