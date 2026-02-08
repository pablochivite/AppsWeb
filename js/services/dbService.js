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
// CACHE-FIRST PATTERN IMPLEMENTATION
// ============================================================================

/**
 * Cache storage keys
 */
const CACHE_KEYS = {
  PROFILE: (userId) => `firestore_cache_profile_${userId}`,
  TRAINING_SYSTEM: (userId) => `firestore_cache_training_system_${userId}`,
  TRAINING_SYSTEMS: (userId) => `firestore_cache_training_systems_${userId}`
};

/**
 * Cache TTL (Time To Live) in milliseconds
 * Data is considered stale after this time
 */
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Network request timeout in milliseconds
 * Increased to 6 seconds to accommodate slower connections (e.g., gym WiFi)
 */
const NETWORK_TIMEOUT = 6000; // 6 seconds

/**
 * Check if data is stale based on timestamp
 * @param {Object} cachedData - Cached data object with _cachedAt timestamp
 * @returns {boolean} True if data is stale
 */
function isCacheStale(cachedData) {
  if (!cachedData || !cachedData._cachedAt) return true;
  return Date.now() - cachedData._cachedAt > CACHE_TTL;
}

/**
 * Save data to cache
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 */
function saveToCache(key, data) {
  try {
    const cachedData = {
      ...data,
      _cachedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cachedData));
  } catch (error) {
    console.warn('Failed to save to cache:', error);
    // Ignore quota exceeded errors silently
  }
}

/**
 * Get data from cache
 * @param {string} key - Cache key
 * @returns {Object|null} Cached data or null
 */
function getFromCache(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    // Remove internal cache metadata before returning
    const { _cachedAt, ...data } = parsed;
    return data;
  } catch (error) {
    console.warn('Failed to read from cache:', error);
    return null;
  }
}

/**
 * Check if cache exists and is valid
 * @param {string} key - Cache key
 * @returns {boolean} True if cache exists and is valid
 */
function hasValidCache(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return false;
    
    const parsed = JSON.parse(cached);
    return !isCacheStale(parsed);
  } catch {
    return false;
  }
}

/**
 * Promise with timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Promise that rejects on timeout
 */
function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Network request timeout')), timeoutMs)
    )
  ]);
}

/**
 * Check if error indicates offline status
 * @param {Error} error - Error object
 * @returns {boolean} True if error indicates offline
 */
function isOfflineError(error) {
  return error.message && (
    error.message.includes('offline') ||
    error.message.includes('Failed to get document') ||
    error.message.includes('Network request timeout')
  );
}

/**
 * Check if error is a permission error
 * These are expected when rules aren't deployed or user doesn't have data yet
 */
function isPermissionError(error) {
  return error && (
    error.code === 'permission-denied' ||
    error.code === 'PERMISSION_DENIED' ||
    (error.message && (
      error.message.includes('Missing or insufficient permissions') ||
      error.message.includes('permission-denied') ||
      error.message.includes('PERMISSION_DENIED')
    ))
  );
}

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
 * Get user session reports sub-collection reference
 * @param {string} userId - User ID
 * @returns {import('firebase/firestore').CollectionReference}
 */
function getUserSessionReportsRef(userId) {
  return collection(db, 'users', userId, 'sessionReports');
}
/**
 * Get sessions sub-collection reference (within a training system)
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @returns {import('firebase/firestore').CollectionReference}
 */
function getSystemSessionsRef(userId, systemId) {
  return collection(db, 'users', userId, 'trainingSystems', systemId, 'sessions');
}

/**
 * Get user sessions sub-collection reference (within a workout) - DEPRECATED
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
  const cacheKey = CACHE_KEYS.PROFILE(userId);
  
  try {
    // Optimistically update cache
    const updatedProfile = { id: userId, ...profileData };
    saveToCache(cacheKey, updatedProfile);
    
    // Save to Firestore
    const userRef = getUserDocRef(userId);
    await withTimeout(setDoc(userRef, {
      ...profileData,
      updatedAt: serverTimestamp()
    }, { merge: true }), NETWORK_TIMEOUT);
    
    // Update cache timestamp after successful save
    saveToCache(cacheKey, updatedProfile);
  } catch (error) {
    // If save fails, try to keep cached data
    if (isOfflineError(error)) {
      console.warn('Offline detected while saving profile, data cached locally');
      // Cache is already updated optimistically, so data is available locally
      // This will sync when network is available (Firestore persistence handles this)
      return;
    }
    
    console.error('Error saving user profile:', error);
    throw new Error(`Failed to save profile: ${error.message}`);
  }
}

/**
 * Get user profile
 * Implements Cache-First pattern: Returns cached data immediately, updates from Firestore in background
 * @param {string} userId - User ID
 * @param {Object} options - Options { skipCache: boolean, returnStale: boolean }
 * @returns {Promise<Object|null>} User profile or null
 */
