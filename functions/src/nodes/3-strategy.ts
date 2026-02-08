/**
 * Nodo 3: Strategy (PROBABILÍSTICO - LLM)
 * 
 * Genera el WeeklyPlan basándose en el perfil del usuario.
 * Hace una llamada al LLM para que esboce profesionalmente el WeeklyPlan.
 * 
 * Flujo:
 * 1. Se inyectan los datos del usuario en el prompt
 * 2. LLM call con la definición del JSON schema
 * 3. Post-processing: leer trainingDays y calcular startDate con la fecha actual
 * 4. Validación del WeeklyPlan completo
 * 
 * Input: userProfile (4 campos: metrics, discomforts, objectives, preferredDisciplines)
 * Output: WeeklyPlan (5 campos: totalTrainingDays, trainingDays, startDate, goalDescription, schedule)
 */

import { TrainingGraphState, WeeklyPlan } from "../types/schemas";
import { getStrategyPrompt, getStrategyFunctionDefinition } from "../prompts/strategy";
import { callLLMWithFunctionCalling } from "../services/llm";
import { calculateStartDate, formatDate } from "../utils/date-helpers";
import { validateWeeklyPlan } from "../utils/weekly-plan-validator";

/**
 * Interface for LLM response (without startDate)
 */
interface WeeklyPlanWithoutStartDate {
  totalTrainingDays: number;
  trainingDays: number[];
  goalDescription: string;
  schedule: Array<{
    dayIndex: number;
    focus: string;
    description: string;
    systemGoal: string;
  }>;
}

export async function strategyNode(
  state: TrainingGraphState
): Promise<Partial<TrainingGraphState>> {
  console.log("[Strategy Node] Starting WeeklyPlan generation...");

  // 1. Validar entrada
  if (!state.userProfile) {
    throw new Error("[Strategy Node] userProfile is required");
  }

  const { userProfile } = state;

  // Validar campos requeridos del userProfile
  if (!userProfile.metrics) {
    throw new Error("[Strategy Node] userProfile.metrics is required");
  }

  if (!userProfile.discomforts) {
    throw new Error("[Strategy Node] userProfile.discomforts is required");
  }

  if (!userProfile.objectives) {
    throw new Error("[Strategy Node] userProfile.objectives is required");
  }

  if (!userProfile.preferredDisciplines) {
    throw new Error("[Strategy Node] userProfile.preferredDisciplines is required");
  }

  console.log("[Strategy Node] User profile validated:", {
    hasMetrics: !!userProfile.metrics,
    discomfortsCount: userProfile.discomforts.length,
    objectivesCount: userProfile.objectives.length,
    preferredDisciplinesCount: userProfile.preferredDisciplines.length,
  });

  // 2. Construir prompt con datos del usuario
  const prompt = getStrategyPrompt({
    metrics: userProfile.metrics,
    discomforts: userProfile.discomforts,
    objectives: userProfile.objectives,
    preferredDisciplines: userProfile.preferredDisciplines,
  });

  console.log("[Strategy Node] Prompt constructed, length:", prompt.length);

  // 3. Llamar al LLM con function calling
  const functionDefinition = getStrategyFunctionDefinition();
  
  console.log("[Strategy Node] Calling LLM with function calling...");
  
  let llmResponse: WeeklyPlanWithoutStartDate;
  try {
    llmResponse = await callLLMWithFunctionCalling<WeeklyPlanWithoutStartDate>(
      prompt,
      functionDefinition
    );
    
    console.log("[Strategy Node] LLM response received:", {
      totalTrainingDays: llmResponse.totalTrainingDays,
      trainingDays: llmResponse.trainingDays,
      scheduleLength: llmResponse.schedule?.length || 0,
    });
  } catch (error) {
    console.error("[Strategy Node] LLM call failed:", error);
    throw new Error(
      `[Strategy Node] Failed to generate WeeklyPlan: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  // 4. Post-processing: calcular startDate basado en trainingDays y fecha actual
  console.log("[Strategy Node] Calculating startDate...");
  
  let startDate: Date;
  try {
    startDate = calculateStartDate(llmResponse.trainingDays);
    console.log("[Strategy Node] Start date calculated:", formatDate(startDate));
  } catch (error) {
    console.error("[Strategy Node] Failed to calculate startDate:", error);
    throw new Error(
      `[Strategy Node] Failed to calculate startDate: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  // 5. Construir WeeklyPlan completo
  const weeklyPlan: WeeklyPlan = {
    totalTrainingDays: llmResponse.totalTrainingDays,
    trainingDays: llmResponse.trainingDays,
    startDate: formatDate(startDate),
    goalDescription: llmResponse.goalDescription,
    schedule: llmResponse.schedule,
  };

  // 6. Validaciones
  console.log("[Strategy Node] Validating WeeklyPlan...");
  
  try {
    validateWeeklyPlan(weeklyPlan);
    console.log("[Strategy Node] WeeklyPlan validation passed");
  } catch (error) {
    console.error("[Strategy Node] WeeklyPlan validation failed:", error);
    throw new Error(
      `[Strategy Node] WeeklyPlan validation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  console.log("[Strategy Node] WeeklyPlan generated successfully:", {
    totalTrainingDays: weeklyPlan.totalTrainingDays,
    trainingDays: weeklyPlan.trainingDays,
    startDate: weeklyPlan.startDate,
    scheduleLength: weeklyPlan.schedule.length,
  });

  return {
    weeklyPlan,
  };
}

