/**
 * REGAIN WORKOUT ENGINE CORE LOGIC
 * 
 * This module provides utilities for:
 * - Loading exercises from Firestore
 * - Filtering exercises by discipline and phase
 * - Progressive overload and milestone tracking
 * - Finding alternative variations
 * - Calculating projected metrics
 * 
 * NOTE: Session and training system generation is now handled by LangGraph
 * via workoutGenerationService.js. This module only provides helper utilities.
 */
import { 
    OVERLOAD_PERIOD_SESSIONS, 
    PHASE_CRITERIA,
    DEFAULT_WEEKLY_CONFIG,
    TERMINOLOGY
} from './constants.js';
import { getAllExercises, getAllVariations } from '../../src/services/exerciseService.js';

/**
 * Load exercises from Firestore and transform to expected structure
 * @returns {Promise<Object>} Exercises data in format { exercises: [...] }
 */
export async function loadExercises() {
    try {
        console.log('[Workout Engine] Loading exercises from Firestore...');
        
        // Fetch exercises and variations from Firestore
        const [exercises, variations] = await Promise.all([
            getAllExercises(),
            getAllVariations()
        ]);
        
        console.log(`[Workout Engine] Loaded ${exercises.length} exercises and ${variations.length} variations from Firestore`);
        
        // Create a map of exerciseId -> exercise for quick lookup
        const exerciseMap = new Map();
        exercises.forEach(exercise => {
            exerciseMap.set(exercise.id, exercise);
        });
        
        // Group variations by exerciseId
        const variationsByExercise = new Map();
        variations.forEach(variation => {
            const exerciseId = variation.exerciseId;
            if (!exerciseId) {
                console.warn(`[Workout Engine] Variation ${variation.id} missing exerciseId, skipping`);
                return;
            }
            
            if (!variationsByExercise.has(exerciseId)) {
                variationsByExercise.set(exerciseId, []);
            }
            variationsByExercise.get(exerciseId).push(variation);
        });
        
        // Transform to expected structure
        const transformedExercises = exercises.map(exercise => {
            const exerciseVariations = variationsByExercise.get(exercise.id) || [];
            
            // Determine discipline from variations (use first discipline found)
            // Map Firestore discipline names to expected format
            const disciplineMap = {
                'pilates': 'Pilates',
                'animal-flow': 'Animal Flow',
                'animalflow': 'Animal Flow',
                'weights': 'Weights',
                'crossfit': 'Crossfit',
                'calisthenics': 'Calisthenics',
                'yoga': 'Yoga' // In case yoga is in the data
            };
            
            let discipline = null;
            if (exerciseVariations.length > 0) {
                const firstVariation = exerciseVariations[0];
                if (firstVariation.disciplines && firstVariation.disciplines.length > 0) {
                    const disciplineKey = firstVariation.disciplines[0].toLowerCase();
                    discipline = disciplineMap[disciplineKey] || 
                                disciplineKey.charAt(0).toUpperCase() + disciplineKey.slice(1);
                }
            }
            
            // Transform variations to expected format
            const transformedVariations = exerciseVariations.map(variation => {
                // Map bilaterality from boolean to string
                let bilaterality = 'bilateral';
                if (variation.metadata?.bilaterality !== undefined) {
                    bilaterality = variation.metadata.bilaterality ? 'bilateral' : 'unilateral';
                }
                
                // Map target muscles from exercise targetMuscleGroups
                // Split into primary (first 2-3) and secondary (rest)
                const targetMuscleGroups = exercise.targetMuscleGroups || [];
                const primaryMuscles = targetMuscleGroups.slice(0, Math.min(3, targetMuscleGroups.length));
                const secondaryMuscles = targetMuscleGroups.slice(3);
                
                // Infer progression_type from difficulty (simple heuristic)
                let progressionType = 'stability';
                const difficulty = variation.difficulty || 0;
                if (difficulty >= 7) {
                    progressionType = 'leverage';
                } else if (difficulty >= 5) {
                    progressionType = 'duration';
                } else if (difficulty >= 3) {
                    progressionType = 'form';
                }
                
                return {
                    id: variation.id,
                    name: variation.name,
                    weight: 0, // Default weight (can be enhanced later)
                    bilaterality: bilaterality,
                    difficulty_score: variation.difficulty || 0,
                    progression_type: progressionType,
                    target_muscles: {
                        primary: primaryMuscles.map(m => m.toLowerCase()),
                        secondary: secondaryMuscles.map(m => m.toLowerCase())
                    },
                    technique_cues: variation.instructions || []
                };
            }).sort((a, b) => a.difficulty_score - b.difficulty_score); // Sort by difficulty
            
            return {
                id: exercise.id,
                name: exercise.name,
                description: exercise.description || `${exercise.name} - A ${exercise.category || 'core'} exercise`,
                discipline: discipline || 'Pilates', // Default fallback
                frameworks: exercise.frameworks || [], // Preserve frameworks from exercise
                variations: transformedVariations
            };
        }).filter(exercise => exercise.variations.length > 0); // Only include exercises with variations
        
        console.log(`[Workout Engine] Transformed to ${transformedExercises.length} exercises with variations`);
        
        return {
            exercises: transformedExercises
        };
    } catch (error) {
        console.error('[Workout Engine] Error loading exercises from Firestore:', error);
        throw new Error(`Failed to load exercises: ${error.message}`);
    }
}

