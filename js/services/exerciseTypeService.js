/**
 * Exercise Type Service
 * 
 * Service layer for determining exercise types and managing exercise input requirements.
 * Handles logic for weight-based, time-based, reps-only, and combined exercises.
 */

/**
 * Exercise type definitions
 */
export const EXERCISE_TYPES = {
  WEIGHT: 'weight',        // Weight-based (with reps)
  TIME: 'time',            // Time-based (isometric, holds)
  BOTH: 'both',            // Both weight and time (e.g., weighted isometric)
  REPS_ONLY: 'reps-only'   // Reps only, no weight (bodyweight)
};

/**
 * Determine exercise type based on exercise and variation metadata
 * @param {Object} exercise - Exercise object
 * @param {Object} variation - Variation object
 * @returns {string} Exercise type ('weight' | 'time' | 'both' | 'reps-only')
 */
export function determineExerciseType(exercise, variation) {
  // If exerciseType is explicitly set in variation, use it
  if (variation?.exerciseType) {
    return variation.exerciseType;
  }

  // Check if variation has isIsometric flag
  if (variation?.isIsometric === true) {
    // Isometric exercises can be time-only or weighted (both)
    if (variation?.weight && variation.weight > 0) {
      return EXERCISE_TYPES.BOTH;
    }
    return EXERCISE_TYPES.TIME;
  }

  // Check progression_type for hints
  const progressionType = variation?.progression_type?.toLowerCase() || '';
  
  if (progressionType.includes('duration') || progressionType.includes('hold')) {
    // Duration-based progression suggests time-based exercise
    if (variation?.weight && variation.weight > 0) {
      return EXERCISE_TYPES.BOTH;
    }
    return EXERCISE_TYPES.TIME;
  }

  // Check if exercise has weight
  if (variation?.weight && variation.weight > 0) {
    return EXERCISE_TYPES.WEIGHT;
  }

  // Default to reps-only (bodyweight)
  return EXERCISE_TYPES.REPS_ONLY;
}

/**
 * Get required input fields for an exercise type
 * @param {string} exerciseType - Exercise type
 * @returns {Object} Object with boolean flags for required inputs
 */
export function getExerciseInputs(exerciseType) {
  switch (exerciseType) {
    case EXERCISE_TYPES.WEIGHT:
      return {
        weight: true,
        reps: true,
        time: false
      };
    case EXERCISE_TYPES.TIME:
      return {
        weight: false,
        reps: false,
        time: true
      };
    case EXERCISE_TYPES.BOTH:
      return {
        weight: true,
        reps: true,
        time: true
      };
    case EXERCISE_TYPES.REPS_ONLY:
      return {
        weight: false,
        reps: true,
        time: false
      };
    default:
      // Default to reps-only for unknown types
      return {
        weight: false,
        reps: true,
        time: false
      };
  }
}

/**
 * Validate exercise input data based on exercise type
 * @param {string} exerciseType - Exercise type
 * @param {Object} data - Input data to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateExerciseInput(exerciseType, data) {
  const errors = [];
  const inputs = getExerciseInputs(exerciseType);

  // Validate required fields
  if (inputs.weight && (data.weight === undefined || data.weight === null)) {
    errors.push('Weight is required for this exercise type');
  }

  if (inputs.reps && (data.reps === undefined || data.reps === null)) {
    errors.push('Reps are required for this exercise type');
  }

  if (inputs.time && (data.time === undefined || data.time === null)) {
    errors.push('Time is required for this exercise type');
  }

  // Validate value ranges
  if (data.weight !== undefined && data.weight !== null) {
    if (typeof data.weight !== 'number' || data.weight < 0) {
      errors.push('Weight must be a non-negative number');
    }
  }

  if (data.reps !== undefined && data.reps !== null) {
    if (typeof data.reps !== 'number' || data.reps < 0 || !Number.isInteger(data.reps)) {
      errors.push('Reps must be a non-negative integer');
    }
  }

  if (data.time !== undefined && data.time !== null) {
    if (typeof data.time !== 'number' || data.time < 0) {
      errors.push('Time must be a non-negative number (seconds)');
    }
  }

  // Special validation for isometric exercises
  if (exerciseType === EXERCISE_TYPES.TIME || exerciseType === EXERCISE_TYPES.BOTH) {
    if (data.reps !== undefined && data.reps !== null && data.reps > 0) {
      // Time-based exercises typically don't have reps
      // But we allow it for flexibility (e.g., "3 sets of 30 seconds")
      // So we don't error, just warn
      console.warn('Time-based exercise has reps specified. This may be intentional.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get default values for an exercise based on type and variation
 * @param {string} exerciseType - Exercise type
 * @param {Object} variation - Variation object
 * @param {Object} lastPerformance - Last performance data (optional)
 * @returns {Object} Default values { weight?, reps?, time? }
 */
export function getDefaultValues(exerciseType, variation, lastPerformance = null) {
  const defaults = {};

  // Prefer last performance if available
  if (lastPerformance) {
    if (lastPerformance.weight !== undefined) defaults.weight = lastPerformance.weight;
    if (lastPerformance.reps !== undefined) defaults.reps = lastPerformance.reps;
    if (lastPerformance.time !== undefined) defaults.time = lastPerformance.time;
  }

  // Fall back to variation defaults if not set
  if (variation?.defaultWeight !== undefined && defaults.weight === undefined) {
    defaults.weight = variation.defaultWeight;
  }
  if (variation?.defaultReps !== undefined && defaults.reps === undefined) {
    defaults.reps = variation.defaultReps;
  }
  if (variation?.defaultTime !== undefined && defaults.time === undefined) {
    defaults.time = variation.defaultTime;
  }

  // Fall back to variation.weight if available (legacy support)
  if (variation?.weight !== undefined && defaults.weight === undefined) {
    defaults.weight = variation.weight;
  }

  return defaults;
}

/**
 * Format exercise type for display
 * @param {string} exerciseType - Exercise type
 * @returns {string} Human-readable exercise type
 */
export function formatExerciseType(exerciseType) {
  const typeMap = {
    [EXERCISE_TYPES.WEIGHT]: 'Weight & Reps',
    [EXERCISE_TYPES.TIME]: 'Time',
    [EXERCISE_TYPES.BOTH]: 'Weight, Reps & Time',
    [EXERCISE_TYPES.REPS_ONLY]: 'Reps Only'
  };

  return typeMap[exerciseType] || 'Reps Only';
}

