/**
 * Exercise Service
 * 
 * Service layer for exercise and variation data operations.
 * Handles fetching exercises and variations from Firestore.
 */

import { db } from '../../config/firebase.config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';

// ============================================================================
// VARIATION OPERATIONS
// ============================================================================

/**
 * Get all variations from Firestore
 * Fetches all variation documents from the variations collection.
 * 
 * @returns {Promise<Array>} Array of all variation objects
 */
export async function getAllVariations() {
  try {
    const variationsRef = collection(db, 'variations');
    const querySnapshot = await getDocs(variationsRef);
    
    // Convert Firestore documents to plain objects
    const variations = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return variations;
  } catch (error) {
    console.error('Error fetching all variations:', error);
    throw new Error(`Failed to fetch variations: ${error.message}`);
  }
}

/**
 * Get variations by discipline name
 * Queries the variations collection where the disciplines array contains the specified discipline.
 * 
 * @param {string} disciplineName - The discipline name to filter by (e.g., "calisthenics", "yoga", "animal-flow", "pilates")
 * @returns {Promise<Array>} Array of variation objects with the specified discipline
 */
export async function getExercisesByDiscipline(disciplineName) {
  try {
    const variationsRef = collection(db, 'variations');
    
    // Query variations where disciplines array contains the disciplineName
    const q = query(
      variationsRef,
      where('disciplines', 'array-contains', disciplineName)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Convert Firestore documents to plain objects
    const variations = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return variations;
  } catch (error) {
    console.error(`Error fetching exercises for discipline "${disciplineName}":`, error);
    throw new Error(`Failed to fetch exercises: ${error.message}`);
  }
}

/**
 * Get a specific variation by ID
 * Fetches a single variation document from the variations collection.
 * 
 * @param {string} variationId - The variation document ID
 * @returns {Promise<Object|null>} The variation object or null if not found
 */
export async function getExerciseById(variationId) {
  try {
    const variationRef = doc(db, 'variations', variationId);
    const variationSnap = await getDoc(variationRef);
    
    if (variationSnap.exists()) {
      return {
        id: variationSnap.id,
        ...variationSnap.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching variation with ID "${variationId}":`, error);
    throw new Error(`Failed to fetch variation: ${error.message}`);
  }
}

// ============================================================================
// EXERCISE OPERATIONS
// ============================================================================

/**
 * Get all exercises from Firestore
 * Fetches all exercise documents from the exercises collection.
 * 
 * @returns {Promise<Array>} Array of all exercise objects
 */
export async function getAllExercises() {
  try {
    const exercisesRef = collection(db, 'exercises');
    const querySnapshot = await getDocs(exercisesRef);
    
    // Convert Firestore documents to plain objects
    const exercises = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return exercises;
  } catch (error) {
    console.error('Error fetching all exercises:', error);
    throw new Error(`Failed to fetch exercises: ${error.message}`);
  }
}

// ============================================================================
// SYSTEM RATING OPERATIONS
// ============================================================================

/**
 * Get system rating for a user
 * Calculates the user's mobility, rotation, and flexibility ratings from their workout history.
 * Fetches the last 20 completed sessions and calculates averages of their metricsSummary.
 * 
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Object with mobility, rotation, and flexibility ratings
 * @returns {Promise<Object>} Example: { mobility: 75, rotation: 68, flexibility: 82 }
 */
export async function getSystemRating(userId) {
  try {
    if (!userId) {
      console.warn('getSystemRating: userId is required');
      return { mobility: 0, rotation: 0, flexibility: 0 };
    }

    // Query the user's sessions sub-collection
    const sessionsRef = collection(db, 'users', userId, 'sessions');
    
    // Get the last 20 completed sessions, ordered by creation date (most recent first)
    const q = query(
      sessionsRef,
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const querySnapshot = await getDocs(q);
    
    // If no sessions exist, return zeros
    if (querySnapshot.empty) {
      console.log(`No sessions found for user ${userId}, returning zeros`);
      return { mobility: 0, rotation: 0, flexibility: 0 };
    }
    
    // Extract metricsSummary from each session and calculate totals
    let totalMobility = 0;
    let totalRotation = 0;
    let totalFlexibility = 0;
    let sessionCount = 0;
    
    querySnapshot.docs.forEach((doc) => {
      const sessionData = doc.data();
      const metricsSummary = sessionData.metricsSummary;
      
      // Only count sessions that have valid metricsSummary
      if (metricsSummary && typeof metricsSummary === 'object') {
        const mobility = metricsSummary.mobility;
        const rotation = metricsSummary.rotation;
        const flexibility = metricsSummary.flexibility;
        
        // Only add if values are valid numbers
        if (typeof mobility === 'number' && !isNaN(mobility)) {
          totalMobility += mobility;
        }
        if (typeof rotation === 'number' && !isNaN(rotation)) {
          totalRotation += rotation;
        }
        if (typeof flexibility === 'number' && !isNaN(flexibility)) {
          totalFlexibility += flexibility;
        }
        
        sessionCount++;
      }
    });
    
    // If no valid sessions found, return zeros
    if (sessionCount === 0) {
      console.log(`No sessions with valid metricsSummary for user ${userId}`);
      return { mobility: 0, rotation: 0, flexibility: 0 };
    }
    
    // Calculate averages and round to nearest integer
    const averages = {
      mobility: Math.round(totalMobility / sessionCount),
      rotation: Math.round(totalRotation / sessionCount),
      flexibility: Math.round(totalFlexibility / sessionCount)
    };
    
    console.log(`Calculated system rating for user ${userId} from ${sessionCount} sessions:`, averages);
    return averages;
    
  } catch (error) {
    console.error(`Error fetching system rating for user "${userId}":`, error);
    // Return zeros on error rather than throwing
    // This ensures the UI can still render even if rating fetch fails
    return {
      mobility: 0,
      rotation: 0,
      flexibility: 0
    };
  }
}

