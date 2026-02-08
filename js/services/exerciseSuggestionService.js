// Exercise Suggestion Service
// Frontend client for AI-powered exercise suggestions (LangGraph Cloud Function)

/**
 * Get the Cloud Functions base URL
 * Reuse the same pattern as analysisAgentService
 */
function getFunctionsUrl() {
  if (import.meta.env.DEV) {
    return 'http://localhost:5001';
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('VITE_FIREBASE_PROJECT_ID not configured');
  }

  return `https://${projectId}.cloudfunctions.net`;
}

/**
 * Get current user's auth token
 */
async function getAuthToken() {
  const { getAuth } = await import('firebase/auth');
  const { auth } = await import('../../config/firebase.config.js');

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  return await currentUser.getIdToken();
}

/**
 * Get AI exercise suggestions for a given phase and context
 * @param {'warmup' | 'workout' | 'cooldown'} phase
 * @param {Object} context
 * @returns {Promise<Array<{ exercise, variation, reason?: string }>>}
 */
export async function getExerciseSuggestions(phase, context = {}) {
  const token = await getAuthToken();
  const functionsUrl = getFunctionsUrl();
  const functionName = 'suggestExercises';

  let url;
  if (import.meta.env.DEV) {
    url = `${functionsUrl}/${import.meta.env.VITE_FIREBASE_PROJECT_ID}/us-central1/${functionName}`;
  } else {
    url = `${functionsUrl}/${functionName}`;
  }

  const payload = {
    phase,
    context,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || errorData.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}



