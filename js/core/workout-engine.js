/**
 * REGAIN WORKOUT ENGINE CORE LOGIC
 * * 1. INPUT: userProfile { currentMilestones, goals, discomforts, equipment }
 * 2. SELECTION: 
 * - Filter Exercises by Discipline (Pilates/Animal Flow/Weights/Crossfit/Calisthenics).
 * - Group by Framework (e.g., Pull/Push/Legs).
 * 3. PROGRESSION CHECK:
 * - If session_count for current_variation < 3: Repeat Variation.
 * - If session_count == 3: Close Overload Period -> Upgrade to next Variation (Higher Difficulty Score).
 * 4. ASSEMBLY: Phase quantity and type may vary depending on the discipline, workout and user's goals.
 * - Phase 1: Warm-up + Mobility.
 * - Phase 2: Core + Strength Framework (Variations/Supersets).
 * - Phase 3: Cool-down (Linked to primary muscles worked in Phase 2).
 * 5. OUTPUT: Structured JSON for the Session View.
 */
// Workout Engine - Session generation logic from exercises.json
import { 
    OVERLOAD_PERIOD_SESSIONS, 
    FRAMEWORK_MUSCLE_MAPPINGS,
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
                variations: transformedVariations
            };
        }).filter(exercise => exercise.variations.length > 0); // Only include exercises with variations
        
        console.log(`[Workout Engine] Transformed to ${transformedExercises.length} exercises with variations`);
        
        return {
            exercises: transformedExercises
        };
    } catch (error) {
        console.error('[Workout Engine] Error loading exercises from Firestore:', error);
        
        // Fallback to local JSON if Firestore fails
        console.log('[Workout Engine] Attempting fallback to local JSON...');
        try {
            const paths = [
                './js/data/exercises.json',
                'js/data/exercises.json',
                '/js/data/exercises.json'
            ];
            
            for (const path of paths) {
                try {
                    const response = await fetch(path);
                    if (response.ok) {
                        const data = await response.json();
                        console.log(`[Workout Engine] Fallback: Loaded ${data.exercises?.length || 0} exercises from ${path}`);
                        return data;
                    }
                } catch (e) {
                    continue;
                }
            }
        } catch (fallbackError) {
            console.error('[Workout Engine] Fallback also failed:', fallbackError);
        }
        
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
 * Check if exercise matches a framework based on target_muscles
 * @param {Object} exercise - Exercise object
 * @param {string} framework - Framework name (e.g., 'Push', 'Pull', 'Legs')
 * @returns {boolean} True if exercise matches framework
 */
function exerciseMatchesFramework(exercise, framework) {
    const mapping = FRAMEWORK_MUSCLE_MAPPINGS[framework];
    if (!mapping) return false;
    
    // Check all variations of the exercise
    if (!exercise.variations || exercise.variations.length === 0) return false;
    
    return exercise.variations.some(variation => {
        const muscles = [
            ...(variation.target_muscles?.primary || []),
            ...(variation.target_muscles?.secondary || [])
        ].map(m => m.toLowerCase());
        
        const frameworkMuscles = [
            ...(mapping.primary || []),
            ...(mapping.secondary || [])
        ].map(m => m.toLowerCase());
        
        // Check if any muscle matches
        return muscles.some(muscle => frameworkMuscles.includes(muscle));
    });
}

/**
 * Filter exercises by Training Framework (via target_muscles)
 * @param {Array} exercises - Array of exercise objects
 * @param {string} framework - Framework name (e.g., 'Push/Pull', 'Upper/Lower')
 * @returns {Array} Filtered exercises
 */
export function filterExercisesByFramework(exercises, framework) {
    if (!exercises || !Array.isArray(exercises)) return [];
    if (!framework) return exercises;
    
    // Handle composite frameworks (e.g., 'Push/Pull')
    const frameworkParts = framework.split('/');
    
    return exercises.filter(exercise => {
        // Check if exercise matches any part of the framework
        return frameworkParts.some(part => exerciseMatchesFramework(exercise, part.trim()));
    });
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

/**
 * Filter exercises by equipment availability
 * @param {Array} exercises - Array of exercise objects
 * @param {Array} availableEquipment - List of available equipment
 * @returns {Array} Filtered exercises
 */
export function filterExercisesByEquipment(exercises, availableEquipment) {
    if (!exercises || !Array.isArray(exercises)) return [];
    if (!availableEquipment || availableEquipment.length === 0) return exercises;
    
    // For now, assume all exercises in JSON are bodyweight or use basic equipment
    // Future: Add equipment field to exercises.json
    return exercises;
}

/**
 * Filter exercises by discomforts (exclude exercises targeting problematic areas)
 * @param {Array} exercises - Array of exercise objects
 * @param {Array} discomforts - List of body areas with discomfort
 * @returns {Array} Filtered exercises
 */
export function filterExercisesByDiscomforts(exercises, discomforts) {
    if (!exercises || !Array.isArray(exercises)) return [];
    if (!discomforts || discomforts.length === 0) return exercises;
    
    const discomfortLower = discomforts.map(d => d.toLowerCase());
    
    return exercises.filter(exercise => {
        if (!exercise.variations) return true;
        
        // Check if any variation targets discomfort areas
        return !exercise.variations.some(variation => {
            const muscles = [
                ...(variation.target_muscles?.primary || []),
                ...(variation.target_muscles?.secondary || [])
            ].map(m => m.toLowerCase());
            
            // Exclude if primary muscles match discomfort areas
            return variation.target_muscles?.primary?.some(muscle => 
                discomfortLower.includes(muscle.toLowerCase())
            );
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

/**
 * Generate a session based on REGAIN principles
 * @param {string} discipline - Discipline type (Pilates, Animal Flow, Weights, etc.)
 * @param {string} workout - Workout type (Push, Pull, Legs, etc.)
 * @param {Object} userData - User preferences and history
 * @param {Array} previousSessions - Previous sessions to avoid repetition
 * @returns {Promise<Object>} Generated session
 */
export async function generateSession(discipline, workout, userData = {}, previousSessions = []) {
    try {
        const exercises = await loadExercises();
        const exerciseList = exercises.exercises || [];
        
        if (exerciseList.length === 0) {
            throw new Error('No exercises available');
        }
        
        // Filter by discipline
        let filteredExercises = filterExercisesByDiscipline(exerciseList, discipline);
        
        if (filteredExercises.length === 0) {
            console.warn(`No exercises found for discipline: ${discipline}, using all exercises`);
            filteredExercises = exerciseList; // Fallback to all exercises
        }
        
        // Filter by framework/workout
        if (workout) {
            const beforeFramework = filteredExercises.length;
            filteredExercises = filterExercisesByFramework(filteredExercises, workout);
            if (filteredExercises.length === 0) {
                console.warn(`No exercises found for framework: ${workout}, using discipline-filtered exercises`);
                filteredExercises = filterExercisesByDiscipline(exerciseList, discipline);
            }
        }
        
        // Filter by equipment and discomforts
        if (userData.equipment && userData.equipment.length > 0) {
            filteredExercises = filterExercisesByEquipment(filteredExercises, userData.equipment);
        }
        if (userData.discomforts && userData.discomforts.length > 0) {
            filteredExercises = filterExercisesByDiscomforts(filteredExercises, userData.discomforts);
        }
        
        // Final safety fallback: if all filters result in zero exercises, use all exercises
        if (filteredExercises.length === 0) {
            console.warn(`[WARNING] All filters resulted in 0 exercises for ${discipline}/${workout}. Using ALL exercises as final fallback.`);
            filteredExercises = exerciseList; // Ultimate fallback - user gets a session regardless
        }
        
        // Select exercises for each phase
        const warmupCandidates = filterExercisesByPhase(filteredExercises, 'warmup');
        const workoutCandidates = filterExercisesByPhase(filteredExercises, 'workout');
        const cooldownCandidates = filterExercisesByPhase(filteredExercises, 'cooldown');
        
        // If phase filtering returns empty, use all filtered exercises
        const warmupExercises = warmupCandidates.length > 0 
            ? selectExercisesForPhase(warmupCandidates, 'warmup', 3, previousSessions)
            : selectExercisesForPhase(filteredExercises, 'warmup', 3, previousSessions);
        
        const workoutExercises = workoutCandidates.length > 0
            ? selectExercisesForPhase(workoutCandidates, 'workout', 5, previousSessions)
            : selectExercisesForPhase(filteredExercises, 'workout', 5, previousSessions);
        
        // Link cool-down to workout muscles
        const workoutMuscles = extractMusclesFromExercises(workoutExercises);
        const cooldownExercises = cooldownCandidates.length > 0
            ? selectCooldownExercises(cooldownCandidates, workoutMuscles, previousSessions)
            : selectCooldownExercises(filteredExercises, workoutMuscles, previousSessions);
        
        // Apply progressive overload to select variations
        const currentMilestones = userData.currentMilestones || {};
        const warmupVariations = applyProgressiveOverload(warmupExercises, currentMilestones);
        const workoutVariations = applyProgressiveOverload(workoutExercises, currentMilestones);
        const cooldownVariations = applyProgressiveOverload(cooldownExercises, currentMilestones);
        
        return {
            discipline: discipline,
            workout: workout,
            phases: {
                warmup: warmupVariations,
                workout: workoutVariations,
                cooldown: cooldownVariations
            },
            generatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Error generating session for ${discipline}/${workout}:`, error);
        throw error;
    }
}

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
 * Group exercises by framework
 * @param {Array} exercises - Array of exercises
 * @returns {Object} Exercises grouped by framework
 */
export function groupExercisesByFramework(exercises) {
    const grouped = {};
    
    for (const framework in FRAMEWORK_MUSCLE_MAPPINGS) {
        grouped[framework] = filterExercisesByFramework(exercises, framework);
    }
    
    return grouped;
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
 * Link cool-down exercises to workout muscles
 * @param {Array} workoutExercises - Exercises from workout phase
 * @param {Array} allExercises - All available exercises
 * @returns {Array} Cool-down exercises linked to workout
 */
export function linkCooldownToWorkout(workoutExercises, allExercises) {
    const workoutMuscles = extractMusclesFromExercises(workoutExercises);
    const cooldownCandidates = filterExercisesByPhase(allExercises, 'cooldown');
    
    return cooldownCandidates.filter(exercise => {
        if (!exercise.variations) return false;
        
        return exercise.variations.some(variation => {
            const muscles = [
                ...(variation.target_muscles?.primary || []),
                ...(variation.target_muscles?.secondary || [])
            ].map(m => m.toLowerCase());
            
            return muscles.some(muscle => workoutMuscles.has(muscle));
        });
    });
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
 * Extract muscles from exercises
 * @param {Array} exercises - Array of exercises
 * @returns {Set} Set of muscle names
 */
function extractMusclesFromExercises(exercises) {
    const muscles = new Set();
    
    exercises.forEach(exercise => {
        if (exercise.variations) {
            exercise.variations.forEach(variation => {
                [
                    ...(variation.target_muscles?.primary || []),
                    ...(variation.target_muscles?.secondary || [])
                ].forEach(muscle => {
                    muscles.add(muscle.toLowerCase());
                });
            });
        }
    });
    
    return muscles;
}

/**
 * Select exercises for a specific phase
 * @param {Array} exercises - Available exercises
 * @param {string} phase - Phase type
 * @param {number} count - Number of exercises to select
 * @param {Array} previousSessions - Previous sessions for variety
 * @returns {Array} Selected exercises
 */
function selectExercisesForPhase(exercises, phase, count, previousSessions = []) {
    if (!exercises || exercises.length === 0) return [];
    
    // Ensure variety
    let candidates = ensureVariety(exercises, previousSessions);
    
    // If not enough after variety filter, use all exercises
    if (candidates.length < count) {
        candidates = exercises;
    }
    
    // Shuffle and select
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Select cool-down exercises linked to workout muscles
 * @param {Array} cooldownExercises - Available cool-down exercises
 * @param {Set} workoutMuscles - Muscles worked in workout phase
 * @param {Array} previousSessions - Previous sessions for variety
 * @returns {Array} Selected cool-down exercises
 */
function selectCooldownExercises(cooldownExercises, workoutMuscles, previousSessions = []) {
    if (!cooldownExercises || cooldownExercises.length === 0) return [];
    
    // Filter by matching muscles
    const matching = cooldownExercises.filter(exercise => {
        if (!exercise.variations) return false;
        return exercise.variations.some(variation => {
            const muscles = [
                ...(variation.target_muscles?.primary || []),
                ...(variation.target_muscles?.secondary || [])
            ].map(m => m.toLowerCase());
            return muscles.some(m => workoutMuscles.has(m));
        });
    });
    
    // Ensure variety
    let candidates = ensureVariety(matching.length > 0 ? matching : cooldownExercises, previousSessions);
    
    // Select 2-3 cool-down exercises
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(3, shuffled.length));
}

/**
 * Apply progressive overload to exercises (select variations)
 * @param {Array} exercises - Exercises to process
 * @param {Object} currentMilestones - Current milestone tracking
 * @returns {Array} Exercises with selected variations
 */
function applyProgressiveOverload(exercises, currentMilestones) {
    return exercises.map(exercise => {
        const variation = selectVariationForUser(exercise, currentMilestones, {});
        
        if (!variation) return null;
        
        return {
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
            sets: null, // To be filled by user during session
            reps: null // To be filled by user during session
        };
    }).filter(item => item !== null);
}

// ============================================================================
// WEEKLY SYSTEM GENERATION
// ============================================================================

/**
 * Distribute frameworks across week
 * @param {string} framework - Framework type (e.g., 'Push/Pull', 'Upper/Lower')
 * @param {number} daysPerWeek - Number of training days
 * @returns {Array} Framework assignments for each day
 */
function distributeFrameworksAcrossWeek(framework, daysPerWeek) {
    const assignments = [];
    
    if (framework === 'Push/Pull') {
        // Alternate Push and Pull
        for (let i = 0; i < daysPerWeek; i++) {
            assignments.push(i % 2 === 0 ? 'Push' : 'Pull');
        }
    } else if (framework === 'Upper/Lower') {
        // Alternate Upper and Lower
        for (let i = 0; i < daysPerWeek; i++) {
            assignments.push(i % 2 === 0 ? 'Upper' : 'Lower');
        }
    } else if (framework === 'Chest/Back/Legs') {
        // Rotate Chest, Back, Legs
        const cycle = ['Chest', 'Back', 'Legs'];
        for (let i = 0; i < daysPerWeek; i++) {
            assignments.push(cycle[i % 3]);
        }
    } else if (framework === 'Push/Pull/Legs') {
        // Rotate Push, Pull, Legs
        const cycle = ['Push', 'Pull', 'Legs'];
        for (let i = 0; i < daysPerWeek; i++) {
            assignments.push(cycle[i % 3]);
        }
    } else if (framework === 'Full Body') {
        // All days are Full Body
        for (let i = 0; i < daysPerWeek; i++) {
            assignments.push('Full Body');
        }
    } else {
        // Default: use framework as-is
        for (let i = 0; i < daysPerWeek; i++) {
            assignments.push(framework);
        }
    }
    
    return assignments;
}

/**
 * Calculate which days of the week are training days
 * @param {number} daysPerWeek - Number of training days per week
 * @returns {Array<number>} Array of day of week numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
 */
function calculateTrainingDaysOfWeek(daysPerWeek) {
    // Default patterns for common training frequencies
    const patterns = {
        2: [1, 4], // Monday, Thursday
        3: [1, 3, 5], // Monday, Wednesday, Friday
        4: [1, 3, 5, 0], // Monday, Wednesday, Friday, Sunday
        5: [1, 2, 4, 5, 6], // Monday, Tuesday, Thursday, Friday, Saturday
        6: [1, 2, 3, 4, 5, 6], // Monday through Saturday
        7: [0, 1, 2, 3, 4, 5, 6] // Every day
    };
    
    // Return pattern if exists, otherwise distribute evenly
    if (patterns[daysPerWeek]) {
        return patterns[daysPerWeek];
    }
    
    // For other numbers, distribute evenly across the week
    const days = [];
    const step = Math.floor(7 / daysPerWeek);
    for (let i = 0; i < daysPerWeek; i++) {
        days.push((i * step + 1) % 7); // Start from Monday (1)
    }
    return days.sort((a, b) => a - b);
}

/**
 * Find the next training day that is today or in the future
 * @param {Date} today - Today's date
 * @param {Array<number>} trainingDaysOfWeek - Array of day of week numbers
 * @returns {Date} The next training day
 */
function findNextTrainingDay(today, trainingDaysOfWeek) {
    const todayDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Find the next training day (including today if it's a training day)
    for (let i = 0; i < 7; i++) {
        const checkDay = (todayDayOfWeek + i) % 7;
        if (trainingDaysOfWeek.includes(checkDay)) {
            const nextDay = new Date(today);
            nextDay.setDate(today.getDate() + i);
            return nextDay;
        }
    }
    
    // Fallback: return today
    return today;
}

/**
 * Get the start of the week (Monday) for a given date
 * @param {Date} date - Date to get week start for
 * @returns {Date} Monday of that week
 */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
}

/**
 * Balance disciplines across week
 * @param {Array} disciplines - Available disciplines
 * @param {number} daysPerWeek - Number of training days
 * @returns {Array} Discipline assignments for each day
 */
function balanceDisciplinesAcrossWeek(disciplines, daysPerWeek) {
    if (!disciplines || disciplines.length === 0) {
        return Array(daysPerWeek).fill(null);
    }
    
    const assignments = [];
    const disciplineCounts = {};
    disciplines.forEach(d => disciplineCounts[d] = 0);
    
    for (let i = 0; i < daysPerWeek; i++) {
        // Find discipline with least assignments
        let minCount = Math.min(...Object.values(disciplineCounts));
        const leastUsed = disciplines.find(d => disciplineCounts[d] === minCount);
        
        assignments.push(leastUsed || disciplines[0]);
        disciplineCounts[leastUsed || disciplines[0]]++;
    }
    
    return assignments;
}

/**
 * Generate a weekly training system using rule-based logic
 * @param {Object} userProfile - User profile with milestones, goals, discomforts, equipment
 * @param {Object} config - Configuration (daysPerWeek, framework, startDate)
 * @returns {Promise<Object>} Generated weekly training system
 */
async function generateWeeklySystemRuleBased(userProfile = {}, config = {}) {
    try {
        console.log('[Rule-Based] Starting rule-based generation...');
        
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
        
        console.log('Config:', { daysPerWeek, framework, startDate });
        
        // Load exercises
        console.log('Loading exercises...');
        const exercises = await loadExercises();
        const exerciseList = exercises.exercises || [];
        console.log(`Loaded ${exerciseList.length} exercises`);
        
        if (exerciseList.length === 0) {
            throw new Error('No exercises found in exercises.json');
        }
        
        // Get user preferences
        const preferredDisciplines = userProfile.preferredDisciplines || 
                                     [TERMINOLOGY.DISCIPLINE_PILATES];
        const currentMilestones = userProfile.currentMilestones || {};
        const equipment = userProfile.equipment || [];
        const discomforts = userProfile.discomforts || [];
        
        console.log('User preferences:', { preferredDisciplines, equipment, discomforts });
        
        // DEBUG: Log preferred disciplines and first 3 exercises' disciplines
        console.log('[DEBUG] Preferred Disciplines:', preferredDisciplines);
        console.log('[DEBUG] First 3 exercises disciplines:');
        exerciseList.slice(0, 3).forEach((ex, idx) => {
            console.log(`  Exercise ${idx + 1}: "${ex.name}" - discipline: "${ex.discipline}"`);
        });
        
        // Filter exercises by discipline
        let filteredExercises = filterExercisesByDiscipline(exerciseList, preferredDisciplines);
        console.log(`After discipline filter: ${filteredExercises.length} exercises`);
        
        // Fallback mechanism: use all exercises if filtering results in empty array
        if (filteredExercises.length === 0) {
            console.warn(`[WARNING] No specific exercises found for disciplines: ${preferredDisciplines.join(', ')}, using ALL exercises as fallback`);
            filteredExercises = exerciseList; // Fallback to all exercises
        }
        
        // Filter by equipment and discomforts
        if (equipment.length > 0) {
            filteredExercises = filterExercisesByEquipment(filteredExercises, equipment);
            console.log(`After equipment filter: ${filteredExercises.length} exercises`);
        }
        if (discomforts.length > 0) {
            filteredExercises = filterExercisesByDiscomforts(filteredExercises, discomforts);
            console.log(`After discomforts filter: ${filteredExercises.length} exercises`);
        }
        
        // Final safety fallback: if all filters result in zero exercises, use all exercises
        if (filteredExercises.length === 0) {
            console.warn('[WARNING] All filters resulted in 0 exercises. Using ALL exercises as final fallback to prevent crash.');
            filteredExercises = exerciseList; // Ultimate fallback - user gets a plan regardless
        }
        
        // Distribute frameworks and disciplines across week
        const frameworkAssignments = distributeFrameworksAcrossWeek(framework, daysPerWeek);
        const disciplineAssignments = balanceDisciplinesAcrossWeek(preferredDisciplines, daysPerWeek);
        
        console.log('Framework assignments:', frameworkAssignments);
        console.log('Discipline assignments:', disciplineAssignments);
        
        // Generate sessions for each day
        // Calculate which days of the week are training days based on daysPerWeek
        // For 4 days: typically Mon, Wed, Fri, Sun (or spread evenly)
        const trainingDaysOfWeek = calculateTrainingDaysOfWeek(daysPerWeek);
        
        const sessions = [];
        const today = new Date();
        const startDateObj = new Date(startDate);
        
        // Always use the start of the current week (Monday) as reference
        // This ensures training days are distributed normally in the current week,
        // not "squeezed" into the remaining days
        const weekStart = getWeekStart(today);
        weekStart.setHours(0, 0, 0, 0);
        
        for (let dayIndex = 0; dayIndex < daysPerWeek; dayIndex++) {
            console.log(`Generating session ${dayIndex + 1}/${daysPerWeek}...`);
            
            // Get the day of week for this session (0 = Sunday, 1 = Monday, etc.)
            const dayOfWeek = trainingDaysOfWeek[dayIndex];
            
            // Calculate the date for this session
            // Always use the current week's Monday as the starting point
            const sessionDate = new Date(weekStart);
            const daysToAdd = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday (0) to 6 for calculation
            sessionDate.setDate(weekStart.getDate() + daysToAdd);
            sessionDate.setHours(0, 0, 0, 0);
            
            // Don't move dates to future - let them stay in the current week
            // This ensures consistent distribution across all weeks
            
            const sessionDiscipline = disciplineAssignments[dayIndex];
            const sessionWorkout = frameworkAssignments[dayIndex];
            
            // Get previous sessions for variety
            const previousSessions = sessions.slice(-2); // Last 2 sessions
            
            const session = await generateSession(
                sessionDiscipline,
                sessionWorkout,
                {
                    ...userProfile,
                    currentMilestones: currentMilestones
                },
                previousSessions
            );
            
            console.log(`Session ${dayIndex + 1} generated:`, {
                discipline: sessionDiscipline,
                workout: sessionWorkout,
                warmupCount: session.phases.warmup?.length || 0,
                workoutCount: session.phases.workout?.length || 0,
                cooldownCount: session.phases.cooldown?.length || 0
            });
            
            sessions.push({
                day: dayIndex + 1, // 1-indexed
                dayOfWeek: dayOfWeek, // Store day of week (0=Sunday, 1=Monday, etc.)
                date: sessionDate.toISOString().split('T')[0],
                discipline: sessionDiscipline,
                workout: sessionWorkout,
                framework: sessionWorkout, // Store framework label for this session
                phases: session.phases,
                editable: true
            });
        }
        
        // Generate system ID
        const systemId = `weekly-system-${Date.now()}`;
        
        // Use the Monday of the generation week as the system start date
        // This ensures the calendar can correctly show the recurring pattern starting from this week
        const systemWeekStart = getWeekStart(today);
        systemWeekStart.setHours(0, 0, 0, 0);
        const systemStartDate = systemWeekStart.toISOString().split('T')[0];
        
        const system = {
            id: systemId,
            type: 'weekly',
            startDate: systemStartDate,
            daysPerWeek: daysPerWeek,
            framework: framework,
            trainingDaysOfWeek: trainingDaysOfWeek, // Store which days of week are training days
            sessions: sessions,
            editable: true,
            createdAt: new Date().toISOString()
        };
        
        console.log('[Rule-Based] Weekly system generated successfully:', system);
        return system;
        
    } catch (error) {
        console.error('[Rule-Based] Error in generateWeeklySystem:', error);
        throw error;
    }
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
        
        // Always attempt AI generation - no fallback to rules
        console.log('[AI] Starting AI-powered generation (AI-driven app - no rule-based fallback)...');
        
        // Load exercises for AI context
        const exercises = await loadExercises();
        const exerciseList = exercises.exercises || [];
        
        if (exerciseList.length === 0) {
            throw new Error('No exercises found for AI generation');
        }
        
        // Import AI service dynamically
        const { generateTrainingSystemWithAI } = await import('../services/aiService.js');
        
        // Use AI directly - NO FALLBACK to rule-based
        // If AI fails, throw error (don't silently fall back to rules)
        try {
            return await generateTrainingSystemWithAI(userProfile, exerciseList, { daysPerWeek, framework, startDate });
        } catch (aiError) {
            console.error('[AI] AI generation failed:', aiError);
            // Always throw error - never fall back to rules in an AI-driven app
            throw new Error(`AI generation failed: ${aiError.message}. This app requires AI-powered generation.`);
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

