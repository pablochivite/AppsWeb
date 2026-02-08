/**
 * Exercise History Service
 * 
 * Service layer for managing exercise performance history.
 * Tracks weight, reps, and time across all sessions for progress tracking.
 */

import { db } from '../../config/firebase.config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

// ============================================================================
// EXERCISE HISTORY OPERATIONS
// ============================================================================

/**
 * Get exercise history for a specific exercise/variation combination
 * @param {string} userId - User ID
 * @param {string} exerciseId - Exercise ID
 * @param {string} variationId - Variation ID
 * @returns {Promise<Object|null>} Exercise history object or null if not found
 */
export async function getExerciseHistory(userId, exerciseId, variationId) {
  try {
    if (!userId || !exerciseId || !variationId) {
      console.warn('getExerciseHistory: userId, exerciseId, and variationId are required');
      return null;
    }

    const historyRef = collection(db, 'users', userId, 'exerciseHistory');
    const q = query(
      historyRef,
      where('exerciseId', '==', exerciseId),
      where('variationId', '==', variationId),
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
      ...data,
      lastPerformedAt: data.lastPerformedAt?.toDate?.()?.toISOString() || data.lastPerformedAt,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      sessions: data.sessions?.map(session => ({
        ...session,
        date: session.date?.toDate?.()?.toISOString() || session.date
      })) || []
    };
  } catch (error) {
    console.error('Error getting exercise history:', error);
    throw new Error(`Failed to get exercise history: ${error.message}`);
  }
}

/**
 * Get last performance for a specific exercise/variation
 * @param {string} userId - User ID
 * @param {string} exerciseId - Exercise ID
 * @param {string} variationId - Variation ID
 * @returns {Promise<Object|null>} Last performance data or null if not found
 */
export async function getLastPerformance(userId, exerciseId, variationId) {
  try {
    const history = await getExerciseHistory(userId, exerciseId, variationId);

    if (!history || !history.sessions || history.sessions.length === 0) {
      return null;
    }

    // Get the most recent session
    const lastSession = history.sessions
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!lastSession || !lastSession.sets || lastSession.sets.length === 0) {
      return null;
    }

    // Calculate averages from last session sets
    const sets = lastSession.sets;
    const totalWeight = sets.reduce((sum, set) => sum + (set.weight || 0), 0);
    const totalReps = sets.reduce((sum, set) => sum + (set.reps || 0), 0);
    const totalTime = sets.reduce((sum, set) => sum + (set.time || 0), 0);
    const setCount = sets.length;

    return {
      weight: setCount > 0 ? totalWeight / setCount : undefined,
      reps: setCount > 0 ? totalReps / setCount : undefined,
      time: setCount > 0 ? totalTime / setCount : undefined,
      sets: sets,
      date: lastSession.date
    };
  } catch (error) {
    console.error('Error getting last performance:', error);
    return null;
  }
}

/**
 * Get personal best for a specific exercise/variation
 * @param {string} userId - User ID
 * @param {string} exerciseId - Exercise ID
 * @param {string} variationId - Variation ID
 * @returns {Promise<Object|null>} Personal best data or null if not found
 */
export async function getPersonalBest(userId, exerciseId, variationId) {
  try {
    const history = await getExerciseHistory(userId, exerciseId, variationId);

    if (!history || !history.personalBest) {
      return null;
    }

    return history.personalBest;
  } catch (error) {
    console.error('Error getting personal best:', error);
    return null;
  }
}

/**
 * Save exercise performance data from a completed session
 * @param {string} userId - User ID
 * @param {string} exerciseId - Exercise ID
 * @param {string} variationId - Variation ID
 * @param {string} sessionId - Completed session ID
 * @param {Array} sets - Array of set performance data
 * @returns {Promise<string>} History document ID
 */
