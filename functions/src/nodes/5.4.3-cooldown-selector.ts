/**
 * Nodo 5.4.3: Cooldown Selector (PROBABILÍSTICO - LLM)
 * 
 * Selecciona las variaciones más adecuadas para la fase cooldown.
 * Se ejecuta en paralelo con 5.4.1 y 5.4.2.
 * 
 * Contexto:
 * - currentSessionContext: focus, description y systemGoal de la sesión actual
 * - scoredPool.cooldown con variaciones candidatas filtradas
 * 
 * Output: selectedVariations.cooldown (array de ExerciseVariation)
 */

import { TrainingGraphState, ExerciseVariation } from "../types/schemas";
import { getCooldownSelectorPrompt, getSelectorFunctionDefinition } from "../prompts/selectors";
import { callLLMWithFunctionCalling } from "../services/llm";

/**
 * Interface para la respuesta del LLM
 */
interface CooldownSelectorResponse {
  selectedVariations: Array<{ id: string }>;
}

export async function cooldownSelectorNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  console.log("[Cooldown Selector Node] Starting cooldown variation selection...");

  // 1. Validar entrada
  if (!state.currentSessionContext) {
    throw new Error("[Cooldown Selector Node] currentSessionContext is required");
  }

  if (!state.scoredPool?.cooldown || state.scoredPool.cooldown.length === 0) {
    console.warn("[Cooldown Selector Node] No cooldown variations available, returning empty array");
    return {
      selectedVariations: {
        ...state.selectedVariations,
        cooldown: [],
      },
    };
  }

  const { currentSessionContext, scoredPool } = state;

  console.log("[Cooldown Selector Node] Using session context:", {
    focus: currentSessionContext.focus,
  });

  // 2. Preparar variaciones para el prompt (solo los campos necesarios)
  const scoredVariations = scoredPool.cooldown.map((v) => ({
    id: v.id,
    name: v.name,
    score: v.score || 0,
    tags: v.tags || [],
    disciplines: v.disciplines || [],
  }));

  // 3. Construir prompt con contexto del currentSessionContext
  const prompt = getCooldownSelectorPrompt(
    currentSessionContext.focus,
    currentSessionContext.description,
    currentSessionContext.systemGoal,
    scoredVariations
  );

  console.log("[Cooldown Selector Node] Prompt constructed, variations count:", scoredVariations.length);

  // 5. Llamar al LLM con function calling
  const functionDefinition = getSelectorFunctionDefinition("cooldown");

  console.log("[Cooldown Selector Node] Calling LLM with function calling...");

  let llmResponse: CooldownSelectorResponse;
  try {
    llmResponse = await callLLMWithFunctionCalling<CooldownSelectorResponse>(
      prompt,
      functionDefinition
    );

    console.log("[Cooldown Selector Node] LLM response received:", {
      selectedCount: llmResponse.selectedVariations?.length || 0,
    });
  } catch (error) {
    console.error("[Cooldown Selector Node] LLM call failed:", error);
    throw new Error(
      `[Cooldown Selector Node] Failed to select cooldown variations: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  // 6. Mapear IDs seleccionados a ExerciseVariation completas
  const selectedIds = new Set(
    llmResponse.selectedVariations.map((v) => v.id)
  );
  
  const selectedVariations: ExerciseVariation[] = scoredPool.cooldown.filter(
    (v) => selectedIds.has(v.id)
  );

  if (selectedVariations.length === 0) {
    throw new Error(
      "[Cooldown Selector Node] No valid variations found for selected IDs"
    );
  }

  console.log("[Cooldown Selector Node] Cooldown variations selected successfully:", {
    count: selectedVariations.length,
    variations: selectedVariations.map((v) => v.name),
  });

  // 7. Retornar selectedVariations.cooldown
  // Inicializar explícitamente todas las fases para evitar dependencia del estado previo
  return {
    selectedVariations: {
      warmup: [], // Inicializar vacío explícitamente
      workout: [], // Inicializar vacío explícitamente
      cooldown: selectedVariations,
    },
  };
}

