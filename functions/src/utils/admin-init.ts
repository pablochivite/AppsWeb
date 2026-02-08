/**
 * Firebase Admin Initialization Utility
 * Ensures proper initialization with emulator support
 */

import * as admin from "firebase-admin";

let isInitialized = false;

/**
 * Initialize Firebase Admin with emulator support
 * This should be called before any admin operations
 */
export function initializeFirebaseAdmin(): void {
  if (isInitialized || admin.apps.length > 0) {
    return;
  }

  // Check if we're running in emulator mode
  const isEmulator = process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR_HOST;
  
  if (isEmulator) {
    // Configure for emulator
    const projectId = process.env.GCLOUD_PROJECT || "demo-regain";
    
    admin.initializeApp({
      projectId,
      // Emulator will be used automatically if FIRESTORE_EMULATOR_HOST is set
    });
    
    console.log("[Admin Init] Firebase Admin initialized for emulator mode");
    console.log("[Admin Init] FIRESTORE_EMULATOR_HOST:", process.env.FIRESTORE_EMULATOR_HOST);
    console.log("[Admin Init] FUNCTIONS_EMULATOR_HOST:", process.env.FUNCTIONS_EMULATOR_HOST);
  } else {
    // Production mode - use default initialization
    admin.initializeApp();
    console.log("[Admin Init] Firebase Admin initialized for production mode");
  }
  
  isInitialized = true;
}

