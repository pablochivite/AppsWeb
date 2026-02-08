// Athlete Dashboard/Homepage Logic
import { AthleteCalendarManager } from './calendar.js';
import { generateWeeklySystem, findAlternativeVariation, loadExercises, calculateProjectedMetrics } from '../core/workout-engine.js';
import { getUserProfile, saveUserProfile, getTrainingSystem, saveTrainingSystem } from '../core/storage.js';
import { SessionView } from './session-view.js';
import { init as initDashboardUI } from '../../src/ui/dashboard.js';
import { getAuthUser } from '../core/auth-manager.js';
import { cleanFrameworkName } from '../core/constants.js';
import { EditSessionManager } from '../ui/edit-session-manager.js';
import { formatDisciplines } from '../core/ui-utils.js';

let athleteCalendarManager = null;
let routerInstance = null;
let editSessionManager = null;
let currentTrainingSystemId = null;

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
            setTimeout(async () => {
                // initDashboard() will call initDashboardUI() with session metrics
                await initDashboard();
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
        
        // Initialize profile when profile page is shown
        if (page === 'profile') {
            setTimeout(async () => {
                const { initProfile } = await import('./profile.js');
                await initProfile();
            }, 100);
        }
        
        // Initialize insights when insights page is shown
        if (page === 'insights') {
            setTimeout(async () => {
                const { initInsights } = await import('./insights.js');
                await initInsights();
            }, 100);
        }
        
        // Initialize My Training page when modus page is shown
        if (page === 'modus') {
            setTimeout(async () => {
                const { initMyTraining } = await import('./modus-operandi.js');
                await initMyTraining();
            }, 100);
        }
    };
    
    // Also call on initial load if already on home
    setTimeout(async () => {
        if (router.currentPage === 'home') {
            // initDashboard() will call initDashboardUI() with session metrics
            await initDashboard();
        }
    }, 100);
    
    // Initialize weekly generator for automatic session generation
    // This runs in the background and checks periodically
    setTimeout(async () => {
        const user = getAuthUser();
        if (user) {
            const { getTrainingSystem } = await import('../core/storage.js');
            const trainingSystem = await getTrainingSystem();
            if (trainingSystem && trainingSystem.id) {
                const { initializeWeeklyGenerator } = await import('../services/weeklyGenerator.js');
                initializeWeeklyGenerator(user.uid, trainingSystem.id);
            }
        }
    }, 2000); // Wait 2 seconds after app load to not block initial rendering
}

// Export initDashboard to window for session completion callback
window.initDashboard = initDashboard;

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Extract framework name from potentially combined "Discipline - Framework" string
 * Uses the cleanFrameworkName utility to remove discipline names
 * @param {string} label - Potentially combined label
 * @returns {string} Framework name only
 */
function extractFrameworkName(label) {
    if (!label) return 'Daily';
    return cleanFrameworkName(label);
}

/**
 * Check if a date is today
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {boolean} True if date is today
 */
function isToday(date) {
    return date === getTodayDate();
}

/**
 * Check if a date is in the past (before today)
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {boolean} True if date is in the past
 */
function isPastDate(date) {
    return date < getTodayDate();
}

/**
 * Check if today is a training day
 * @param {Object} trainingSystem - Training system object
 * @returns {boolean} True if today is a training day
 */
function isTodayTrainingDay(trainingSystem) {
    if (!trainingSystem) {
        return false;
    }
    
    const today = getTodayDate();
    
    // PRIORITY 1: Check if there's a session with exact date match for today (moved/rescheduled session)
    // This allows moved sessions to make today a training day even if it's not in the weekly pattern
    if (trainingSystem.sessions && Array.isArray(trainingSystem.sessions)) {
        const sessionForToday = trainingSystem.sessions.find(session => {
            if (!session || !session.date) return false;
            // Normalize session date for comparison
            const sessionDateStr = typeof session.date === 'string' 
                ? session.date.split('T')[0] 
                : new Date(session.date).toISOString().split('T')[0];
            return sessionDateStr === today;
        });
        
        if (sessionForToday) {
            // Found a session for today - it's a training day
            return true;
        }
    }
    
    // PRIORITY 2: Fall back to weekly pattern check
    if (!trainingSystem.trainingDaysOfWeek || !Array.isArray(trainingSystem.trainingDaysOfWeek)) {
        return false;
    }
    
    const todayDate = new Date();
    const todayDayOfWeek = todayDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    return trainingSystem.trainingDaysOfWeek.includes(todayDayOfWeek);
}

