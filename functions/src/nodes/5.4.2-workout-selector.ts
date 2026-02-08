/**
 * Nodo 5.4.2: Workout Selector (PROBABILÍSTICO - LLM)
 * 
 * Selecciona las variaciones más adecuadas para la fase workout.
 * Se ejecuta en paralelo con 5.4.1 y 5.4.3.
 * 
 * Contexto:
 * - currentSessionContext: focus, description y systemGoal de la sesión actual
 * - scoredPool.workout con variaciones candidatas filtradas
 * 
 * Restricción: mínimo 2 disciplinas en fase workout
 * 
 * Output: selectedVariations.workout (array de ExerciseVariation)
 */

import { TrainingGraphState, ExerciseVariation } from "../types/schemas";
import { getWorkoutSelectorPrompt, getSelectorFunctionDefinition } from "../prompts/selectors";
import { callLLMWithFunctionCalling } from "../services/llm";

/**
 * Interface para la respuesta del LLM
 */
interface WorkoutSelectorResponse {
  selectedVariations: Array<{ id: string }>;
}

export async function workoutSelectorNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  console.log("[Workout Selector Node] Starting workout variation selection...");

  // 1. Validar entrada
  if (!state.currentSessionContext) {
    throw new Error("[Workout Selector Node] currentSessionContext is required");
  }

  if (!state.scoredPool?.workout || state.scoredPool.workout.length === 0) {
    console.warn("[Workout Selector Node] No workout variations available, returning empty array");
    return {
      selectedVariations: {
        ...state.selectedVariations,
        workout: [],
      },
    };
  }

  const { currentSessionContext, scoredPool } = state;

  console.log("[Workout Selector Node] Using session context:", {
    focus: currentSessionContext.focus,
  });

  // 2. Preparar variaciones para el prompt (solo los campos necesarios)
  const scoredVariations = scoredPool.workout.map((v) => ({
    id: v.id,
    name: v.name,
    score: v.score || 0,
    tags: v.tags || [],
    disciplines: v.disciplines || [],
  }));

  // 3. Construir prompt con contexto del currentSessionContext
  const prompt = getWorkoutSelectorPrompt(
    currentSessionContext.focus,
    currentSessionContext.description,
    currentSessionContext.systemGoal,
    scoredVariations
  );

  console.log("[Workout Selector Node] Prompt constructed, variations count:", scoredVariations.length);

  // 5. Llamar al LLM con function calling
  const functionDefinition = getSelectorFunctionDefinition("workout");

  console.log("[Workout Selector Node] Calling LLM with function calling...");

  let llmResponse: WorkoutSelectorResponse;
  try {
    llmResponse = await callLLMWithFunctionCalling<WorkoutSelectorResponse>(
      prompt,
      functionDefinition
    );

    console.log("[Workout Selector Node] LLM response received:", {
      selectedCount: llmResponse.selectedVariations?.length || 0,
    });
  } catch (error) {
    console.error("[Workout Selector Node] LLM call failed:", error);
    throw new Error(
      `[Workout Selector Node] Failed to select workout variations: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  // 6. Mapear IDs seleccionados a ExerciseVariation completas
  const selectedIds = new Set(
    llmResponse.selectedVariations.map((v) => v.id)
  );
  
  const selectedVariations: ExerciseVariation[] = scoredPool.workout.filter(
    (v) => selectedIds.has(v.id)
  );

  if (selectedVariations.length === 0) {
    throw new Error(
      "[Workout Selector Node] No valid variations found for selected IDs"
    );
  }

  // 7. Validar que haya mínimo 2 disciplinas diferentes
  const uniqueDisciplines = new Set<string>();
  selectedVariations.forEach((v) => {
    if (v.disciplines && v.disciplines.length > 0) {
      v.disciplines.forEach((d) => uniqueDisciplines.add(d.toLowerCase().trim()));
    }
  });

  if (uniqueDisciplines.size < 2) {
    console.warn(
      "[Workout Selector Node] Selected variations have less than 2 disciplines:",
      Array.from(uniqueDisciplines)
    );
    // No lanzamos error, solo advertimos - el LLM debería haber cumplido esta restricción
  }

  console.log("[Workout Selector Node] Workout variations selected successfully:", {
    count: selectedVariations.length,
    disciplines: Array.from(uniqueDisciplines),
    variations: selectedVariations.map((v) => v.name),
  });

  // 8. Retornar selectedVariations.workout
  // Inicializar explícitamente todas las fases para evitar dependencia del estado previo
  return {
    selectedVariations: {
      warmup: [], // Inicializar vacío explícitamente
      workout: selectedVariations,
      cooldown: [], // Inicializar vacío explícitamente
    },
  };
}

