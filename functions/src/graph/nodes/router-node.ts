/**
 * Router Node
 * Uses semantic LLM classification to determine user intent
 * NO regex - uses LLM for semantic understanding
 */

import { AgentState } from "../agent-state";
import { classifyIntent } from "../../services/openai-service";

export async function routerNode(state: AgentState): Promise<Partial<AgentState>> {
  try {
    // Use LLM to classify intent semantically
    const route = await classifyIntent(state.userQuery);

    // Add user message to history
    const updatedMessages = [
      ...state.messages,
      {
        role: "user" as const,
        content: state.userQuery,
      },
    ];

    // Determine next step based on route
    let currentStep: AgentState["currentStep"] = "complete";
    let needsClarification = false;
    let clarificationQuestion: string | undefined;

    if (route === "analysis") {
      currentStep = "fetch_data";
    } else if (route === "training") {
      // Training requests are handled by existing aiService
      currentStep = "complete";
    } else if (route === "clarification") {
      needsClarification = true;
      clarificationQuestion = "¿Podrías ser más específico sobre qué quieres analizar? Por ejemplo: '¿Cómo va mi progreso en pecho este mes?'";
      currentStep = "complete";
    }

    return {
      route,
      currentStep,
      needsClarification,
      clarificationQuestion,
      messages: updatedMessages,
    };
  } catch (error) {
    console.error("Error in router node:", error);
    // Default to analysis on error
    return {
      route: "analysis",
      currentStep: "fetch_data",
      messages: [
        ...state.messages,
        {
          role: "user" as const,
          content: state.userQuery,
        },
      ],
    };
  }
}

