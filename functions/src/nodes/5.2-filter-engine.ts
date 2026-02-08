/**
 * Nodo 5.2: Filter Engine (DETERMINÍSTICO)
 * 
 * Filtra las variaciones disponibles aplicando:
 * 1. Excluir variaciones en initialBlacklist (usadas la semana pasada)
 * 2. Excluir variaciones en sessionUsedIds (usadas esta semana)
 * 3. Hard Filter: filtrar por fase (warmup, workout, cooldown)
 * 4. Scoring Filter: asignar puntuación usando fuzzy logic basado en targetTags
 * 
 * Output: scoredPool con variaciones separadas por fase y con sus scores
 */

import { TrainingGraphState, ExerciseVariation, PhaseType } from "../types/schemas";

/**
 * Calcula el score de una variación basado en la coincidencia de tags con los targetTags
 */
const scoreVariation = (variation: ExerciseVariation, targetTags: Set<string>): ExerciseVariation => {
  if (targetTags.size === 0) {
    return { ...variation, score: 0 };
  }

  if (!variation.tags || variation.tags.length === 0) {
    return { ...variation, score: 0 };
  }

  // Contar coincidencias (case-insensitive)
  const matches = variation.tags.filter(tag => 
    targetTags.has(tag.toLowerCase().trim())
  ).length;

  // Score base: porcentaje de tags objetivo que coinciden
  const baseScore = matches / targetTags.size;

  // Bonus: si tiene múltiples coincidencias, dar bonus proporcional
  // Esto favorece variaciones que cubren más tags objetivo
  const bonusMultiplier = matches > 1 ? 1 + (matches - 1) * 0.1 : 1;
  const finalScore = Math.min(1.0, baseScore * bonusMultiplier);

  return { ...variation, score: finalScore };
};

export async function filterEngineNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  const {
    availableVariations,
    initialBlacklist,
    sessionUsedIds,
    currentSessionContext
  } = state;

  // Validación: asegurar que tenemos variaciones disponibles
  if (!availableVariations || availableVariations.length === 0) {
    return {
      scoredPool: {
        warmup: [],
        workout: [],
        cooldown: [],
      },
    };
  }

  // 1. GLOBAL EXCLUSION - Combinar ambas blacklists
  const fullBlacklist = new Set([...initialBlacklist, ...sessionUsedIds]);
  const candidates = availableVariations.filter(v => !fullBlacklist.has(v.id));

  // 2. HARD FILTER - Agrupación por fases
  const groupedVariations: Record<PhaseType, ExerciseVariation[]> = {
    warmup: [],
    workout: [],
    cooldown: [],
  };

  candidates.forEach(v => {
    if (v.phase && groupedVariations[v.phase]) {
      groupedVariations[v.phase].push(v);
    }
  });

  // 3. SCORING FILTER - Fuzzy Logic
  const targetTags = new Set(
    (currentSessionContext?.targetTags || []).map(t => t.toLowerCase().trim())
  );

  // Aplicar scoring y ordenar descendente
  const scoredPool = {
    warmup: groupedVariations.warmup
      .map(v => scoreVariation(v, targetTags))
      .sort((a, b) => (b.score || 0) - (a.score || 0)),
    workout: groupedVariations.workout
      .map(v => scoreVariation(v, targetTags))
      .sort((a, b) => (b.score || 0) - (a.score || 0)),
    cooldown: groupedVariations.cooldown
      .map(v => scoreVariation(v, targetTags))
      .sort((a, b) => (b.score || 0) - (a.score || 0)),
  };

  return { scoredPool };
}

