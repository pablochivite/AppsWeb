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
  addDoc,
  updateDoc,
  serverTimestamp,
  runTransaction
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

    // Use transaction to atomically:
    // 1. Save session
    // 2. Update user profile (currentStreak, totalSessions)
    const sessionId = await runTransaction(db, async (transaction) => {
      // Get user profile for streak calculation
      const userRef = getUserDocRef(userId);
      const userSnap = await transaction.get(userRef);
      
      let currentStreak = 1;
      let totalSessions = 1;
      let lastSessionDate = null;

      if (userSnap.exists()) {
        const userData = userSnap.data();
        currentStreak = userData.currentStreak || 0;
        totalSessions = userData.totalSessions || 0;
        lastSessionDate = userData.lastSessionDate || null;

        // Calculate streak: increment if last session was yesterday or today
        const today = new Date(sessionDoc.date);
        today.setHours(0, 0, 0, 0);
        
        if (lastSessionDate) {
          const lastDate = new Date(lastSessionDate);
          lastDate.setHours(0, 0, 0, 0);
          
          const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === 0) {
            // Same day - don't increment streak
            currentStreak = currentStreak || 1;
          } else if (daysDiff === 1) {
            // Consecutive day - increment streak
            currentStreak = (currentStreak || 0) + 1;
          } else {
            // Gap in days - reset streak
            currentStreak = 1;
          }
        } else {
          // First session
          currentStreak = 1;
        }

        // Increment total sessions
        totalSessions = (totalSessions || 0) + 1;
      }

      // Add session document
      const sessionsRef = getUserSessionsRef(userId);
      const sessionRef = doc(sessionsRef); // Generate ID
      transaction.set(sessionRef, sessionDoc);

      // Update user profile atomically
      transaction.update(userRef, {
        currentStreak,
        totalSessions,
        lastSessionDate: sessionDoc.date,
        updatedAt: serverTimestamp()
      });

      return sessionRef.id;
    });

    console.log(`✓ Session saved successfully: ${sessionId}`);
    return sessionId;
  } catch (error) {
    console.error('Error saving completed session:', error);
    throw new Error(`Failed to save session: ${error.message}`);
  }
}