// ============================================================================
// CORE FILTERING FUNCTIONS (ER Diagram Implementation)
// ============================================================================

/**
 * Filter exercises by Discipline (N:N relationship)
 * @param {Array} exercises - Array of exercise objects
 * @param {Array|string} disciplines - Discipline(s) to filter by
 * @returns {Array} Filtered exercises
 */
export function filterExercisesByDiscipline(exercises, disciplines) {
    if (!exercises || !Array.isArray(exercises)) return [];
    if (!disciplines) return exercises;
    
    const disciplineArray = Array.isArray(disciplines) ? disciplines : [disciplines];
    // Normalize disciplines to lowercase for case-insensitive comparison
    const normalizedDisciplines = disciplineArray.map(d => d.toLowerCase().trim());
    
    return exercises.filter(exercise => {
        if (!exercise.discipline) return false;
        const exerciseDiscipline = exercise.discipline.toLowerCase().trim();
        return normalizedDisciplines.includes(exerciseDiscipline);
    });
}

/**
 * Get variations for an exercise (1:N relationship)
 * @param {Object} exercise - Exercise object
 * @returns {Array} Sorted variations by difficulty_score
 */
export function getVariationsForExercise(exercise) {
    if (!exercise || !exercise.variations) return [];
    return [...exercise.variations].sort((a, b) => 
        (a.difficulty_score || 0) - (b.difficulty_score || 0)
    );
}

/**
 * Filter exercises by phase type (warmup/workout/cooldown)
 * @param {Array} exercises - Array of exercise objects
 * @param {string} phase - Phase type ('warmup', 'workout', 'cooldown')
 * @returns {Array} Filtered exercises
 */
export function filterExercisesByPhase(exercises, phase) {
    if (!exercises || !Array.isArray(exercises)) return [];
    if (!phase) return exercises;
    
    const criteria = PHASE_CRITERIA[phase.toUpperCase()];
    if (!criteria) return exercises;
    
    return exercises.filter(exercise => {
        if (!exercise.variations || exercise.variations.length === 0) return false;
        
        // Check if any variation matches phase criteria
        return exercise.variations.some(variation => {
            const difficulty = variation.difficulty_score || 0;
            const progressionType = variation.progression_type || '';
            const bilaterality = variation.bilaterality || '';
            
            if (phase === 'warmup') {
                return difficulty <= criteria.maxDifficulty &&
                       (criteria.preferredProgressionTypes.includes(progressionType) ||
                        bilaterality === criteria.preferredBilaterality);
            } else if (phase === 'workout') {
                return difficulty >= criteria.minDifficulty && 
                       difficulty <= criteria.maxDifficulty;
            } else if (phase === 'cooldown') {
                return difficulty <= criteria.maxDifficulty &&
                       criteria.preferredProgressionTypes.includes(progressionType);
            }
            return false;
        });
    });
}

// ============================================================================
// PROGRESSIVE OVERLOAD & MILESTONE TRACKING
// ============================================================================

/**
 * Get current variation for an exercise based on milestones
 * @param {string} exerciseId - Exercise ID
 * @param {Object} currentMilestones - Milestone tracking object
 * @param {Object} exercise - Exercise object with variations
 * @returns {Object|null} Current variation or null
 */
