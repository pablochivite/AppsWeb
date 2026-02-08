/**
 * Nodo 4: Loop Controller (DETERMINÍSTICO)
 * 
 * Controla el bucle para que genere el mismo número de sesiones que training days hay en la semana.
 * 
 * Lógica:
 * - Si currentDayIndex < WeeklyPlan.totalTrainingDays -> continuar a Nodo 5.1
 * - Si currentDayIndex >= WeeklyPlan.totalTrainingDays -> ir a Nodo 8 (Persistence)
 * 
 * Nota: Este nodo valida y loggea, pero el routing real se maneja en workflow.ts mediante edges condicionales.
 */

import { TrainingGraphState } from "../types/schemas";

export async function loopControllerNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  const { weeklyPlan, currentDayIndex } = state;

  // 1. Validaciones de entrada
  if (!weeklyPlan) {
    throw new Error("[Loop Controller] weeklyPlan no está definido");
  }

  if (typeof weeklyPlan.totalTrainingDays !== "number" || weeklyPlan.totalTrainingDays <= 0) {
    throw new Error(
      `[Loop Controller] weeklyPlan.totalTrainingDays debe ser un número positivo, recibido: ${weeklyPlan.totalTrainingDays}`
    );
  }

  if (typeof currentDayIndex !== "number" || currentDayIndex < 0) {
    throw new Error(
      `[Loop Controller] currentDayIndex debe ser un número no negativo, recibido: ${currentDayIndex}`
    );
  }

  // 2. Lógica de control de bucle
  const shouldContinue = currentDayIndex < weeklyPlan.totalTrainingDays;

  // 3. Logging informativo
  if (shouldContinue) {
    console.log(
      `[Loop Controller] Continuando bucle: día ${currentDayIndex + 1} de ${weeklyPlan.totalTrainingDays}. ` +
      `Siguiente: Nodo 5.1 (Phase Orchestrator)`
    );
  } else {
    console.log(
      `[Loop Controller] Bucle completado: ${currentDayIndex} sesiones generadas de ${weeklyPlan.totalTrainingDays}. ` +
      `Siguiente: Nodo 8 (Persistence Protocol)`
    );
  }

  // 4. Retornar objeto vacío (no modifica el estado del grafo)
  // El control de flujo se maneja en workflow.ts mediante edges condicionales
  return {};
}

