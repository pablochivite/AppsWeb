// REGAIN Constants and Terminology
// This file centralizes all REGAIN-specific terminology and configuration

export const TERMINOLOGY = {
    // Core Entities
    SESSION: 'Session',
    WORKOUT: 'Workout',
    ROUTINE: 'Routine',
    DISCIPLINE: 'Discipline',
    TRAINING_FRAMEWORK: 'Training Framework',
    TRAINING_SYSTEM: 'Training System',
    PHASES: 'Phases',
    EXERCISE: 'Exercise',
    SUPERSET: 'Superset',
    SET: 'Set',
    VARIATIONS: 'Variations',
    OVERLOAD: 'Overload',
    PROGRESSIVE_OVERLOAD: 'Progressive overload',
    FORM: 'Form',
    TECHNIQUE: 'Technique',
    OVERLOAD_PERIOD: 'Overload Period',
    MILESTONE: 'Milestone',
    
    // Session Phases
    PHASE_WARMUP: 'Warm-up',
    PHASE_WORKOUT: 'Workout',
    PHASE_COOLDOWN: 'Cool Down',
    
    // Disciplines
    DISCIPLINE_PILATES: 'Pilates',
    DISCIPLINE_ANIMAL_FLOW: 'Animal Flow',
    DISCIPLINE_WEIGHTS: 'Weights',
    DISCIPLINE_CROSSFIT: 'Crossfit',
    DISCIPLINE_CALISTHENICS: 'Calisthenics',
    
    // Roles
    ROLE_ATHLETE: 'athlete',
    
    // Progression Types
    PROGRESSION_LOAD: 'load',
    PROGRESSION_LEVERAGE: 'leverage',
    PROGRESSION_STABILITY: 'stability',
    PROGRESSION_DURATION: 'duration',
    PROGRESSION_RANGE_OF_MOTION: 'range_of_motion',
    PROGRESSION_FORM: 'form',
    
    // Bilaterality
    BILATERAL: 'bilateral',
    UNILATERAL: 'unilateral'
};

export const REGAIN_PRINCIPLES = {
    BREATHING: 'Breathing',
    HOLISTIC_FOCUS: 'Holistic Focus',
    VARIABILITY: 'Variability',
    LONGEVITY: 'Longevity',
    TECHNIQUE: 'Technique'
};

export const SESSION_STRUCTURE = {
    PHASE_1: 'Warm-up (Warm-up + Mobility)',
    PHASE_2: 'Workout (Core + Framework)',
    PHASE_3: 'Cool Down (Stretching/Mobility)'
};

export const MOVEMENT_HIERARCHY = {
    POSTURE: 'Posture',
    MOBILITY_FLEXIBILITY: 'Mobility/Flexibility',
    ROTATION: 'Rotation',
    MECHANICAL_ORDER: {
        BILATERAL_BEFORE_UNILATERAL: 'Bilateral BEFORE Unilateral',
        STATIC_BEFORE_DYNAMIC: 'Static BEFORE Dynamic',
        CONCENTRIC_BEFORE_ECCENTRIC: 'Concentric BEFORE Eccentric'
    }
};

export const OVERLOAD_PERIOD_SESSIONS = 3; // Milestone achieved after 3 successful sessions

// Training Framework Definitions
export const TRAINING_FRAMEWORKS = {
    PUSH_PULL: 'Push/Pull',
    UPPER_LOWER: 'Upper/Lower',
    CHEST_BACK_LEGS: 'Chest/Back/Legs',
    FULL_BODY: 'Full Body',
    PUSH_PULL_LEGS: 'Push/Pull/Legs'
};

// Framework to Muscle Group Mappings
export const FRAMEWORK_MUSCLE_MAPPINGS = {
    'Push': {
        primary: ['chest', 'shoulders', 'triceps'],
        secondary: ['front delts', 'upper chest']
    },
    'Pull': {
        primary: ['back', 'biceps', 'rear delts'],
        secondary: ['lats', 'rhomboids', 'traps']
    },
    'Legs': {
        primary: ['quads', 'glutes', 'hamstrings', 'calves'],
        secondary: ['hip flexors', 'adductors']
    },
    'Upper': {
        primary: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
        secondary: ['traps', 'rear delts', 'front delts']
    },
    'Lower': {
        primary: ['quads', 'glutes', 'hamstrings', 'calves'],
        secondary: ['hip flexors', 'adductors', 'abductors']
    },
    'Core': {
        primary: ['abs', 'core', 'obliques'],
        secondary: ['lower back', 'hip flexors']
    },
    'Push/Pull': {
        // Alternates between Push and Pull
        primary: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
        secondary: ['rear delts', 'traps']
    },
    'Upper/Lower': {
        // Alternates between Upper and Lower
        primary: ['chest', 'back', 'shoulders', 'arms', 'quads', 'glutes', 'hamstrings'],
        secondary: ['calves', 'traps']
    },
    'Chest/Back/Legs': {
        // Alternates between Chest, Back, and Legs
        primary: ['chest', 'back', 'quads', 'glutes', 'hamstrings'],
        secondary: ['shoulders', 'biceps', 'triceps', 'calves']
    },
    'Full Body': {
        primary: ['chest', 'back', 'shoulders', 'quads', 'glutes', 'hamstrings', 'core'],
        secondary: ['biceps', 'triceps', 'calves', 'abs']
    },
    'Push/Pull/Legs': {
        // Alternates between Push, Pull, and Legs
        primary: ['chest', 'back', 'shoulders', 'quads', 'glutes', 'hamstrings'],
        secondary: ['biceps', 'triceps', 'calves']
    }
};

// Phase Selection Criteria
export const PHASE_CRITERIA = {
    WARMUP: {
        maxDifficulty: 4,
        preferredProgressionTypes: ['stability', 'duration', 'mobility'],
        preferredBilaterality: 'bilateral',
        focus: 'mobility'
    },
    WORKOUT: {
        minDifficulty: 3,
        maxDifficulty: 9,
        allProgressionTypes: true,
        focus: 'strength'
    },
    COOLDOWN: {
        maxDifficulty: 5,
        preferredProgressionTypes: ['stability', 'mobility', 'range_of_motion'],
        focus: 'stretching'
    }
};

// Default Weekly System Configuration
export const DEFAULT_WEEKLY_CONFIG = {
    daysPerWeek: 4,
    framework: TRAINING_FRAMEWORKS.PUSH_PULL,
    startDate: new Date().toISOString().split('T')[0],
    restDays: [2, 4, 6] // Tuesday, Thursday, Saturday (0 = Sunday)
};

