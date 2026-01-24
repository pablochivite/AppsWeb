/**
 * Analysis Node
 * Analyzes training data using LLM and validates with Zod
 */

import { AgentState } from "../agent-state";
import { analyzeData } from "../../services/openai-service";

export async function analysisNode(state: AgentState): Promise<Partial<AgentState>> {
  try {
    if (!state.analyticsData) {
      throw new Error("Analytics data not available");
    }

    // Analyze data with LLM
    const analysis = await analyzeData(
      {
        completedSessions: state.analyticsData.completedSessions || [],
        milestones: state.analyticsData.milestones || [],
        baselineAssessment: state.analyticsData.baselineAssessment || null,
      },
      state.userQuery
    );

    // Add assistant message with insights
    const insightsMessage = analysis.insights.join("\n");
    const updatedMessages = [
      ...state.messages,
      {
        role: "assistant" as const,
        content: insightsMessage,
      },
    ];

    return {
      analysis,
      currentStep: "visualize",
      messages: updatedMessages,
    };
  } catch (error) {
    console.error("Error in analysis node:", error);
    // Return default analysis on error
    return {
      analysis: {
        insights: ["No se pudieron analizar los datos en este momento."],
        metrics: {},
        recommendations: ["Intenta de nuevo más tarde."],
      },
      currentStep: "visualize",
    };
  }
}

