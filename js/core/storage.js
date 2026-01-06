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
 * @returns {Promise<string|null>} 'athlete', 'coach', or null
 */
export async function getUserRole() {
    await ensureImports();
    const user = getAuthUser();
    
    if (user) {
        // Try Firestore first
        try {
            const profile = await getFirestoreProfile(user.uid);
            if (profile?.role) {
                return profile.role;
            }
        } catch (error) {
            console.warn('Error getting role from Firestore, falling back to localStorage:', error);
        }
    }
    
    // Fallback to localStorage
    return localStorage.getItem('userRole');
}

/**
 * Set the user role
 * @param {string} role - 'athlete' or 'coach'
 */
export async function setUserRole(role) {
    await ensureImports();
    const user = getAuthUser();
    
    if (user) {
        // Save to Firestore
        try {
            const profile = await getFirestoreProfile(user.uid);
            await saveFirestoreProfile(user.uid, {
                ...profile,
                role: role
            });
        } catch (error) {
            console.error('Error saving role to Firestore:', error);
            // Fall through to localStorage fallback
        }
    }
    
    // Always save to localStorage as fallback
    localStorage.setItem('userRole', role);
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
 * Get calendar view preference for a specific calendar type
 * @param {string} calendarType - 'athlete' or 'coach'
 * @returns {string} 'weekly' or 'monthly'
 */
export function getCalendarViewPreference(calendarType) {
    const stored = localStorage.getItem(`calendarView-${calendarType}`);
    return stored || 'weekly';
}

/**
 * Save calendar view preference for a specific calendar type
 * @param {string} calendarType - 'athlete' or 'coach'
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
 * @returns {Promise<Object>} User profile object
 */
export async function getUserProfile() {
    await ensureImports();
    const user = getAuthUser();
    
    const baseProfile = {
        currentMilestones: {},
        goals: [],
        equipment: [],
        discomforts: [],
        preferredDisciplines: []
    };
    
    if (user) {
        // Try Firestore first
        try {
            const profile = await getFirestoreProfile(user.uid);
            if (profile) {
                return { ...baseProfile, ...profile };
            }
        } catch (error) {
            console.warn('Error getting profile from Firestore, falling back to localStorage:', error);
        }
    }
    
    // Fallback to localStorage
    const onboardingData = getOnboardingData();
    const storedProfile = localStorage.getItem('userProfile');
    
    // Merge onboarding data
    if (onboardingData) {
        baseProfile.discomforts = onboardingData.discomforts || [];
        baseProfile.preferredDisciplines = onboardingData.primaryDiscipline || [];
    }
    
    // Merge stored profile
    if (storedProfile) {
        try {
            const parsed = JSON.parse(storedProfile);
            return { ...baseProfile, ...parsed };
        } catch (e) {
            console.error('Error parsing userProfile:', e);
        }
    }
    
    return baseProfile;
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
 * Get training system
 * @returns {Promise<Object|null>} Training system object or null
 */
export async function getTrainingSystem() {
    await ensureImports();
    const user = getAuthUser();
    
    if (user) {
        // Try Firestore first - get latest training system
        try {
            const systems = await getAllTrainingSystems(user.uid);
            if (systems && systems.length > 0) {
                // Return the most recent one
                return systems[0];
            }
        } catch (error) {
            console.warn('Error getting training system from Firestore, falling back to localStorage:', error);
        }
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem('trainingSystem');
    return stored ? JSON.parse(stored) : null;
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

