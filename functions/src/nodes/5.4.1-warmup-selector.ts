/**
 * Nodo 5.4.1: Warmup Selector (PROBABILÍSTICO - LLM)
 * 
 * Selecciona las variaciones más adecuadas para la fase warmup.
 * Se ejecuta en paralelo con 5.4.2 y 5.4.3.
 * 
 * Contexto:
 * - currentSessionContext: focus, description y systemGoal de la sesión actual
 * - scoredPool.warmup con variaciones candidatas filtradas
 * 
 * Output: selectedVariations.warmup (array de ExerciseVariation)
 */

import { TrainingGraphState, ExerciseVariation } from "../types/schemas";
import { getWarmupSelectorPrompt, getSelectorFunctionDefinition } from "../prompts/selectors";
import { callLLMWithFunctionCalling } from "../services/llm";

/**
 * Interface para la respuesta del LLM
 */
interface WarmupSelectorResponse {
  selectedVariations: Array<{ id: string }>;
}

export async function warmupSelectorNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  console.log("[Warmup Selector Node] Starting warmup variation selection...");

  // 1. Validar entrada
  if (!state.currentSessionContext) {
    throw new Error("[Warmup Selector Node] currentSessionContext is required");
  }

  if (!state.scoredPool?.warmup || state.scoredPool.warmup.length === 0) {
    console.warn("[Warmup Selector Node] No warmup variations available, returning empty array");
    return {
      selectedVariations: {
        ...state.selectedVariations,
        warmup: [],
      },
    };
  }

  const { currentSessionContext, scoredPool } = state;

  console.log("[Warmup Selector Node] Using session context:", {
    focus: currentSessionContext.focus,
  });

  // 2. Preparar variaciones para el prompt (solo los campos necesarios)
  const scoredVariations = scoredPool.warmup.map((v) => ({
    id: v.id,
    name: v.name,
    score: v.score || 0,
    tags: v.tags || [],
    disciplines: v.disciplines || [],
  }));

  // 3. Construir prompt con contexto del currentSessionContext
  const prompt = getWarmupSelectorPrompt(
    currentSessionContext.focus,
    currentSessionContext.description,
    currentSessionContext.systemGoal,
    scoredVariations
  );

  console.log("[Warmup Selector Node] Prompt constructed, variations count:", scoredVariations.length);

  // 5. Llamar al LLM con function calling
  const functionDefinition = getSelectorFunctionDefinition("warmup");

  console.log("[Warmup Selector Node] Calling LLM with function calling...");

  let llmResponse: WarmupSelectorResponse;
  try {
    llmResponse = await callLLMWithFunctionCalling<WarmupSelectorResponse>(
      prompt,
      functionDefinition
    );

    console.log("[Warmup Selector Node] LLM response received:", {
      selectedCount: llmResponse.selectedVariations?.length || 0,
    });
  } catch (error) {
    console.error("[Warmup Selector Node] LLM call failed:", error);
    throw new Error(
      `[Warmup Selector Node] Failed to select warmup variations: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  // 6. Mapear IDs seleccionados a ExerciseVariation completas
  const selectedIds = new Set(
    llmResponse.selectedVariations.map((v) => v.id)
  );
  
  const selectedVariations: ExerciseVariation[] = scoredPool.warmup.filter(
    (v) => selectedIds.has(v.id)
  );

  if (selectedVariations.length === 0) {
    throw new Error(
      "[Warmup Selector Node] No valid variations found for selected IDs"
    );
  }

  console.log("[Warmup Selector Node] Warmup variations selected successfully:", {
    count: selectedVariations.length,
    variations: selectedVariations.map((v) => v.name),
  });

  // 7. Retornar selectedVariations.warmup
  // Inicializar explícitamente todas las fases para evitar dependencia del estado previo
  return {
    selectedVariations: {
      warmup: selectedVariations,
      workout: [], // Inicializar vacío explícitamente
      cooldown: [], // Inicializar vacío explícitamente
    },
  };
}

