/**
 * Session View UI Binding
 * 
 * Handles session completion and constructs sessionData for saving.
 * This module integrates with the existing session-view to save completed sessions.
 */

import { saveCompletedSession } from '../../js/services/dbService.js';

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
        // Ensure all fields are defined (no undefined values)
        const block = {
          variationId: variation.variationId || variation.id || null,
          exerciseId: variation.exerciseId || null,
          sets: sets || []
        };
        
        // Remove any undefined fields
        if (!block.variationId || !block.exerciseId) {
          console.warn('[handleFinishWorkout] Missing variationId or exerciseId for variation:', variation);
        }
        
        return block;
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

    // Build set object, only including defined values (Firestore doesn't accept undefined)
    const setObj = {
      setNumber,
      completed: true
    };
    
    // Only add fields if they have actual values (not undefined)
    if (performanceData.reps !== undefined && performanceData.reps !== null) {
      setObj.reps = performanceData.reps;
    } else if (variation.reps !== undefined && variation.reps !== null) {
      setObj.reps = variation.reps;
    }
    
    if (performanceData.weight !== undefined && performanceData.weight !== null) {
      setObj.weight = performanceData.weight;
    } else if (variation.weight !== undefined && variation.weight !== null) {
      setObj.weight = variation.weight;
    }
    
    if (performanceData.duration !== undefined && performanceData.duration !== null) {
      setObj.duration = performanceData.duration;
    }
    
    if (performanceData.notes !== undefined && performanceData.notes !== null && performanceData.notes !== '') {
      setObj.notes = performanceData.notes;
    }
    
    sets.push(setObj);
  });

  // If no sets found but variation was in session, assume it was completed
  // (for cases where tracking wasn't fully implemented yet)
  if (sets.length === 0 && variation) {
    // Create a default set indicating the variation was performed
    const defaultSet = {
      setNumber: 1,
      completed: true
    };
    
    // Only add reps/weight if they exist (not undefined)
    if (variation.reps !== undefined && variation.reps !== null) {
      defaultSet.reps = variation.reps;
    }
    if (variation.weight !== undefined && variation.weight !== null) {
      defaultSet.weight = variation.weight;
    }
    
    sets.push(defaultSet);
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
      setData: sessionViewInstance.setData || {} // Track set performance data (weight/reps/time)
    };

    // Capture completion timestamp and rough duration for downstream analytics
    const completedAt = new Date();
    const startedAtDate = sessionState.startedAt
      ? new Date(sessionState.startedAt)
      : completedAt;
    const durationSeconds = Math.max(
      0,
      Math.floor((completedAt.getTime() - startedAtDate.getTime()) / 1000)
    );

    sessionState.completedAt = completedAt.toISOString();
    sessionState.duration = durationSeconds;

    // Get session date for streak calculation
    const sessionDate = sessionViewInstance.session.date || new Date().toISOString().split('T')[0];

    // Save the session
    let sessionId = null;
    try {
      sessionId = await handleFinishWorkout(sessionState, sessionViewInstance.session, userId);
      console.log('[SessionView] ✓ Session saved with ID:', sessionId);
    } catch (sessionError) {
      console.error('[SessionView] Error saving session:', sessionError);
      // Even if session save fails, try to update streak and continue
      // The user completed the session, so we should still track it
    }
    
    // Update streak after saving session (or even if save failed)
    // This ensures the streak is updated regardless of session save status
    try {
      const { updateStreakOnSessionComplete } = await import('../../js/services/dbService.js');
      const streakInfo = await updateStreakOnSessionComplete(userId, sessionDate);
      console.log('[SessionView] ✓ Streak updated:', streakInfo);
      
      // Clear profile cache immediately after updating streak to ensure fresh data
      const cacheKey = `firestore_cache_profile_${userId}`;
      localStorage.removeItem(cacheKey);
      localStorage.removeItem('userProfile');
      console.log('[SessionView] ✓ Profile cache cleared after streak update');
    } catch (streakError) {
      console.error('[SessionView] Error updating streak:', streakError);
      console.error('[SessionView] Streak error stack:', streakError.stack);
      // Non-critical: do not block session completion if streak update fails
    }
    
    // Save exercise history for each completed exercise (only if session was saved)
    if (sessionId) {
      try {
        await saveExerciseHistory(sessionState, sessionViewInstance.session, userId, sessionId);
      } catch (historyError) {
        console.error('[SessionView] Error saving exercise history:', historyError);
        // Non-critical: continue even if history save fails
      }
    } else {
      console.warn('[SessionView] Skipping exercise history save - no sessionId');
    }

    // Build and persist a performance report for this session (only if session was saved)
    if (sessionId) {
      try {
        const { buildSessionReportData } = await import('../../js/core/workout-metrics.js');
        const { saveSessionReport } = await import('../../js/services/dbService.js');

        console.log('[SessionView] Building session report data...');
        const reportData = await buildSessionReportData({
          session: sessionViewInstance.session,
          sessionState,
          userId,
          sessionId
        });

        if (reportData) {
          console.log('[SessionView] Report data built successfully:', {
            sessionId: reportData.sessionId,
            sessionDate: reportData.sessionDate,
            exercisesCount: reportData.exercises?.length || 0
          });
          
          const reportId = await saveSessionReport(userId, reportData);
          console.log('[SessionView] ✓ Session performance report saved with ID:', reportId);
          
          // Clear reports cache to force refresh when user visits My Training
          const reportsCacheKey = `firestore_cache_session_reports_${userId}`;
          localStorage.removeItem(reportsCacheKey);
          console.log('[SessionView] ✓ Reports cache cleared');
        } else {
          console.warn('[SessionView] Report data was empty, skipping saveSessionReport');
        }
      } catch (reportError) {
        console.error('[SessionView] Error building or saving session report:', reportError);
        console.error('[SessionView] Report error stack:', reportError.stack);
        // Non-critical: do not block session completion if reports fail
      }
    } else {
      console.warn('[SessionView] Skipping report generation - no sessionId');
    }

  } catch (error) {
    console.error('Error saving session on complete:', error);
    // Don't throw - allow session to complete even if save fails
  }
}

