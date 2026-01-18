/**
 * Firestore Data Model Schema
 * Defines TypeScript interfaces for Exercise and Variation entities
 */

export interface ExerciseMetrics {
  mobility: number; // 0-100
  rotation: number; // 0-100
  flexibility: number; // 0-100
}

export interface Exercise {
  id: string; // kebab-case
  name: string;
  targetMuscleGroups: string[];
  category: string; // e.g., 'push', 'pull', 'core'
}

export interface VariationMetadata {
  bilaterality: boolean;
  equipment: string[];
}

export interface Variation {
  id: string;
  exerciseId: string; // Foreign Key to Exercise
  name: string;
  disciplines: string[]; // e.g., 'calisthenics', 'animal-flow'
  difficulty: number; // 1-10 for progressive overload
  metrics: ExerciseMetrics;
  instructions: string[];
  videoUrl?: string; // optional
  metadata: VariationMetadata;
}

/**
 * Set performance data
 * Contains actual performance data for a specific set of a variation
 */
export interface SetPerformance {
  setNumber: number; // 1-based set number
  reps?: number; // Number of repetitions completed
  weight?: number; // Weight used (if applicable)
  duration?: number; // Duration in seconds (for time-based exercises)
  completed: boolean; // Whether the set was completed
  notes?: string; // Optional notes about the set
}

/**
 * Variation with performance data
 * Represents a variation that was performed in a session, including set data
 */
export interface PerformedVariation {
  variationId: string; // Reference to the Variation master data
  exerciseId: string; // Reference to the Exercise
  sets: SetPerformance[]; // Array of sets performed
}

/**
 * Block within a phase
 * A block can be either a single variation OR a Superset (array of variations)
 */
export type Block = PerformedVariation | PerformedVariation[];

/**
 * Phase structure
 * Each phase contains an array of blocks
 */
export interface Phase {
  blocks: Block[]; // Array of blocks (each block is a variation or superset)
  duration: number; // Duration of the phase in seconds (0 if skipped)
}

/**
 * WorkoutSession structure
 * Represents a completed workout session with 3 mandatory phases
 */
export interface WorkoutSession {
  id?: string; // Auto-generated document ID
  userId: string; // Reference to user
  workoutLabel: string; // Workout label (e.g., 'Push', 'Pull', 'Legs')
  discipline: string; // Discipline (e.g., 'Pilates', 'Animal Flow')
  date: string; // ISO date string (YYYY-MM-DD)
  startedAt: string; // ISO timestamp when session started
  completedAt: string; // ISO timestamp when session completed
  duration: number; // Total session duration in seconds
  
  // The 3 mandatory phases
  warmup: Phase;
  workout: Phase; // The workout phase (not the label)
  cooldown: Phase;
  
  // Calculated metrics summary from all variations performed
  metricsSummary: ExerciseMetrics; // Aggregated from variation master data
  
  // User profile updates
  sessionNumber?: number; // Sequential session number for this user
  createdAt?: any; // Firestore Timestamp
}

/**
 * Baseline Assessment data structure
 * Stores mobility, rotation, and flexibility baseline scores from onboarding
 */
export interface BaselineAssessment {
  // Mobility scores (1-5 scale, will map to 0-100 for consistency)
  mobility: {
    overheadReach: number;      // 1-5
    shoulderRotation: number;   // 1-5  
    hipFlexibility: number;     // 1-5
    overallScore: number;       // Calculated average (1-5)
  };
  
  // Rotation scores
  rotation: {
    spinalRotation: number;     // 1-5
    dailyRotationFrequency: number; // 1-4 (Rarely → Very Often)
    overallScore: number;       // Calculated (1-5 equivalent)
  };
  
  // Flexibility scores  
  flexibility: {
    lowerBody: number;          // 1-5
    upperBody: number;          // 1-5
    overallScore: number;       // Calculated average (1-5)
  };
  
  // Physiological data (optional)
  physiological?: {
    age?: number;
    activityLevel?: 'sedentary' | 'lightly-active' | 'moderately-active' | 'very-active' | 'extremely-active';
    height?: number;            // cm
    weight?: number;            // kg
    bodyFatPercent?: number;    // 0-100
    injuryHistory?: string;     // Free text
  };
  
  // Metadata
  completedAt?: any;            // Firestore Timestamp
  version: string;              // "1.0" for future assessment iterations
  
  // Calculated baseline metrics (0-100 scale, matching ExerciseMetrics)
  baselineMetrics: ExerciseMetrics;
}