/**
 * Get the next training day date
 * @param {Object} trainingSystem - Training system object
 * @returns {Date|null} Next training day or null
 */
function getNextTrainingDay(trainingSystem) {
    if (!trainingSystem || !trainingSystem.trainingDaysOfWeek || !Array.isArray(trainingSystem.trainingDaysOfWeek)) {
        return null;
    }
    
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    
    // Find the next training day (excluding today if it's not a training day)
    for (let i = 1; i <= 7; i++) {
        const checkDay = (todayDayOfWeek + i) % 7;
        if (trainingSystem.trainingDaysOfWeek.includes(checkDay)) {
            const nextDay = new Date(today);
            nextDay.setDate(today.getDate() + i);
            return nextDay;
        }
    }
    
    return null;
}

/**
 * Format date for display (e.g., "Monday, January 15" or "Tomorrow")
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatNextTrainingDay(date) {
    if (!date) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateCopy = new Date(date);
    dateCopy.setHours(0, 0, 0, 0);
    
    if (dateCopy.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    }
    
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return dateCopy.toLocaleDateString('en-US', options);
}

/**
 * Show or hide the Session Rating section
 * @param {boolean} show - Whether to show the section
 */
function toggleSessionRatingSection(show) {
    // Find the Session Rating section by looking for the h3 with "Session Rating" text
    // The section is in the sidebar, second card after Current Streak
    const allSections = document.querySelectorAll('.glass-strong.rounded-2xl.p-6.card-hover');
    for (const section of allSections) {
        const h3 = section.querySelector('h3');
        if (h3 && h3.textContent.trim() === 'Session Rating') {
            section.style.display = show ? 'block' : 'none';
            return;
        }
    }
    // If not found, try finding by data attributes or other means
    // This is a fallback - the section should always be found by the h3 text
    console.warn('Session Rating section not found for toggling');
}

/**
 * Render rest day state with streak and next training day
 * @param {Object} userProfile - User profile object
 * @param {Object} trainingSystem - Training system object (must exist)
 */
