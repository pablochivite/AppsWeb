/**
 * Analysis Agent Service
 * Frontend client for calling Cloud Functions LangGraph agent
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
 * Analyze a query using the LangGraph agent
 * @param {string} query - User's query/question
 * @returns {Promise<Object>} Analysis result with visualizationSpec, insights, recommendations
 */
export async function analyzeQuery(query) {
  try {
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      throw new Error("Query is required and must be a non-empty string");
    }

    // Get auth token
    const token = await getAuthToken();
    
    // Get functions URL
    const functionsUrl = getFunctionsUrl();
    const functionName = "analyze"; // Name of the Cloud Function
    
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
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: query.trim() }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    
    return {
      visualizationSpec: data.visualizationSpec,
      insights: data.insights || [],
      recommendations: data.recommendations || [],
      needsClarification: data.needsClarification || false,
      clarificationQuestion: data.clarificationQuestion,
    };
  } catch (error) {
    console.error("Error in analyzeQuery:", error);
    throw error;
  }
}

