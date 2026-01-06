/**
 * Authentication Manager
 * 
 * Manages authentication state and flow throughout the application.
 * Handles login, signup, logout, and authentication state changes.
 */

import { 
    signIn, 
    signUp, 
    signOutUser, 
    getCurrentUser, 
    onAuthStateChange,
    sendPasswordReset,
    signInWithGoogle
} from '../services/authService.js';
import { saveUserProfile, getUserProfile } from '../services/dbService.js';
import { migrateLocalStorageToFirestore } from './data-migration.js';

// Auth state
let currentUser = null;
let authStateListeners = [];

/**
 * Initialize authentication manager
 * Sets up auth state listener and checks for existing session
 */
export function initAuthManager() {
    // Listen for auth state changes
    onAuthStateChange(async (user) => {
        const previousUser = currentUser;
        currentUser = user;
        
        console.log('Auth state changed:', user ? `User: ${user.uid}` : 'No user');
        
        // If user just signed in and we have localStorage data, migrate it
        if (user && !previousUser) {
            await handleUserSignIn(user);
        }
        
        // If user signed out, clear local state
        if (!user && previousUser) {
            handleUserSignOut();
        }
        
        // Notify all listeners
        notifyAuthStateListeners(user);
    });
    
    // Check initial auth state
    currentUser = getCurrentUser();
    if (currentUser) {
        console.log('User already signed in:', currentUser.uid);
    }
}

/**
 * Handle user sign in - migrate data if needed
 * @param {import('firebase/auth').User} user - Firebase user object
 */
async function handleUserSignIn(user) {
    try {
        // Check if user profile exists in Firestore
        const profile = await getUserProfile(user.uid);
        
        if (!profile) {
            // New user - check for localStorage data to migrate
            console.log('New user detected, checking for localStorage data to migrate...');
            await migrateLocalStorageToFirestore(user.uid);
        } else {
            console.log('Existing user profile found in Firestore');
        }
    } catch (error) {
        console.error('Error handling user sign in:', error);
        // Don't block sign in if migration fails
    }
}

/**
 * Handle user sign out
 */
function handleUserSignOut() {
    console.log('User signed out');
    // Clear any local state if needed
    // Note: We don't clear localStorage here as it might be used for offline fallback
}

/**
 * Subscribe to authentication state changes
 * @param {Function} callback - Callback function (user) => void
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChanged(callback) {
    authStateListeners.push(callback);
    
    // Immediately call with current state
    if (currentUser !== undefined) {
        callback(currentUser);
    }
    
    // Return unsubscribe function
    return () => {
        const index = authStateListeners.indexOf(callback);
        if (index > -1) {
            authStateListeners.splice(index, 1);
        }
    };
}

/**
 * Notify all auth state listeners
 * @param {import('firebase/auth').User|null} user - Current user or null
 */
function notifyAuthStateListeners(user) {
    authStateListeners.forEach(callback => {
        try {
            callback(user);
        } catch (error) {
            console.error('Error in auth state listener:', error);
        }
    });
}

/**
 * Get current authenticated user
 * @returns {import('firebase/auth').User|null} Current user or null
 */
export function getAuthUser() {
    return currentUser;
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if user is authenticated
 */
export function isAuthenticated() {
    return currentUser !== null;
}

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function login(email, password) {
    try {
        const userCredential = await signIn(email, password);
        return userCredential;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

/**
 * Sign up with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - User display name
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signup(email, password, displayName) {
    try {
        const userCredential = await signUp(email, password, displayName);
        
        // Create initial user profile
        if (userCredential.user) {
            await saveUserProfile(userCredential.user.uid, {
                email: email,
                displayName: displayName,
                role: null, // Will be set during onboarding
                preferredDisciplines: [],
                discomforts: [],
                equipment: [],
                goals: []
            });
        }
        
        return userCredential;
    } catch (error) {
        console.error('Signup error:', error);
        throw error;
    }
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export async function logout() {
    try {
        await signOutUser();
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<void>}
 */
export async function resetPassword(email) {
    try {
        await sendPasswordReset(email);
    } catch (error) {
        console.error('Password reset error:', error);
        throw error;
    }
}

/**
 * Sign in with Google
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function loginWithGoogle() {
    try {
        const userCredential = await signInWithGoogle();
        
        // Create profile if new user
        if (userCredential.user) {
            const profile = await getUserProfile(userCredential.user.uid);
            if (!profile) {
                await saveUserProfile(userCredential.user.uid, {
                    email: userCredential.user.email,
                    displayName: userCredential.user.displayName,
                    role: null,
                    preferredDisciplines: [],
                    discomforts: [],
                    equipment: [],
                    goals: []
                });
            }
        }
        
        return userCredential;
    } catch (error) {
        console.error('Google login error:', error);
        throw error;
    }
}

