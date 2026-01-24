/**
 * TypeScript types for the LangGraph Agent
 */

import { AgentState } from "../graph/agent-state";

export type { AgentState };

export interface AnalysisResult {
  insights: string[];
  metrics: Record<string, number>;
  recommendations: string[];
}

export interface VisualizationSpec {
  type: "line" | "bar" | "pie" | "radar";
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string;
    }>;
  };
  options: Record<string, any>;
}

export interface CompletedSession {
  id: string;
  date: string;
  completedAt: string;
  metricsSummary: {
    mobility: number;
    rotation: number;
    flexibility: number;
  };
  workout: string;
  discipline: string;
}

export interface Milestone {
  exerciseId: string;
  variationId: string;
  sessionCount: number;
  lastCompletedAt?: string;
}