export async function getUserProfile(userId, options = {}) {
  const cacheKey = CACHE_KEYS.PROFILE(userId);
  const { skipCache = false, returnStale = true } = options;
  
  // STEP 1: Return cached data immediately if available (Cache-First)
  if (!skipCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      // If cache is valid, return immediately and update in background
      if (!isCacheStale({ _cachedAt: JSON.parse(localStorage.getItem(cacheKey))._cachedAt })) {
        // Update from network in background (fire and forget)
        fetchUserProfileFromFirestore(userId, cacheKey).catch(() => {
          // Silently fail - we already have cached data
        });
        return cached;
      } else if (returnStale) {
        // Cache is stale but return it anyway, update in background
        fetchUserProfileFromFirestore(userId, cacheKey).catch(() => {
          // Silently fail - we'll return stale data
        });
        return cached;
      }
    }
  }
  
  // STEP 2: Fetch from Firestore (cache miss or skipCache=true)
  return await fetchUserProfileFromFirestore(userId, cacheKey);
}

/**
 * Fetch user profile from Firestore and update cache
 * @param {string} userId - User ID
 * @param {string} cacheKey - Cache key
 * @returns {Promise<Object|null>} User profile or null
 */
async function fetchUserProfileFromFirestore(userId, cacheKey) {
  try {
    const userRef = getUserDocRef(userId);
    const userSnap = await withTimeout(getDoc(userRef), NETWORK_TIMEOUT);
    
    if (userSnap.exists()) {
      const profile = { id: userSnap.id, ...userSnap.data() };
      
      // Auto-backfill longestStreak if missing (non-blocking)
      if (profile.longestStreak === undefined) {
        // Backfill in background - don't block profile loading
        backfillLongestStreak(userId).catch(err => {
          console.warn('Background longestStreak backfill failed (non-critical):', err);
        });
      }
      
      // Update cache for next time
      saveToCache(cacheKey, profile);
      return profile;
    }
    
    // Document doesn't exist - clear cache
    localStorage.removeItem(cacheKey);
    return null;
  } catch (error) {
    // If offline/timeout, return cached data if available
    if (isOfflineError(error)) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        console.warn('Offline detected, returning cached profile');
        return cached;
      }
    }
    
    console.error('Error getting user profile:', error);
    throw new Error(`Failed to get profile: ${error.message}`);
  }
}

// ============================================================================
// TRAINING SYSTEM OPERATIONS
// ============================================================================

/**
 * Save training system (without sessions - sessions are stored separately)
 * @param {string} userId - User ID
 * @param {Object} trainingSystem - Training system object (sessions array is ignored)
 * @returns {Promise<string>} Training system ID
 */
export async function saveTrainingSystem(userId, trainingSystem) {
  try {
    console.log('[saveTrainingSystem] Starting save process', {
      userId,
      systemId: trainingSystem.id,
      hasSessions: !!(trainingSystem.sessions && trainingSystem.sessions.length > 0),
      sessionsCount: trainingSystem.sessions?.length || 0
    });
    
    const systemsRef = getUserTrainingSystemsRef(userId);
    
    // Extract sessions separately (they're stored in sub-collection)
    const { sessions, ...systemDataWithoutSessions } = trainingSystem;
    
    // Remove id from systemData as it's used as document ID, not a field
    const { id, ...systemDataForFirestore } = systemDataWithoutSessions;
    
    // Convert dates to Firestore Timestamps
    const systemData = {
      ...systemDataForFirestore,
      type: systemDataForFirestore.type || 'weekly',
      editable: systemDataForFirestore.editable !== undefined ? systemDataForFirestore.editable : true,
      startDate: trainingSystem.startDate ? Timestamp.fromDate(new Date(trainingSystem.startDate)) : null,
      createdAt: trainingSystem.createdAt ? Timestamp.fromDate(new Date(trainingSystem.createdAt)) : serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log('[saveTrainingSystem] System data prepared', {
      type: systemData.type,
      daysPerWeek: systemData.daysPerWeek,
      framework: systemData.framework,
      hasStartDate: !!systemData.startDate
    });
    
    let systemId;
    if (trainingSystem.id && trainingSystem.id.startsWith('weekly-system-')) {
      // Use the provided ID but clean it if needed
      // Firestore document IDs can contain alphanumeric characters, hyphens, and underscores
      // weekly-system-{timestamp} should be valid, but let's ensure it's clean
      systemId = trainingSystem.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const systemRef = doc(systemsRef, systemId);
      console.log('[saveTrainingSystem] Saving with existing ID:', systemId);
      await withTimeout(setDoc(systemRef, systemData, { merge: true }), NETWORK_TIMEOUT);
      console.log('[saveTrainingSystem] System document saved successfully');
    } else if (trainingSystem.id) {
      // Update existing or create if doesn't exist (upsert)
      systemId = trainingSystem.id;
      const systemRef = doc(systemsRef, systemId);
      console.log('[saveTrainingSystem] Upserting with ID:', systemId);
      await withTimeout(setDoc(systemRef, systemData, { merge: true }), NETWORK_TIMEOUT);
      console.log('[saveTrainingSystem] System document upserted successfully');
    } else {
      // Create new - Firestore will generate ID
      console.log('[saveTrainingSystem] Creating new system document');
      const docRef = await withTimeout(addDoc(systemsRef, systemData), NETWORK_TIMEOUT);
      systemId = docRef.id;
      console.log('[saveTrainingSystem] New system document created with ID:', systemId);
    }
    
    // If sessions are provided, save them to the sub-collection
    if (sessions && Array.isArray(sessions) && sessions.length > 0) {
      console.log(`[saveTrainingSystem] Saving ${sessions.length} sessions to system ${systemId}`);
      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        try {
          await saveSessionToSystem(userId, systemId, session);
          if ((i + 1) % 5 === 0 || i === sessions.length - 1) {
            console.log(`[saveTrainingSystem] Saved ${i + 1}/${sessions.length} sessions`);
          }
        } catch (sessionError) {
          console.error(`[saveTrainingSystem] Error saving session ${i + 1}:`, sessionError);
          // Continue with other sessions even if one fails
        }
      }
      console.log(`[saveTrainingSystem] All ${sessions.length} sessions saved successfully`);
    }
    
    // Update cache optimistically
    const cacheKey = `${CACHE_KEYS.TRAINING_SYSTEM(userId)}_${systemId}`;
    const cachedSystem = {
      ...systemDataForFirestore,
      id: systemId,
      startDate: trainingSystem.startDate,
      createdAt: trainingSystem.createdAt || new Date().toISOString(),
      // Don't cache sessions - they're loaded separately
      sessions: []
    };
    saveToCache(cacheKey, cachedSystem);
    
    // Also invalidate the list cache
    localStorage.removeItem(CACHE_KEYS.TRAINING_SYSTEMS(userId));
    
    console.log('[saveTrainingSystem] Training system saved successfully', { systemId });
    return systemId;
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('Offline detected while saving training system, data cached locally');
      // Cache will be updated when network is available
      return trainingSystem.id || `temp-${Date.now()}`;
    }
    
    console.error('[saveTrainingSystem] Error saving training system:', error);
    console.error('[saveTrainingSystem] Error details:', {
      message: error.message,
      stack: error.stack,
      userId,
      systemId: trainingSystem.id
    });
    throw new Error(`Failed to save training system: ${error.message}`);
  }
}

