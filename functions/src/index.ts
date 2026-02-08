/**
 * Cloud Functions Entry Point
 * Exports HTTP functions for Workout Generation
 */

// Load environment variables from .env file (for emulator)
// This must be at the top, before any other imports that might use env vars
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Try to load .env from functions directory first, then from project root
const functionsEnvPath = path.join(__dirname, "..", ".env");
const rootEnvPath = path.join(__dirname, "..", "..", ".env");

// Load .env files (functions/.env takes precedence)
if (fs.existsSync(functionsEnvPath)) {
  dotenv.config({ path: functionsEnvPath });
  console.log("[Functions] Loaded .env from functions/.env");
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
  console.log("[Functions] Loaded .env from project root");
}

// Also check for OPENAI_API_KEY from process.env (set by emulator script)
if (process.env.OPENAI_API_KEY) {
  console.log("[Functions] OPENAI_API_KEY found in process.env");
} else {
  console.warn("[Functions] WARNING: OPENAI_API_KEY not found in process.env");
}

export { generateWorkout } from "./api/generate-workout";