export function getCurrentVariation(exerciseId, currentMilestones, exercise) {
    if (!exercise || !exercise.variations || exercise.variations.length === 0) {
        return null;
    }
    
    const sortedVariations = getVariationsForExercise(exercise);
    const milestones = currentMilestones?.[exerciseId] || {};
    
    // Find the highest variation with milestone data
    let currentVariationId = null;
    let highestSessionCount = -1;
    
    for (const [variationId, sessionCount] of Object.entries(milestones)) {
        if (sessionCount > highestSessionCount && sessionCount < OVERLOAD_PERIOD_SESSIONS) {
            highestSessionCount = sessionCount;
            currentVariationId = variationId;
        }
    }
    
    // If no current variation found, start with lowest difficulty
    if (!currentVariationId) {
        return sortedVariations[0] || null;
    }
    
    // Find the variation object
    const variation = sortedVariations.find(v => v.id === currentVariationId);
    return variation || sortedVariations[0] || null;
}

/**
 * Check if milestone achieved (3 sessions completed)
 * @param {string} exerciseId - Exercise ID
 * @param {string} variationId - Variation ID
 * @param {Object} currentMilestones - Milestone tracking object
 * @returns {boolean} True if milestone achieved
 */
export function isMilestoneAchieved(exerciseId, variationId, currentMilestones) {
    const milestones = currentMilestones?.[exerciseId] || {};
    const sessionCount = milestones[variationId] || 0;
    return sessionCount >= OVERLOAD_PERIOD_SESSIONS;
}

/**
 * Get next variation in progression (higher difficulty_score)
 * @param {Object} exercise - Exercise object
 * @param {string} currentVariationId - Current variation ID
 * @returns {Object|null} Next variation or null if at max
 */
export function getNextVariation(exercise, currentVariationId) {
    if (!exercise || !exercise.variations) return null;
    
    const sortedVariations = getVariationsForExercise(exercise);
    const currentIndex = sortedVariations.findIndex(v => v.id === currentVariationId);
    
    if (currentIndex === -1 || currentIndex === sortedVariations.length - 1) {
        return null; // Already at highest variation
    }
    
    return sortedVariations[currentIndex + 1];
}

/**
 * Update milestone after session completion
 * @param {string} exerciseId - Exercise ID
 * @param {string} variationId - Variation ID
 * @param {Object} currentMilestones - Current milestone tracking object
 * @returns {Object} Updated milestones
 */
export function updateMilestone(exerciseId, variationId, currentMilestones) {
    const updated = { ...currentMilestones };
    
    if (!updated[exerciseId]) {
        updated[exerciseId] = {};
    }
    
    const currentCount = updated[exerciseId][variationId] || 0;
    updated[exerciseId][variationId] = Math.min(currentCount + 1, OVERLOAD_PERIOD_SESSIONS);
    
    return updated;
}

// ============================================================================
// SESSION GENERATION
// ============================================================================


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Select appropriate variation based on user state
 * @param {Object} exercise - Exercise object
 * @param {Object} currentMilestones - Current milestone tracking
 * @param {Object} userProfile - User profile data
 * @returns {Object|null} Selected variation
 */
export function selectVariationForUser(exercise, currentMilestones, userProfile) {
    if (!exercise) return null;
    
    const exerciseId = exercise.id;
    let currentVariation = getCurrentVariation(exerciseId, currentMilestones, exercise);
    
    // Check if milestone achieved and upgrade if possible
    if (currentVariation) {
        const milestoneData = currentMilestones[exerciseId] || {};
        const sessionCount = milestoneData[currentVariation.id] || 0;
        
        if (sessionCount >= OVERLOAD_PERIOD_SESSIONS) {
            const nextVariation = getNextVariation(exercise, currentVariation.id);
            if (nextVariation) {
                currentVariation = nextVariation;
            }
        }
    }
    
    return currentVariation;
}

/**
 * Ensure exercise variety (no exact repetition in consecutive sessions)
 * @param {Array} selectedExercises - Currently selected exercises
 * @param {Array} previousSessions - Previous session data
 * @returns {Array} Filtered exercises with variety
 */