/**
 * Get training system by ID (without sessions - sessions are loaded separately)
 * Implements Cache-First pattern
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @param {Object} options - Options { skipCache: boolean, returnStale: boolean, includeSessions: boolean }
 * @returns {Promise<Object|null>} Training system or null (sessions are empty array unless includeSessions=true)
 */
export async function getTrainingSystem(userId, systemId, options = {}) {
  const cacheKey = `${CACHE_KEYS.TRAINING_SYSTEM(userId)}_${systemId}`;
  const { skipCache = false, returnStale = true, includeSessions = false } = options;
  
  // STEP 1: Return cached data immediately if available
  if (!skipCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      if (!isCacheStale({ _cachedAt: JSON.parse(localStorage.getItem(cacheKey))._cachedAt })) {
        // Update in background
        fetchTrainingSystemFromFirestore(userId, systemId, cacheKey, includeSessions).catch(() => {});
        // Load sessions separately if requested
        if (includeSessions && (!cached.sessions || cached.sessions.length === 0)) {
          const sessions = await getSystemSessions(userId, systemId);
          cached.sessions = sessions;
        }
        return cached;
      } else if (returnStale) {
        // Return stale, update in background
        fetchTrainingSystemFromFirestore(userId, systemId, cacheKey, includeSessions).catch(() => {});
        // Load sessions separately if requested
        if (includeSessions && (!cached.sessions || cached.sessions.length === 0)) {
          const sessions = await getSystemSessions(userId, systemId);
          cached.sessions = sessions;
        }
        return cached;
      }
    }
  }
  
  // STEP 2: Fetch from Firestore
  return await fetchTrainingSystemFromFirestore(userId, systemId, cacheKey, includeSessions);
}

/**
 * Fetch training system from Firestore and update cache
 * @param {boolean} includeSessions - If true, also load sessions from sub-collection
 */
async function fetchTrainingSystemFromFirestore(userId, systemId, cacheKey, includeSessions = false) {
  try {
    const systemsRef = getUserTrainingSystemsRef(userId);
    const systemRef = doc(systemsRef, systemId);
    const systemSnap = await withTimeout(getDoc(systemRef), NETWORK_TIMEOUT);
    
    if (systemSnap.exists()) {
      const data = systemSnap.data();
      // Convert Firestore Timestamps to ISO strings
      const system = {
        id: systemSnap.id,
        ...data,
        startDate: data.startDate?.toDate?.()?.toISOString() || data.startDate,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        sessions: [] // Sessions are stored separately
      };
      
      // Load sessions if requested
      if (includeSessions) {
        system.sessions = await getSystemSessions(userId, systemId);
      }
      
      saveToCache(cacheKey, system);
      return system;
    }
    
    localStorage.removeItem(cacheKey);
    return null;
  } catch (error) {
    if (isOfflineError(error)) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        console.warn('Offline detected, returning cached training system');
        return cached;
      }
    }
    
    if (isPermissionError(error)) {
      // Permission errors are expected when rules aren't deployed or user has no data
      console.warn('Permission denied while fetching training system (this is expected for new users or when rules aren\'t deployed):', error.message);
      return null;
    }
    
    console.error('Error getting training system:', error);
    throw new Error(`Failed to get training system: ${error.message}`);
  }
}

/**
 * Get all training systems for a user
 * Implements Cache-First pattern (Stale-While-Revalidate)
 * Always returns immediately with cache if available, updates in background
 * @param {string} userId - User ID
 * @param {Object} options - Options { skipCache: boolean, returnStale: boolean }
 * @returns {Promise<Array>} Array of training systems
 */
