/**
 * Dashboard Controller
 * 
 * Controller Pattern implementation for the athlete dashboard.
 * Separates state management from DOM rendering to facilitate future React migration.
 * 
 * Architecture:
 * - State: Holds application state (mimics React state)
 * - Render: Updates DOM based on state
 * - Init: Fetches data, updates state, triggers render
 */

import { getUserProfile } from '../../js/services/dbService.js';
import { getCurrentUser } from '../../js/services/authService.js';

// ============================================================================
// STATE (mimics React state)
// ============================================================================

/**
 * Dashboard state object
 * Holds all state data for the dashboard view
 * @type {Object}
 */
const state = {
  sessionRating: null, // { mobility: number, rotation: number, flexibility: number } - Projected metrics for today's session
  streak: 0 // Current streak count
};

// ============================================================================
// RENDER FUNCTION
// ============================================================================

/**
 * Render function - updates DOM elements based on state
 * This separation makes it easy to migrate to React later (just replace this function)
 */
function render() {
  // Update streak display in sidebar
  // Find the streak number element within "Current Streak" section
  const streakSection = Array.from(document.querySelectorAll('h3')).find(
    el => el.textContent.includes('Current Streak')
  );
  
  if (streakSection) {
    // Find the parent container and then the number element
    const streakContainer = streakSection.closest('.glass-strong');
    if (streakContainer) {
      // Find the div with the large number (text-5xl class)
      const streakNumberEl = streakContainer.querySelector('.text-5xl');
      // Find the text element - it's a p tag with text-sm and text-white/60 classes
      const streakTextEl = streakContainer.querySelector('p.text-sm');
      
      if (streakNumberEl) {
        streakNumberEl.textContent = state.streak;
      }
      
      if (streakTextEl) {
        streakTextEl.textContent = state.streak === 1 ? 'day in a row' : 'days in a row';
      }
    }
  }

  // Update session rating display (if rating cards exist)
  if (state.sessionRating) {
    const mobilityElement = document.querySelector('[data-rating-mobility]');
    const rotationElement = document.querySelector('[data-rating-rotation]');
    const flexibilityElement = document.querySelector('[data-rating-flexibility]');
    
    const mobilityBar = document.querySelector('[data-rating-bar-mobility]');
    const rotationBar = document.querySelector('[data-rating-bar-rotation]');
    const flexibilityBar = document.querySelector('[data-rating-bar-flexibility]');

    if (mobilityElement) {
      mobilityElement.textContent = `${state.sessionRating.mobility}%`;
    }
    if (mobilityBar) {
      mobilityBar.style.width = `${state.sessionRating.mobility}%`;
    }
    
    if (rotationElement) {
      rotationElement.textContent = `${state.sessionRating.rotation}%`;
    }
    if (rotationBar) {
      rotationBar.style.width = `${state.sessionRating.rotation}%`;
    }
    
    if (flexibilityElement) {
      flexibilityElement.textContent = `${state.sessionRating.flexibility}%`;
    }
    if (flexibilityBar) {
      flexibilityBar.style.width = `${state.sessionRating.flexibility}%`;
    }
  } else {
    // If no session rating, show zeros (rest day)
    const mobilityElement = document.querySelector('[data-rating-mobility]');
    const rotationElement = document.querySelector('[data-rating-rotation]');
    const flexibilityElement = document.querySelector('[data-rating-flexibility]');
    
    const mobilityBar = document.querySelector('[data-rating-bar-mobility]');
    const rotationBar = document.querySelector('[data-rating-bar-rotation]');
    const flexibilityBar = document.querySelector('[data-rating-bar-flexibility]');

    if (mobilityElement) mobilityElement.textContent = '0%';
    if (mobilityBar) mobilityBar.style.width = '0%';
    if (rotationElement) rotationElement.textContent = '0%';
    if (rotationBar) rotationBar.style.width = '0%';
    if (flexibilityElement) flexibilityElement.textContent = '0%';
    if (flexibilityBar) flexibilityBar.style.width = '0%';
  }

  // Log state for debugging
  console.log('[Dashboard] State updated:', state);
}

// ============================================================================
// INIT FUNCTION
// ============================================================================

/**
 * Initialize dashboard - fetches data, updates state, and renders
 * This is the main entry point for the dashboard controller
 * 
 * @param {Object} sessionMetrics - Optional projected metrics for today's session { mobility, rotation, flexibility }
 *                                  If not provided, will show zeros (rest day)
 */
export async function init(sessionMetrics = null) {
  try {
    console.log('[Dashboard] Initializing...');

    // Get current user
    const user = getCurrentUser();
    if (!user) {
      console.warn('[Dashboard] No authenticated user found');
      // Render with default state (streak: 0, sessionRating: null)
      render();
      return;
    }

    const userId = user.uid;
    console.log('[Dashboard] User ID:', userId);

    // Set session rating from provided metrics (projected metrics for today's session)
    if (sessionMetrics) {
      state.sessionRating = sessionMetrics;
      console.log('[Dashboard] Session rating (projected metrics) loaded:', sessionMetrics);
    } else {
      // No session (rest day) - show zeros
      state.sessionRating = { mobility: 0, rotation: 0, flexibility: 0 };
      console.log('[Dashboard] No session today (rest day), showing zeros');
    }

    // Fetch user profile from db service
    // Note: Using getUserProfile instead of getUserData (which doesn't exist)
    try {
      const userProfile = await getUserProfile(userId);
      console.log('[Dashboard] User profile loaded:', userProfile);

      // Extract streak from user profile if available
      // The streak is now stored as currentStreak in the user profile (updated when sessions are saved)
      if (userProfile?.currentStreak !== undefined) {
        state.streak = userProfile.currentStreak;
      } else {
        // Default to 0 if streak is not in profile
        state.streak = 0;
      }
    } catch (error) {
      console.error('[Dashboard] Error loading user profile:', error);
      // Continue with default streak: 0
    }

    // Update DOM based on state
    render();

    console.log('[Dashboard] Initialization complete');
  } catch (error) {
    console.error('[Dashboard] Initialization error:', error);
    // Render with whatever state we have (may be defaults)
    render();
  }
}

// Export state for debugging/development (optional)
export { state };

