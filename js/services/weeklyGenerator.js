/**
 * Weekly Session Generator Service
 * 
 * Automatically generates next week's training sessions when the current week ends.
 * Uses LangGraph workflow via workoutGenerationService to generate sessions based on
 * user onboarding data and exercises/variations from Firebase.
 */

import { generateWeeklySystem } from './workoutGenerationService.js';
import { getSystemSessions, saveSessionToSystem, getTrainingSystem } from './dbService.js';
import { getUserProfile } from './dbService.js';

/**
 * Get the start of the week (Monday) for a given date
 * @param {Date} date - Date to get week start for
 * @returns {Date} Monday of that week
 */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
}

/**
 * Get the start of next week (Monday)
 * @param {Date} date - Reference date
 * @returns {Date} Monday of next week
 */
function getNextWeekStart(date) {
    const weekStart = getWeekStart(date);
    weekStart.setDate(weekStart.getDate() + 7);
    return weekStart;
}

/**
 * Format a Date object to YYYY-MM-DD string
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Check if we should generate next week's sessions
 * Generates on Sunday night (after 6 PM) or Monday morning (before 10 AM)
 * @returns {boolean} True if we should generate next week
 */
function shouldGenerateNextWeek() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();
    
    // Generate on Sunday after 6 PM (18:00) or Monday before 10 AM (10:00)
    if (dayOfWeek === 0 && hour >= 18) {
        return true; // Sunday night
    }
    if (dayOfWeek === 1 && hour < 10) {
        return true; // Monday morning
    }
    
    return false;
}

/**
 * Get current week's sessions (sessions from the current week)
 * @param {Array} allSessions - All sessions from the training system
 * @returns {Array} Sessions from the current week
 */
function getCurrentWeekSessions(allSessions) {
    if (!allSessions || allSessions.length === 0) {
        return [];
    }
    
    const today = new Date();
    const currentWeekStart = getWeekStart(today);
    const nextWeekStart = getNextWeekStart(today);
    
    const currentWeekStartStr = formatDate(currentWeekStart);
    const nextWeekStartStr = formatDate(nextWeekStart);
    
    // Filter sessions that are in the current week
    return allSessions.filter(session => {
        if (!session.date) return false;
        
        const sessionDateStr = typeof session.date === 'string' 
            ? session.date.split('T')[0]
            : formatDate(new Date(session.date));
        
        // Session is in current week if its date is >= current week start and < next week start
        return sessionDateStr >= currentWeekStartStr && sessionDateStr < nextWeekStartStr;
    });
}

/**
 * Check if next week's sessions already exist
 * @param {Array} allSessions - All sessions from the training system
 * @returns {boolean} True if next week's sessions already exist
 */
function hasNextWeekSessions(allSessions) {
    if (!allSessions || allSessions.length === 0) {
        return false;
    }
    
    const today = new Date();
    const nextWeekStart = getNextWeekStart(today);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    
    const nextWeekStartStr = formatDate(nextWeekStart);
    const nextWeekEndStr = formatDate(nextWeekEnd);
    
    // Check if any sessions exist in the next week
    return allSessions.some(session => {
        if (!session.date) return false;
        
        const sessionDateStr = typeof session.date === 'string' 
            ? session.date.split('T')[0]
            : formatDate(new Date(session.date));
        
        return sessionDateStr >= nextWeekStartStr && sessionDateStr < nextWeekEndStr;
    });
}

/**
 * Generate sessions for the next week using LangGraph workflow
 * @param {string} userId - User ID
 * @param {Object} trainingSystem - Training system object
 * @param {Array} currentWeekSessions - Current week's sessions (not used, kept for compatibility)
 * @returns {Promise<Array>} Generated sessions for next week
 */
