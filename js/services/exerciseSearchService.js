// Exercise Search Service
// Lightweight search utilities for Edit Session drawer

import { loadExercises, filterExercisesByPhase } from '../core/workout-engine.js';
import { getExerciseSuggestions } from './exerciseSuggestionService.js';

let cachedExercises = null;

async function ensureExercisesLoaded() {
  if (cachedExercises) return cachedExercises;
  const data = await loadExercises();
  cachedExercises = Array.isArray(data.exercises) ? data.exercises : [];
  return cachedExercises;
}

/**
 * Search exercises and variations by text and optional phase
 * @param {string} query
 * @param {{ phase?: 'warmup' | 'workout' | 'cooldown' }} options
 * @returns {Promise<Array<{ exercise, variation }>>}
 */
export async function searchExercises(query, options = {}) {
  const { phase } = options;
  const exercises = await ensureExercisesLoaded();
  let source = exercises;

  if (phase) {
    source = filterExercisesByPhase(exercises, phase);
  }

  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  const results = [];

  source.forEach(exercise => {
    if (!exercise.variations || exercise.variations.length === 0) return;

    exercise.variations.forEach(variation => {
      const haystack = `${exercise.name} ${variation.name}`.toLowerCase();
      if (haystack.includes(normalizedQuery)) {
        results.push({ exercise, variation });
      }
    });
  });

  // Return top 20 matches
  return results.slice(0, 20);
}

/**
 * Get AI-powered exercise suggestions for a phase
 * Falls back to simple search-like behavior if AI is unavailable
 * @param {'warmup' | 'workout' | 'cooldown'} phase
 * @param {Object} context
 * @returns {Promise<Array<{ exercise, variation, reason?: string }>>}
 */
export async function getAISuggestions(phase, context = {}) {
  try {
    const suggestions = await getExerciseSuggestions(phase, context);
    if (Array.isArray(suggestions) && suggestions.length > 0) {
      return suggestions;
    }
  } catch (error) {
    console.warn('[ExerciseSearchService] AI suggestions failed, falling back to rule-based:', error);
  }

  // Fallback: just return some appropriate exercises for the phase
  const exercises = await ensureExercisesLoaded();
  const phaseExercises = filterExercisesByPhase(exercises, phase);
  const results = [];

  phaseExercises.slice(0, 10).forEach(exercise => {
    if (!exercise.variations || exercise.variations.length === 0) return;
    const variation = exercise.variations[0];
    results.push({
      exercise,
      variation,
      reason: 'Rule-based suggestion for this phase.'
    });
  });

  return results;
}


