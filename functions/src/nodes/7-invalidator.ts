/**
 * Nodo 7: Invalidator (DETERMINÍSTICO)
 * 
 * Añade el 50% de las variaciones usadas en la sesión recién generada a sessionUsedIds.
 * Esto evita repeticiones dentro de la misma semana (intra-week variability).
 * 
 * También incrementa currentDayIndex +1 para continuar el bucle.
 * 
 * Lógica:
 * - Identificar 50% de variaciones de warmup
 * - Identificar 50% de variaciones de workout
 * - Identificar 50% de variaciones de cooldown
 * - Fusionar con sessionUsedIds existente
 * - Incrementar currentDayIndex
 * - Limpiar estado de sesión para evitar contaminación
 */

import { TrainingGraphState, ExerciseVariation } from "../types/schemas";

/**
 * Selecciona aleatoriamente el 50% de las variaciones usando Fisher-Yates shuffle.
 * Retorna un array con los IDs de las variaciones seleccionadas.
 * 
 * @param variations Array de variaciones a procesar
 * @returns Array de IDs seleccionados (50% redondeado hacia arriba)
 */
const getRandomHalfIds = (variations: ExerciseVariation[]): string[] => {
  if (!variations || variations.length === 0) {
    return [];
  }

  // Crear copia del array para no mutar el original
  const shuffled = [...variations];

  // Fisher-Yates shuffle para distribución uniforme
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Seleccionar el 50% redondeado hacia arriba (Math.ceil asegura al menos 1 si hay pocos)
  const count = Math.ceil(shuffled.length * 0.5);

  return shuffled.slice(0, count).map(v => v.id);
};

export async function invalidatorNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  const { selectedVariations, currentDayIndex, sessionUsedIds } = state;

  // Validar que selectedVariations existe
  if (!selectedVariations) {
    console.warn("[Invalidator] selectedVariations no está definido. Avanzando al siguiente día.");
    return {
      currentDayIndex: currentDayIndex + 1,
      currentSessionContext: undefined,
      selectedVariations: undefined,
      scoredPool: undefined,
    };
  }

  // 1. Identificar variaciones a bloquear de la sesión actual (50% de cada fase)
  const warmupBlock = getRandomHalfIds(selectedVariations.warmup || []);
  const workoutBlock = getRandomHalfIds(selectedVariations.workout || []);
  const cooldownBlock = getRandomHalfIds(selectedVariations.cooldown || []);

  // 2. Combinar todos los IDs bloqueados
  const newIdsToBlock = [...warmupBlock, ...workoutBlock, ...cooldownBlock];

  // 3. Actualizar el acumulador intra-semanal (sessionUsedIds)
  // Usar spread operator para mantener inmutabilidad
  const updatedSessionUsedIds = [...(sessionUsedIds || []), ...newIdsToBlock];

  // 4. Incrementar índice para control de bucle
  const nextDayIndex = currentDayIndex + 1;

  console.log(
    `[Invalidator] Bloqueando ${newIdsToBlock.length} variaciones ` +
    `(warmup: ${warmupBlock.length}, workout: ${workoutBlock.length}, cooldown: ${cooldownBlock.length}). ` +
    `Total acumulado: ${updatedSessionUsedIds.length}. Avanzando al día ${nextDayIndex}`
  );

  // 5. Retornar estado actualizado y limpiar campos de sesión
  return {
    sessionUsedIds: updatedSessionUsedIds,
    currentDayIndex: nextDayIndex,
    // Limpiar contexto de la sesión anterior para evitar contaminación
    currentSessionContext: undefined,
    selectedVariations: undefined,
    scoredPool: undefined,
  };
}

