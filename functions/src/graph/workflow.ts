/**
 * LangGraph Workflow
 * Executes the agent workflow step by step
 * Note: Simplified implementation that executes nodes sequentially
 * based on the current step in the state
 */

import { AgentState, AgentStateSchema } from "./agent-state";
import { routerNode } from "./nodes/router-node";
import { fetchDataNode } from "./nodes/fetch-data-node";
import { analysisNode } from "./nodes/analysis-node";
import { visualizationNode } from "./nodes/visualization-node";

/**
 * Execute the workflow with initial state
 * This implements a simple state machine that executes nodes based on currentStep
 */
export async function executeWorkflow(initialState: Partial<AgentState>): Promise<AgentState> {
  // Validate initial state with Zod
  let state = AgentStateSchema.parse(initialState);

  // Execute workflow step by step
  while (state.currentStep !== "complete") {
    try {
      switch (state.currentStep) {
        case "router":
          {
            const routerResult = await routerNode(state);
            state = { ...state, ...routerResult };
            
            // If needs clarification or route is not analysis, stop
            if (state.needsClarification || state.route !== "analysis") {
              state.currentStep = "complete";
            }
          }
          break;

        case "fetch_data":
          {
            const fetchResult = await fetchDataNode(state);
            state = { ...state, ...fetchResult };
          }
          break;

        case "analyze":
          {
            const analysisResult = await analysisNode(state);
            state = { ...state, ...analysisResult };
          }
          break;

        case "visualize":
          {
            const visualizationResult = await visualizationNode(state);
            state = { ...state, ...visualizationResult };
          }
          break;

        default:
          state.currentStep = "complete";
          break;
      }
    } catch (error) {
      console.error(`Error in workflow step ${state.currentStep}:`, error);
      // Stop execution on error
      state.currentStep = "complete";
    }
  }

  // Validate final state
  return AgentStateSchema.parse(state);
}