export async function getAllTrainingSystems(userId, options = {}) {
  const cacheKey = CACHE_KEYS.TRAINING_SYSTEMS(userId);
  const { skipCache = false, returnStale = true } = options;
  
  // STEP 1: Return cached data immediately if available (CACHE-FIRST)
  if (!skipCache) {
    const cached = getFromCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      // Check if cache is valid
      const cacheItem = localStorage.getItem(cacheKey);
      if (cacheItem) {
        try {
          const parsed = JSON.parse(cacheItem);
          const isStale = isCacheStale(parsed);
          
          if (!isStale) {
            // Cache is fresh - return immediately, update in background
            fetchAllTrainingSystemsFromFirestore(userId, cacheKey).catch(() => {});
            return cached;
          } else if (returnStale) {
            // Cache is stale but return it anyway (STALE-WHILE-REVALIDATE)
            // Update in background
            fetchAllTrainingSystemsFromFirestore(userId, cacheKey).catch(() => {});
            return cached;
          }
        } catch (e) {
          // Invalid cache format, continue to fetch
        }
      }
    }
  }
  
  // STEP 2: No cache available - fetch from Firestore
  // fetchAllTrainingSystemsFromFirestore will return cached data if network fails
  return await fetchAllTrainingSystemsFromFirestore(userId, cacheKey);
}

/**
 * Fetch all training systems from Firestore and update cache
 * Returns cached data if network fails (even if stale)
 * Optimized query with limit to improve performance
 */
async function fetchAllTrainingSystemsFromFirestore(userId, cacheKey) {
  try {
    const systemsRef = getUserTrainingSystemsRef(userId);
    // Optimize query: limit to 50 most recent systems, order by creation date
    // This reduces data transfer and improves response time
    const q = query(
      systemsRef, 
      orderBy('createdAt', 'desc'),
      limit(50) // Limit to prevent fetching excessive data
    );
    const querySnapshot = await withTimeout(getDocs(q), NETWORK_TIMEOUT);
    
    const systems = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startDate: data.startDate?.toDate?.()?.toISOString() || data.startDate,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    });
    
    // If Firestore returns empty array, clear all training system caches
    if (systems.length === 0) {
      // Clear the list cache
      localStorage.removeItem(cacheKey);
      // Clear individual system caches (they all start with the same prefix)
      const prefix = `firestore_cache_training_system_${userId}_`;
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });
      // Clear the legacy localStorage trainingSystem key
      localStorage.removeItem('trainingSystem');
      console.log('[dbService] Training systems empty in Firestore - cleared all caches');
    } else {
      saveToCache(cacheKey, systems);
    }
    
    return systems;
  } catch (error) {
    // CRITICAL: Always check for cached data on ANY network error
    // This ensures users can see their training systems even if network fails
    const cached = getFromCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      if (isOfflineError(error)) {
        console.warn('⚠️ Offline detected, returning cached training systems');
      } else {
        console.warn('⚠️ Network error, returning cached training systems:', error.message);
      }
      return cached;
    }
    
    // No cache available: This is expected for first-time users or when cache was cleared
    // Use warning instead of error - this is not a critical failure
    if (isPermissionError(error)) {
      console.warn('⚠️ Permission denied while loading training systems (this is expected for new users or when rules aren\'t deployed). Rules may need to be deployed.');
    } else if (isOfflineError(error)) {
      console.warn('⚠️ Network timeout - no cached training systems available. This is normal for new users.');
    } else {
      console.warn('⚠️ Could not load training systems (network issue). This is normal for new users or when offline.');
    }
    
    // Return empty array - better UX than error for first-time users
    // The UI should handle empty arrays gracefully
    return [];
  }
}

/**
 * Sync training system from localStorage to Firestore
 * Useful when training system exists locally but not in Firebase
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} System ID if synced, null if no local system found
 */
