/**
 * Database Service
 * 
 * Service layer for Firestore operations related to workout sessions.
 */

import { db } from '../../config/firebase.config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { getExerciseById } from './exerciseService.js';

/**
 * Get user sessions sub-collection reference
 * @param {string} userId - User ID
 * @returns {import('firebase/firestore').CollectionReference}
 */
function getUserSessionsRef(userId) {
  return collection(db, 'users', userId, 'sessions');
}

/**
 * Get user document reference
 * @param {string} userId - User ID
 * @returns {import('firebase/firestore').DocumentReference}
 */
function getUserDocRef(userId) {
  return doc(db, 'users', userId);
}

/**
 * Get user training systems reference
 * @param {string} userId - User ID
 * @returns {import('firebase/firestore').CollectionReference}
 */
function getUserTrainingSystemsRef(userId) {
  return collection(db, 'users', userId, 'trainingSystems');
}

/**
 * Get all completed sessions for a user, sorted by date (descending)
 * @param {string} userId - User ID
 * @param {number} limitCount - Maximum number of sessions to retrieve (default: 100)
 * @returns {Promise<Array>} Array of completed sessions
 */
async function getAllCompletedSessions(userId, limitCount = 100) {
  try {
    const sessionsRef = getUserSessionsRef(userId);
    const q = query(
      sessionsRef,
      orderBy('date', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date,
        completedAt: data.completedAt
      };
    });
  } catch (error) {
    console.error('Error getting completed sessions:', error);
    return [];
  }
}

/**
 * Get completed sessions with better date handling for streak calculation
 * Normalizes dates to ensure consistent comparison
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of completed sessions with normalized dates
 */
async function getCompletedSessions(userId) {
  try {
    const sessionsRef = getUserSessionsRef(userId);
    const q = query(
      sessionsRef,
      orderBy('date', 'desc'),
      limit(100)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Preserve original date format for normalization in streak calculation
      return {
        id: doc.id,
        date: data.date, // Keep original format (could be string or Timestamp)
        completedAt: data.completedAt
      };
    });
  } catch (error) {
    console.error('[Streak] Error getting completed sessions:', error);
    return [];
  }
}

/**
 * Get the latest training system for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Training system or null
 */
async function getLatestTrainingSystem(userId) {
  try {
    const systemsRef = getUserTrainingSystemsRef(userId);
    const q = query(
      systemsRef,
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      startDate: data.startDate?.toDate?.()?.toISOString() || data.startDate,
      daysPerWeek: data.daysPerWeek,
      sessions: data.sessions || []
    };
  } catch (error) {
    console.error('Error getting latest training system:', error);
    return null;
  }
}

/**
 * Determine which days of the week are training days based on the training system
 * @param {Object} trainingSystem - Training system object with startDate, daysPerWeek, and sessions
 * @returns {Set<number>} Set of day of week indices (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
function getTrainingDaysOfWeek(trainingSystem) {
  if (!trainingSystem || !trainingSystem.sessions || trainingSystem.sessions.length === 0) {
    // Default: assume consecutive days starting from Monday if no system
    return new Set([1, 2, 3]); // Mon, Tue, Wed
  }
  
  const trainingDays = new Set();
  const sessions = trainingSystem.sessions;
  
  // Extract day of week from each session's date
  for (const session of sessions) {
    if (session.date) {
      const date = new Date(session.date);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      trainingDays.add(dayOfWeek);
    }
  }
  
  // If we couldn't determine from sessions, use startDate and daysPerWeek
  if (trainingDays.size === 0 && trainingSystem.startDate) {
    const startDate = new Date(trainingSystem.startDate);
    const startDayOfWeek = startDate.getDay();
    const daysPerWeek = trainingSystem.daysPerWeek || 3;
    
    // Add consecutive days starting from startDate
    for (let i = 0; i < daysPerWeek; i++) {
      trainingDays.add((startDayOfWeek + i) % 7);
    }
  }
  
  return trainingDays;
}

/**
 * Check if a date is a training day
 * @param {Date} date - Date to check
 * @param {Set<number>} trainingDaysOfWeek - Set of training day indices (0-6)
 * @returns {boolean} True if the date is a training day
 */