function renderRestDayState(userProfile, trainingSystem) {
    const card = document.getElementById('daily-session-card');
    if (!card) return;
    
    // Verify trainingSystem exists before using it
    if (!trainingSystem) {
        console.warn('[Dashboard] renderRestDayState called without trainingSystem');
        renderEmptyState();
        return;
    }
    
    const streak = userProfile?.currentStreak || 0;
    const nextTrainingDay = getNextTrainingDay(trainingSystem);
    const nextTrainingDayText = formatNextTrainingDay(nextTrainingDay);
    
    card.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-calendar-check text-6xl text-white/20 mb-6"></i>
            <h3 class="text-2xl font-semibold text-white mb-4">Rest Day</h3>
            <div class="glass rounded-xl p-6 border border-zinc-800 mb-6 max-w-md mx-auto">
                <div class="flex items-center justify-center gap-3 mb-4">
                    <i class="fas fa-fire text-orange-400 text-3xl"></i>
                    <div>
                        <div class="text-4xl font-bold text-white">${streak}</div>
                        <p class="text-sm text-white/60">${streak === 1 ? 'day' : 'days'} in a row</p>
                    </div>
                </div>
                ${nextTrainingDay ? `
                    <p class="text-white/80 mb-2">Keep your streak going!</p>
                    <p class="text-white/60 text-sm">Next training: <span class="font-semibold text-white">${nextTrainingDayText}</span></p>
                ` : `
                    <p class="text-white/80">Keep your streak going!</p>
                `}
            </div>
        </div>
    `;
}

/**
 * Get the active session to display (today's session if available and not completed)
 * Only shows a session if today is a training day
 * @param {Array} sessions - Array of session objects
 * @param {string} userId - User ID
 * @param {Object} trainingSystem - Training system object (optional, for checking if today is a training day)
 * @returns {Promise<Object|null>} Active session or null
 */
async function getActiveSession(sessions, userId, trainingSystem = null) {
    if (!sessions || sessions.length === 0) {
        return null;
    }
    
    const today = getTodayDate();
    const todayDate = new Date();
    const todayDayOfWeek = todayDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Check if today is a training day (using the updated function that checks for moved sessions)
    if (trainingSystem) {
        const isTrainingDay = isTodayTrainingDay(trainingSystem);
        if (!isTrainingDay) {
            // Today is not a training day, don't show any session
            return null;
        }
    }
    
    const { isSessionCompleted } = await import('../services/dbService.js');
    
    // Find today's session - normalize date comparison to handle different date formats
    const todaySession = sessions.find(s => {
        if (!s || !s.date) return false;
        // Normalize session date for comparison (handle both string and Date formats)
        const sessionDateStr = typeof s.date === 'string' 
            ? s.date.split('T')[0] 
            : new Date(s.date).toISOString().split('T')[0];
        // Compare with today's date (both should be in YYYY-MM-DD format)
        return sessionDateStr === today;
    });
    
    if (todaySession) {
        // Check if today's session is completed
        const completed = await isSessionCompleted(userId, today);
        if (completed) {
            // Today's session is completed, don't show it
            return null;
        }
        return todaySession;
    }
    
    // If today is a training day but no session found, this shouldn't happen
    // But if it does, don't show any session (principle: only show session on training days)
    return null;
}

/**
 * Get previous and next sessions relative to current session
 * @param {Array} sessions - Array of session objects
 * @param {Object} currentSession - Current session object
 * @returns {Object} { previous: Object|null, next: Object|null }
 */
function getAdjacentSessions(sessions, currentSession) {
    if (!sessions || !currentSession || !currentSession.date) {
        return { previous: null, next: null };
    }
    
    // Sort sessions by date
    const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
    const currentIndex = sortedSessions.findIndex(s => s.date === currentSession.date);
    
    if (currentIndex === -1) {
        return { previous: null, next: null };
    }
    
    return {
        previous: currentIndex > 0 ? sortedSessions[currentIndex - 1] : null,
        next: currentIndex < sortedSessions.length - 1 ? sortedSessions[currentIndex + 1] : null
    };
}

/**
 * Initialize dashboard - load and render active session
 */
export async function initDashboard() {
    try {
        // Load userProfile (merge onboarding data) - now async
        // Force fresh fetch from Firestore to get updated streak
        const user = getAuthUser();
        let userProfile;
        if (user) {
            // Always fetch fresh profile to get updated streak after session completion
            const { getUserProfile: getFirestoreProfile } = await import('../services/dbService.js');
            const freshProfile = await getFirestoreProfile(user.uid, { skipCache: true });
            if (freshProfile) {
                // Merge with local profile structure
                const localProfile = await getUserProfile();
                userProfile = { ...localProfile, ...freshProfile };
                // Update localStorage with fresh data
                localStorage.setItem('userProfile', JSON.stringify(userProfile));
            } else {
                userProfile = await getUserProfile();
            }
        } else {
            userProfile = await getUserProfile();
        }
        
        // Update homepage stats (streak, milestones)
        await updateHomepageStats(userProfile);
        
        // Check if training system exists - use skipCache to detect deletions
        let trainingSystem = await getTrainingSystem({ skipCache: true });
        
        // If no training system in Firebase but exists in localStorage, sync it
        if (!trainingSystem && user && user.uid) {
            console.log('[Dashboard] No training system in Firebase, checking localStorage...');
            const { syncTrainingSystemFromLocalStorage } = await import('../services/dbService.js');
            try {
                const syncedSystemId = await syncTrainingSystemFromLocalStorage(user.uid);
                if (syncedSystemId) {
                    console.log('[Dashboard] Training system synced from localStorage to Firebase');
                    // Reload training system after sync
                    trainingSystem = await getTrainingSystem({ skipCache: true });
                }
            } catch (error) {
                console.warn('[Dashboard] Error syncing training system:', error);
                // Continue - try to load from localStorage
                trainingSystem = await getTrainingSystem({ skipCache: false });
            }
        }
        
        if (!trainingSystem) {
            // No training system - show empty state with "Generate My First Plan"
            renderEmptyState();
            // Hide session rating section
            toggleSessionRatingSection(false);
            // No training system - show zeros for session rating
            await initDashboardUI({ mobility: 0, rotation: 0, flexibility: 0 });
            return;
        }

        // Store current training system id for Edit Session drawer
        currentTrainingSystemId = trainingSystem.id || null;
        
        // Check and generate next week's sessions if needed (background process)
        if (user && trainingSystem && trainingSystem.id) {
            // Run in background - don't block dashboard rendering
            import('../services/weeklyGenerator.js').then(({ checkAndGenerateNextWeek }) => {
                checkAndGenerateNextWeek(user.uid, trainingSystem.id).catch(err => {
                    // Silently fail - this is a background process
                    console.warn('[Dashboard] Weekly generator check failed:', err);
                });
            }).catch(err => {
                // Silently fail if module can't be loaded
                console.warn('[Dashboard] Could not load weekly generator:', err);
            });
        }
        
        // CRITICAL: Always load fresh sessions from Firestore FIRST
        // This catches sessions that were moved to today via drag-and-drop
        const { isSessionCompleted, getSystemSessions } = await import('../services/dbService.js');
        const today = getTodayDate();
        
        console.log('[Dashboard] Loading sessions for date:', today);
        
        // Always load fresh sessions from Firestore to ensure we have the latest data
        let sessions = trainingSystem.sessions || [];
        if (user?.uid && trainingSystem.id) {
            try {
                const freshSessions = await getSystemSessions(user.uid, trainingSystem.id);
                if (freshSessions && Array.isArray(freshSessions)) {
                    sessions = freshSessions;
                    // Update trainingSystem with fresh sessions for consistency
                    trainingSystem.sessions = sessions;
                    console.log('[Dashboard] Loaded', sessions.length, 'fresh sessions from Firestore');
                }
            } catch (error) {
                console.warn('[Dashboard] Failed to load fresh sessions, using cached:', error.message);
                // Continue with cached sessions if fresh load fails
            }
        }
        
        // Find today's session - normalize date comparison to handle different date formats
        const todaySession = sessions.find(s => {
            if (!s || !s.date) return false;
            // Normalize session date for comparison (handle both string and Date formats)
            const sessionDateStr = typeof s.date === 'string' 
                ? s.date.split('T')[0] 
                : new Date(s.date).toISOString().split('T')[0];
            // Compare with today's date (both should be in YYYY-MM-DD format)
            const matches = sessionDateStr === today;
            if (matches) {
                console.log('[Dashboard] Found session for today:', s.id, 'date:', s.date);
            }
            return matches;
        });
        
        // If there's a session for today, it's a training day (regardless of weekly pattern)
        if (todaySession) {
            // Check if today's session is completed
            // PRIORITY 1: Check the session object's completed flag first (most reliable)
            // PRIORITY 2: Then check completedSessions collection by date
            let activeSession = null;
            
            console.log('[Dashboard] Found session for today:', {
                id: todaySession.id,
                date: todaySession.date,
                completed: todaySession.completed,
                completedAt: todaySession.completedAt
            });
            
            // If session object itself says it's not completed, show it (regardless of completedSessions)
            if (!todaySession.completed) {
                activeSession = todaySession;
                console.log('[Dashboard] Session is not completed (by session.completed flag), showing it');
            } else if (user?.uid) {
                // Session object says completed, but double-check completedSessions for today's date
                // This handles edge cases where session was moved after completion
                const completedByDate = await isSessionCompleted(user.uid, today);
                console.log('[Dashboard] Session completed check by date for', today, ':', completedByDate);
                
                // If there's no completion entry for TODAY's date, show the session
                // (it might have been completed on a different date before being moved)
                if (!completedByDate) {
                    activeSession = todaySession;
                    console.log('[Dashboard] No completion entry for today, showing session (may have been moved)');
                } else {
                    console.log('[Dashboard] Session was completed today, not showing it');
                }
            } else {
                // No user ID, show session anyway
                activeSession = todaySession;
            }
            
            if (activeSession) {
                // Show session rating section for training days
                toggleSessionRatingSection(true);
                await renderDailySession(activeSession, sessions, user?.uid);
                return;
            }
        }
        
        // No session for today - check if today is a training day by weekly pattern
        const isTrainingDay = isTodayTrainingDay(trainingSystem);
        
        if (!isTrainingDay) {
            // Today is NOT a training day - show rest day state
            console.log('[Dashboard] No session for today and not a training day - showing rest day');
            renderRestDayState(userProfile, trainingSystem);
            // Hide session rating section for rest days
            toggleSessionRatingSection(false);
            // Show zeros for session rating (rest day)
            await initDashboardUI({ mobility: 0, rotation: 0, flexibility: 0 });
            return;
        }
        
        // Today IS a training day by pattern but no session found or session is completed
        console.log('[Dashboard] Today is a training day but no active session available');
        renderEmptyState();
        // Hide session rating section when no active session
        toggleSessionRatingSection(false);
        // No active session - show zeros for session rating
        await initDashboardUI({ mobility: 0, rotation: 0, flexibility: 0 });
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        renderEmptyState();
        // Hide session rating section on error
        toggleSessionRatingSection(false);
        // On error, show zeros for session rating
        try {
            await initDashboardUI({ mobility: 0, rotation: 0, flexibility: 0 });
        } catch (uiError) {
            console.error('Error initializing dashboard UI:', uiError);
        }
    }
}

// Store current session for swap functionality
let currentSession = null;

/**
 * Lazy-initialize EditSessionManager
 * @returns {EditSessionManager}
 */
function getEditSessionManager() {
    if (!editSessionManager) {
        editSessionManager = new EditSessionManager();
    }
    return editSessionManager;
}

/**
 * Populate existing Daily Session card with session data
 * @param {Object} session - Session object from training system
 * @param {Array} allSessions - All sessions in the training system
 * @param {string} userId - User ID
 */
async function renderDailySession(session, allSessions = [], userId = null) {
    currentSession = session; // Store for swap functionality
    
    const card = document.getElementById('daily-session-card');
    if (!card) return;
    
    // Check if card is in empty state (has generate button)
    const generateBtn = document.getElementById('generate-plan-btn');
    const isEmptyState = generateBtn !== null;
    
    // If in empty state, restore the full card structure
    if (isEmptyState) {
        // Restore the original card structure
        const dateText = isToday(session.date) ? 'Today' : 
                        (() => {
                            const sessionDate = new Date(session.date);
                            const today = new Date();
                            const tomorrow = new Date(today);
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            
                            if (sessionDate.toDateString() === tomorrow.toDateString()) {
                                return 'Tomorrow';
                            } else {
                                const options = { weekday: 'short', month: 'short', day: 'numeric' };
                                return sessionDate.toLocaleDateString('en-US', options);
                            }
                        })();
        
        const rawWorkout = session.workout || session.framework || 'Daily';
        const framework = extractFrameworkName(rawWorkout);
        
        card.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h3 class="text-xl font-semibold text-white" id="session-title">${framework} Session</h3>
                    <p class="text-sm text-white/60 mt-1" id="session-workout-info">${formatDisciplines(session.discipline) || ''}</p>
                </div>
                <span class="text-xs text-white bg-white/10 px-3 py-1 rounded-full border border-white/20">${dateText}</span>
            </div>
            <div id="session-navigation"></div>
            <div class="space-y-4" id="session-phases"></div>
            <button id="start-session-btn" class="w-full mt-6 bg-white hover:bg-white/90 text-black font-semibold py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-white/20">
                Start Now
            </button>
        `;
    }
    
    // Update title with workout info (only show framework, not discipline)
    const titleEl = document.getElementById('session-title');
    const workoutInfoEl = document.getElementById('session-workout-info');
    const dateBadgeEl = document.querySelector('#daily-session-card .text-xs.text-white');
    
    if (titleEl) {
        const rawWorkout = session.workout || session.framework || 'Daily';
        const framework = extractFrameworkName(rawWorkout);
        titleEl.textContent = `${framework} Session`;
    }
    
    if (workoutInfoEl) {
        workoutInfoEl.textContent = formatDisciplines(session.discipline) || '';
    }
    
    // Update date badge
    if (dateBadgeEl) {
        if (isToday(session.date)) {
            dateBadgeEl.textContent = 'Today';
        } else {
            const sessionDate = new Date(session.date);
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            if (sessionDate.toDateString() === tomorrow.toDateString()) {
                dateBadgeEl.textContent = 'Tomorrow';
            } else {
                // Format date as "Mon, Jan 1"
                const options = { weekday: 'short', month: 'short', day: 'numeric' };
                dateBadgeEl.textContent = sessionDate.toLocaleDateString('en-US', options);
            }
        }
    }
    
    // Render navigation buttons
    renderSessionNavigation(session, allSessions, userId);
    
    // Render expandable phases
    renderExpandablePhases(session);
    
    // Make Start button functional
    const startBtn = document.getElementById('start-session-btn');
    if (startBtn) {
        startBtn.onclick = () => handleStartSession(session);
        startBtn.disabled = false;
    }

    // Wire Edit Session button
    const editBtn = document.getElementById('edit-session-btn');
    if (editBtn) {
        editBtn.onclick = () => handleEditSession(session);
        editBtn.disabled = false;
    }
    
    // Calculate and update session rating (projected metrics)
    try {
        const projectedMetrics = await calculateProjectedMetrics(session);
        // Update dashboard UI with session metrics
        await initDashboardUI(projectedMetrics);
    } catch (error) {
        console.error('Error calculating projected metrics:', error);
        // Still show dashboard with zeros if calculation fails
        await initDashboardUI({ mobility: 0, rotation: 0, flexibility: 0 });
    }
}