export async function syncTrainingSystemFromLocalStorage(userId) {
  try {
    console.log('[syncTrainingSystemFromLocalStorage] Checking for local training system...');
    
    // Get training system from localStorage
    const localSystemStr = localStorage.getItem('trainingSystem');
    if (!localSystemStr) {
      console.log('[syncTrainingSystemFromLocalStorage] No local training system found');
      return null;
    }
    
    const localSystem = JSON.parse(localSystemStr);
    if (!localSystem || !localSystem.id) {
      console.log('[syncTrainingSystemFromLocalStorage] Local training system has no ID');
      return null;
    }
    
    console.log('[syncTrainingSystemFromLocalStorage] Found local training system', {
      id: localSystem.id,
      type: localSystem.type,
      sessionsCount: localSystem.sessions?.length || 0
    });
    
    // Check if it already exists in Firebase
    try {
      const existingSystem = await getTrainingSystem(userId, localSystem.id, { skipCache: true });
      if (existingSystem) {
        console.log('[syncTrainingSystemFromLocalStorage] Training system already exists in Firebase');
        return localSystem.id;
      }
    } catch (error) {
      // If error is permission or not found, continue to save
      if (!isPermissionError(error)) {
        console.warn('[syncTrainingSystemFromLocalStorage] Error checking existing system:', error.message);
      }
    }
    
    // Save to Firebase
    console.log('[syncTrainingSystemFromLocalStorage] Saving training system to Firebase...');
    const systemId = await saveTrainingSystem(userId, localSystem);
    console.log('[syncTrainingSystemFromLocalStorage] Training system synced successfully', { systemId });
    
    return systemId;
  } catch (error) {
    console.error('[syncTrainingSystemFromLocalStorage] Error syncing training system:', error);
    throw error;
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
// SESSION OPERATIONS (within training systems)
// ============================================================================

/**
 * Save session to a training system's sessions sub-collection
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @param {Object} session - Session object
 * @returns {Promise<string>} Session ID
 */
export async function saveSessionToSystem(userId, systemId, session) {
  try {
    const sessionsRef = getSystemSessionsRef(userId, systemId);
    
    // Prepare session data
    const sessionData = {
      ...session,
      updatedAt: serverTimestamp()
    };
    
    // Remove id from data if present (it's the document ID)
    const { id, ...sessionDataWithoutId } = sessionData;
    
    // Remove undefined values (Firestore doesn't allow undefined)
    const cleanedSessionData = Object.fromEntries(
      Object.entries(sessionDataWithoutId).filter(([_, value]) => value !== undefined)
    );
    
    let sessionId;
    if (session.id) {
      // Update existing or create if doesn't exist (upsert)
      const sessionRef = doc(sessionsRef, session.id);
      await withTimeout(setDoc(sessionRef, cleanedSessionData, { merge: true }), NETWORK_TIMEOUT);
      sessionId = session.id;
    } else {
      // Create new
      const docRef = await withTimeout(addDoc(sessionsRef, {
        ...cleanedSessionData,
        createdAt: serverTimestamp()
      }), NETWORK_TIMEOUT);
      sessionId = docRef.id;
    }
    
    return sessionId;
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('Offline detected while saving session to system');
      return session.id || `temp-${Date.now()}`;
    }
    
    console.error('Error saving session to system:', error);
    throw new Error(`Failed to save session: ${error.message}`);
  }
}

/**
 * Get all sessions for a training system
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @returns {Promise<Array>} Array of sessions
 */
export async function getSystemSessions(userId, systemId) {
  try {
    const sessionsRef = getSystemSessionsRef(userId, systemId);
    const q = query(sessionsRef, orderBy('day', 'asc'));
    const querySnapshot = await withTimeout(getDocs(q), NETWORK_TIMEOUT);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt
      };
    });
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('Offline detected while fetching system sessions');
      return [];
    }
    
    if (isPermissionError(error)) {
      // Permission errors are expected when rules aren't deployed or user has no data
      console.warn('Permission denied while fetching system sessions (this is expected for new users or when rules aren\'t deployed):', error.message);
      return [];
    }
    
    console.error('Error getting system sessions:', error);
    throw new Error(`Failed to get system sessions: ${error.message}`);
  }
}

/**
 * Get session by ID from a training system
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Session or null
 */
export async function getSystemSession(userId, systemId, sessionId) {
  try {
    const sessionsRef = getSystemSessionsRef(userId, systemId);
    const sessionRef = doc(sessionsRef, sessionId);
    const sessionSnap = await withTimeout(getDoc(sessionRef), NETWORK_TIMEOUT);
    
    if (sessionSnap.exists()) {
      const data = sessionSnap.data();
      return {
        id: sessionSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt
      };
    }
    
    return null;
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('Offline detected while fetching session');
      return null;
    }
    
    console.error('Error getting session:', error);
    throw new Error(`Failed to get session: ${error.message}`);
  }
}

/**
 * Save session (backwards compatibility - redirects to saveSessionToSystem)
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @param {Object} session - Session object
 * @returns {Promise<string>} Session ID
 */
export async function saveSession(userId, systemId, session) {
  return await saveSessionToSystem(userId, systemId, session);
}

/**
 * Get session by ID (backwards compatibility)
 * @param {string} userId - User ID
 * @param {string} systemId - Training system ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Session or null
 */
export async function getSession(userId, systemId, sessionId) {
  return await getSystemSession(userId, systemId, sessionId);
}

/**
 * Get user completed sessions sub-collection reference
 * @param {string} userId - User ID
 * @returns {import('firebase/firestore').CollectionReference}
 */
function getUserCompletedSessionsRef(userId) {
  return collection(db, 'users', userId, 'completedSessions');
}

/**
 * Remove undefined fields from an object recursively
 * Firestore doesn't accept undefined values
 * @param {*} obj - Object to clean
 * @returns {*} Cleaned object
 */
function removeUndefinedFields(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)).filter(item => item !== null && item !== undefined);
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null && !(value instanceof Date) && !(value.toDate)) {
        // Recursively clean nested objects (but skip Date objects and Firestore Timestamps)
        const cleanedValue = removeUndefinedFields(value);
        if (cleanedValue !== null && cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      } else {
        cleaned[key] = value;
      }
    }
  }
  
  return cleaned;
}

/**
 * Save completed session to Firebase
 * Stores completed sessions in a separate sub-collection for easy querying
 * @param {string} userId - User ID
 * @param {Object} sessionData - Completed session data
 * @returns {Promise<string>} Session document ID
 */
