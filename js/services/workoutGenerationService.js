/**
 * Workout Generation Service
 * 
 * Service layer for generating workouts using LangGraph workflow via Cloud Functions.
 * Replaces direct calls to aiService.js with LangGraph-based generation.
 */

import { getAuthUser } from '../core/auth-manager.js';

/**
 * Calculate training days of week
 */
function calculateTrainingDaysOfWeek(daysPerWeek) {
  const patterns = {
    2: [1, 4], // Monday, Thursday
    3: [1, 3, 5], // Monday, Wednesday, Friday
    4: [1, 3, 5, 0], // Monday, Wednesday, Friday, Sunday
    5: [1, 2, 4, 5, 6], // Monday, Tuesday, Thursday, Friday, Saturday
    6: [1, 2, 3, 4, 5, 6], // Monday through Saturday
    7: [0, 1, 2, 3, 4, 5, 6] // Every day
  };
  
  if (patterns[daysPerWeek]) {
    return patterns[daysPerWeek];
  }
  
  // For other numbers, distribute evenly
  const days = [];
  const step = Math.floor(7 / daysPerWeek);
  for (let i = 0; i < daysPerWeek; i++) {
    days.push((i * step + 1) % 7);
  }
  return days.sort((a, b) => a - b);
}

/**
 * Get week start (Monday)
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

// Determine if we're using emulator or production
// IMPORTANT: By default, use PRODUCTION unless explicitly set to use emulator
// This prevents accidentally using emulator in production
// CRITICAL: Only use emulator if explicitly set to 'true' (string)
const emulatorEnvValue = import.meta.env.VITE_USE_FIREBASE_EMULATOR;
const USE_EMULATOR = emulatorEnvValue === 'true' || emulatorEnvValue === true;
const EMULATOR_HOST = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || 'localhost';
const EMULATOR_PORT = import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || '5001';

// Log the configuration for debugging
// CRITICAL: Log all environment variables to help debug emulator vs production issue
console.log('[WorkoutGenerationService] 🔍 Environment configuration check:', {
  VITE_USE_FIREBASE_EMULATOR_raw: emulatorEnvValue,
  VITE_USE_FIREBASE_EMULATOR_type: typeof emulatorEnvValue,
  VITE_USE_FIREBASE_EMULATOR_stringified: String(emulatorEnvValue),
  USE_EMULATOR: USE_EMULATOR,
  EMULATOR_HOST: EMULATOR_HOST,
  EMULATOR_PORT: EMULATOR_PORT,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  NODE_ENV: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
});

// Force production if emulator is explicitly set to false
if (emulatorEnvValue === 'false' || emulatorEnvValue === false) {
  console.log('[WorkoutGenerationService] ✅ VITE_USE_FIREBASE_EMULATOR is explicitly false - FORCING PRODUCTION');
}

/**
 * Get the base URL for Cloud Functions
 * @returns {string} Base URL for functions
 */
function getFunctionsBaseUrl() {
  // CRITICAL: Only use emulator if explicitly enabled
  // Default to production to prevent accidental emulator usage
  if (USE_EMULATOR) {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) {
      console.error('[WorkoutGenerationService] ERROR: VITE_FIREBASE_PROJECT_ID is required for emulator');
      throw new Error('VITE_FIREBASE_PROJECT_ID is required for emulator');
    }
    const url = `http://${EMULATOR_HOST}:${EMULATOR_PORT}/${projectId}/us-central1`;
    console.warn('[WorkoutGenerationService] ⚠️ USING EMULATOR URL:', url);
    console.warn('[WorkoutGenerationService] ⚠️ To use production, set VITE_USE_FIREBASE_EMULATOR=false or remove it from .env');
    return url;
  }
  
  // Production: use the actual Firebase project's functions URL
  // This should be set in environment variables
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error('[WorkoutGenerationService] ERROR: VITE_FIREBASE_PROJECT_ID is required for production');
    throw new Error('VITE_FIREBASE_PROJECT_ID is required for production');
  }
  
  const url = `https://us-central1-${projectId}.cloudfunctions.net`;
  console.log('[WorkoutGenerationService] ✅ Using PRODUCTION URL:', url);
  return url;
}

/**
 * Get authentication token
 * @returns {Promise<string>} Firebase auth token
 */
async function getAuthToken() {
  const user = getAuthUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  return user.getIdToken();
}

/**
 * Generate a weekly training system using LangGraph
 * @param {Object} userProfile - User profile with preferences, goals, etc.
 * @param {Object} config - Configuration (daysPerWeek, framework, startDate)
 * @returns {Promise<Object>} Generated weekly training system
 */
export async function generateWeeklySystem(userProfile = {}, config = {}) {
  try {
    const token = await getAuthToken();
    const baseUrl = getFunctionsBaseUrl();
    const url = `${baseUrl}/generateWorkout`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        requestType: 'weekly',
        config: {
          daysPerWeek: config.daysPerWeek || 3,
          framework: config.framework || 'Push/Pull',
          startDate: config.startDate || new Date().toISOString().split('T')[0],
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
      const validationErrors = errorData.validationErrors || [];
      
      // Log detailed error information
      console.error('[WorkoutGenerationService] Weekly system request failed:', {
        status: response.status,
        error: errorMessage,
        validationErrors: validationErrors,
      });
      
      // Include validation errors in the error message if available
      if (validationErrors.length > 0) {
        throw new Error(`${errorMessage}: ${validationErrors.join(', ')}`);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Transform response to match expected format from workout-engine.js
    // Calculate training days of week
    const daysPerWeek = config.daysPerWeek || 3;
    const trainingDaysOfWeek = calculateTrainingDaysOfWeek(daysPerWeek);
    
    // Calculate start date (Monday of current week)
    const today = new Date();
    const weekStart = getWeekStart(today);
    weekStart.setHours(0, 0, 0, 0);
    const startDate = config.startDate || weekStart.toISOString().split('T')[0];
    
    return {
      id: `weekly-system-${Date.now()}`,
      type: 'weekly',
      startDate: startDate,
      daysPerWeek: daysPerWeek,
      framework: config.framework || 'Push/Pull',
      trainingDaysOfWeek: trainingDaysOfWeek,
      sessions: data.sessions || [],
      editable: true,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error generating weekly system:', error);
    throw new Error(`Failed to generate weekly system: ${error.message}`);
  }
}