/**
 * Handle Edit Session button click
 * @param {Object} session - Current session object
 */
async function handleEditSession(session) {
    try {
        const manager = getEditSessionManager();
        await manager.open(session, currentTrainingSystemId);
    } catch (error) {
        console.error('[Dashboard] Error opening Edit Session drawer:', error);
    }
}

/**
 * Render navigation buttons for previous/next sessions
 * @param {Object} currentSession - Current session object
 * @param {Array} allSessions - All sessions in the training system
 * @param {string} userId - User ID
 */
async function renderSessionNavigation(currentSession, allSessions, userId) {
    const { previous, next } = getAdjacentSessions(allSessions, currentSession);
    
    // Check if previous/next sessions are completed
    const { isSessionCompleted } = await import('../services/dbService.js');
    
    let previousCompleted = false;
    let nextCompleted = false;
    
    if (previous && userId) {
        previousCompleted = await isSessionCompleted(userId, previous.date);
    }
    
    if (next && userId) {
        nextCompleted = await isSessionCompleted(userId, next.date);
    }
    
    // Create or update navigation container
    let navContainer = document.getElementById('session-navigation');
    if (!navContainer) {
        const sessionCard = document.getElementById('daily-session-card');
        if (sessionCard) {
            const headerDiv = sessionCard.querySelector('.flex.items-center.justify-between.mb-6');
            if (headerDiv) {
                navContainer = document.createElement('div');
                navContainer.id = 'session-navigation';
                navContainer.className = 'flex items-center justify-between mb-4';
                headerDiv.parentNode.insertBefore(navContainer, headerDiv.nextSibling);
            }
        }
    }
    
    if (navContainer) {
        navContainer.innerHTML = '';
        
        // Previous session button
        if (previous) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-300 text-white text-sm';
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
            if (previousCompleted) {
                prevBtn.innerHTML += ' <span class="text-xs text-white/60">(Completed)</span>';
            }
            prevBtn.onclick = () => navigateToSession(previous, allSessions, userId);
            navContainer.appendChild(prevBtn);
        }
        
        // Next session button
        if (next) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-300 text-white text-sm';
            if (nextCompleted) {
                nextBtn.innerHTML = '<span class="text-xs text-white/60">(Completed)</span> ';
            }
            nextBtn.innerHTML += 'Next <i class="fas fa-chevron-right"></i>';
            nextBtn.onclick = () => navigateToSession(next, allSessions, userId);
            navContainer.appendChild(nextBtn);
        }
    }
}

