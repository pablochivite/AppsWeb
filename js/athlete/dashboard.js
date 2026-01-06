// Athlete Dashboard/Homepage Logic
import { AthleteCalendarManager } from './calendar.js';
import { generateWeeklySystem, findAlternativeVariation, loadExercises } from '../core/workout-engine.js';
import { getUserProfile, saveUserProfile, getTrainingSystem, saveTrainingSystem } from '../core/storage.js';
import { SessionView } from './session-view.js';

let athleteCalendarManager = null;
let routerInstance = null;

/**
 * Initialize athlete-specific functionality
 * @param {SPARouter} router - The SPA router instance
 */
export function initializeAthleteApp(router) {
    routerInstance = router;
    
    // Initialize calendar when calendar page is shown
    const originalNavigateTo = router.navigateTo.bind(router);
    router.navigateTo = function(page) {
        originalNavigateTo(page);
        
        // Initialize dashboard when home page is shown
        if (page === 'home') {
            setTimeout(() => {
                initDashboard();
            }, 100);
        }
        
        // Initialize calendar manager when calendar page is shown
        if (page === 'calendar') {
            setTimeout(async () => {
                if (!athleteCalendarManager) {
                    athleteCalendarManager = new AthleteCalendarManager();
                } else {
                    // Re-render if manager already exists
                    await athleteCalendarManager.renderCalendar();
                }
            }, 100);
        }
    };
    
    // Also call on initial load if already on home
    setTimeout(() => {
        if (router.currentPage === 'home') {
            initDashboard();
        }
    }, 100);
}

// Export initDashboard to window for session completion callback
window.initDashboard = initDashboard;

/**
 * Initialize dashboard - load and render first session
 */
export async function initDashboard() {
    try {
        // Load userProfile (merge onboarding data) - now async
        const userProfile = await getUserProfile();
        
        // Check if training system exists - now async
        let trainingSystem = await getTrainingSystem();
        
        if (!trainingSystem) {
            // Show empty state
            renderEmptyState();
            return;
        }
        
        // Render first session
        const firstSession = trainingSystem.sessions && trainingSystem.sessions[0];
        if (firstSession) {
            renderDailySession(firstSession);
        } else {
            renderEmptyState();
        }
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        renderEmptyState();
    }
}

// Store current session for swap functionality
let currentSession = null;

/**
 * Populate existing Daily Session card with session data
 * @param {Object} session - Session object from training system
 */
function renderDailySession(session) {
    currentSession = session; // Store for swap functionality
    
    // Update title with workout info
    const titleEl = document.getElementById('session-title');
    const workoutInfoEl = document.getElementById('session-workout-info');
    
    if (titleEl) {
        titleEl.textContent = `${session.workout || 'Daily'} Session`;
    }
    
    if (workoutInfoEl) {
        workoutInfoEl.textContent = session.discipline || '';
    }
    
    // Render expandable phases
    renderExpandablePhases(session);
    
    // Make Start button functional
    const startBtn = document.getElementById('start-session-btn');
    if (startBtn) {
        startBtn.onclick = () => handleStartSession(session);
        startBtn.disabled = false;
    }
}

/**
 * Render expandable phases with variation lists
 * @param {Object} session - Session object
 */
function renderExpandablePhases(session) {
    const phasesContainer = document.getElementById('session-phases');
    if (!phasesContainer || !session.phases) return;
    
    const phaseConfig = {
        warmup: { name: 'Warm-up', icon: 'fa-fire', color: 'text-orange-400' },
        workout: { name: 'Workout', icon: 'fa-dumbbell', color: 'text-white' },
        cooldown: { name: 'Cool Down', icon: 'fa-wind', color: 'text-blue-400' }
    };
    
    phasesContainer.innerHTML = '';
    
    ['warmup', 'workout', 'cooldown'].forEach(phaseKey => {
        const phase = session.phases[phaseKey] || [];
        const config = phaseConfig[phaseKey];
        
        const phaseCard = document.createElement('div');
        phaseCard.className = 'glass rounded-xl border border-zinc-800 overflow-hidden';
        phaseCard.setAttribute('data-phase', phaseKey);
        
        const isExpanded = phaseKey === 'warmup'; // Expand first phase by default
        
        phaseCard.innerHTML = `
            <div class="p-4 cursor-pointer" onclick="togglePhase('${phaseKey}')">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center">
                        <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mr-3 border border-white/20">
                            <i class="fas ${config.icon} ${config.color}"></i>
                        </div>
                        <div>
                            <h4 class="font-semibold text-white">${config.name}</h4>
                            <p class="text-xs text-white/60">${phase.length} exercise${phase.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-white text-sm font-medium">Ready</span>
                        <i class="fas fa-chevron-${isExpanded ? 'up' : 'down'} text-white/60 transition-transform duration-300" id="phase-chevron-${phaseKey}"></i>
                    </div>
                </div>
            </div>
            <div class="phase-variations px-4 pb-4 ${isExpanded ? '' : 'hidden'}" id="phase-variations-${phaseKey}">
                ${phase.length > 0 ? renderVariationList(phase, phaseKey) : '<p class="text-sm text-white/60">No exercises in this phase</p>'}
            </div>
        `;
        
        phasesContainer.appendChild(phaseCard);
    });
}

/**
 * Render list of variations for a phase
 * @param {Array} variations - Array of variation objects
 * @param {string} phaseKey - Phase key (warmup/workout/cooldown)
 * @returns {string} HTML string
 */
