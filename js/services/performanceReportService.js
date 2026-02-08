/**
 * Performance Report Service
 * Frontend client for generating workout performance report narratives
 */

/**
 * Get the Cloud Functions URL
 * In development, this will be the emulator URL
 * In production, this will be the deployed function URL
 */
function getFunctionsUrl() {
  // Check if we're in development with emulator
  if (import.meta.env.DEV) {
    // Default emulator URL - adjust if needed
    return "http://localhost:5001";
  }
  
  // Get from environment or use default Firebase project
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("VITE_FIREBASE_PROJECT_ID not configured");
  }
  
  return `https://${projectId}.cloudfunctions.net`;
}

/**
 * Get current user's auth token
 */
async function getAuthToken() {
  const { getAuth } = await import("firebase/auth");
  const { auth } = await import("../../config/firebase.config.js");
  
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated");
  }
  
  return await currentUser.getIdToken();
}

/**
 * Generate performance report narrative from reportData
 * @param {Object} reportData - Performance report data with macroStats and exercises
 * @returns {Promise<Object>} Narrative result with reportTitle, macroSummary, exerciseInsights
 */
export async function generatePerformanceReportNarrative(reportData) {
  try {
    if (!reportData || typeof reportData !== "object") {
      throw new Error("reportData is required and must be an object");
    }

    if (!reportData.sessionDate || !reportData.macroStats || !Array.isArray(reportData.exercises)) {
      throw new Error("reportData must have sessionDate, macroStats, and exercises array");
    }

    // Get auth token
    const token = await getAuthToken();
    
    // Get functions URL
    const functionsUrl = getFunctionsUrl();
    const functionName = "generateWorkoutReport"; // Name of the Cloud Function
    
    // Determine the full URL
    let url;
    if (import.meta.env.DEV) {
      // Emulator URL format
      url = `${functionsUrl}/${import.meta.env.VITE_FIREBASE_PROJECT_ID}/us-central1/${functionName}`;
    } else {
      // Production URL format
      url = `${functionsUrl}/${functionName}`;
    }

    // Make request to Cloud Function
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reportData }),
      });
    } catch (fetchError) {
      // Handle network errors (CORS, connection refused, etc.)
      if (fetchError.name === "TypeError" && fetchError.message.includes("Failed to fetch")) {
        const isDev = import.meta.env.DEV;
        const errorMessage = isDev
          ? `Failed to connect to Firebase Functions emulator. Please ensure:\n1. Firebase emulators are running (firebase emulators:start)\n2. Functions emulator is on port 5001\n3. CORS is properly configured\n\nOriginal error: ${fetchError.message}`
          : `Failed to connect to Firebase Functions. Please check your network connection and try again.\n\nOriginal error: ${fetchError.message}`;
        throw new Error(errorMessage);
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    
    return {
      reportTitle: data.reportTitle,
      macroSummary: data.macroSummary,
      exerciseInsights: data.exerciseInsights || {},
    };
  } catch (error) {
    console.error("Error in generatePerformanceReportNarrative:", error);
    throw error;
  }
}