/**
 * Navigate to a different session
 * @param {Object} session - Session to navigate to
 * @param {Array} allSessions - All sessions in the training system
 * @param {string} userId - User ID
 */
async function navigateToSession(session, allSessions, userId) {
    await renderDailySession(session, allSessions, userId);
    
    // Scroll to top of session card
    const sessionCard = document.getElementById('daily-session-card');
    if (sessionCard) {
        sessionCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
 * Show empty state with Generate button (only if no training system exists)
 */
function renderEmptyState() {
    const card = document.getElementById('daily-session-card');
    if (!card) return;
    
    // Check if training system exists - use skipCache to detect deletions
    getTrainingSystem({ skipCache: true }).then(trainingSystem => {
        if (trainingSystem) {
            // Training system exists - don't show "Generate My First Plan"
            // This should not happen if called correctly, but handle gracefully
            card.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-dumbbell text-6xl text-white/20 mb-6"></i>
                    <h3 class="text-2xl font-semibold text-white mb-2">No Session Today</h3>
                    <p class="text-white/60">Check back on your next training day</p>
                </div>
            `;
        } else {
            // No training system - show generate button
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
    }).catch(error => {
        console.error('Error checking training system in renderEmptyState:', error);
        // Fallback to showing generate button
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
    });
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
        
        console.log('[Plan Generation] Starting AI-powered plan generation...');
        
        // Load user profile (includes onboarding + baselineAssessment + milestones)
        const userProfile = await getUserProfile();
        console.log('[Plan Generation] User profile loaded:', {
            hasBaselineAssessment: !!userProfile.baselineAssessment,
            hasMilestones: !!userProfile.currentMilestones,
            preferredDisciplines: userProfile.preferredDisciplines,
            discomforts: userProfile.discomforts,
            equipment: userProfile.equipment
        });
        
        // Verify user has completed baseline assessment
        if (!userProfile.baselineAssessment) {
            throw new Error('Please complete your baseline assessment before generating a training plan.');
        }
        
        // ALWAYS use AI generation - this is an AI-driven app
        // forceAI: true ensures it never falls back to rule-based generation
        const systemPromise = generateWeeklySystem(userProfile, {}, { useAI: true, forceAI: true });
        
        // Set up timeout warning (but don't cancel the operation)
        let timeoutWarningShown = false;
        const timeoutWarning = setTimeout(() => {
            timeoutWarningShown = true;
            if (generateBtn) {
                generateBtn.textContent = 'Still generating... This may take a while';
            }
            console.log('[Plan Generation] Generation taking longer than expected, but continuing...');
        }, 60000);
        
        // Wait for generation to complete (no timeout cancellation)
        let system;
        try {
            system = await systemPromise;
        } finally {
            clearTimeout(timeoutWarning);
        }
        
        console.log('[Plan Generation] System generated:', {
            id: system.id,
            framework: system.framework,
            daysPerWeek: system.daysPerWeek,
            sessionsCount: system.sessions?.length
        });
        
        // Validate system
        if (!system || !system.sessions || system.sessions.length === 0) {
            throw new Error('No sessions generated in system');
        }
        
        // Save system to Firestore with sessions in sub-collection
        const user = getAuthUser();
        if (!user || !user.uid) {
            throw new Error('User not authenticated');
        }
        
        console.log('[Plan Generation] Saving system to Firestore...', {
            systemId: system.id,
            sessionsCount: system.sessions.length,
            userId: user.uid
        });
        
        const { saveTrainingSystem: saveDbTrainingSystem } = await import('../services/dbService.js');
        const savedSystemId = await saveDbTrainingSystem(user.uid, system);
        console.log('[Plan Generation] System saved to Firestore successfully', { savedSystemId });
        
        // Also save to localStorage for cache
        await saveTrainingSystem(system);
        
        // Check if today is a training day
        const isTrainingDay = isTodayTrainingDay(system);
        
        if (!isTrainingDay) {
            // Today is NOT a training day - show rest day state
            const userProfile = await getUserProfile();
            renderRestDayState(userProfile, system);
            // Hide session rating section for rest days
            toggleSessionRatingSection(false);
            await initDashboardUI({ mobility: 0, rotation: 0, flexibility: 0 });
        } else {
            // Today IS a training day - render today's session if available and not completed
            const activeSession = await getActiveSession(system.sessions, user?.uid, system);
            if (activeSession) {
                // Show session rating section for training days
                toggleSessionRatingSection(true);
                await renderDailySession(activeSession, system.sessions, user?.uid);
            } else {
                // Today is a training day but no active session (completed or missing)
                renderEmptyState();
                // Hide session rating section when no active session
                toggleSessionRatingSection(false);
                await initDashboardUI({ mobility: 0, rotation: 0, flexibility: 0 });
            }
        }
        console.log('[Plan Generation] Dashboard rendered successfully');
        
        // Re-enable button and update text
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate My First Plan';
        }
        
    } catch (error) {
        console.error('[Plan Generation] Error generating plan:', error);
        console.error('[Plan Generation] Error stack:', error.stack);
        
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

/**
 * Update homepage stats (streak, milestones)
 * @param {Object} userProfile - User profile object
 */
async function updateHomepageStats(userProfile) {
    try {
        // Update streak display
        const streakEl = document.getElementById('current-streak');
        if (streakEl) {
            const streak = userProfile.currentStreak || 0;
            streakEl.textContent = streak;
            console.log('Updated streak display to:', streak);
        }
        
        // Update milestones display
        await renderUpcomingMilestones(userProfile);
    } catch (error) {
        console.error('Error updating homepage stats:', error);
    }
}

/**
 * Render upcoming milestones on homepage
 * @param {Object} userProfile - User profile object
 */
async function renderUpcomingMilestones(userProfile) {
    const milestonesList = document.getElementById('upcoming-milestones');
    if (!milestonesList) {
        console.warn('Milestones list element not found');
        return;
    }
    
    const milestones = userProfile.milestones || [];
    
    if (milestones.length === 0) {
        milestonesList.innerHTML = `
            <div class="glass rounded-lg p-3 border border-zinc-800 text-center">
                <p class="text-sm text-white/60">No milestones yet. Create one in your Profile!</p>
            </div>
        `;
        return;
    }
    
    // Calculate progress for each milestone and sort by progress (descending - closest to completion first)
    const milestonesWithProgress = milestones.map(milestone => {
        const progress = calculateMilestoneProgress(milestone, userProfile);
        return { ...milestone, progress };
    }).sort((a, b) => b.progress.percentage - a.progress.percentage);
    
    // Show top 3 upcoming milestones
    const upcomingMilestones = milestonesWithProgress.filter(m => m.progress.percentage < 100).slice(0, 3);
    
    if (upcomingMilestones.length === 0) {
        milestonesList.innerHTML = `
            <div class="glass rounded-lg p-3 border border-zinc-800 text-center">
                <p class="text-sm text-white/60">All milestones completed! 🎉</p>
            </div>
        `;
        return;
    }
    
    milestonesList.innerHTML = upcomingMilestones.map(milestone => {
        const { progress } = milestone;
        return `
            <div class="glass rounded-lg p-3 border border-zinc-800">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-medium text-white">${milestone.name}</span>
                    <span class="text-xs text-white/60">${progress.remainingText}</span>
                </div>
                <div class="w-full bg-white/10 rounded-full h-2">
                    <div class="bg-white h-full rounded-full transition-all duration-500" style="width: ${progress.percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Calculate progress for a milestone
 * @param {Object} milestone - Milestone object
 * @param {Object} userProfile - User profile object
 * @returns {Object} Progress object with percentage and remainingText
 */
function calculateMilestoneProgress(milestone, userProfile) {
    const { type, target, metric } = milestone;
    
    let current = 0;
    let percentage = 0;
    let remaining = 0;
    let remainingText = '';
    
    switch (type) {
        case 'streak':
            current = userProfile.currentStreak || 0;
            remaining = Math.max(0, target - current);
            percentage = Math.min(100, (current / target) * 100);
            remainingText = remaining > 0 ? `${remaining} days left` : 'Completed!';
            break;
            
        case 'sessions':
            current = userProfile.totalSessions || 0;
            remaining = Math.max(0, target - current);
            percentage = Math.min(100, (current / target) * 100);
            remainingText = remaining > 0 ? `${remaining} sessions left` : 'Completed!';
            break;
            
        case 'metric':
            // For metric-based milestones (mobility, rotation, flexibility)
            const baselineMetrics = userProfile.baselineAssessment?.baselineMetrics || {};
            const currentMetric = baselineMetrics[metric] || 0;
            remaining = Math.max(0, target - currentMetric);
            percentage = Math.min(100, (currentMetric / target) * 100);
            remainingText = remaining > 0 ? `${remaining}% to go` : 'Completed!';
            break;
            
        default:
            percentage = 0;
            remainingText = 'Unknown type';
    }
    
    return { percentage, remaining, remainingText, current };
}