export async function saveCompletedSession(userId, sessionData) {
  try {
    const sessionsRef = getUserCompletedSessionsRef(userId);
    
    // Ensure date is in ISO format (YYYY-MM-DD)
    const sessionDate = sessionData.date || new Date().toISOString().split('T')[0];
    
    // Convert dates to Firestore Timestamps
    let sessionDoc = {
      ...sessionData,
      date: sessionDate,
      startedAt: sessionData.startedAt ? Timestamp.fromDate(new Date(sessionData.startedAt)) : serverTimestamp(),
      completedAt: sessionData.completedAt ? Timestamp.fromDate(new Date(sessionData.completedAt)) : serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Remove all undefined fields before saving (Firestore doesn't accept undefined)
    sessionDoc = removeUndefinedFields(sessionDoc);
    
    console.log('[saveCompletedSession] Cleaning session data, removing undefined fields');
    console.log('[saveCompletedSession] Session date:', sessionDate);
    
    // Check if session already exists for this date
    const existingQuery = query(
      sessionsRef,
      where('date', '==', sessionDate),
      limit(1)
    );
    
    const existingSnap = await withTimeout(getDocs(existingQuery), NETWORK_TIMEOUT);
    
    let sessionId;
    if (!existingSnap.empty) {
      // Update existing session
      const existingDoc = existingSnap.docs[0];
      const docRef = doc(sessionsRef, existingDoc.id);
      await withTimeout(updateDoc(docRef, sessionDoc), NETWORK_TIMEOUT);
      sessionId = existingDoc.id;
      console.log('[saveCompletedSession] ✓ Updated existing session:', sessionId);
    } else {
      // Create new session
      const docRef = await withTimeout(addDoc(sessionsRef, sessionDoc), NETWORK_TIMEOUT);
      sessionId = docRef.id;
      console.log('[saveCompletedSession] ✓ Created new session:', sessionId);
    }
    
    return sessionId;
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('Offline detected while saving completed session, will retry when online');
      // Firestore persistence will handle retry
      return `temp-${Date.now()}`;
    }
    
    console.error('Error saving completed session:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw new Error(`Failed to save completed session: ${error.message}`);
  }
}

/**
 * Get completed sessions for a user
 * @param {string} userId - User ID
 * @param {Object} options - Options { limit: number, startDate: string, endDate: string }
 * @returns {Promise<Array>} Array of completed sessions
 */
export async function getCompletedSessions(userId, options = {}) {
  try {
    const { limit: limitCount = 50, startDate, endDate } = options;
    const sessionsRef = getUserCompletedSessionsRef(userId);
    
    let q = query(sessionsRef, orderBy('date', 'desc'), limit(limitCount));
    
    if (startDate || endDate) {
      const constraints = [];
      if (startDate) {
        constraints.push(where('date', '>=', startDate));
      }
      if (endDate) {
        constraints.push(where('date', '<=', endDate));
      }
      q = query(sessionsRef, ...constraints, orderBy('date', 'desc'), limit(limitCount));
    }
    
    const querySnapshot = await withTimeout(getDocs(q), NETWORK_TIMEOUT);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startedAt: data.startedAt?.toDate?.()?.toISOString() || data.startedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    });
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('Offline detected while fetching completed sessions');
      return [];
    }
    
    console.error('Error getting completed sessions:', error);
    throw new Error(`Failed to get completed sessions: ${error.message}`);
  }
}

// ============================================================================
// SESSION REPORTS (PERFORMANCE ANALYST)
// ============================================================================

/**
 * Save or update a performance report for a completed session.
 * Stores both a lightweight summary (for listing) and the full reportData payload.
 *
 * @param {string} userId - User ID
 * @param {Object} reportData - Report data object from workout-metrics
 * @returns {Promise<string>} Report document ID
 */