function isTrainingDay(date, trainingDaysOfWeek) {
  const dayOfWeek = date.getDay();
  const isTraining = trainingDaysOfWeek.has(dayOfWeek);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  console.log(`[Streak]   isTrainingDay(${dayNames[dayOfWeek]}, day=${dayOfWeek}):`, isTraining, 'Training days:', Array.from(trainingDaysOfWeek).sort((a, b) => a - b));
  return isTraining;
}

/**
 * Get the previous training day before a given date
 * @param {Date} date - Reference date
 * @param {Set<number>} trainingDaysOfWeek - Set of training day indices (0-6)
 * @returns {Date|null} Previous training day or null if none found
 */
function getPreviousTrainingDay(date, trainingDaysOfWeek) {
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const startDateStr = checkDate.toISOString().split('T')[0];
  const startDay = checkDate.getDay();
  
  // Look back up to 7 days to find the previous training day
  for (let i = 1; i <= 7; i++) {
    checkDate.setDate(checkDate.getDate() - 1);
    const checkDay = checkDate.getDay();
    const checkDateStr = checkDate.toISOString().split('T')[0];
    
    if (isTrainingDay(checkDate, trainingDaysOfWeek)) {
      console.log(`[Streak]   getPreviousTrainingDay: Found previous training day ${i} day(s) back: ${checkDateStr} (${dayNames[checkDay]})`);
      return new Date(checkDate);
    }
  }
  
  console.log(`[Streak]   getPreviousTrainingDay: No previous training day found within 7 days of ${startDateStr} (${dayNames[startDay]})`);
  return null;
}

/**
 * Calculate streak based on training days (not calendar days)
 * @param {string} userId - User ID
 * @param {string} currentSessionDate - Current session date (ISO string)
 * @returns {Promise<number>} Current streak count
 */
