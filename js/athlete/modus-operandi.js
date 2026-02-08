// Athlete My Training - Training System Analysis & Statistics
import { getTrainingSystem } from '../core/storage.js';
import { getAuthUser } from '../core/auth-manager.js';
import { getCompletedSessions } from '../services/dbService.js';
import { calculateProjectedMetrics } from '../core/workout-engine.js';
import { cleanFrameworkName } from '../core/constants.js';
import { initTrainingReports } from './training-reports.js';
import { normalizeDisciplines } from '../core/ui-utils.js';

/**
 * Initialize My Training page with training system statistics
 */
export async function initMyTraining() {
    try {
        const user = getAuthUser();
        if (!user) {
            console.warn('[My Training] User not authenticated');
            renderEmptyState();
            return;
        }

        // Use skipCache to ensure we get fresh data from Firebase (detects deletions)
        const trainingSystem = await getTrainingSystem({ skipCache: true });
        if (!trainingSystem || !trainingSystem.sessions || trainingSystem.sessions.length === 0) {
            console.warn('[My Training] No training system found');
            renderEmptyState();
            return;
        }

        // Render training cycle info
        renderTrainingCycleInfo(trainingSystem);

        // Calculate and render discipline percentages per framework
        const disciplineStats = calculateDisciplineStats(trainingSystem);
        renderFrameworkStats(disciplineStats);

        // Calculate and render weekly rating (includes all sessions of the week)
        const weeklyRating = await calculateWeeklyRating(user.uid, trainingSystem);
        renderWeeklyRating(weeklyRating);

        // Initialize training reports section
        await initTrainingReports();

    } catch (error) {
        console.error('[My Training] Error initializing:', error);
        renderEmptyState();
    }
}

/**
 * Calculate discipline statistics grouped by framework
 * @param {Object} trainingSystem - Training system with sessions
 * @returns {Object} Discipline stats grouped by framework
 */
function calculateDisciplineStats(trainingSystem) {
    const stats = {};
    const sessions = trainingSystem.sessions || [];

    /**
     * Extract framework name from potentially combined "Discipline - Framework" string
     * Uses the cleanFrameworkName utility to remove discipline names
     * @param {string} label - Potentially combined label
     * @returns {string} Framework name only
     */
    function extractFrameworkName(label) {
        if (!label) return 'Unknown';
        return cleanFrameworkName(label);
    }
    
    // Group sessions by framework (workout label)
    sessions.forEach(session => {
        const rawFramework = session.workout || session.framework || 'Unknown';
        const framework = extractFrameworkName(rawFramework);
        if (!stats[framework]) {
            stats[framework] = {
                framework,
                disciplines: {},
                totalExercises: 0
            };
        }

        // Count exercises by discipline for this session
        // Normalize discipline to handle both string (legacy) and array (new) formats
        const disciplines = normalizeDisciplines(session.discipline);
        const disciplinesList = disciplines.length > 0 ? disciplines : ['Unknown'];
        let exerciseCount = 0;

        // Count exercises in all phases
        ['warmup', 'workout', 'cooldown'].forEach(phase => {
            const phaseExercises = session.phases?.[phase] || [];
            exerciseCount += phaseExercises.length;
        });

        // Distribute exercise count across all disciplines in the session
        // If a session has multiple disciplines, each gets a proportional count
        const countPerDiscipline = exerciseCount / disciplinesList.length;
        
        disciplinesList.forEach(discipline => {
            if (!stats[framework].disciplines[discipline]) {
                stats[framework].disciplines[discipline] = 0;
            }
            stats[framework].disciplines[discipline] += countPerDiscipline;
        });
        
        stats[framework].totalExercises += exerciseCount;
    });

    // Calculate percentages for each framework
    Object.keys(stats).forEach(framework => {
        const frameworkStats = stats[framework];
        frameworkStats.percentages = {};

        Object.keys(frameworkStats.disciplines).forEach(discipline => {
            const count = frameworkStats.disciplines[discipline];
            const percentage = frameworkStats.totalExercises > 0
                ? Math.round((count / frameworkStats.totalExercises) * 100)
                : 0;
            frameworkStats.percentages[discipline] = percentage;
        });
    });

    return stats;
}

