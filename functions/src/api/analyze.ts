/**
 * HTTP endpoint for analysis queries
 * Validates authentication and executes LangGraph workflow
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import cors from "cors";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const corsHandler = cors({ origin: true });

export const analyzeQuery = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      // Validate request method
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Extract and validate auth token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];

      // Verify token and extract userId
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        res.status(401).json({ error: "Unauthorized: Invalid token" });
        return;
      }

      const userId = decodedToken.uid;
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        res.status(400).json({ error: "Bad request: 'query' field is required" });
        return;
      }

      // Import workflow dynamically to avoid circular dependencies
      const { executeWorkflow } = await import("../graph/workflow");
      
      // Execute LangGraph workflow
      const result = await executeWorkflow({
        userId,
        userQuery: query,
        messages: [],
        currentStep: "router",
      });

      // Return response
      res.status(200).json({
        visualizationSpec: result.visualizationSpec,
        insights: result.analysis?.insights || [],
        recommendations: result.analysis?.recommendations || [],
        needsClarification: result.needsClarification || false,
        clarificationQuestion: result.clarificationQuestion,
      });
    } catch (error) {
      console.error("Error in analyzeQuery:", error);
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
});

