// Storage helpers with Firebase integration
// Uses Firestore when user is authenticated, falls back to localStorage

// Lazy import to avoid circular dependencies
let getAuthUser = null;
let getFirestoreProfile = null;
let saveFirestoreProfile = null;
let getFirestoreTrainingSystem = null;
let saveFirestoreTrainingSystem = null;
let getAllTrainingSystems = null;

async function ensureImports() {
    if (!getAuthUser) {
        const authModule = await import('./auth-manager.js');
        getAuthUser = authModule.getAuthUser;
    }
    if (!getFirestoreProfile) {
        const dbModule = await import('../services/dbService.js');
        getFirestoreProfile = dbModule.getUserProfile;
        saveFirestoreProfile = dbModule.saveUserProfile;
        getFirestoreTrainingSystem = dbModule.getTrainingSystem;
        saveFirestoreTrainingSystem = dbModule.saveTrainingSystem;
        getAllTrainingSystems = dbModule.getAllTrainingSystems;
    }
}

/**
 * Get the current user role
 * Cache-First: Returns localStorage immediately, updates from Firestore in background
 * @returns {Promise<string|null>} 'athlete' or null
 */
export async function getUserRole() {
    await ensureImports();
    const user = getAuthUser();
    
    // STEP 1: Return localStorage immediately (instant)
    const localRole = localStorage.getItem('userRole');
    
    if (user) {
        // STEP 2: Update from Firestore in background (non-blocking)
        getFirestoreProfile(user.uid)
            .then(profile => {
                if (profile?.role && profile.role !== localRole) {
                    // Update localStorage if Firestore has different value
                    localStorage.setItem('userRole', profile.role);
                }
            })
            .catch(error => {
                // Silently fail - we already returned localRole
                // Only log if we have no localRole at all
                if (!localRole) {
                    console.warn('Error getting role from Firestore:', error);
                }
            });
    }
    
    // Return immediately with cached value
    return localRole;
}

/**
 * Set the user role
 * Optimistic update: Saves to localStorage immediately, syncs to Firestore in background
 * @param {string} role - 'athlete'
 */
export async function setUserRole(role) {
    await ensureImports();
    const user = getAuthUser();
    
    // STEP 1: Save to localStorage immediately (optimistic update)
    localStorage.setItem('userRole', role);
    
    // STEP 2: Sync to Firestore in background (non-blocking)
    if (user) {
        getFirestoreProfile(user.uid, { returnStale: true })
            .then(profile => {
                return saveFirestoreProfile(user.uid, {
                    ...profile,
                    role: role
                });
            })
            .catch(error => {
                // Silently fail - localStorage is already updated
                // Firestore persistence will sync when network is available
                console.warn('Background role sync failed (non-critical):', error.message);
            });
    }
}

/**
 * Get onboarding data from localStorage
 * @returns {Object|null} Onboarding answers object or null
 */
export function getOnboardingData() {
    const data = localStorage.getItem('onboardingData');
    return data ? JSON.parse(data) : null;
}

/**
 * Save onboarding data to localStorage
 * @param {Object} data - Onboarding answers object
 */
export function saveOnboardingData(data) {
    localStorage.setItem('onboardingData', JSON.stringify(data));
}

/**
 * Get calendar view preference
 * @param {string} calendarType - 'athlete'
 * @returns {string} 'weekly' or 'monthly'
 */
export function getCalendarViewPreference(calendarType) {
    const stored = localStorage.getItem(`calendarView-${calendarType}`);
    return stored || 'weekly';
}

/**
 * Save calendar view preference
 * @param {string} calendarType - 'athlete'
 * @param {string} view - 'weekly' or 'monthly'
 */
export function saveCalendarViewPreference(calendarType, view) {
    localStorage.setItem(`calendarView-${calendarType}`, view);
}

/**
 * Clear all user data from localStorage
 */
export function clearUserData() {
    localStorage.removeItem('userRole');
    localStorage.removeItem('onboardingData');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('trainingSystem');
}

/**
 * Get user profile (merge onboarding data with training data)
 * Cache-First: Returns localStorage immediately, updates from Firestore in background
 * @returns {Promise<Object>} User profile object
 */