async function calculateTrainingDayStreak(userId, currentSessionDate) {
  try {
    console.log('[Streak] ===== STARTING STREAK CALCULATION =====');
    console.log('[Streak] User ID:', userId);
    console.log('[Streak] Current session date (raw):', currentSessionDate, typeof currentSessionDate);
    
    // Get training system to determine training days
    const trainingSystem = await getLatestTrainingSystem(userId);
    if (!trainingSystem) {
      // No training system - default to calendar day streak
      console.log('[Streak] ❌ No training system found, defaulting to streak: 1');
      return 1;
    }
    
    console.log('[Streak] ✓ Training system found:', {
      startDate: trainingSystem.startDate,
      daysPerWeek: trainingSystem.daysPerWeek,
      sessionsCount: trainingSystem.sessions?.length || 0
    });
    
    const trainingDaysOfWeek = getTrainingDaysOfWeek(trainingSystem);
    const trainingDaysArray = Array.from(trainingDaysOfWeek).sort((a, b) => a - b);
    console.log('[Streak] ✓ Training days of week (0=Sun, 1=Mon, ..., 6=Sat):', trainingDaysArray);
    
    // Get all completed sessions
    const completedSessions = await getCompletedSessions(userId);
    console.log('[Streak] ✓ Completed sessions count:', completedSessions.length);
    
    if (completedSessions.length === 0) {
      // First session
      console.log('[Streak] ✓ First session ever, returning streak: 1');
      console.log('[Streak] ===== STREAK CALCULATION COMPLETE: 1 =====');
      return 1;
    }
    
    // Normalize all session dates to YYYY-MM-DD format for consistent comparison
    const normalizedSessions = completedSessions.map(s => {
      let normalizedDate;
      if (typeof s.date === 'string') {
        // Extract YYYY-MM-DD from string (handle both YYYY-MM-DD and ISO strings)
        normalizedDate = s.date.split('T')[0];
      } else if (s.date?.toDate) {
        // Firestore Timestamp
        normalizedDate = s.date.toDate().toISOString().split('T')[0];
      } else if (s.date instanceof Date) {
        // Date object
        normalizedDate = s.date.toISOString().split('T')[0];
      } else {
        console.warn('[Streak] ⚠️ Unknown date format:', s.date);
        normalizedDate = null;
      }
      return { ...s, date: normalizedDate };
    }).filter(s => s.date !== null);
    
    // Sort sessions by date (ascending)
    const sortedSessions = normalizedSessions.sort((a, b) => a.date.localeCompare(b.date));
    console.log('[Streak] ✓ Sorted session dates:', sortedSessions.map(s => s.date));
    
    // Get unique session dates (in case user completed multiple sessions on same day)
    const sessionDates = [...new Set(sortedSessions.map(s => s.date))];
    console.log('[Streak] ✓ Unique session dates:', sessionDates);
    
    // Parse current session date (normalize to YYYY-MM-DD format)
    // Handle both YYYY-MM-DD and full ISO string formats
    let currentDate;
    if (typeof currentSessionDate === 'string' && currentSessionDate.includes('T')) {
      currentDate = new Date(currentSessionDate);
    } else if (typeof currentSessionDate === 'string') {
      currentDate = new Date(currentSessionDate + 'T00:00:00');
    } else if (currentSessionDate instanceof Date) {
      currentDate = new Date(currentSessionDate);
    } else {
      currentDate = new Date();
    }
    currentDate.setHours(0, 0, 0, 0);
    const currentDateStr = currentDate.toISOString().split('T')[0];
    const currentDayOfWeek = currentDate.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    console.log('[Streak] ✓ Current session date normalized:', currentDateStr);
    console.log('[Streak] ✓ Current day of week:', currentDayOfWeek, `(${dayNames[currentDayOfWeek]})`);
    
    // Check if current date is a training day
    const isCurrentDateTrainingDay = isTrainingDay(currentDate, trainingDaysOfWeek);
    console.log('[Streak] ✓ Is current date a training day?', isCurrentDateTrainingDay);
    
    if (!isCurrentDateTrainingDay) {
      // Current session is not on a training day - this shouldn't happen, but handle gracefully
      console.warn('[Streak] ⚠️ Current session date is NOT a training day!');
      console.log('[Streak] ⚠️ Current day:', currentDayOfWeek, `(${dayNames[currentDayOfWeek]})`);
      console.log('[Streak] ⚠️ Training days:', trainingDaysArray);
      console.log('[Streak] ===== STREAK CALCULATION COMPLETE: 1 (not a training day) =====');
      return 1;
    }
    
    // Check if there's already a session on the current date (shouldn't happen, but handle it)
    const hasSessionToday = sessionDates.includes(currentDateStr);
    console.log('[Streak] ✓ Has session on current date?', hasSessionToday);
    
    if (hasSessionToday) {
      // User already completed a session today - don't increment streak
      // Find the last unique session date before today
      const datesBeforeToday = sessionDates.filter(d => d < currentDateStr).sort((a, b) => b.localeCompare(a));
      console.log('[Streak] ✓ Dates before today:', datesBeforeToday);
      
      if (datesBeforeToday.length === 0) {
        console.log('[Streak] ✓ No previous sessions, returning streak: 1');
        console.log('[Streak] ===== STREAK CALCULATION COMPLETE: 1 =====');
        return 1;
      }
      
      // Use the most recent session date as the reference point
      const lastSessionDateStr = datesBeforeToday[0];
      const lastSessionDate = new Date(lastSessionDateStr + 'T00:00:00');
      lastSessionDate.setHours(0, 0, 0, 0);
      const lastDayOfWeek = lastSessionDate.getDay();
      
      console.log('[Streak] ✓ Last session date:', lastSessionDateStr, `(${dayNames[lastDayOfWeek]})`);
      
      // Check if last session was on the previous training day
      const previousTrainingDay = getPreviousTrainingDay(currentDate, trainingDaysOfWeek);
      if (previousTrainingDay) {
        const previousDateStr = previousTrainingDay.toISOString().split('T')[0];
        const previousDayOfWeek = previousTrainingDay.getDay();
        console.log('[Streak] ✓ Previous training day:', previousDateStr, `(${dayNames[previousDayOfWeek]})`);
        console.log('[Streak] ✓ Last session date matches previous training day?', lastSessionDateStr === previousDateStr);
        
        if (lastSessionDateStr === previousDateStr) {
          // Last session was on previous training day - maintain streak
          // Calculate streak from last session
          let streak = 1;
          let checkDate = new Date(lastSessionDate);
          
          console.log('[Streak] ✓ Starting backwards streak calculation from:', lastSessionDateStr);
          let iteration = 0;
          
          while (iteration < 100) { // Safety limit
            iteration++;
            const prevTrainingDay = getPreviousTrainingDay(checkDate, trainingDaysOfWeek);
            if (!prevTrainingDay) {
              console.log('[Streak] ✓ No more previous training days found');
              break;
            }
            
            const prevDateStr = prevTrainingDay.toISOString().split('T')[0];
            const prevDayOfWeek = prevTrainingDay.getDay();
            const hasSession = sessionDates.includes(prevDateStr);
            
            console.log(`[Streak]   [${iteration}] Checking:`, prevDateStr, `(${dayNames[prevDayOfWeek]})`, 'Has session?', hasSession);
            
            if (hasSession) {
              streak++;
              console.log(`[Streak]   [${iteration}] ✓ Found session, streak now:`, streak);
              checkDate = prevTrainingDay;
            } else {
              console.log(`[Streak]   [${iteration}] ✗ No session, streak broken at:`, streak);
              break;
            }
          }
          
          console.log('[Streak] ===== STREAK CALCULATION COMPLETE:', streak, '=====');
          return streak;
        }
      }
      // Last session was not on previous training day - reset streak
      console.log('[Streak] ⚠️ Last session was not on previous training day, resetting to: 1');
      console.log('[Streak] ===== STREAK CALCULATION COMPLETE: 1 =====');
      return 1;
    }
    
    // Calculate streak by checking consecutive training days
    let streak = 1;
    let checkDate = new Date(currentDate);
    
    console.log('[Streak] ✓ Starting backwards streak calculation from current date');
    console.log('[Streak] ✓ Current date:', currentDateStr);
    
    // Work backwards from current date
    let iteration = 0;
    while (iteration < 100) { // Safety limit
      iteration++;
      
      // Get previous training day
      const previousTrainingDay = getPreviousTrainingDay(checkDate, trainingDaysOfWeek);
      if (!previousTrainingDay) {
        console.log('[Streak]   [', iteration, '] No more previous training days found');
        break;
      }
      
      // Check if there's a completed session on the previous training day
      const previousDateStr = previousTrainingDay.toISOString().split('T')[0];
      const previousDayOfWeek = previousTrainingDay.getDay();
      const hasSessionOnPreviousDay = sessionDates.includes(previousDateStr);
      
      console.log(`[Streak]   [${iteration}] Checking:`, previousDateStr, `(${dayNames[previousDayOfWeek]})`, 'Has session?', hasSessionOnPreviousDay);
      
      if (hasSessionOnPreviousDay) {
        streak++;
        console.log(`[Streak]   [${iteration}] ✓ Found session, streak now:`, streak);
        checkDate = previousTrainingDay;
      } else {
        // Gap found - streak is broken
        console.log(`[Streak]   [${iteration}] ✗ No session found, streak broken at:`, streak);
        break;
      }
    }
    
    console.log('[Streak] ===== STREAK CALCULATION COMPLETE:', streak, '=====');
    return streak;
  } catch (error) {
    console.error('[Streak] ❌ Error calculating training day streak:', error);
    console.error('[Streak] ❌ Error stack:', error.stack);
    // Fallback to 1 on error
    return 1;
  }
}

