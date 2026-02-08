/**
 * /types/schemas.ts
 * Versión Final: Lógica Simplificada FIFO / Rolling Window
 */

export type PhaseType = 'warmup' | 'workout' | 'cooldown';

// --- ENTIDADES ---

export interface UserMetrics {
  mobility: number;
  flexibility: number;
  rotation: number;
}

export interface UserProfile {
  uid: string;
  metrics: UserMetrics;
  discomforts: string[];
  objectives: string[];
  preferredDisciplines: string[];
  // NOTA: Ya no guardamos la blacklist aquí para no duplicar datos en el State.
  // La blacklist se carga directamente en 'initialBlacklist' del state.
}

export interface ExerciseVariation {
  id: string;
  name: string;
  phase: PhaseType;
  disciplines: string[];
  tags: string[];
  score?: number; 
}

// --- PLAN Y SESIÓN ---

export interface ScheduledTrainingDay {
  dayIndex: number;
  focus: string;
  description: string;
  systemGoal: string;
}

export interface WeeklyPlan {
  totalTrainingDays: number;
  trainingDays: number[];
  startDate: string;
  goalDescription: string;
  schedule: ScheduledTrainingDay[];
}

export interface TrainingSession {
  dayIndex: number;
  date: string;
  focus: string;
  description: string;
  warmup: ExerciseVariation[];
  workout: ExerciseVariation[];
  cooldown: ExerciseVariation[];
}

// --- ESTADO DEL GRAFO (LANGGRAPH) ---

export interface TrainingGraphState {
  // 1. INPUTS
  userProfile: UserProfile | null;
  availableVariations: ExerciseVariation[]; 

  // 2. GESTIÓN DE VARIABILIDAD (Simplificado)
  
  /**
   * LO QUE VIENE DE FIREBASE (READ ONLY).
   * Contenido del campo 'users/{uid}/blackLstedVariationIds'.
   * Representa las variaciones usadas en la SEMANA ANTERIOR.
   * Se usa para bloquear ejercicios durante toda esta generación.
   */
  initialBlacklist: string[]; 

  /**
   * LO QUE SE ACUMULA AHORA (APPEND ONLY durante el grafo).
   * Representa las variaciones usadas en la SEMANA ACTUAL.
   * Se usa para variabilidad intra-semanal.
   * Al final del grafo, esto (filtrado al 50%) SOBREESCRIBIRÁ la BD.
   */
  sessionUsedIds: string[]; 

  // 3. ORQUESTACIÓN
  weeklyPlan: WeeklyPlan | null;
  finalSessions: TrainingSession[]; 
  
  // 4. CONTROL DE BUCLE
  currentDayIndex: number; 
  
  currentSessionContext?: {
    focus: string;
    description: string;
    systemGoal: string;
    targetTags: string[]; 
  };

  scoredPool: {
    warmup: ExerciseVariation[];
    workout: ExerciseVariation[];
    cooldown: ExerciseVariation[];
  };

  selectedVariations: {
    warmup: ExerciseVariation[];
    workout: ExerciseVariation[];
    cooldown: ExerciseVariation[];
  };
}