/**
 * Render training cycle information
 * @param {Object} trainingSystem - Training system
 */
function renderTrainingCycleInfo(trainingSystem) {
    const cycleInfoEl = document.getElementById('training-cycle-info');
    if (!cycleInfoEl) {
        console.warn('[My Training] Training cycle info element not found');
        return;
    }

    const framework = trainingSystem.framework || 'Training';
    const daysPerWeek = trainingSystem.daysPerWeek || 0;
    
    // Calculate week progress (simplified - could be enhanced)
    const sessions = trainingSystem.sessions || [];
    const completedSessions = sessions.filter(s => s.completed).length;
    const totalSessions = sessions.length;
    const progress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    cycleInfoEl.innerHTML = `
        <h3 class="text-xl font-semibold text-white mb-4">Current Training Cycle</h3>
        <div class="flex items-center justify-between">
            <div>
                <p class="text-white/60 mb-1">${completedSessions} of ${totalSessions} sessions</p>
                <div class="w-64 bg-white/10 rounded-full h-3">
                    <div class="bg-white h-full rounded-full transition-all duration-500" style="width: ${progress}%"></div>
                </div>
            </div>
            <span class="text-white font-semibold">${framework}</span>
        </div>
    `;
}

/**
 * Render framework statistics with discipline percentages
 * @param {Object} disciplineStats - Discipline stats grouped by framework
 */