export async function getUserProfile() {
    await ensureImports();
    const user = getAuthUser();
    
    const baseProfile = {
        currentMilestones: {},
        milestones: [], // User-defined milestones
        currentStreak: 0,
        longestStreak: 0, // Personal best streak
        totalSessions: 0,
        lastSessionDate: null,
        goals: [],
        objectives: [],
        equipment: [],
        discomforts: [],
        preferredDisciplines: []
    };
    
    // STEP 1: Return localStorage data immediately (instant)
    const onboardingData = getOnboardingData();
    const storedProfile = localStorage.getItem('userProfile');
    
    let localProfile = { ...baseProfile };
    
    // Merge onboarding data
    if (onboardingData) {
        localProfile.discomforts = onboardingData.discomforts || [];
        localProfile.preferredDisciplines = onboardingData.primaryDiscipline || [];
        localProfile.objectives = onboardingData.objectives || [];
    }
    
    // Merge stored profile
    if (storedProfile) {
        try {
            const parsed = JSON.parse(storedProfile);
            localProfile = { ...localProfile, ...parsed };
        } catch (e) {
            console.error('Error parsing userProfile:', e);
        }
    }
    
    // STEP 2: Update from Firestore in background (non-blocking)
    if (user) {
        getFirestoreProfile(user.uid)
            .then(profile => {
                if (profile) {
                    // Merge Firestore data with local
                    const merged = { ...baseProfile, ...localProfile, ...profile };
                    // Update localStorage for next time
                    localStorage.setItem('userProfile', JSON.stringify(merged));
                }
            })
            .catch(error => {
                // Silently fail - we already returned localProfile
            });
    }
    
    // Return immediately with cached/local data
    return localProfile;
}

/**
 * Save baseline assessment
 * Saves baseline mobility/rotation/flexibility assessment to user profile
 * @param {Object} assessment - Baseline assessment object
 */
export async function saveBaselineAssessment(assessment) {
    await ensureImports();
    const user = getAuthUser();
    
    // Add completedAt timestamp if not present
    if (!assessment.completedAt) {
        assessment.completedAt = new Date().toISOString();
    }
    
    // Save to Firestore profile (if authenticated)
    if (user) {
        try {
            // Get current profile and merge baseline assessment
            const currentProfile = await getFirestoreProfile(user.uid);
            await saveFirestoreProfile(user.uid, {
                ...currentProfile,
                baselineAssessment: assessment
            });
        } catch (error) {
            console.error('Error saving baseline assessment to Firestore:', error);
            // Fall through to localStorage fallback
        }
    }
    
    // Always save to localStorage as fallback
    const storedProfile = localStorage.getItem('userProfile');
    let profile = storedProfile ? JSON.parse(storedProfile) : {};
    profile.baselineAssessment = assessment;
    localStorage.setItem('userProfile', JSON.stringify(profile));
}

/**
 * Save user profile
 * @param {Object} profile - User profile object
 */
export async function saveUserProfile(profile) {
    await ensureImports();
    const user = getAuthUser();
    
    if (user) {
        // Save to Firestore
        try {
            await saveFirestoreProfile(user.uid, profile);
        } catch (error) {
            console.error('Error saving profile to Firestore:', error);
            // Fall through to localStorage fallback
        }
    }
    
    // Always save to localStorage as fallback
    localStorage.setItem('userProfile', JSON.stringify(profile));
}

/**
 * Get training system (with sessions loaded)
 * Cache-First: Returns localStorage immediately, updates from Firestore in background
 * @param {Object} options - Options { skipCache: boolean }
 * @returns {Promise<Object|null>} Training system object with sessions array or null
 */