/**
 * Save exercise history for all exercises in completed session
 * @param {Object} sessionState - Session state with setData
 * @param {Object} session - Original session object
 * @param {string} userId - User ID
 * @param {string} sessionId - Completed session ID
 */
async function saveExerciseHistory(sessionState, session, userId, sessionId) {
  try {
    const { saveExercisePerformance } = await import('../../js/services/exerciseHistoryService.js');
    
    // Process each phase
    const phases = ['warmup', 'workout', 'cooldown'];
    
    for (const phaseName of phases) {
      const phaseVariations = session.phases && session.phases[phaseName] 
        ? session.phases[phaseName] 
        : [];

      for (const variation of phaseVariations) {
        const exerciseId = variation.exerciseId;
        const variationId = variation.variationId || variation.id;
        
        if (!exerciseId || !variationId) continue;

        // Extract sets for this variation
        const setPattern = `${exerciseId}-${variationId}-set-`;
        const variationSets = Object.entries(sessionState.setData || {})
          .filter(([key]) => key.startsWith(setPattern))
          .map(([key, data]) => {
            const match = key.match(/set-(\d+)/);
            return {
              setNumber: match ? parseInt(match[1], 10) : 1,
              weight: data.weight,
              reps: data.reps,
              time: data.time,
              notes: data.notes
            };
          })
          .sort((a, b) => a.setNumber - b.setNumber);

        if (variationSets.length > 0) {
          try {
            await saveExercisePerformance(userId, exerciseId, variationId, sessionId, variationSets);
          } catch (error) {
            console.warn(`Failed to save history for ${exerciseId}/${variationId}:`, error);
            // Continue with other exercises even if one fails
          }
        }
      }
    }
  } catch (error) {
    console.error('Error saving exercise history:', error);
    // Don't throw - history saving is non-critical
  }
}