export function ensureVariety(selectedExercises, previousSessions) {
    if (!previousSessions || previousSessions.length === 0) {
        return selectedExercises;
    }
    
    // Get exercise IDs from last session
    const lastSession = previousSessions[previousSessions.length - 1];
    const lastSessionExerciseIds = new Set();
    
    if (lastSession?.phases) {
        ['warmup', 'workout', 'cooldown'].forEach(phase => {
            if (lastSession.phases[phase]) {
                lastSession.phases[phase].forEach(item => {
                    if (item.exerciseId) lastSessionExerciseIds.add(item.exerciseId);
                });
            }
        });
    }
    
    // Filter out exercises that were in the last session
    return selectedExercises.filter(exercise => 
        !lastSessionExerciseIds.has(exercise.id)
    );
}


/**
 * Find alternative variations with similar target muscles but different biomechanics
 * @param {Object} currentVariation - Current variation object
 * @param {Array} allExercises - All available exercises
 * @param {string} phaseType - Phase type (warmup/workout/cooldown)
 * @returns {Promise<Array>} Array of alternative variation objects
 */
export async function findAlternativeVariation(currentVariation, allExercises, phaseType) {
    if (!currentVariation || !allExercises || allExercises.length === 0) {
        return [];
    }
    
    // Extract target muscles from current variation
    const currentMuscles = new Set([
        ...(currentVariation.target_muscles?.primary || []),
        ...(currentVariation.target_muscles?.secondary || [])
    ].map(m => m.toLowerCase()));
    
    if (currentMuscles.size === 0) {
        return [];
    }
    
    const alternatives = [];
    const currentExerciseId = currentVariation.exerciseId;
    const currentDifficulty = currentVariation.difficulty_score || 0;
    const currentBilaterality = currentVariation.bilaterality || 'bilateral';
    const currentProgressionType = currentVariation.progression_type || '';
    
    // Find exercises with overlapping muscles
    for (const exercise of allExercises) {
        // Skip current exercise
        if (exercise.id === currentExerciseId) continue;
        
        if (!exercise.variations || exercise.variations.length === 0) continue;
        
        // Check each variation
        for (const variation of exercise.variations) {
            const variationMuscles = new Set([
                ...(variation.target_muscles?.primary || []),
                ...(variation.target_muscles?.secondary || [])
            ].map(m => m.toLowerCase()));
            
            // Calculate muscle overlap
            const overlap = [...currentMuscles].filter(m => variationMuscles.has(m)).length;
            const totalMuscles = Math.max(currentMuscles.size, variationMuscles.size);
            const similarityScore = overlap / totalMuscles;
            
            // Must have at least 50% muscle overlap
            if (similarityScore < 0.5) continue;
            
            // Check phase appropriateness
            const difficulty = variation.difficulty_score || 0;
            const criteria = PHASE_CRITERIA[phaseType.toUpperCase()];
            if (criteria) {
                if (phaseType === 'warmup' && difficulty > criteria.maxDifficulty) continue;
                if (phaseType === 'workout' && (difficulty < criteria.minDifficulty || difficulty > criteria.maxDifficulty)) continue;
                if (phaseType === 'cooldown' && difficulty > criteria.maxDifficulty) continue;
            }
            
            // Calculate biomechanical difference score
            let biomechanicalDiff = 0;
            if (variation.bilaterality !== currentBilaterality) biomechanicalDiff += 2;
            if (variation.progression_type !== currentProgressionType) biomechanicalDiff += 1;
            if (Math.abs(variation.difficulty_score - currentDifficulty) > 0) biomechanicalDiff += 1;
            
            // Prefer variations with different biomechanics
            const totalScore = similarityScore * 10 + biomechanicalDiff;
            
            // Create variation object in session format
            const alternativeVariation = {
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                variationId: variation.id,
                variationName: variation.name,
                difficulty_score: variation.difficulty_score,
                weight: variation.weight,
                bilaterality: variation.bilaterality,
                progression_type: variation.progression_type,
                target_muscles: variation.target_muscles,
                technique_cues: variation.technique_cues,
                sets: null,
                reps: null,
                _swapScore: totalScore
            };
            
            alternatives.push(alternativeVariation);
        }
    }
    
    // Sort by score (higher is better) and return top 3
    alternatives.sort((a, b) => (b._swapScore || 0) - (a._swapScore || 0));
    
    // Remove score property before returning
    return alternatives.slice(0, 3).map(alt => {
        delete alt._swapScore;
        return alt;
    });
}