export async function saveSessionReport(userId, reportData) {
  try {
    if (!userId || !reportData) {
      throw new Error('userId and reportData are required');
    }

    const reportsRef = getUserSessionReportsRef(userId);
    const sessionId = reportData.sessionId || null;
    const sessionDate =
      reportData.sessionDate || new Date().toISOString().split('T')[0];

    // Build exercise summaries for quick listing (ensure no undefined values)
    const exercises = Array.isArray(reportData.exercises)
      ? reportData.exercises
      : [];

    const exerciseSummaries = exercises.map((ex) => {
      const comp = ex.comparison || {};
      const summary = {
        exerciseId: ex.exerciseId || null,
        variationId: ex.variationId || null,
        name: ex.name || '',
        metric: comp.metric || 'volume',
        isPR: !!comp.isPR
      };
      
      // Only include numeric fields if they have values
      if (comp.currentVolume !== undefined && comp.currentVolume !== null) {
        summary.currentVolume = comp.currentVolume;
      }
      if (comp.deltaPercent !== undefined && comp.deltaPercent !== null) {
        summary.deltaPercent = comp.deltaPercent;
      }
      
      return summary;
    });

    // Clean macroStats to remove undefined values
    const macroStats = reportData.macroStats || {};
    const cleanMacroStats = {};
    Object.keys(macroStats).forEach(key => {
      if (macroStats[key] !== undefined) {
        cleanMacroStats[key] = macroStats[key];
      }
    });

    const now = Timestamp.fromDate(new Date());

    // Build report document
    let reportDoc = {
      userId,
      sessionId: sessionId || null,
      sessionDate,
      macroStats: cleanMacroStats,
      exerciseSummaries,
      reportData: removeUndefinedFields(reportData), // Clean the full reportData
      updatedAt: now
    };

    // Remove all undefined fields before saving (Firestore doesn't accept undefined)
    reportDoc = removeUndefinedFields(reportDoc);

    console.log('[saveSessionReport] Cleaning report data, removing undefined fields');
    console.log('[saveSessionReport] Session ID:', sessionId, 'Date:', sessionDate);

    // If we have a sessionId, try to upsert by that to keep a 1:1 mapping
    let reportId;

    if (sessionId) {
      const existingQuery = query(
        reportsRef,
        where('sessionId', '==', sessionId),
        limit(1)
      );
      const existingSnap = await withTimeout(
        getDocs(existingQuery),
        NETWORK_TIMEOUT
      );

      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const docRef = doc(reportsRef, existingDoc.id);
        await withTimeout(
          updateDoc(docRef, {
            ...reportDoc,
            createdAt: existingDoc.data().createdAt || now
          }),
          NETWORK_TIMEOUT
        );
        reportId = existingDoc.id;
        console.log('[saveSessionReport] ✓ Updated existing report:', reportId);
      } else {
        const docRef = await withTimeout(
          addDoc(reportsRef, {
            ...reportDoc,
            createdAt: now
          }),
          NETWORK_TIMEOUT
        );
        reportId = docRef.id;
        console.log('[saveSessionReport] ✓ Created new report:', reportId);
      }
    } else {
      // No sessionId (should be rare) – just add a new document
      const docRef = await withTimeout(
        addDoc(reportsRef, {
          ...reportDoc,
          createdAt: now
        }),
        NETWORK_TIMEOUT
      );
      reportId = docRef.id;
      console.log('[saveSessionReport] ✓ Created new report (no sessionId):', reportId);
    }

    return reportId;
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn(
        '[SessionReports] Offline detected while saving session report'
      );
      // Firestore persistence will retry when back online
      return `temp-report-${Date.now()}`;
    }

    console.error('[SessionReports] Error saving session report:', error);
    console.error('[SessionReports] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw new Error(`Failed to save session report: ${error.message}`);
  }
}

/**
 * Get session performance reports for a user (for My Training UI).
 *
 * @param {string} userId - User ID
 * @param {Object} options - { limit: number, skipCache: boolean }
 * @returns {Promise<Array>} Array of report summaries
 */
export async function getSessionReports(userId, options = {}) {
  try {
    if (!userId) {
      console.warn('getSessionReports: userId is required');
      return [];
    }

    const { limit: limitCount = 50, skipCache = false } = options;
    const reportsRef = getUserSessionReportsRef(userId);

    // Always fetch fresh from Firestore (no cache for reports to ensure latest data)
    const q = query(
      reportsRef,
      orderBy('sessionDate', 'desc'),
      limit(limitCount)
    );

    const snap = await withTimeout(getDocs(q), NETWORK_TIMEOUT);

    const reports = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        // Normalize timestamps if they are Firestore Timestamp objects
        createdAt:
          data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
        updatedAt:
          data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || null
      };
    });

    console.log(`[SessionReports] Fetched ${reports.length} reports for user ${userId}`);
    return reports;
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('[SessionReports] Offline detected while fetching reports');
      return [];
    }

    if (isPermissionError(error)) {
      console.warn('[SessionReports] Permission error (expected for new users):', error.message);
      return [];
    }

    console.error('[SessionReports] Error getting session reports:', error);
    throw new Error(`Failed to get session reports: ${error.message}`);
  }
}

/**
 * Get a specific session report by ID
 * @param {string} userId - User ID
 * @param {string} reportId - Report document ID
 * @returns {Promise<Object|null>} Report document or null if not found
 */
export async function getSessionReport(userId, reportId) {
  try {
    if (!userId || !reportId) {
      console.warn('getSessionReport: userId and reportId are required');
      return null;
    }

    const reportsRef = getUserSessionReportsRef(userId);
    const reportDoc = doc(reportsRef, reportId);
    const reportSnap = await withTimeout(getDoc(reportDoc), NETWORK_TIMEOUT);

    if (!reportSnap.exists()) {
      return null;
    }

    const data = reportSnap.data();
    return {
      id: reportSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || null
    };
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('[SessionReport] Offline detected while fetching report');
      return null;
    }

    console.error('[SessionReport] Error getting session report:', error);
    throw new Error(`Failed to get session report: ${error.message}`);
  }
}

/**
 * Check if a session is completed for a given date
 * @param {string} userId - User ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<boolean>} True if session is completed
 */
