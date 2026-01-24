/**
 * Visualization Node
 * Generates Chart.js specification using LLM based on analysis metrics
 */

import { AgentState } from "../agent-state";
import { generateChartSpec } from "../../services/openai-service";

export async function visualizationNode(state: AgentState): Promise<Partial<AgentState>> {
  try {
    if (!state.analysis || !state.analysis.metrics) {
      // No metrics to visualize
      return {
        currentStep: "complete",
      };
    }

    // Generate Chart.js specification
    const visualizationSpec = await generateChartSpec(
      state.analysis.metrics,
      state.userQuery
    );

    return {
      visualizationSpec,
      currentStep: "complete",
    };
  } catch (error) {
    console.error("Error in visualization node:", error);
    // Return default visualization on error
    if (state.analysis?.metrics) {
      return {
        visualizationSpec: {
          type: "line" as const,
          data: {
            labels: Object.keys(state.analysis.metrics),
            datasets: [
              {
                label: "Métricas",
                data: Object.values(state.analysis.metrics),
                backgroundColor: "rgba(54, 162, 235, 0.2)",
                borderColor: "rgba(54, 162, 235, 1)",
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: "Análisis de Progreso",
              },
              legend: {
                display: true,
              },
            },
          },
        },
        currentStep: "complete",
      };
    }

    return {
      currentStep: "complete",
    };
  }
}

