/**
 * Nodo 6: Assembler (DETERMINÍSTICO)
 * 
 * Construye el objeto TrainingSession agregando los outputs de los nodos 5.4.1, 5.4.2 y 5.4.3.
 * Añade la sesión completa a finalSessions.
 * 
 * Input: selectedVariations (warmup, workout, cooldown) del estado
 * Output: TrainingSession añadido a finalSessions
 */

import { TrainingGraphState, TrainingSession } from "../types/schemas";

/**
 * Calcula la fecha de la sesión basándose en startDate y currentDayIndex
 * @param startDate ISO date string (YYYY-MM-DD)
 * @param currentDayIndex Índice actual (0-indexed)
 * @param trainingDays Array de días de la semana (0=Sunday, 6=Saturday)
 * @returns ISO date string (YYYY-MM-DD) de la fecha de la sesión
 */
function calculateSessionDate(
  startDate: string,
  currentDayIndex: number,
  trainingDays: number[]
): string {
  // 1. Parsear startDate
  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
    throw new Error(`[Assembler] startDate inválida: ${startDate}`);
  }

  // 2. Validar índices
  if (currentDayIndex < 0 || currentDayIndex >= trainingDays.length) {
    throw new Error(
      `[Assembler] currentDayIndex fuera de rango: ${currentDayIndex} (máximo: ${trainingDays.length - 1})`
    );
  }

  // 3. Obtener día objetivo y día de inicio
  const targetDayOfWeek = trainingDays[currentDayIndex];
  const startDayOfWeek = start.getDay(); // 0=Sunday, 6=Saturday

  // 4. Calcular diferencia de días
  let daysToAdd = targetDayOfWeek - startDayOfWeek;
  
  // 5. Manejar wrap-around: si el día objetivo ya pasó, ir a la siguiente semana
  if (daysToAdd < 0) {
    daysToAdd += 7;
  }

  // 6. Calcular fecha final
  const sessionDate = new Date(start);
  sessionDate.setDate(start.getDate() + daysToAdd);

  // 7. Retornar como ISO string (YYYY-MM-DD)
  const year = sessionDate.getFullYear();
  const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
  const day = String(sessionDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function assemblerNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  const {
    weeklyPlan,
    currentDayIndex,
    selectedVariations,
    currentSessionContext,
    finalSessions,
  } = state;

  // 1. Validaciones
  if (!weeklyPlan) {
    throw new Error("[Assembler] weeklyPlan no está definido");
  }

  if (!weeklyPlan.startDate || typeof weeklyPlan.startDate !== "string") {
    throw new Error(
      `[Assembler] weeklyPlan.startDate no está definida o no es válida: ${weeklyPlan.startDate}`
    );
  }

  if (!weeklyPlan.trainingDays || !Array.isArray(weeklyPlan.trainingDays) || weeklyPlan.trainingDays.length === 0) {
    throw new Error(
      `[Assembler] weeklyPlan.trainingDays no está definido o está vacío`
    );
  }

  if (typeof currentDayIndex !== "number" || currentDayIndex < 0) {
    throw new Error(
      `[Assembler] currentDayIndex debe ser un número no negativo, recibido: ${currentDayIndex}`
    );
  }

  if (currentDayIndex >= weeklyPlan.trainingDays.length) {
    throw new Error(
      `[Assembler] currentDayIndex (${currentDayIndex}) está fuera del rango de trainingDays (máximo: ${weeklyPlan.trainingDays.length - 1})`
    );
  }

  if (!selectedVariations) {
    throw new Error("[Assembler] selectedVariations no está definido");
  }

  if (!selectedVariations.warmup || !Array.isArray(selectedVariations.warmup)) {
    throw new Error("[Assembler] selectedVariations.warmup no está definido o no es un array");
  }

  if (!selectedVariations.workout || !Array.isArray(selectedVariations.workout)) {
    throw new Error("[Assembler] selectedVariations.workout no está definido o no es un array");
  }

  if (!selectedVariations.cooldown || !Array.isArray(selectedVariations.cooldown)) {
    throw new Error("[Assembler] selectedVariations.cooldown no está definido o no es un array");
  }

  // 2. Calcular fecha de la sesión
  const sessionDate = calculateSessionDate(
    weeklyPlan.startDate,
    currentDayIndex,
    weeklyPlan.trainingDays
  );

  // 3. Construir objeto TrainingSession
  // dayIndex debe ser el día de la semana (0=Sunday, 1=Monday, ..., 6=Saturday),
  // no el índice del bucle (currentDayIndex)
  const dayOfWeek = weeklyPlan.trainingDays[currentDayIndex];
  const newSession: TrainingSession = {
    dayIndex: dayOfWeek,
    date: sessionDate,
    focus: currentSessionContext?.focus || "",
    description: currentSessionContext?.description || "",
    warmup: selectedVariations.warmup,
    workout: selectedVariations.workout,
    cooldown: selectedVariations.cooldown,
  };

  // 4. Añadir a finalSessions
  const updatedFinalSessions = [...(finalSessions || []), newSession];

  // 5. Logging informativo
  console.log(
    `[Assembler] Sesión creada:\n` +
    `  CurrentDayIndex (bucle): ${currentDayIndex}\n` +
    `  DayIndex (día semana): ${dayOfWeek}\n` +
    `  Fecha: ${sessionDate}\n` +
    `  Focus: ${newSession.focus}\n` +
    `  Variaciones - Warmup: ${newSession.warmup.length}, Workout: ${newSession.workout.length}, Cooldown: ${newSession.cooldown.length}`
  );

  return {
    finalSessions: updatedFinalSessions,
  };
}

