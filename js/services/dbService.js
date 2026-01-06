/**
 * Database Service
 * 
 * Service layer abstraction for Firestore operations.
 * This service wraps Firestore methods to provide a clean API for the UI layer.
 * 
 * Benefits:
 * - UI components never directly import Firestore
 * - Centralized data access patterns
 * - Consistent error handling
 * - Easy to add caching, offline support, etc.
 * 
 * Architecture:
 * - Uses sub-collections for user-specific data (users/{uid}/workouts, etc.)
 * - Provides CRUD operations for all data models
 * - Handles data transformation between app format and Firestore format
 */

import { db } from '../../config/firebase.config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

// ============================================================================
// COLLECTION PATHS
// ============================================================================

/**
 * Get user document reference
 * @param {string} userId - User ID (Firebase Auth UID)
 * @returns {import('firebase/firestore').DocumentReference}
 */
function getUserDocRef(userId) {
  return doc(db, 'users', userId);
}

/**
 * Get user profile sub-collection reference
 * @param {string} userId - User ID
 * @returns {import('firebase/firestore').CollectionReference}
 */
function getUserProfileRef(userId) {
  return collection(db, 'users', userId, 'profile');
}

/**
 * Get user workouts sub-collection reference
 * @param {string} userId - User ID
 * @returns {import('firebase/firestore').CollectionReference}
 */
function getUserWorkoutsRef(userId) {
  return collection(db, 'users', userId, 'workouts');
}

/**
 * Get user training systems sub-collection reference
 * @param {string} userId - User ID
 * @returns {import('firebase/firestore').CollectionReference}
 */
function getUserTrainingSystemsRef(userId) {
  return collection(db, 'users', userId, 'trainingSystems');
}

/**
 * Get user sessions sub-collection reference (within a workout)
 * @param {string} userId - User ID
 * @param {string} workoutId - Workout ID
 * @returns {import('firebase/firestore').CollectionReference}
 */
function getUserSessionsRef(userId, workoutId) {
  return collection(db, 'users', userId, 'workouts', workoutId, 'sessions');
}

// ============================================================================
// USER PROFILE OPERATIONS
// ============================================================================

/**
 * Create or update user profile
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data
 * @returns {Promise<void>}
 */
export async function saveUserProfile(userId, profileData) {
  try {
    const userRef = getUserDocRef(userId);
    await setDoc(userRef, {
      ...profileData,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw new Error(`Failed to save profile: ${error.message}`);
  }
}

/**
 * Get user profile
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User profile or null
 */
export async function getUserProfile(userId) {
  try {
    const userRef = getUserDocRef(userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw new Error(`Failed to get profile: ${error.message}`);
  }
}

// ============================================================================
// TRAINING SYSTEM OPERATIONS
// ============================================================================

/**
 * Save training system
 * @param {string} userId - User ID
 * @param {Object} trainingSystem - Training system object
 * @returns {Promise<string>} Training system ID
 */
export async function saveTrainingSystem(userId, trainingSystem) {
  try {
    const systemsRef = getUserTrainingSystemsRef(userId);
    
    // Convert dates to Firestore Timestamps
    const systemData = {
      ...trainingSystem,
      startDate: trainingSystem.startDate ? Timestamp.fromDate(new Date(trainingSystem.startDate)) : null,
      createdAt: trainingSystem.createdAt ? Timestamp.fromDate(new Date(trainingSystem.createdAt)) : serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    if (trainingSystem.id) {
      // Update existing
      const systemRef = doc(systemsRef, trainingSystem.id);
      await updateDoc(systemRef, systemData);
      return trainingSystem.id;
    } else {
      // Create new
      const docRef = await addDoc(systemsRef, systemData);
      return docRef.id;
    }
  } catch (error) {
    console.error('Error saving training system:', error);
    throw new Error(`Failed to save training system: ${error.message}`);
  }
}

/**
 * Get training system by ID
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @returns {Promise<Object|null>} Training system or null
 */
export async function getTrainingSystem(userId, systemId) {
  try {
    const systemsRef = getUserTrainingSystemsRef(userId);
    const systemRef = doc(systemsRef, systemId);
    const systemSnap = await getDoc(systemRef);
    
    if (systemSnap.exists()) {
      const data = systemSnap.data();
      // Convert Firestore Timestamps to ISO strings
      return {
        id: systemSnap.id,
        ...data,
        startDate: data.startDate?.toDate?.()?.toISOString() || data.startDate,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting training system:', error);
    throw new Error(`Failed to get training system: ${error.message}`);
  }
}

/**
 * Get all training systems for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of training systems
 */
export async function getAllTrainingSystems(userId) {
  try {
    const systemsRef = getUserTrainingSystemsRef(userId);
    const q = query(systemsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startDate: data.startDate?.toDate?.()?.toISOString() || data.startDate,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    });
  } catch (error) {
    console.error('Error getting training systems:', error);
    throw new Error(`Failed to get training systems: ${error.message}`);
  }
}

/**
 * Delete training system
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @returns {Promise<void>}
 */
export async function deleteTrainingSystem(userId, systemId) {
  try {
    const systemsRef = getUserTrainingSystemsRef(userId);
    const systemRef = doc(systemsRef, systemId);
    await deleteDoc(systemRef);
  } catch (error) {
    console.error('Error deleting training system:', error);
    throw new Error(`Failed to delete training system: ${error.message}`);
  }
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

/**
 * Save session (within a training system)
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @param {Object} session - Session object
 * @returns {Promise<string>} Session ID
 */
export async function saveSession(userId, systemId, session) {
  try {
    // Sessions are stored as part of the training system's sessions array
    // For now, we'll update the entire training system
    // Future: Could store sessions as sub-collection if needed for scalability
    const system = await getTrainingSystem(userId, systemId);
    if (!system) {
      throw new Error('Training system not found');
    }
    
    // Update or add session in sessions array
    const sessions = system.sessions || [];
    const sessionIndex = sessions.findIndex(s => s.id === session.id || s.date === session.date);
    
    if (sessionIndex >= 0) {
      sessions[sessionIndex] = session;
    } else {
      sessions.push(session);
    }
    
    system.sessions = sessions;
    await saveTrainingSystem(userId, system);
    
    return session.id || `session-${Date.now()}`;
  } catch (error) {
    console.error('Error saving session:', error);
    throw new Error(`Failed to save session: ${error.message}`);
  }
}

/**
 * Get session by ID
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Session or null
 */
export async function getSession(userId, systemId, sessionId) {
  try {
    const system = await getTrainingSystem(userId, systemId);
    if (!system || !system.sessions) {
      return null;
    }
    
    return system.sessions.find(s => s.id === sessionId || s.date === sessionId) || null;
  } catch (error) {
    console.error('Error getting session:', error);
    throw new Error(`Failed to get session: ${error.message}`);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert Firestore document to plain object
 * @param {import('firebase/firestore').DocumentSnapshot} docSnap - Firestore document
 * @returns {Object} Plain object
 */
function docToObject(docSnap) {
  if (!docSnap.exists()) {
    return null;
  }
  
  const data = docSnap.data();
  // Convert Timestamps to ISO strings
  const converted = { ...data };
  Object.keys(converted).forEach(key => {
    if (converted[key]?.toDate) {
      converted[key] = converted[key].toDate().toISOString();
    }
  });
  
  return {
    id: docSnap.id,
    ...converted
  };
}

