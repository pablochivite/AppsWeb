/**
 * Workout Metrics & Performance Report Utilities
 *
 * Builds rich per-session report data from:
 * - Current session structure (phases/variations)
 * - Captured set performance (weight, reps, time)
 * - Historical exercise data from exerciseHistoryService
 */

import { getExerciseHistory } from '../services/exerciseHistoryService.js';

/**
 * Safely parse a date string or Date into a Date instance.
 * Falls back to now() if parsing fails.
 * @param {string|Date|undefined|null} value
 * @returns {Date}
 */
function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Compute volume for a single set (weight * reps).
 * @param {Object} set
 * @returns {number}
 */
function computeSetVolume(set) {
  const weight = typeof set.weight === 'number' ? set.weight : 0;
  const reps = typeof set.reps === 'number' ? set.reps : 0;
  if (!weight || !reps) return 0;
  return weight * reps;
}

/**
 * Aggregate volume, reps, sets and max weight for an array of sets.
 * @param {Array<Object>} sets
 */
function aggregateSets(sets) {
  let totalVolume = 0;
  let totalReps = 0;
  let maxWeight = 0;

  if (!Array.isArray(sets)) {
    return { totalVolume, totalReps, maxWeight, numSets: 0 };
  }

  for (const set of sets) {
    const vol = computeSetVolume(set);
    totalVolume += vol;

    if (typeof set.reps === 'number') {
      totalReps += set.reps;
    }

    if (typeof set.weight === 'number' && set.weight > maxWeight) {
      maxWeight = set.weight;
    }
  }

  return {
    totalVolume,
    totalReps,
    maxWeight,
    numSets: sets.length
  };
}

/**
 * Build current-session set list for a given exercise/variation
 * using the journal's sessionState.setData shape.
 *
 * Keys are `${exerciseId}-${variationId}-set-${n}`.
 */
function extractCurrentSetsForVariation(exerciseId, variationId, setData) {
  if (!exerciseId || !variationId || !setData) return [];

  const pattern = `${exerciseId}-${variationId}-set-`;
  const sets = [];

  Object.entries(setData).forEach(([key, data]) => {
    if (typeof key !== 'string' || !key.startsWith(pattern)) return;
    const match = key.match(/set-(\d+)/);
    const setNumber = match ? parseInt(match[1], 10) : 1;

    sets.push({
      setNumber,
      weight: typeof data.weight === 'number' ? data.weight : undefined,
      reps: typeof data.reps === 'number' ? data.reps : undefined,
      time: typeof data.time === 'number' ? data.time : undefined,
      notes: data.notes
    });
  });

  // Sort by setNumber for consistent ordering
  sets.sort((a, b) => a.setNumber - b.setNumber);
  return sets;
}

/**
 * Build per-exercise report entry combining:
 * - Current session performance (sets, volume, max weight)
 * - Historical sessions from exerciseHistory
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.sessionId
 * @param {Object} params.variation
 * @param {Object} params.sessionState
 */
async function buildExerciseReportEntry({ userId, sessionId, variation, sessionState }) {
  const exerciseId = variation.exerciseId;
  const variationId = variation.variationId || variation.id;

  if (!exerciseId || !variationId) {
    return null;
  }

  const exerciseName =
    variation.exerciseName ||
    variation.variationName ||
    variation.name ||
    'Exercise';

  // Current session sets (from journal state)
  const currentSets = extractCurrentSetsForVariation(
    exerciseId,
    variationId,
    sessionState.setData || {}
  );

  const currentAgg = aggregateSets(currentSets);

  let history = [];
  let comparison = {
    metric: 'volume',
    currentVolume: currentAgg.totalVolume,
    previousVolume: null,
    deltaAbsolute: null,
    deltaPercent: null,
    currentMaxWeight: currentAgg.maxWeight,
    previousMaxWeight: null,
    maxWeightDelta: null,
    maxWeightDeltaPercent: null,
    improvement: null,
    isPR: false
  };

  if (userId) {
    try {
      const historyDoc = await getExerciseHistory(userId, exerciseId, variationId);

      if (historyDoc && Array.isArray(historyDoc.sessions)) {
        // Exclude the just-completed session from the "past" baseline
        const pastSessions = historyDoc.sessions
          .filter((s) => !sessionId || s.sessionId !== sessionId)
          .slice(); // shallow copy

        // Sort by date ascending
        pastSessions.sort((a, b) => {
          const da = toDate(a.date).getTime();
          const db = toDate(b.date).getTime();
          return da - db;
        });

        // Build micro history (last 5 sessions)
        const lastFive = pastSessions.slice(-5);
        history = lastFive.map((session) => {
          const sets = Array.isArray(session.sets) ? session.sets : [];
          const agg = aggregateSets(sets);
          return {
            date: session.date || null,
            volume: agg.totalVolume,
            maxWeight: agg.maxWeight
          };
        });

        // Comparison vs last past session (if any)
        const lastPast = pastSessions[pastSessions.length - 1];
        if (lastPast) {
          const lastAgg = aggregateSets(Array.isArray(lastPast.sets) ? lastPast.sets : []);

          const prevVol = lastAgg.totalVolume;
          const prevMax = lastAgg.maxWeight;
          const curVol = currentAgg.totalVolume;
          const curMax = currentAgg.maxWeight;

          const volumeDelta = curVol - prevVol;
          const volumeDeltaPct =
            prevVol > 0 ? Math.round((volumeDelta / prevVol) * 100) : null;

          const maxDelta = curMax - prevMax;
          const maxDeltaPct =
            prevMax > 0 ? Math.round((maxDelta / prevMax) * 100) : null;

          comparison = {
            metric: 'volume',
            currentVolume: curVol,
            previousVolume: prevVol,
            deltaAbsolute: volumeDelta,
            deltaPercent: volumeDeltaPct,
            currentMaxWeight: curMax,
            previousMaxWeight: prevMax,
            maxWeightDelta: maxDelta,
            maxWeightDeltaPercent: maxDeltaPct,
            improvement: volumeDelta > 0 || maxDelta > 0,
            isPR:
              !!historyDoc.personalBest &&
              typeof historyDoc.personalBest.weight === 'number' &&
              curMax > historyDoc.personalBest.weight
          };
        } else {
          // No past sessions -> possible first time doing this variation
          comparison = {
            ...comparison,
            improvement: null,
            isPR: false
          };
        }
      }
    } catch (error) {
      console.warn(
        '[WorkoutMetrics] Failed to load exercise history for report:',
        exerciseId,
        variationId,
        error
      );
    }
  }

  // Build return object, ensuring no undefined fields
  const entry = {
    exerciseId,
    variationId,
    name: exerciseName,
    current: {
      sets: currentSets,
      totalVolume: currentAgg.totalVolume,
      totalReps: currentAgg.totalReps,
      maxWeight: currentAgg.maxWeight,
      numSets: currentAgg.numSets
    },
    history,
    comparison: {}
  };
  
  // Only include phase if it exists
  if (variation.phase) {
    entry.phase = variation.phase;
  }
  
  // Clean comparison object - only include defined values
  Object.keys(comparison).forEach(key => {
    if (comparison[key] !== undefined) {
      entry.comparison[key] = comparison[key];
    }
  });
  
  return entry;
}

