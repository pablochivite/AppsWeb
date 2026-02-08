/**
 * Nodo 5.1: Phase Orchestrator (PROBABILÍSTICO - LLM)
 * 
 * Selecciona las tags adecuadas para la sesión actual basándose en:
 * - WeeklyPlan: focus, descripción y systemGoal del training day en currentDayIndex
 * - Lista de todos los tags disponibles en la BD
 * 
 * Output: currentSessionContext con focus, description, systemGoal y targetTags
 * Este contexto se usa posteriormente por los nodos 5.4.1, 5.4.2 y 5.4.3
 */

import { TrainingGraphState } from "../types/schemas";
import { getPhaseOrchestratorPrompt, getPhaseOrchestratorFunctionDefinition } from "../prompts/phase-orchestrator";
import { callLLMWithFunctionCalling } from "../services/llm";

/**
 * Lista de todas las tags disponibles en el sistema
 */
const AVAILABLE_TAGS = [
  // Anatomía
  'chest',
  'back',
  'legs',
  'shoulders',
  'core',
  // Patrón de Movimiento
  'push',
  'pull',
  'squat',
  'hinge',
  'lunge',
  'rotation',
  // Modalidad/Atributo
  'unilateral',
  'bilateral',
  'isometric',
  'explosive',
  'plyometric',
];

/**
 * Interface para la respuesta del LLM
 */
interface PhaseOrchestratorResponse {
  targetTags: string[];
}

export async function phaseOrchestratorNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  console.log("[Phase Orchestrator Node] Starting tag selection...");

  // 1. Validar entrada
  if (!state.weeklyPlan) {
    throw new Error("[Phase Orchestrator Node] weeklyPlan is required");
  }

  if (state.currentDayIndex === undefined || state.currentDayIndex === null) {
    throw new Error("[Phase Orchestrator Node] currentDayIndex is required");
  }

  const { weeklyPlan, currentDayIndex } = state;

  // 2. Validar que currentDayIndex está en rango
  if (currentDayIndex < 0 || currentDayIndex >= weeklyPlan.trainingDays.length) {
    throw new Error(
      `[Phase Orchestrator Node] currentDayIndex (${currentDayIndex}) está fuera del rango de trainingDays (máximo: ${weeklyPlan.trainingDays.length - 1})`
    );
  }

  // 3. Obtener el día de la semana correspondiente al índice de sesión actual
  const dayOfWeek = weeklyPlan.trainingDays[currentDayIndex];

  // 4. Encontrar el ScheduledTrainingDay correspondiente al día de la semana
  const trainingDay = weeklyPlan.schedule.find(
    (day) => day.dayIndex === dayOfWeek
  );

  if (!trainingDay) {
    throw new Error(
      `[Phase Orchestrator Node] No training day found for dayOfWeek ${dayOfWeek} (session index: ${currentDayIndex})`
    );
  }

  console.log("[Phase Orchestrator Node] Training day found:", {
    sessionIndex: currentDayIndex,
    dayOfWeek: dayOfWeek,
    dayIndex: trainingDay.dayIndex,
    focus: trainingDay.focus,
  });

  // 5. Construir prompt con los datos del training day
  const prompt = getPhaseOrchestratorPrompt(
    trainingDay.focus,
    trainingDay.description,
    trainingDay.systemGoal,
    AVAILABLE_TAGS
  );

  console.log("[Phase Orchestrator Node] Prompt constructed, length:", prompt.length);

  // 6. Llamar al LLM con function calling
  const functionDefinition = getPhaseOrchestratorFunctionDefinition();

  console.log("[Phase Orchestrator Node] Calling LLM with function calling...");

  let llmResponse: PhaseOrchestratorResponse;
  try {
    llmResponse = await callLLMWithFunctionCalling<PhaseOrchestratorResponse>(
      prompt,
      functionDefinition
    );

    console.log("[Phase Orchestrator Node] LLM response received:", {
      targetTagsCount: llmResponse.targetTags?.length || 0,
      targetTags: llmResponse.targetTags,
    });
  } catch (error) {
    console.error("[Phase Orchestrator Node] LLM call failed:", error);
    throw new Error(
      `[Phase Orchestrator Node] Failed to select tags: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  // 7. Validar que las tags seleccionadas estén en la lista de tags disponibles
  const invalidTags = llmResponse.targetTags.filter(
    (tag) => !AVAILABLE_TAGS.includes(tag.toLowerCase().trim())
  );

  if (invalidTags.length > 0) {
    console.warn(
      "[Phase Orchestrator Node] Invalid tags detected, filtering out:",
      invalidTags
    );
  }

  // Filtrar y normalizar las tags (case-insensitive)
  const validTags = llmResponse.targetTags
    .map((tag) => tag.toLowerCase().trim())
    .filter((tag) => AVAILABLE_TAGS.includes(tag));

  if (validTags.length === 0) {
    throw new Error(
      "[Phase Orchestrator Node] No valid tags selected by LLM"
    );
  }

  console.log("[Phase Orchestrator Node] Tags selected successfully:", {
    validTagsCount: validTags.length,
    validTags,
  });

  // 8. Actualizar currentSessionContext con todos los campos necesarios
  // Inicializar selectedVariations vacío al inicio de cada iteración
  return {
    currentSessionContext: {
      focus: trainingDay.focus,
      description: trainingDay.description,
      systemGoal: trainingDay.systemGoal,
      targetTags: validTags,
    },
    selectedVariations: {
      warmup: [],
      workout: [],
      cooldown: [],
    },
  };
}