/**
 * Calculate metrics summary from all variations performed in a session
 * Iterates through all 3 phases -> blocks -> variations to aggregate metrics
 * 
 * @param {Object} sessionData - Session data with warmup, workout, cooldown phases
 * @returns {Promise<Object>} Aggregated metrics { mobility, rotation, flexibility }
 */
async function calculateMetricsSummary(sessionData) {
  const metricsTotals = { mobility: 0, rotation: 0, flexibility: 0 };
  let variationCount = 0;

  // Iterate through all 3 phases
  const phases = ['warmup', 'workout', 'cooldown'];
  
  for (const phaseName of phases) {
    const phase = sessionData[phaseName];
    if (!phase || !phase.blocks || !Array.isArray(phase.blocks)) {
      continue;
    }

    // Iterate through blocks
    for (const block of phase.blocks) {
      // Block can be a single variation OR a Superset (array of variations)
      const variations = Array.isArray(block) ? block : [block];

      // Iterate through variations in the block
      for (const variation of variations) {
        if (!variation || !variation.variationId) {
          continue;
        }

        // Fetch variation master data to get metrics
        const variationMaster = await getExerciseById(variation.variationId);
        
        if (variationMaster && variationMaster.metrics) {
          const metrics = variationMaster.metrics;
          metricsTotals.mobility += metrics.mobility || 0;
          metricsTotals.rotation += metrics.rotation || 0;
          metricsTotals.flexibility += metrics.flexibility || 0;
          variationCount++;
        }
      }
    }
  }

  // Calculate averages (avoid division by zero)
  if (variationCount === 0) {
    return { mobility: 0, rotation: 0, flexibility: 0 };
  }

  return {
    mobility: Math.round(metricsTotals.mobility / variationCount),
    rotation: Math.round(metricsTotals.rotation / variationCount),
    flexibility: Math.round(metricsTotals.flexibility / variationCount)
  };
}

