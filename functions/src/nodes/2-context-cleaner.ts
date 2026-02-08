/**
 * Nodo 2: Context Cleaner (DETERMINÍSTICO)
 * 
 * Limpia los campos del perfil y de las variaciones para que el estado sea más simple:
 * - userProfile: solo metrics, discomforts, objectives, preferredDisciplines, uid
 * - variations: solo id, name, phase, disciplines, tags
 */

import { TrainingGraphState, UserProfile, ExerciseVariation, PhaseType } from "../types/schemas";

/**
 * Transforma el userProfile completo a la versión limpia con solo los campos necesarios
 */
function cleanUserProfile(rawProfile: any): UserProfile | null {
  if (!rawProfile) {
    return null;
  }

  // Extraer baselineMetrics y mapear a metrics
  const baselineMetrics = rawProfile.baselineAssessment?.baselineMetrics || rawProfile.baselineMetrics;
  const metrics = {
    mobility: baselineMetrics?.mobility ?? 0,
    rotation: baselineMetrics?.rotation ?? 0,
    flexibility: baselineMetrics?.flexibility ?? 0,
  };

  // Extraer otros campos
  const discomforts = Array.isArray(rawProfile.discomforts) ? rawProfile.discomforts : [];
  const objectives = Array.isArray(rawProfile.objectives) ? rawProfile.objectives : [];
  const preferredDisciplines = Array.isArray(rawProfile.preferredDisciplines)
    ? rawProfile.preferredDisciplines
    : [];

  const uid = rawProfile.uid || "";

  return {
    uid,
    metrics,
    discomforts,
    objectives,
    preferredDisciplines,
  };
}

/**
 * Filtra una variación para mantener solo los campos necesarios
 */
function cleanVariation(rawVariation: any): ExerciseVariation | null {
  if (!rawVariation || !rawVariation.id) {
    return null;
  }

  // Mantener solo los campos necesarios
  // Validar que phase sea un PhaseType válido
  const validPhases: PhaseType[] = ["warmup", "workout", "cooldown"];
  const phase: PhaseType = validPhases.includes(rawVariation.phase)
    ? rawVariation.phase
    : "workout"; // Default a workout si no es válido

  return {
    id: rawVariation.id,
    name: rawVariation.name || "",
    phase,
    disciplines: Array.isArray(rawVariation.disciplines) ? rawVariation.disciplines : [],
    tags: Array.isArray(rawVariation.tags) ? rawVariation.tags : [],
  };
}

export async function contextCleanerNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  // 1. Validaciones
  if (!state.userProfile) {
    throw new Error("[Context Cleaner] userProfile no está definido en el estado");
  }

  if (!state.availableVariations || !Array.isArray(state.availableVariations)) {
    throw new Error(
      "[Context Cleaner] availableVariations no está definido o no es un array"
    );
  }

  // 2. Transformar userProfile
  const cleanedProfile = cleanUserProfile(state.userProfile);

  if (!cleanedProfile) {
    throw new Error("[Context Cleaner] No se pudo transformar userProfile");
  }

  // 3. Filtrar availableVariations
  const cleanedVariations = state.availableVariations
    .map(cleanVariation)
    .filter((v): v is ExerciseVariation => v !== null);

  // 4. Logging informativo
  const originalVariationCount = state.availableVariations.length;
  const cleanedVariationCount = cleanedVariations.length;
  
  console.log(
    `[Context Cleaner] Limpieza completada:\n` +
    `  - UserProfile: transformado (baselineMetrics → metrics, preferredDisciplines mantenido)\n` +
    `  - Variaciones: ${originalVariationCount} → ${cleanedVariationCount} ` +
    `(${originalVariationCount - cleanedVariationCount} eliminadas por falta de campos requeridos)`
  );

  // 5. Retornar estado limpio
  return {
    userProfile: cleanedProfile,
    availableVariations: cleanedVariations,
  };
}

