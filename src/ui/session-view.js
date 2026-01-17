/**
 * Session View UI Binding
 * 
 * Handles session completion and constructs sessionData for saving.
 * This module integrates with the existing session-view to save completed sessions.
 */

import { saveCompletedSession } from '../services/dbService.js';

/**
 * Construct sessionData object from session state
 * Transforms the session data into the 3-phase structure with blocks
 * 
 * @param {Object} sessionState - Current session state from SessionView
 * @param {Object} session - Original session object
 * @param {string} userId - User ID
 * @returns {Promise<string>} Session document ID
 */
export async function handleFinishWorkout(sessionState, session, userId) {
  try {
    // Calculate duration (seconds)
    const startedAt = new Date(sessionState.startedAt || new Date());
    const completedAt = new Date();
    const duration = Math.floor((completedAt - startedAt) / 1000);

    // Extract workout label before processing phases to avoid conflict
    const workoutLabel = session.workout || ''; // Workout label (e.g., 'Push', 'Pull')

    // Transform session phases into the 3-phase structure with blocks
    // Each phase must have blocks array (even if empty)
    const phases = ['warmup', 'workout', 'cooldown'];
    const sessionData = {
      workout: workoutLabel, // Workout label - will be normalized in saveCompletedSession
      discipline: session.discipline || '',
      date: session.date || new Date().toISOString().split('T')[0],
      startedAt: sessionState.startedAt || startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      duration
    };

    // Transform each phase
    for (const phaseName of phases) {
      const phaseVariations = session.phases && session.phases[phaseName] 
        ? session.phases[phaseName] 
        : [];

      // Convert variations array into blocks
      // Each variation becomes a block (or variations can be grouped into supersets)
      const blocks = phaseVariations.map(variation => {
        // Extract sets for this variation from completedSets
        const sets = extractSetsForVariation(
          variation,
          sessionState.completedSets || [],
          sessionState.setData || {} // Optional: additional set performance data
        );

        // Create PerformedVariation object
        return {
          variationId: variation.variationId || variation.id,
          exerciseId: variation.exerciseId,
          sets
        };
      });

      // Calculate phase duration (can be tracked separately or estimated)
      const phaseDuration = calculatePhaseDuration(phaseVariations, blocks);

      // Ensure phase structure follows Phase interface
      // Store workout phase as 'workoutPhase' to avoid conflict with workout label
      if (phaseName === 'workout') {
        sessionData.workoutPhase = {
          blocks: blocks.length > 0 ? blocks : [],
          duration: phaseDuration
        };
      } else {
        sessionData[phaseName] = {
          blocks: blocks.length > 0 ? blocks : [],
          duration: phaseDuration
        };
      }
    }

    // Ensure all 3 phases exist (even if skipped)
    // If a phase was skipped, save it as empty but present
    if (!sessionData.warmup) {
      sessionData.warmup = { blocks: [], duration: 0 };
    }
    if (!sessionData.workoutPhase) {
      sessionData.workoutPhase = { blocks: [], duration: 0 };
    }
    if (!sessionData.cooldown) {
      sessionData.cooldown = { blocks: [], duration: 0 };
    }

    // Save the completed session
    const sessionId = await saveCompletedSession(userId, sessionData);
    
    console.log(`✓ Session saved with ID: ${sessionId}`);
    return sessionId;
  } catch (error) {
    console.error('Error finishing workout:', error);
    throw error;
  }
}

/**
 * Extract sets for a variation from completedSets
 * Creates SetPerformance objects from the tracked completed sets
 * 
 * @param {Object} variation - Variation object
 * @param {Array} completedSets - Array of completed set keys
 * @param {Object} setData - Optional set performance data (reps, weight, etc.)
 * @returns {Array<Object>} Array of SetPerformance objects
 */
function extractSetsForVariation(variation, completedSets, setData = {}) {
  const sets = [];
  const variationId = variation.variationId || variation.id;
  const exerciseId = variation.exerciseId;

  if (!variationId || !exerciseId) {
    return sets;
  }

  // Find all sets for this variation from completedSets
  // Format: `${exerciseId}-${variationId}-set-${setNumber}`
  const setPattern = `${exerciseId}-${variationId}-set-`;
  const variationSets = completedSets.filter(setKey => 
    typeof setKey === 'string' && setKey.startsWith(setPattern)
  );

  // Extract set numbers and create SetPerformance objects
  const setNumbers = new Set();
  variationSets.forEach(setKey => {
    const match = setKey.match(/set-(\d+)/);
    if (match) {
      setNumbers.add(parseInt(match[1], 10));
    }
  });

  // Create SetPerformance objects in order
  Array.from(setNumbers).sort((a, b) => a - b).forEach(setNumber => {
    const setKey = `${exerciseId}-${variationId}-set-${setNumber}`;
    const performanceData = setData[setKey] || {};

    sets.push({
      setNumber,
      reps: performanceData.reps || variation.reps || undefined,
      weight: performanceData.weight || variation.weight || undefined,
      duration: performanceData.duration || undefined,
      completed: true,
      notes: performanceData.notes || undefined
    });
  });

  // If no sets found but variation was in session, assume it was completed
  // (for cases where tracking wasn't fully implemented yet)
  if (sets.length === 0 && variation) {
    // Create a default set indicating the variation was performed
    sets.push({
      setNumber: 1,
      reps: variation.reps || undefined,
      weight: variation.weight || undefined,
      completed: true
    });
  }

  return sets;
}

/**
 * Calculate phase duration
 * Can be enhanced to track actual phase durations
 * 
 * @param {Array} phaseVariations - Variations in the phase
 * @param {Array} blocks - Blocks with sets
 * @returns {number} Duration in seconds
 */
function calculatePhaseDuration(phaseVariations, blocks) {
  // Simple estimation: assume 2 minutes per variation
  // This can be enhanced with actual tracking
  const estimatedSecondsPerVariation = 120;
  
  if (blocks.length > 0) {
    // More accurate: count total sets and estimate time per set
    const totalSets = blocks.reduce((sum, block) => {
      return sum + (block.sets ? block.sets.length : 0);
    }, 0);
    
    const estimatedSecondsPerSet = 60; // 1 minute per set
    return totalSets > 0 ? totalSets * estimatedSecondsPerSet : phaseVariations.length * estimatedSecondsPerVariation;
  }
  
  return 0; // Phase was skipped
}

/**
 * Hook into existing SessionView endSession to save session
 * This can be called from the existing endSession method
 * 
 * @param {Object} sessionViewInstance - Instance of SessionView
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function saveSessionOnComplete(sessionViewInstance, userId) {
  try {
    // Extract session state
    const sessionState = {
      startedAt: sessionViewInstance.startedAt,
      completedSets: sessionViewInstance.completedSets || [],
      setData: sessionViewInstance.setData || {} // Optional: track set performance data
    };

    // Save the session
    await handleFinishWorkout(sessionState, sessionViewInstance.session, userId);
  } catch (error) {
    console.error('Error saving session on complete:', error);
    // Don't throw - allow session to complete even if save fails
  }
}