export async function saveExercisePerformance(userId, exerciseId, variationId, sessionId, sets) {
  try {
    if (!userId || !exerciseId || !variationId || !sessionId) {
      throw new Error('userId, exerciseId, variationId, and sessionId are required');
    }

    if (!sets || !Array.isArray(sets) || sets.length === 0) {
      console.warn('saveExercisePerformance: No sets provided, skipping');
      return null;
    }

    // Check if history document already exists
    const historyRef = collection(db, 'users', userId, 'exerciseHistory');
    const q = query(
      historyRef,
      where('exerciseId', '==', exerciseId),
      where('variationId', '==', variationId),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    const now = new Date();

    if (querySnapshot.empty) {
      // Create new history document
      const newHistoryRef = doc(historyRef);
      const personalBest = calculatePersonalBest(sets);

      const historyData = {
        exerciseId,
        variationId,
        sessions: [{
          sessionId,
          date: Timestamp.fromDate(now),
          sets: sets.map(set => ({
            setNumber: set.setNumber,
            weight: set.weight,
            reps: set.reps,
            time: set.time,
            notes: set.notes
          }))
        }],
        lastPerformedAt: Timestamp.fromDate(now),
        personalBest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(newHistoryRef, historyData);
      return newHistoryRef.id;
    } else {
      // Update existing history document
      const existingDoc = querySnapshot.docs[0];
      const existingData = existingDoc.data();
      const existingSessions = existingData.sessions || [];

      // Add new session
      const newSession = {
        sessionId,
        date: Timestamp.fromDate(now),
        sets: sets.map(set => ({
          setNumber: set.setNumber,
          weight: set.weight,
          reps: set.reps,
          time: set.time,
          notes: set.notes
        }))
      };

      const updatedSessions = [...existingSessions, newSession];

      // Calculate new personal best
      const allSets = updatedSessions.flatMap(s => s.sets);
      const personalBest = calculatePersonalBest(allSets);

      await updateDoc(existingDoc.ref, {
        sessions: updatedSessions,
        lastPerformedAt: Timestamp.fromDate(now),
        personalBest,
        updatedAt: serverTimestamp()
      });

      return existingDoc.id;
    }
  } catch (error) {
    console.error('Error saving exercise performance:', error);
    throw new Error(`Failed to save exercise performance: ${error.message}`);
  }
}

/**
 * Calculate personal best from sets
 * @param {Array} sets - Array of set performance data
 * @returns {Object} Personal best object
 */
function calculatePersonalBest(sets) {
  if (!sets || sets.length === 0) {
    return {};
  }

  const personalBest = {};

  // Find max weight
  const weights = sets.map(s => s.weight).filter(w => w !== undefined && w !== null);
  if (weights.length > 0) {
    personalBest.weight = Math.max(...weights);
  }

  // Find max reps
  const reps = sets.map(s => s.reps).filter(r => r !== undefined && r !== null);
  if (reps.length > 0) {
    personalBest.reps = Math.max(...reps);
  }

  // Find max time (for time-based exercises)
  const times = sets.map(s => s.time).filter(t => t !== undefined && t !== null);
  if (times.length > 0) {
    personalBest.time = Math.max(...times);
  }

  return Object.keys(personalBest).length > 0 ? personalBest : undefined;
}

/**
 * Get all exercise history for a user (for analytics)
 * @param {string} userId - User ID
 * @param {number} limitCount - Maximum number of records to return
 * @returns {Promise<Array>} Array of exercise history objects
 */
export async function getAllExerciseHistory(userId, limitCount = 100) {
  try {
    if (!userId) {
      console.warn('getAllExerciseHistory: userId is required');
      return [];
    }

    const historyRef = collection(db, 'users', userId, 'exerciseHistory');
    const q = query(
      historyRef,
      orderBy('lastPerformedAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        lastPerformedAt: data.lastPerformedAt?.toDate?.()?.toISOString() || data.lastPerformedAt,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        sessions: data.sessions?.map(session => ({
          ...session,
          date: session.date?.toDate?.()?.toISOString() || session.date
        })) || []
      };
    });
  } catch (error) {
    console.error('Error getting all exercise history:', error);
    throw new Error(`Failed to get exercise history: ${error.message}`);
  }
}