/**
 * Generate a weekly training system (AI-powered with fallback)
 * @param {Object} userProfile - User profile with milestones, goals, discomforts, equipment, baselineAssessment
 * @param {Object} config - Configuration (daysPerWeek, framework, startDate)
 * @param {Object} options - Options { useAI: boolean, forceAI: boolean }
 * @returns {Promise<Object>} Generated weekly training system
 */
export async function generateWeeklySystem(userProfile = {}, config = {}, options = {}) {
    const { useAI = true, forceAI = true } = options; // Default forceAI to true - this is an AI-driven app
    
    try {
        console.log('generateWeeklySystem called with:', { userProfile, config, options });
        
        // Merge with defaults
        const finalConfig = {
            ...DEFAULT_WEEKLY_CONFIG,
            ...config
        };
        
        const {
            daysPerWeek = finalConfig.daysPerWeek,
            framework = finalConfig.framework,
            startDate = finalConfig.startDate
        } = finalConfig;
        
        // ALWAYS use AI - this is an AI-driven app
        // Check if API key is available
        const hasApiKey = import.meta.env.VITE_OPENAI_API_KEY;
        
        if (!hasApiKey && forceAI) {
            throw new Error('OpenAI API key is required but not configured. Please set VITE_OPENAI_API_KEY in your environment variables.');
        }
        
        if (!hasApiKey) {
            throw new Error('OpenAI API key not found. This app requires AI-powered generation.');
        }
        
        // Use LangGraph-based generation via Cloud Functions
        console.log('[LangGraph] Starting LangGraph-powered generation...');
        
        // Import workout generation service
        const { generateWeeklySystem } = await import('../services/workoutGenerationService.js');
        
        // Use LangGraph workflow via Cloud Functions
        try {
            return await generateWeeklySystem(userProfile, { daysPerWeek, framework, startDate });
        } catch (error) {
            console.error('[LangGraph] Generation failed:', error);
            // Throw error - LangGraph is required
            throw new Error(`Workout generation failed: ${error.message}. This app requires LangGraph-powered generation.`);
        }
        
    } catch (error) {
        console.error('Error in generateWeeklySystem:', error);
        throw error;
    }
}

/**
 * Calculate projected metrics from a planned session
 * Iterates through all phases and their variations to sum up mobility, rotation, and flexibility scores
 * 
 * @param {Object} session - Planned session object with phases.warmup, phases.workout, phases.cooldown arrays
 * @returns {Promise<Object>} Projected metrics { mobility: number, rotation: number, flexibility: number }
 */
export async function calculateProjectedMetrics(session) {
    try {
        if (!session || !session.phases) {
            return { mobility: 0, rotation: 0, flexibility: 0 };
        }

        const metricsTotals = { mobility: 0, rotation: 0, flexibility: 0 };
        let variationCount = 0;

        // Iterate through all 3 phases
        const phases = ['warmup', 'workout', 'cooldown'];
        
        for (const phaseName of phases) {
            const phaseVariations = session.phases[phaseName] || [];
            
            if (!Array.isArray(phaseVariations) || phaseVariations.length === 0) {
                continue;
            }

            // Iterate through variations in the phase
            for (const variation of phaseVariations) {
                if (!variation || !variation.variationId) {
                    continue;
                }

                // Fetch variation master data to get metrics
                const { getExerciseById } = await import('../../src/services/exerciseService.js');
                const variationMaster = await getExerciseById(variation.variationId);
                
                if (variationMaster && variationMaster.metrics) {
                    const metrics = variationMaster.metrics;
                    metricsTotals.mobility += metrics.mobility || 0;
                    metricsTotals.rotation += metrics.rotation || 0;
                    metricsTotals.flexibility += metrics.flexibility || 0;
                    variationCount++;
                }
            }
        }

        // Calculate averages (avoid division by zero)
        if (variationCount === 0) {
            return { mobility: 0, rotation: 0, flexibility: 0 };
        }

        return {
            mobility: Math.round(metricsTotals.mobility / variationCount),
            rotation: Math.round(metricsTotals.rotation / variationCount),
            flexibility: Math.round(metricsTotals.flexibility / variationCount)
        };
    } catch (error) {
        console.error('Error calculating projected metrics:', error);
        // Return zeros on error to prevent UI breakage
        return { mobility: 0, rotation: 0, flexibility: 0 };
    }
}

