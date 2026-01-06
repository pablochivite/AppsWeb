/**
 * Authentication Service
 * 
 * Service layer abstraction for Firebase Authentication.
 * This service wraps Firebase Auth methods to provide a clean API for the UI layer.
 * 
 * Benefits:
 * - UI components never directly import Firebase
 * - Centralized auth logic
 * - Easy to mock for testing
 * - Consistent error handling
 */

import { auth } from '../../config/firebase.config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';

/**
 * Get current authenticated user
 * @returns {import('firebase/auth').User|null} Current user or null
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signIn(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error) {
    console.error('Sign in error:', error);
    throw new Error(`Sign in failed: ${error.message}`);
  }
}

/**
 * Sign up with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - User display name (optional)
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signUp(email, password, displayName = null) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update display name if provided
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
    
    return userCredential;
  } catch (error) {
    console.error('Sign up error:', error);
    throw new Error(`Sign up failed: ${error.message}`);
  }
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw new Error(`Sign out failed: ${error.message}`);
  }
}

/**
 * Subscribe to authentication state changes
 * @param {Function} callback - Callback function (user) => void
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<void>}
 */
export async function sendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Password reset error:', error);
    throw new Error(`Password reset failed: ${error.message}`);
  }
}

/**
 * Sign in with Google
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    return userCredential;
  } catch (error) {
    console.error('Google sign in error:', error);
    throw new Error(`Google sign in failed: ${error.message}`);
  }
}

/**
 * Update user profile
 * @param {Object} updates - Profile updates { displayName?, photoURL? }
 * @returns {Promise<void>}
 */
export async function updateUserProfile(updates) {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('No user is currently signed in');
    }
    await updateProfile(user, updates);
  } catch (error) {
    console.error('Profile update error:', error);
    throw new Error(`Profile update failed: ${error.message}`);
  }
}

