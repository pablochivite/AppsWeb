/**
 * Nodo 5.3: Variation Cleaner (DETERMINÍSTICO)
 * 
 * Descarta las variaciones con mala puntuación del scoredPool.
 * Esto reduce el tamaño del contexto para los nodos LLM siguientes (5.4.x).
 * 
 * Criterio de filtrado balanceado:
 * - Umbral mínimo: score >= 0.2 (elimina ruido y variaciones sin buen fit)
 * - Límites máximos por fase: Warmup 15, Workout 20, Cooldown 12
 * - Protección: si quedan menos de 5 variaciones, mantener todas las originales
 * 
 * Input: scoredPool con todas las variaciones y sus scores (ordenadas descendente)
 * Output: scoredPool filtrado (solo variaciones con buena puntuación)
 */

import { TrainingGraphState, ExerciseVariation } from "../types/schemas";

/**
 * Filtra variaciones de una fase aplicando criterio híbrido:
 * 1. Umbral mínimo de score (>= minScore)
 * 2. Límite máximo de variaciones (maxCount)
 * 3. Protección: si quedan menos de 5, mantener todas las originales
 * 
 * @param variations Array de variaciones ya ordenadas descendente por score
 * @param minScore Umbral mínimo de score (default: 0.2)
 * @param maxCount Límite máximo de variaciones a mantener
 * @returns Array filtrado de variaciones
 */
const filterPhaseVariations = (
  variations: ExerciseVariation[],
  minScore: number,
  maxCount: number
): ExerciseVariation[] => {
  if (!variations || variations.length === 0) {
    return [];
  }

  // Protección: si hay menos de 5 variaciones, mantener todas
  if (variations.length < 5) {
    return variations;
  }

  // 1. Filtrar por umbral mínimo de score
  // Tratar scores undefined como 0.0 (descartar)
  const filteredByScore = variations.filter(
    v => (v.score ?? 0) >= minScore
  );

  // 2. Aplicar límite máximo (mantener las primeras N, ya están ordenadas)
  const filtered = filteredByScore.slice(0, maxCount);

  // 3. Protección: si después del filtrado quedan menos de 5, mantener todas las originales
  if (filtered.length < 5 && variations.length >= 5) {
    return variations.slice(0, maxCount);
  }

  return filtered;
};

export async function variationCleanerNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  const { scoredPool } = state;

  // Validación: si scoredPool no existe, retornar estructura vacía
  if (!scoredPool) {
    return {
      scoredPool: {
        warmup: [],
        workout: [],
        cooldown: [],
      },
    };
  }

  // Guardar conteos originales para logging
  const originalCounts = {
    warmup: scoredPool.warmup?.length || 0,
    workout: scoredPool.workout?.length || 0,
    cooldown: scoredPool.cooldown?.length || 0,
  };

  // Aplicar filtrado a cada fase con sus límites específicos
  const MIN_SCORE = 0.2;
  const filteredPool = {
    warmup: filterPhaseVariations(
      scoredPool.warmup || [],
      MIN_SCORE,
      15 // máximo 15 variaciones para warmup
    ),
    workout: filterPhaseVariations(
      scoredPool.workout || [],
      MIN_SCORE,
      20 // máximo 20 variaciones para workout
    ),
    cooldown: filterPhaseVariations(
      scoredPool.cooldown || [],
      MIN_SCORE,
      12 // máximo 12 variaciones para cooldown
    ),
  };

  // Logging informativo
  console.log(
    `[Variation Cleaner] Filtrado completado:\n` +
    `  Warmup: ${originalCounts.warmup} → ${filteredPool.warmup.length} variaciones\n` +
    `  Workout: ${originalCounts.workout} → ${filteredPool.workout.length} variaciones\n` +
    `  Cooldown: ${originalCounts.cooldown} → ${filteredPool.cooldown.length} variaciones`
  );

  return {
    scoredPool: filteredPool,
  };
}

