/**
 * HTTP endpoint for workout generation
 * 
 * This endpoint executes the LangGraph workflow to generate workout sessions
 * based on the user's profile and preferences.
 */

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { initializeFirebaseAdmin } from "../utils/admin-init";

// Initialize Firebase Admin with emulator support
initializeFirebaseAdmin();

// Define secrets and environment variables for Firebase Functions v2
let langchainApiKey: ReturnType<typeof defineSecret>;
let langchainTracingV2: ReturnType<typeof defineString>;
let langchainEndpoint: ReturnType<typeof defineString>;
let langchainProject: ReturnType<typeof defineString>;

try {
  langchainApiKey = defineSecret("LANGCHAIN_API_KEY");
  langchainTracingV2 = defineString("LANGCHAIN_TRACING_V2", { default: "true" });
  langchainEndpoint = defineString("LANGCHAIN_ENDPOINT", { 
    default: "https://api.smith.langchain.com" 
  });
  langchainProject = defineString("LANGCHAIN_PROJECT", { default: "Regain" });
} catch (error) {
  console.log("[Generate Workout] Using process.env for LangSmith configuration (development mode)");
  langchainApiKey = { value: () => process.env.LANGCHAIN_API_KEY } as any;
  langchainTracingV2 = { value: () => process.env.LANGCHAIN_TRACING_V2 || "true" } as any;
  langchainEndpoint = { value: () => process.env.LANGCHAIN_ENDPOINT || "https://api.smith.langchain.com" } as any;
  langchainProject = { value: () => process.env.LANGCHAIN_PROJECT || "Regain" } as any;
}

// Helper function to get LangSmith config
function getLangSmithConfig() {
  try {
    const apiKeyFromSecret = langchainApiKey?.value?.();
    const apiKeyFromEnv = process.env.LANGCHAIN_API_KEY;
    
    return {
      apiKey: apiKeyFromSecret || apiKeyFromEnv,
      tracingV2: langchainTracingV2?.value?.() || process.env.LANGCHAIN_TRACING_V2 || "true",
      endpoint: langchainEndpoint?.value?.() || process.env.LANGCHAIN_ENDPOINT || "https://api.smith.langchain.com",
      project: langchainProject?.value?.() || process.env.LANGCHAIN_PROJECT || "Regain",
    };
  } catch (error) {
    return {
      apiKey: process.env.LANGCHAIN_API_KEY,
      tracingV2: process.env.LANGCHAIN_TRACING_V2 || "true",
      endpoint: process.env.LANGCHAIN_ENDPOINT || "https://api.smith.langchain.com",
      project: process.env.LANGCHAIN_PROJECT || "Regain",
    };
  }
}

console.log("[Generate Workout] LangSmith Configuration Setup:");
console.log("  LANGCHAIN_TRACING_V2:", process.env.LANGCHAIN_TRACING_V2 || "will be set at runtime");
console.log("  LANGCHAIN_ENDPOINT:", process.env.LANGCHAIN_ENDPOINT || "will be set at runtime");
console.log("  LANGCHAIN_PROJECT:", process.env.LANGCHAIN_PROJECT || "will be set at runtime");
console.log("  LANGCHAIN_API_KEY:", process.env.LANGCHAIN_API_KEY ? "***set (from .env)***" : "will be set at runtime from secret");

export const generateWorkout = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 3600,
    memory: "512MiB",
    maxInstances: 10,
    cors: true,
  },
  async (req, res) => {
    let userId: string | undefined;

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
          userId = decodedToken.uid;
        } catch (error) {
          res.status(401).json({ error: "Unauthorized: Invalid token" });
          return;
        }

        const { requestType } = req.body;

        console.log("[Generate Workout] Starting workflow for user:", userId);
        console.log("[Generate Workout] Request type:", requestType);
        
        // Set LangSmith environment variables at runtime
        const runtimeConfig = getLangSmithConfig();
        
        if (runtimeConfig.apiKey) {
          process.env.LANGCHAIN_API_KEY = runtimeConfig.apiKey;
        }
        if (runtimeConfig.tracingV2) {
          process.env.LANGCHAIN_TRACING_V2 = runtimeConfig.tracingV2;
        }
        if (runtimeConfig.endpoint) {
          process.env.LANGCHAIN_ENDPOINT = runtimeConfig.endpoint;
        }
        if (runtimeConfig.project) {
          process.env.LANGCHAIN_PROJECT = runtimeConfig.project;
        }

        console.log("[Generate Workout] LangSmith Tracing Status:", {
          tracingEnabled: process.env.LANGCHAIN_TRACING_V2 === "true",
          hasApiKey: !!runtimeConfig.apiKey,
          project: runtimeConfig.project,
          endpoint: runtimeConfig.endpoint,
        });
        
        if (!runtimeConfig.apiKey) {
          console.warn("[Generate Workout] ⚠️  WARNING: LANGCHAIN_API_KEY not available. LangGraph tracing will not work.");
        } else {
          console.log("[Generate Workout] ✅ LangSmith environment variables configured for tracing");
        }

        // Import workflow dynamically
        const { executeWorkoutWorkflow } = await import("../graph/workout-generation-workflow");

        // Execute LangGraph workflow
        const startTime = Date.now();
        const result = await executeWorkoutWorkflow({
          userId,
          requestType: requestType || "weekly",
        });
        const duration = Date.now() - startTime;

        console.log("[Generate Workout] Workflow completed", {
          duration: `${duration}ms`,
          sessionsGenerated: result.result?.sessions?.length || 0,
          hasError: !!result.error,
        });

        // Return response
        if (result.error) {
          console.error("[Generate Workout] Workflow error:", result.error);
          res.status(500).json({
            error: "Workout generation failed",
            message: result.error,
          });
        } else {
          console.log("[Generate Workout] Success");
          res.status(200).json({
            sessions: result.result?.sessions || [],
            requestType: result.requestType,
          });
        }
      } catch (error) {
        console.error("[Generate Workout] Error in generateWorkout:", error);
        console.error("[Generate Workout] Error details:", {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          userId: userId || "unknown",
        });
        res.status(500).json({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
);
