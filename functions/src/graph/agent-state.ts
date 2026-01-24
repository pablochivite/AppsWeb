/**
 * Agent State Schema with Zod Validation
 * Defines the structure and validation for the LangGraph agent state
 */

import { z } from "zod";

export const AgentStateSchema = z.object({
  userId: z.string(),
  userQuery: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ).default([]),
  route: z.enum(["analysis", "training", "clarification"]).optional(),
  analyticsData: z
    .object({
      completedSessions: z.array(z.any()).optional(),
      milestones: z.any().optional(),
      baselineAssessment: z.any().optional(),
    })
    .optional(),
  analysis: z
    .object({
      insights: z.array(z.string()),
      metrics: z.record(z.number()),
      recommendations: z.array(z.string()),
    })
    .optional(),
  visualizationSpec: z
    .object({
      type: z.enum(["line", "bar", "pie", "radar"]),
      data: z.any(),
      options: z.any(),
    })
    .optional(),
  currentStep: z
    .enum(["router", "fetch_data", "analyze", "visualize", "complete"])
    .default("router"),
  needsClarification: z.boolean().default(false),
  clarificationQuestion: z.string().optional(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