async function generateNextWeekSessions(userId, trainingSystem, currentWeekSessions) {
    try {
        console.log('[WeeklyGenerator] Generating next week sessions using LangGraph...');
        
        // Get user profile (includes onboarding data and baselineAssessment)
        const userProfile = await getUserProfile(userId);
        if (!userProfile) {
            throw new Error('User profile not found');
        }
        
        // Prepare config for next week
        const nextWeekStart = getNextWeekStart(new Date());
        const config = {
            daysPerWeek: trainingSystem.daysPerWeek || 4,
            framework: trainingSystem.framework || 'Push/Pull',
            startDate: formatDate(nextWeekStart)
        };
        
        // Generate using LangGraph workflow via workoutGenerationService
        // LangGraph will:
        // 1. Use user profile with baselineAssessment (onboarding data)
        // 2. Get exercises and variations from Firebase
        // 3. Generate sessions based on onboarding data, not exercise history
        const generatedSystem = await generateWeeklySystem(
            userProfile,
            config
        );
        
        console.log('[WeeklyGenerator] Generated next week sessions:', generatedSystem.sessions.length);
        
        return generatedSystem.sessions;
    } catch (error) {
        console.error('[WeeklyGenerator] Error generating next week sessions:', error);
        throw error;
    }
}

/**
 * Save generated sessions to Firestore
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @param {Array} sessions - Sessions to save
 * @returns {Promise<void>}
 */
async function saveNextWeekSessions(userId, systemId, sessions) {
    try {
        console.log('[WeeklyGenerator] Saving next week sessions to Firestore...');
        
        // Save each session
        // Remove any existing IDs so Firestore creates new documents
        for (const session of sessions) {
            const sessionWithoutId = { ...session };
            delete sessionWithoutId.id; // Let Firestore generate new IDs
            await saveSessionToSystem(userId, systemId, sessionWithoutId);
        }
        
        console.log('[WeeklyGenerator] Successfully saved', sessions.length, 'sessions');
    } catch (error) {
        console.error('[WeeklyGenerator] Error saving next week sessions:', error);
        throw error;
    }
}

/**
 * Check if next week's sessions should be generated and generate them if needed
 * This function should be called periodically (e.g., on app load or every hour)
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @returns {Promise<boolean>} True if sessions were generated, false otherwise
 */
export async function checkAndGenerateNextWeek(userId, systemId) {
    try {
        // Check if we should generate (Sunday night or Monday morning)
        if (!shouldGenerateNextWeek()) {
            console.log('[WeeklyGenerator] Not time to generate next week yet');
            return false;
        }
        
        console.log('[WeeklyGenerator] Checking if next week sessions need to be generated...');
        
        // Get training system with sessions
        const trainingSystem = await getTrainingSystem(userId, systemId, { includeSessions: true });
        if (!trainingSystem) {
            console.warn('[WeeklyGenerator] Training system not found');
            return false;
        }
        
        // Get all sessions
        const allSessions = trainingSystem.sessions || [];
        
        // Check if next week's sessions already exist
        if (hasNextWeekSessions(allSessions)) {
            console.log('[WeeklyGenerator] Next week sessions already exist, skipping generation');
            return false;
        }
        
        // Get current week's sessions for variety
        const currentWeekSessions = getCurrentWeekSessions(allSessions);
        
        if (currentWeekSessions.length === 0) {
            console.warn('[WeeklyGenerator] No current week sessions found, cannot ensure variety');
            // Still generate, but without variety context
        }
        
        // Generate next week's sessions
        const nextWeekSessions = await generateNextWeekSessions(
            userId,
            trainingSystem,
            currentWeekSessions
        );
        
        // Save to Firestore
        await saveNextWeekSessions(userId, systemId, nextWeekSessions);
        
        console.log('[WeeklyGenerator] Successfully generated and saved next week sessions');
        return true;
    } catch (error) {
        // Log error but don't throw - this is a background process
        console.error('[WeeklyGenerator] Error in checkAndGenerateNextWeek:', error);
        return false;
    }
}

/**
 * Initialize weekly generator - sets up periodic checks
 * Call this once when the app loads
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 */
export function initializeWeeklyGenerator(userId, systemId) {
    // Check immediately on load
    checkAndGenerateNextWeek(userId, systemId).catch(err => {
        console.error('[WeeklyGenerator] Initial check failed:', err);
    });
    
    // Check every hour
    setInterval(() => {
        checkAndGenerateNextWeek(userId, systemId).catch(err => {
            console.error('[WeeklyGenerator] Periodic check failed:', err);
        });
    }, 60 * 60 * 1000); // 1 hour in milliseconds
}

