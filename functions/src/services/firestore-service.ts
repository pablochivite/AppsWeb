/**
 * Firestore Service
 * Provides access to Firestore using firebase-admin
 */

import * as admin from "firebase-admin";
import { CompletedSession, Milestone } from "../types/agent.types";

// Initialize Firestore
const db = admin.firestore();

/**
 * Get completed sessions for a user within a time range
 */
export async function getCompletedSessions(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<CompletedSession[]> {
  try {
    const sessionsRef = db
      .collection("users")
      .doc(userId)
      .collection("completedSessions");

    let query: admin.firestore.Query = sessionsRef.orderBy("completedAt", "desc");

    if (startDate) {
      query = query.where("completedAt", ">=", admin.firestore.Timestamp.fromDate(startDate));
    }

    if (endDate) {
      query = query.where("completedAt", "<=", admin.firestore.Timestamp.fromDate(endDate));
    }

    const snapshot = await query.get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date || "",
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt || "",
        metricsSummary: data.metricsSummary || {
          mobility: 0,
          rotation: 0,
          flexibility: 0,
        },
        workout: data.workout || "",
        discipline: data.discipline || "",
      };
    });
  } catch (error) {
    console.error("Error fetching completed sessions:", error);
    throw new Error(`Failed to fetch completed sessions: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get milestones for a user
 */
export async function getMilestones(userId: string): Promise<Milestone[]> {
  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return [];
    }

    const userData = userDoc.data();
    const currentMilestones = userData?.currentMilestones || {};

    // Convert nested object to array
    const milestones: Milestone[] = [];

    for (const [exerciseId, variations] of Object.entries(currentMilestones)) {
      if (variations && typeof variations === "object") {
        for (const [variationId, sessionCount] of Object.entries(variations as Record<string, number>)) {
          milestones.push({
            exerciseId,
            variationId,
            sessionCount: typeof sessionCount === "number" ? sessionCount : 0,
          });
        }
      }
    }

    return milestones;
  } catch (error) {
    console.error("Error fetching milestones:", error);
    throw new Error(`Failed to fetch milestones: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get baseline assessment for a user
 */
export async function getBaselineAssessment(userId: string): Promise<any> {
  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();
    return userData?.baselineAssessment || null;
  } catch (error) {
    console.error("Error fetching baseline assessment:", error);
    throw new Error(`Failed to fetch baseline assessment: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get training systems for a user
 */
export async function getTrainingSystems(userId: string): Promise<any[]> {
  try {
    const systemsRef = db
      .collection("users")
      .doc(userId)
      .collection("trainingSystems");

    const snapshot = await systemsRef.orderBy("createdAt", "desc").limit(10).get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching training systems:", error);
    throw new Error(`Failed to fetch training systems: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