/**
 * Build full `reportData` object for a completed session.
 *
 * @param {Object} params
 * @param {Object} params.session - Original session object
 * @param {Object} params.sessionState - { startedAt, completedSets, setData, duration? }
 * @param {string} params.userId - User ID
 * @param {string} params.sessionId - Saved session ID (from completedSessions)
 * @returns {Promise<Object|null>}
 */
export async function buildSessionReportData({
  session,
  sessionState,
  userId,
  sessionId
}) {
  if (!session || !session.phases) {
    console.warn('[WorkoutMetrics] Missing session/phases, skipping reportData build');
    return null;
  }

  const phases = ['warmup', 'workout', 'cooldown'];
  const sessionDate =
    session.date || new Date().toISOString().split('T')[0];

  const startedAt = toDate(sessionState.startedAt);
  const completedAt = toDate(sessionState.completedAt || new Date());
  const durationSeconds =
    typeof sessionState.duration === 'number' && sessionState.duration >= 0
      ? sessionState.duration
      : Math.max(0, Math.floor((completedAt - startedAt) / 1000));

  const exerciseEntries = [];

  // Build per-exercise entries for all variations in the session
  for (const phaseName of phases) {
    const phaseVariations =
      (session.phases && session.phases[phaseName]) || [];

    for (const variation of phaseVariations) {
      const entry = await buildExerciseReportEntry({
        userId,
        sessionId,
        variation,
        sessionState
      });
      if (entry) {
        exerciseEntries.push(entry);
      }
    }
  }

  // Aggregate macro stats across all exercises
  let totalVolume = 0;
  let totalReps = 0;
  let numSets = 0;
  let numExercises = exerciseEntries.length;
  let previousTotalVolume = 0;

  for (const entry of exerciseEntries) {
    const cur = entry.current;
    totalVolume += cur.totalVolume;
    totalReps += cur.totalReps;
    numSets += cur.numSets;

    const comp = entry.comparison;
    if (comp && typeof comp.previousVolume === 'number') {
      previousTotalVolume += comp.previousVolume;
    }
  }

  const volumeDelta = totalVolume - previousTotalVolume;
  const volumeDeltaPercent =
    previousTotalVolume > 0
      ? Math.round((volumeDelta / previousTotalVolume) * 100)
      : null;

  // Build macroStats ensuring no undefined values
  const macroStats = {
    sessionDate,
    durationSeconds,
    totalVolume,
    totalReps,
    numSets,
    numExercises,
    previousTotalVolume,
    volumeDelta
  };
  
  // Only include volumeDeltaPercent if it's not null
  if (volumeDeltaPercent !== null) {
    macroStats.volumeDeltaPercent = volumeDeltaPercent;
  }

  // Build return object ensuring no undefined values
  const reportData = {
    sessionDate,
    macroStats,
    exercises: exerciseEntries
  };
  
  // Only include sessionId if it exists
  if (sessionId) {
    reportData.sessionId = sessionId;
  }

  return reportData;
}


