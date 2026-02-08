/**
 * Workout Generation Workflow Executor
 * 
 * This module provides the main entry point for executing the workout generation workflow.
 * It wraps the LangGraph workflow and provides a clean interface for the API.
 */

import { createTrainingGraph } from "./workflow";
import { TrainingGraphState, TrainingSession } from "../types/schemas";

export interface WorkoutWorkflowInput {
  userId: string;
  requestType: "weekly" | "daily" | "session";
}

export interface WorkoutWorkflowOutput {
  result?: {
    sessions: TrainingSession[];
  };
  error?: string;
  requestType: string;
}

/**
 * Execute the workout generation workflow
 */
export async function executeWorkoutWorkflow(
  input: WorkoutWorkflowInput
): Promise<WorkoutWorkflowOutput> {
  try {
    // Create the compiled graph
    const graph = createTrainingGraph();

    // Initialize the state with the input data
    // The contextLoaderNode will load the full user profile and variations
    // It needs at least the uid to work, which we provide in userProfile.uid
    const initialState: Partial<TrainingGraphState> = {
      userProfile: {
        uid: input.userId,
        metrics: { mobility: 0, flexibility: 0, rotation: 0 },
        discomforts: [],
        objectives: [],
        preferredDisciplines: [],
      } as any, // Will be replaced by contextLoaderNode with real data
      availableVariations: [], // Will be loaded by contextLoaderNode
      initialBlacklist: [], // Will be loaded by contextLoaderNode
      weeklyPlan: null,
      finalSessions: [],
      currentDayIndex: 0,
      sessionUsedIds: [],
      scoredPool: {
        warmup: [],
        workout: [],
        cooldown: [],
      },
      selectedVariations: {
        warmup: [],
        workout: [],
        cooldown: [],
      },
    };

    console.log("[Workout Workflow] Starting workflow execution", {
      userId: input.userId,
      requestType: input.requestType,
    });

    // Execute the workflow
    const finalState = await graph.invoke(initialState, {
      recursionLimit: 50,
    });

    console.log("[Workout Workflow] Workflow execution completed", {
      sessionsGenerated: finalState.finalSessions?.length || 0,
      hasWeeklyPlan: !!finalState.weeklyPlan,
    });

    // Transform the result to match the expected output format
    return {
      result: {
        sessions: finalState.finalSessions || [],
      },
      requestType: input.requestType,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Workout Workflow] Error executing workflow:", errorMessage);
    
    if (error instanceof Error && error.stack) {
      console.error("[Workout Workflow] Error stack:", error.stack);
    }
    
    return {
      error: errorMessage,
      requestType: input.requestType,
    };
  }
}