/**
 * Save completed workout session
 * 
 * 1. Calculates metricsSummary from variation master data
 * 2. Saves session to users/{userId}/sessions using addDoc
 * 3. Atomically updates currentStreak and totalSessions in user profile
 * 
 * @param {string} userId - User ID
 * @param {Object} sessionData - Session data following WorkoutSession interface structure:
 *   - workout: string (workout label, e.g., 'Push')
 *   - discipline: string (e.g., 'Pilates')
 *   - date: string (ISO date string)
 *   - startedAt: string (ISO timestamp)
 *   - completedAt: string (ISO timestamp)
 *   - duration: number (seconds)
 *   - warmup: Phase { blocks: Block[], duration: number }
 *   - workout: Phase { blocks: Block[], duration: number }
 *   - cooldown: Phase { blocks: Block[], duration: number }
 * 
 * @returns {Promise<string>} Session document ID
 */
export async function saveCompletedSession(userId, sessionData) {
  try {
    // Validate required fields
    if (!userId || !sessionData) {
      throw new Error('UserId and sessionData are required');
    }

    // Extract workout label (string) before processing phases
    const workoutLabel = sessionData.workout || '';
    
    // Ensure all 3 phases exist (even if empty)
    // Note: 'workout' in sessionData might refer to the label, so check for 'workoutPhase'
    const phaseMap = {
      warmup: sessionData.warmup,
      workout: sessionData.workoutPhase || sessionData.workout, // Handle both naming conventions
      cooldown: sessionData.cooldown
    };
    
    const phases = ['warmup', 'workout', 'cooldown'];
    for (const phaseName of phases) {
      // Get the phase data (could be from phaseName key or mapped key)
      let phaseData = phaseMap[phaseName];
      
      if (!phaseData || typeof phaseData !== 'object' || !phaseData.blocks) {
        phaseData = { blocks: [], duration: 0 };
      } else {
        // Ensure blocks array exists
        if (!Array.isArray(phaseData.blocks)) {
          phaseData.blocks = [];
        }
        // Ensure duration exists
        if (typeof phaseData.duration !== 'number') {
          phaseData.duration = phaseData.duration || 0;
        }
      }
      
      // Store normalized phase data
      sessionData[phaseName] = phaseData;
    }

    // Calculate metrics summary from all variations performed
    const metricsSummary = await calculateMetricsSummary(sessionData);

    // Prepare session document for Firestore
    // Store workout label as 'workoutLabel' and workout phase as 'workout' to match schema
    const sessionDoc = {
      userId,
      workoutLabel: workoutLabel, // Workout label (e.g., 'Push', 'Pull')
      discipline: sessionData.discipline || '',
      date: sessionData.date || new Date().toISOString().split('T')[0],
      startedAt: sessionData.startedAt || new Date().toISOString(),
      completedAt: sessionData.completedAt || new Date().toISOString(),
      duration: sessionData.duration || 0,
      warmup: sessionData.warmup, // Phase object
      workout: sessionData.workout, // Phase object
      cooldown: sessionData.cooldown, // Phase object
      metricsSummary,
      createdAt: serverTimestamp()
    };

    // Calculate streak based on training days BEFORE the transaction
    // This ensures we have the most up-to-date data
    console.log('[SaveSession] Calculating streak before saving session...');
    const calculatedStreak = await calculateTrainingDayStreak(userId, sessionDoc.date);
    console.log('[SaveSession] ✓ Calculated streak value:', calculatedStreak);
    console.log('[SaveSession] ✓ Will write streak to Firestore:', calculatedStreak);

    // Use transaction to atomically:
    // 1. Save session
    // 2. Update user profile (currentStreak, totalSessions)
    const sessionId = await runTransaction(db, async (transaction) => {
      // Get user profile for total sessions count
      const userRef = getUserDocRef(userId);
      const userSnap = await transaction.get(userRef);
      
      let totalSessions = 1;
      let longestStreak = calculatedStreak; // For new users, first streak is their longest

      if (userSnap.exists()) {
        const userData = userSnap.data();
        // Increment total sessions
        totalSessions = (userData.totalSessions || 0) + 1;
        console.log('[SaveSession] ✓ Current totalSessions in DB:', userData.totalSessions, '-> New:', totalSessions);
        console.log('[SaveSession] ✓ Current currentStreak in DB:', userData.currentStreak, '-> New:', calculatedStreak);
        
        // Update longestStreak if current streak exceeds it
        const currentLongestStreak = userData.longestStreak || 0;
        if (calculatedStreak > currentLongestStreak) {
          longestStreak = calculatedStreak;
          console.log('[SaveSession] 🏆 New personal best! Longest streak:', currentLongestStreak, '->', longestStreak);
        } else {
          longestStreak = currentLongestStreak;
          console.log('[SaveSession] ✓ Current longestStreak:', longestStreak, '(not exceeded)');
        }
      } else {
        console.log('[SaveSession] ✓ New user profile, initializing totalSessions:', totalSessions, 'currentStreak:', calculatedStreak, 'longestStreak:', longestStreak);
      }

      // Add session document
      const sessionsRef = getUserSessionsRef(userId);
      const sessionRef = doc(sessionsRef); // Generate ID
      transaction.set(sessionRef, sessionDoc);
      console.log('[SaveSession] ✓ Session document prepared for save with date:', sessionDoc.date);

      // Update user profile atomically
      const updateData = {
        currentStreak: calculatedStreak,
        longestStreak: longestStreak,
        totalSessions,
        lastSessionDate: sessionDoc.date,
        updatedAt: serverTimestamp()
      };
      console.log('[SaveSession] ✓ Updating user profile with:', JSON.stringify(updateData, null, 2));
      transaction.update(userRef, updateData);

      return sessionRef.id;
    });

    console.log(`[SaveSession] ✓✓✓ Session saved successfully: ${sessionId}`);
    console.log(`[SaveSession] ✓✓✓ User profile updated with streak: ${calculatedStreak}`);
    return sessionId;
  } catch (error) {
    console.error('Error saving completed session:', error);
    throw new Error(`Failed to save session: ${error.message}`);
  }
}