export async function getTrainingSystem(options = {}) {
    await ensureImports();
    const user = getAuthUser();
    const { skipCache = false } = options;
    
    // If skipCache is true, fetch from Firebase first (for detecting deletions)
    if (skipCache && user) {
        try {
            const systems = await getAllTrainingSystems(user.uid, { skipCache: true });
            
            // If Firebase returns empty array, clear localStorage and return null
            if (!systems || systems.length === 0) {
                localStorage.removeItem('trainingSystem');
                console.log('[storage] No training systems in Firebase - cleared cache');
                return null;
            }
            
            // Firebase has data - load the latest system with sessions
            const latest = systems[0];
            if (latest.id) {
                const { getTrainingSystem: getDbTrainingSystem } = await import('../services/dbService.js');
                try {
                    const systemWithSessions = await getDbTrainingSystem(user.uid, latest.id, { includeSessions: true });
                    if (systemWithSessions) {
                        // Update localStorage with fresh data
                        localStorage.setItem('trainingSystem', JSON.stringify(systemWithSessions));
                        return systemWithSessions;
                    }
                } catch (error) {
                    console.warn('Failed to load sessions for training system:', error.message);
                    // Still return the system without sessions
                    localStorage.setItem('trainingSystem', JSON.stringify(latest));
                    return latest;
                }
            }
            
            // Update localStorage and return
            localStorage.setItem('trainingSystem', JSON.stringify(latest));
            return latest;
        } catch (error) {
            console.warn('Error fetching training system from Firebase:', error.message);
            // Fall through to cache-first behavior on error
        }
    }
    
    // STEP 1: Return localStorage immediately (instant) - Cache-First pattern
    const stored = localStorage.getItem('trainingSystem');
    let localSystem = stored ? JSON.parse(stored) : null;
    
    // STEP 2: Update from Firestore in background (non-blocking)
    // Load the latest system with sessions included
    if (user) {
        getAllTrainingSystems(user.uid)
            .then(async (systems) => {
                if (systems && Array.isArray(systems) && systems.length > 0) {
                    const latest = systems[0];
                    // Load sessions for the latest system
                    if (latest.id) {
                        const { getTrainingSystem: getDbTrainingSystem } = await import('../services/dbService.js');
                        try {
                            const systemWithSessions = await getDbTrainingSystem(user.uid, latest.id, { includeSessions: true });
                            if (systemWithSessions && systemWithSessions.sessions) {
                                latest.sessions = systemWithSessions.sessions;
                            }
                        } catch (error) {
                            console.warn('Failed to load sessions for training system:', error.message);
                        }
                    }
                    // Update localStorage if we got new data
                    localStorage.setItem('trainingSystem', JSON.stringify(latest));
                    // Note: localSystem is already returned, this update happens in background
                } else {
                    // Firebase returned empty array - clear cache
                    localStorage.removeItem('trainingSystem');
                }
            })
            .catch(error => {
                // This shouldn't happen anymore as getAllTrainingSystems returns empty array on error
                // But keeping for safety
                console.warn('Background training systems update failed (non-critical):', error.message);
            });
        
        // Also try to load sessions for the local system if it exists
        if (localSystem && localSystem.id && user) {
            try {
                const { getSystemSessions } = await import('../services/dbService.js');
                const sessions = await getSystemSessions(user.uid, localSystem.id);
                if (sessions && sessions.length > 0) {
                    localSystem.sessions = sessions;
                } else if (!localSystem.sessions) {
                    // If no sessions found in DB, initialize empty array
                    localSystem.sessions = [];
                }
            } catch (error) {
                console.warn('Failed to load sessions from Firestore (non-critical):', error.message);
                // Ensure sessions array exists even on error
                if (!localSystem.sessions) {
                    localSystem.sessions = [];
                }
            }
        }
    }
    
    // Return immediately with cached data (sessions loaded if available)
    return localSystem;
}

/**
 * Save training system
 * @param {Object} system - Training system object
 */
export async function saveTrainingSystem(system) {
    await ensureImports();
    const user = getAuthUser();
    
    if (user) {
        // Save to Firestore
        try {
            await saveFirestoreTrainingSystem(user.uid, system);
        } catch (error) {
            console.error('Error saving training system to Firestore:', error);
            // Fall through to localStorage fallback
        }
    }
    
    // Always save to localStorage as fallback
    localStorage.setItem('trainingSystem', JSON.stringify(system));
}

/**
 * Save session progress
 * @param {Object} progress - Session progress object
 */
export function saveSessionProgress(progress) {
    localStorage.setItem('sessionProgress', JSON.stringify(progress));
}

/**
 * Get session progress
 * @returns {Object|null} Session progress or null
 */
export function getSessionProgress() {
    const stored = localStorage.getItem('sessionProgress');
    return stored ? JSON.parse(stored) : null;
}

/**
 * Clear session progress
 */
export function clearSessionProgress() {
    localStorage.removeItem('sessionProgress');
}