export async function isSessionCompleted(userId, date) {
  try {
    const sessionsRef = getUserCompletedSessionsRef(userId);
    const q = query(
      sessionsRef,
      where('date', '==', date),
      limit(1)
    );
    
    const querySnapshot = await withTimeout(getDocs(q), NETWORK_TIMEOUT);
    return !querySnapshot.empty;
  } catch (error) {
    if (isOfflineError(error)) {
      // On offline, assume not completed to be safe
      return false;
    }
    
    if (isPermissionError(error)) {
      // Permission errors are expected when rules aren't deployed or user has no data
      // Assume session is not completed (safe default)
      console.warn('Permission denied while checking session completion (this is expected for new users or when rules aren\'t deployed):', error.message);
      return false;
    }
    
    console.error('Error checking if session is completed:', error);
    return false;
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

/**
 * Update user streak when a session is completed
 * Increments currentStreak by 1 and updates longestStreak if needed
 * Also updates lastSessionDate to track consecutive days
 * 
 * @param {string} userId - User ID
 * @param {string} sessionDate - Session date in YYYY-MM-DD format
 * @returns {Promise<Object>} Updated streak info { currentStreak, longestStreak }
 */
export async function updateStreakOnSessionComplete(userId, sessionDate) {
  try {
    const userRef = getUserDocRef(userId);
    const userSnap = await withTimeout(getDoc(userRef), NETWORK_TIMEOUT);
    
    if (!userSnap.exists()) {
      console.log('[Streak] User profile does not exist, creating with streak 1');
      // First session - initialize streak
      const newStreak = 1;
      await withTimeout(setDoc(userRef, {
        currentStreak: newStreak,
        longestStreak: newStreak,
        lastSessionDate: sessionDate,
        updatedAt: serverTimestamp()
      }), NETWORK_TIMEOUT);
      
      // Update cache
      const cacheKey = CACHE_KEYS.PROFILE(userId);
      saveToCache(cacheKey, {
        id: userId,
        currentStreak: newStreak,
        longestStreak: newStreak,
        lastSessionDate: sessionDate
      });
      
      return { currentStreak: newStreak, longestStreak: newStreak };
    }
    
    const userData = userSnap.data();
    const currentStreak = userData.currentStreak || 0;
    const longestStreak = userData.longestStreak || 0;
    const lastSessionDate = userData.lastSessionDate;
    
    // Calculate new streak
    let newStreak = 1; // Default to 1 if no previous session
    
    if (lastSessionDate) {
      // Parse dates
      const lastDate = new Date(lastSessionDate);
      const currentDate = new Date(sessionDate);
      
      // Calculate days difference
      const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) {
        // Same day - don't increment (session already counted)
        newStreak = currentStreak;
      } else if (daysDiff === 1) {
        // Consecutive day - increment streak
        newStreak = currentStreak + 1;
      } else {
        // Gap in days - reset streak to 1
        newStreak = 1;
      }
    } else {
      // First session ever
      newStreak = 1;
    }
    
    // Update longestStreak if current streak exceeds it
    const newLongestStreak = Math.max(longestStreak, newStreak);
    
    // Update user profile
    await withTimeout(updateDoc(userRef, {
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastSessionDate: sessionDate,
      updatedAt: serverTimestamp()
    }), NETWORK_TIMEOUT);
    
    // Update cache
    const cacheKey = CACHE_KEYS.PROFILE(userId);
    const cachedProfile = getFromCache(cacheKey) || {};
    saveToCache(cacheKey, {
      ...cachedProfile,
      id: userId,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastSessionDate: sessionDate
    });
    
    console.log(`[Streak] ✓ Updated streak: ${currentStreak} -> ${newStreak} (longest: ${newLongestStreak})`);
    
    return { currentStreak: newStreak, longestStreak: newLongestStreak };
  } catch (error) {
    console.error('[Streak] Error updating streak:', error);
    throw new Error(`Failed to update streak: ${error.message}`);
  }
}

/**
 * Backfill longestStreak field for existing users
 * Sets longestStreak to currentStreak if it's missing
 * This is a simple initialization - for accurate historical calculation,
 * use the backfillLongestStreak function from src/services/dbService.js
 * 
 * @param {string} userId - User ID
 * @returns {Promise<number>} The longest streak value (currentStreak or 0)
 */
export async function backfillLongestStreak(userId) {
  try {
    console.log('[Backfill] Initializing longestStreak for user:', userId);
    
    const userRef = getUserDocRef(userId);
    const userSnap = await withTimeout(getDoc(userRef), NETWORK_TIMEOUT);
    
    if (!userSnap.exists()) {
      console.log('[Backfill] User profile does not exist');
      return 0;
    }
    
    const userData = userSnap.data();
    const currentStreak = userData.currentStreak || 0;
    const existingLongestStreak = userData.longestStreak;
    
    console.log('[Backfill] Current streak:', currentStreak);
    console.log('[Backfill] Existing longestStreak:', existingLongestStreak);
    
    // If longestStreak is missing, set it to currentStreak (or 0 if no streak)
    if (existingLongestStreak === undefined) {
      const longestStreak = currentStreak;
      await withTimeout(updateDoc(userRef, {
        longestStreak: longestStreak,
        updatedAt: serverTimestamp()
      }), NETWORK_TIMEOUT);
      
      console.log('[Backfill] ✓ Initialized longestStreak to:', longestStreak);
      return longestStreak;
    }
    
    // If currentStreak is higher than longestStreak, update it
    if (currentStreak > existingLongestStreak) {
      await withTimeout(updateDoc(userRef, {
        longestStreak: currentStreak,
        updatedAt: serverTimestamp()
      }), NETWORK_TIMEOUT);
      
      console.log('[Backfill] ✓ Updated longestStreak:', existingLongestStreak, '->', currentStreak);
      return currentStreak;
    }
    
    console.log('[Backfill] ✓ longestStreak already up to date:', existingLongestStreak);
    return existingLongestStreak;
  } catch (error) {
    console.error('[Backfill] Error backfilling longestStreak:', error);
    throw new Error(`Failed to backfill longest streak: ${error.message}`);
  }
}