/**
 * Calculate and backfill longestStreak for existing users
 * This function calculates the longest streak from all historical sessions
 * and updates the user profile if longestStreak is missing or incorrect
 * 
 * @param {string} userId - User ID
 * @returns {Promise<number>} The calculated longest streak
 */
export async function backfillLongestStreak(userId) {
  try {
    console.log('[Backfill] ===== STARTING LONGEST STREAK BACKFILL =====');
    console.log('[Backfill] User ID:', userId);
    
    // Get user profile to check current longestStreak
    const userRef = getUserDocRef(userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.log('[Backfill] ❌ User profile does not exist');
      return 0;
    }
    
    const userData = userSnap.data();
    const existingLongestStreak = userData.longestStreak;
    console.log('[Backfill] ✓ Current longestStreak in DB:', existingLongestStreak);
    
    // Get training system to determine training days
    const trainingSystem = await getLatestTrainingSystem(userId);
    if (!trainingSystem) {
      console.log('[Backfill] ❌ No training system found, cannot calculate streak');
      // Set to 0 if no training system
      if (existingLongestStreak === undefined) {
        await updateDoc(userRef, { longestStreak: 0 });
        console.log('[Backfill] ✓ Initialized longestStreak to 0');
      }
      return 0;
    }
    
    const trainingDaysOfWeek = getTrainingDaysOfWeek(trainingSystem);
    console.log('[Backfill] ✓ Training days of week:', Array.from(trainingDaysOfWeek).sort((a, b) => a - b));
    
    // Get all completed sessions
    const completedSessions = await getCompletedSessions(userId);
    console.log('[Backfill] ✓ Completed sessions count:', completedSessions.length);
    
    if (completedSessions.length === 0) {
      console.log('[Backfill] ✓ No completed sessions, longestStreak: 0');
      if (existingLongestStreak === undefined) {
        await updateDoc(userRef, { longestStreak: 0 });
        console.log('[Backfill] ✓ Initialized longestStreak to 0');
      }
      return 0;
    }
    
    // Normalize all session dates to YYYY-MM-DD format
    const normalizedSessions = completedSessions.map(s => {
      let normalizedDate;
      if (typeof s.date === 'string') {
        normalizedDate = s.date.split('T')[0];
      } else if (s.date?.toDate) {
        normalizedDate = s.date.toDate().toISOString().split('T')[0];
      } else if (s.date instanceof Date) {
        normalizedDate = s.date.toISOString().split('T')[0];
      } else {
        return null;
      }
      return normalizedDate;
    }).filter(d => d !== null);
    
    // Get unique session dates and sort
    const sessionDates = [...new Set(normalizedSessions)].sort((a, b) => a.localeCompare(b));
    console.log('[Backfill] ✓ Unique session dates:', sessionDates.length);
    
    // Calculate longest streak by finding the longest consecutive sequence
    let longestStreak = 0;
    let currentStreak = 0;
    let previousDate = null;
    
    for (const dateStr of sessionDates) {
      const date = new Date(dateStr + 'T00:00:00');
      date.setHours(0, 0, 0, 0);
      
      // Only count training days
      if (!isTrainingDay(date, trainingDaysOfWeek)) {
        continue;
      }
      
      if (previousDate === null) {
        // First training day with a session
        currentStreak = 1;
        previousDate = date;
      } else {
        // Check if this date is the next training day after previousDate
        const daysDiff = Math.floor((date - previousDate) / (1000 * 60 * 60 * 24));
        const expectedNextTrainingDay = getPreviousTrainingDay(
          new Date(date.getTime() + 24 * 60 * 60 * 1000), // date + 1 day
          trainingDaysOfWeek
        );
        
        if (expectedNextTrainingDay) {
          const expectedDateStr = expectedNextTrainingDay.toISOString().split('T')[0];
          const previousDateStr = previousDate.toISOString().split('T')[0];
          
          if (expectedDateStr === previousDateStr) {
            // This is the next consecutive training day
            currentStreak++;
          } else {
            // Streak broken, start new streak
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
          }
        } else {
          // Can't determine next training day, assume streak continues if close
          if (daysDiff <= 7) {
            // Check if there's a training day between previousDate and date
            let foundGap = false;
            let checkDate = new Date(previousDate);
            while (checkDate < date) {
              checkDate.setDate(checkDate.getDate() + 1);
              if (isTrainingDay(checkDate, trainingDaysOfWeek)) {
                const checkDateStr = checkDate.toISOString().split('T')[0];
                if (!sessionDates.includes(checkDateStr)) {
                  foundGap = true;
                  break;
                }
              }
            }
            
            if (!foundGap) {
              currentStreak++;
            } else {
              longestStreak = Math.max(longestStreak, currentStreak);
              currentStreak = 1;
            }
          } else {
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
          }
        }
        
        previousDate = date;
      }
      
      longestStreak = Math.max(longestStreak, currentStreak);
    }
    
    // Final check
    longestStreak = Math.max(longestStreak, currentStreak);
    
    console.log('[Backfill] ✓ Calculated longest streak:', longestStreak);
    
    // Update user profile if longestStreak is missing or if calculated value is higher
    if (existingLongestStreak === undefined || longestStreak > existingLongestStreak) {
      await updateDoc(userRef, {
        longestStreak: longestStreak,
        updatedAt: serverTimestamp()
      });
      console.log('[Backfill] ✓✓✓ Updated longestStreak in user profile:', existingLongestStreak, '->', longestStreak);
    } else {
      console.log('[Backfill] ✓ longestStreak already up to date:', existingLongestStreak);
    }
    
    console.log('[Backfill] ===== LONGEST STREAK BACKFILL COMPLETE =====');
    return longestStreak;
  } catch (error) {
    console.error('[Backfill] ❌ Error backfilling longest streak:', error);
    throw new Error(`Failed to backfill longest streak: ${error.message}`);
  }
}