function renderVariationList(variations, phaseKey) {
    return variations.map((variation, index) => `
        <div class="flex items-center justify-between py-2 border-b border-white/10 last:border-0" data-variation-index="${index}">
            <div class="flex-1">
                <p class="text-sm font-medium text-white">${variation.variationName || variation.exerciseName}</p>
                <p class="text-xs text-white/60">${variation.exerciseName || ''}</p>
            </div>
            <button 
                class="ml-3 p-2 rounded-lg hover:bg-white/10 transition-all duration-300 swap-btn" 
                onclick="handleSwapVariation('${variation.exerciseId}', '${variation.variationId}', '${phaseKey}', ${index})"
                title="Swap exercise"
            >
                <i class="fas fa-exchange-alt text-white/60 hover:text-white transition-colors"></i>
            </button>
        </div>
    `).join('');
}

/**
 * Toggle phase expansion
 * @param {string} phaseKey - Phase key to toggle
 */
window.togglePhase = function(phaseKey) {
    const variationsEl = document.getElementById(`phase-variations-${phaseKey}`);
    const chevronEl = document.getElementById(`phase-chevron-${phaseKey}`);
    
    if (variationsEl && chevronEl) {
        const isExpanded = !variationsEl.classList.contains('hidden');
        
        if (isExpanded) {
            variationsEl.classList.add('hidden');
            chevronEl.classList.remove('fa-chevron-up');
            chevronEl.classList.add('fa-chevron-down');
        } else {
            variationsEl.classList.remove('hidden');
            chevronEl.classList.remove('fa-chevron-down');
            chevronEl.classList.add('fa-chevron-up');
        }
    }
};

/**
 * Handle swap variation click
 * @param {string} exerciseId - Current exercise ID
 * @param {string} variationId - Current variation ID
 * @param {string} phaseKey - Phase key
 * @param {number} variationIndex - Index in phase array
 */
window.handleSwapVariation = async function(exerciseId, variationId, phaseKey, variationIndex) {
    if (!currentSession) return;
    
    try {
        const exercises = await loadExercises();
        const currentVariation = currentSession.phases[phaseKey][variationIndex];
        
        if (!currentVariation) return;
        
        // Find alternatives
        const alternatives = await findAlternativeVariation(
            currentVariation,
            exercises.exercises || [],
            phaseKey
        );
        
        if (alternatives.length === 0) {
            alert('No alternative exercises found. Try a different variation.');
            return;
        }
        
        // Show selection modal (simplified - just use first alternative for now)
        // TODO: Create proper selection UI
        const selected = alternatives[0];
        
        // Update session
        currentSession.phases[phaseKey][variationIndex] = selected;
        
        // Update training system - now async
        const trainingSystem = await getTrainingSystem();
        if (trainingSystem && trainingSystem.sessions) {
            const sessionIndex = trainingSystem.sessions.findIndex(s => 
                s.date === currentSession.date || s.day === currentSession.day
            );
            if (sessionIndex !== -1) {
                trainingSystem.sessions[sessionIndex] = currentSession;
                await saveTrainingSystem(trainingSystem);
            }
        }
        
        // Re-render phase
        renderExpandablePhases(currentSession);
        
    } catch (error) {
        console.error('Error swapping variation:', error);
        alert('Error swapping exercise. Please try again.');
    }
};

/**
 * Show empty state with Generate button
 */
function renderEmptyState() {
    const card = document.getElementById('daily-session-card');
    if (!card) return;
    
    // Store original content structure
    const originalContent = card.innerHTML;
    
    card.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-dumbbell text-6xl text-white/20 mb-6"></i>
            <h3 class="text-2xl font-semibold text-white mb-2">Ready to Start?</h3>
            <p class="text-white/60 mb-8">Generate your first personalized training plan</p>
            <button id="generate-plan-btn" class="bg-white hover:bg-white/90 text-black font-semibold px-8 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02]">
                Generate My First Plan
            </button>
        </div>
    `;
    
    const generateBtn = document.getElementById('generate-plan-btn');
    if (generateBtn) {
        generateBtn.onclick = handleGeneratePlan;
    }
}

/**
 * Generate weekly system and render
 */
async function handleGeneratePlan() {
    const generateBtn = document.getElementById('generate-plan-btn');
    
    try {
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating...';
        }
        
        console.log('Starting plan generation...');
        const userProfile = await getUserProfile(); // Now async
        console.log('User profile:', userProfile);
        
        // Add timeout to detect if it's hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Generation timeout after 30 seconds')), 30000);
        });
        
        const systemPromise = generateWeeklySystem(userProfile);
        const system = await Promise.race([systemPromise, timeoutPromise]);
        
        console.log('System generated:', system);
        
        // Validate system
        if (!system || !system.sessions || system.sessions.length === 0) {
            throw new Error('No sessions generated in system');
        }
        
        // Save system - now async
        await saveTrainingSystem(system);
        console.log('System saved to Firestore/localStorage');
        
        // Render first session
        renderDailySession(system.sessions[0]);
        console.log('Dashboard rendered successfully');
        
    } catch (error) {
        console.error('Error generating plan:', error);
        console.error('Error stack:', error.stack);
        
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate My First Plan';
        }
        
        // Show user-friendly error message
        const errorMsg = error.message || 'Error generating training plan. Please check console for details.';
        alert(`Error: ${errorMsg}`);
    }
}

/**
 * Handle Start Session button click
 * @param {Object} session - Session object
 */
function handleStartSession(session) {
    if (!session) {
        console.error('No session provided');
        return;
    }
    
    // Launch SessionView
    const sessionView = new SessionView(session);
    sessionView.render();
}

