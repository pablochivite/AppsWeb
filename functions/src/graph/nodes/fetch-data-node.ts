/**
 * Fetch Data Node
 * Retrieves analytics data from Firestore
 */

import { AgentState } from "../agent-state";
import {
  getCompletedSessions,
  getMilestones,
  getBaselineAssessment,
} from "../../services/firestore-service";

export async function fetchDataNode(state: AgentState): Promise<Partial<AgentState>> {
  try {
    // Calculate date range (last 3 months by default)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    // Fetch all required data in parallel
    const [completedSessions, milestones, baselineAssessment] = await Promise.all([
      getCompletedSessions(state.userId, startDate, endDate),
      getMilestones(state.userId),
      getBaselineAssessment(state.userId),
    ]);

    return {
      analyticsData: {
        completedSessions,
        milestones,
        baselineAssessment,
      },
      currentStep: "analyze",
    };
  } catch (error) {
    console.error("Error in fetch data node:", error);
    // Continue with empty data
    return {
      analyticsData: {
        completedSessions: [],
        milestones: [],
        baselineAssessment: null,
      },
      currentStep: "analyze",
    };
  }
}