function renderFrameworkStats(disciplineStats) {
    const frameworksContainer = document.getElementById('training-frameworks-container');
    if (!frameworksContainer) {
        console.warn('[My Training] Training frameworks container not found');
        return;
    }

    const frameworks = Object.keys(disciplineStats);
    if (frameworks.length === 0) {
        frameworksContainer.innerHTML = '<p class="text-white/60 col-span-2 text-center py-8">No training frameworks found</p>';
        return;
    }

    // Render each framework card
    frameworksContainer.innerHTML = frameworks.map(framework => {
        const stats = disciplineStats[framework];
        const disciplines = Object.keys(stats.percentages).sort((a, b) => 
            stats.percentages[b] - stats.percentages[a]
        );

        const frameworkIcon = getFrameworkIcon(framework);

        return `
            <div class="glass-strong rounded-2xl p-6 card-hover">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold text-white">${framework}</h3>
                    <i class="fas ${frameworkIcon} text-white"></i>
                </div>
                <div class="space-y-4">
                    ${disciplines.map(discipline => {
                        const percentage = stats.percentages[discipline];
                        return `
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-sm text-white/70">${discipline}</span>
                                    <span class="text-sm font-semibold text-white">${percentage}%</span>
                                </div>
                                <div class="w-full bg-white/10 rounded-full h-2">
                                    <div class="bg-white h-full rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    ${disciplines.length === 0 ? '<p class="text-sm text-white/60 text-center py-4">No exercises found</p>' : ''}
                </div>
            </div>
        `;
    }).join('');

    // Add placeholder cards if only one framework
    if (frameworks.length === 1) {
        frameworksContainer.innerHTML += `
            <div class="glass-strong rounded-2xl p-6 card-hover opacity-50">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold text-white/60">Additional Framework</h3>
                    <i class="fas fa-dumbbell text-white/60"></i>
                </div>
                <div class="space-y-4">
                    <p class="text-sm text-white/60 text-center py-4">Add more training days to see additional frameworks</p>
                </div>
            </div>
        `;
    }
}

/**
 * Get icon for framework type
 * @param {string} framework - Framework name
 * @returns {string} FontAwesome icon class
 */
function getFrameworkIcon(framework) {
    const lower = framework.toLowerCase();
    if (lower.includes('push')) return 'fa-arrow-up';
    if (lower.includes('pull')) return 'fa-arrow-down';
    if (lower.includes('leg') || lower.includes('lower')) return 'fa-walking';
    if (lower.includes('upper')) return 'fa-hand-paper';
    if (lower.includes('full') || lower.includes('body')) return 'fa-user';
    return 'fa-dumbbell';
}

/**
 * Calculate weekly rating average from all weekly sessions in the training system
 * Includes both completed sessions (using actual metrics) and upcoming sessions (using projected metrics)
 * Uses the first sessionsPerWeek sessions from the training system (typically 4 sessions per week)
 * @param {string} userId - User ID
 * @param {Object} trainingSystem - Training system with sessions
 * @returns {Promise<Object>} Weekly rating with mobility, rotation, flexibility
 */
async function calculateWeeklyRating(userId, trainingSystem) {
    try {
        const sessions = trainingSystem?.sessions || [];
        if (sessions.length === 0) {
            return { mobility: 0, rotation: 0, flexibility: 0, overall: 0, count: 0 };
        }

        // Get daysPerWeek from training system (typically 4 sessions per week)
        const daysPerWeek = trainingSystem?.daysPerWeek || 4;
        
        // Get the first sessionsPerWeek sessions (weekly sessions)
        // These represent one week of training
        const weekSessions = sessions.slice(0, daysPerWeek);

        if (weekSessions.length === 0) {
            return { mobility: 0, rotation: 0, flexibility: 0, overall: 0, count: 0 };
        }

        // Get date range for completed sessions lookup
        const dates = weekSessions.map(s => s.date).filter(Boolean);
        if (dates.length === 0) {
            // If no dates, we'll still calculate projected metrics
        }

        // Get all completed sessions for the week in one query
        const minDate = dates.length > 0 ? Math.min(...dates) : null;
        const maxDate = dates.length > 0 ? Math.max(...dates) : null;
        
        let completedSessions = [];
        if (minDate && maxDate) {
            completedSessions = await getCompletedSessions(userId, {
                startDate: minDate,
                endDate: maxDate
            });
        }

        // Create a map of completed sessions by date for quick lookup
        const completedSessionsMap = new Map();
        if (completedSessions && completedSessions.length > 0) {
            completedSessions.forEach(session => {
                if (session.date && session.metricsSummary) {
                    completedSessionsMap.set(session.date, session.metricsSummary);
                }
            });
        }

        // Calculate averages from all sessions in the week
        let totalMobility = 0;
        let totalRotation = 0;
        let totalFlexibility = 0;
        let validCount = 0;

        // Process each session in the week
        for (const session of weekSessions) {
            let metrics = null;

            // Check if session is completed by looking in the map
            const completedMetrics = session.date ? completedSessionsMap.get(session.date) : null;
            
            if (completedMetrics) {
                // For completed sessions, use actual metrics
                metrics = completedMetrics;
            } else {
                // For non-completed sessions, calculate projected metrics
                metrics = await calculateProjectedMetrics(session);
            }

            // Add metrics to totals if valid
            if (metrics) {
                totalMobility += metrics.mobility || 0;
                totalRotation += metrics.rotation || 0;
                totalFlexibility += metrics.flexibility || 0;
                validCount++;
            }
        }

        if (validCount === 0) {
            return { mobility: 0, rotation: 0, flexibility: 0, overall: 0, count: 0 };
        }

        const mobility = Math.round(totalMobility / validCount);
        const rotation = Math.round(totalRotation / validCount);
        const flexibility = Math.round(totalFlexibility / validCount);
        const overall = Math.round((mobility + rotation + flexibility) / 3);

        return { mobility, rotation, flexibility, overall, count: validCount };

    } catch (error) {
        console.error('[My Training] Error calculating weekly rating:', error);
        return { mobility: 0, rotation: 0, flexibility: 0, overall: 0, count: 0 };
    }
}

/**
 * Render weekly rating section
 * @param {Object} weeklyRating - Weekly rating object
 */
function renderWeeklyRating(weeklyRating) {
    // Use specific ID selector to avoid conflicts with framework cards
    const ratingSection = document.querySelector('#weekly-rating-card');
    if (!ratingSection) {
        console.warn('[My Training] Weekly rating card not found');
        return;
    }

    const { mobility, rotation, flexibility, overall, count } = weeklyRating;

    ratingSection.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-white">Weekly Rating</h3>
            <i class="fas fa-chart-line text-white"></i>
        </div>
        
        ${count === 0 ? `
            <div class="text-center py-8">
                <p class="text-white/60 mb-2">No sessions this week</p>
                <p class="text-sm text-white/40">Complete sessions to see your weekly rating</p>
            </div>
        ` : `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Mobility Progress -->
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center">
                            <i class="fas fa-arrows-alt text-white mr-2"></i>
                            <span class="font-medium text-white">Mobility</span>
                        </div>
                        <span class="text-white font-semibold">${mobility}%</span>
                    </div>
                    <div class="w-full bg-white/10 rounded-full h-3 overflow-hidden border border-white/10">
                        <div class="bg-white h-full rounded-full progress-bar transition-all duration-500" style="width: ${mobility}%"></div>
                    </div>
                </div>

                <!-- Rotation Progress -->
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center">
                            <i class="fas fa-sync-alt text-white mr-2"></i>
                            <span class="font-medium text-white">Rotation</span>
                        </div>
                        <span class="text-white font-semibold">${rotation}%</span>
                    </div>
                    <div class="w-full bg-white/10 rounded-full h-3 overflow-hidden border border-white/10">
                        <div class="bg-white h-full rounded-full progress-bar transition-all duration-500" style="width: ${rotation}%"></div>
                    </div>
                </div>

                <!-- Flexibility Progress -->
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center">
                            <i class="fas fa-bend text-white mr-2"></i>
                            <span class="font-medium text-white">Flexibility</span>
                        </div>
                        <span class="text-white font-semibold">${flexibility}%</span>
                    </div>
                    <div class="w-full bg-white/10 rounded-full h-3 overflow-hidden border border-white/10">
                        <div class="bg-white h-full rounded-full progress-bar transition-all duration-500" style="width: ${flexibility}%"></div>
                    </div>
                </div>
            </div>

            <div class="mt-6 pt-6 border-t border-zinc-800">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="text-sm text-white/60">Overall Score (${count} session${count !== 1 ? 's' : ''})</span>
                    </div>
                    <span class="text-2xl font-bold text-white">${overall}%</span>
                </div>
            </div>
        `}
    `;
}

/**
 * Render empty state when no training system is available
 */
function renderEmptyState() {
    const container = document.getElementById('my-training-container');
    if (!container) {
        // Fallback to querySelector if ID not found
        const fallbackContainer = document.querySelector('#page-modus .max-w-7xl');
        if (!fallbackContainer) return;
        fallbackContainer.innerHTML = `
            <div class="mb-8">
                <h2 class="text-4xl font-bold text-white mb-2">My Training</h2>
                <p class="text-white/60">Your Training System & Cycle</p>
            </div>
            <div class="text-center py-12">
                <i class="fas fa-dumbbell text-6xl text-white/20 mb-6"></i>
                <h3 class="text-2xl font-semibold text-white mb-2">No Training System</h3>
                <p class="text-white/60 mb-8">Generate your first training plan to see statistics here</p>
            </div>
        `;
        return;
    }

    // Replace all content with empty state
    container.innerHTML = `
        <div class="mb-8">
            <h2 class="text-4xl font-bold text-white mb-2">My Training</h2>
            <p class="text-white/60">Your Training System & Cycle</p>
        </div>
        <div class="text-center py-12">
            <i class="fas fa-dumbbell text-6xl text-white/20 mb-6"></i>
            <h3 class="text-2xl font-semibold text-white mb-2">No Training System</h3>
            <p class="text-white/60 mb-8">Generate your first training plan to see statistics here</p>
        </div>
    `;
}
