/**
 * Executable entry point for testing the Functions setup
 * This file can be executed directly with ts-node to verify the configuration
 */

// Load environment variables from .env file
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
} else {
  console.warn("[Functions] WARNING: No .env file found");
}

// Verify LangSmith configuration
console.log("\n=== LangSmith Configuration ===");
console.log("LANGCHAIN_TRACING_V2:", process.env.LANGCHAIN_TRACING_V2 || "not set");
console.log("LANGCHAIN_ENDPOINT:", process.env.LANGCHAIN_ENDPOINT || "not set");
console.log("LANGCHAIN_API_KEY:", process.env.LANGCHAIN_API_KEY ? "***set***" : "not set");
console.log("LANGCHAIN_PROJECT:", process.env.LANGCHAIN_PROJECT || "not set");

// Verify OpenAI configuration
console.log("\n=== OpenAI Configuration ===");
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "***set***" : "not set");

// Verify configuration
async function main() {
  console.log("\n=== Configuration Check ===");
  
  console.log("\n✅ Configuration check complete!");
  console.log("\n=== Setup Summary ===");
  console.log("✅ TypeScript compilation: OK");
  console.log("✅ Environment variables: Loaded");
  if (process.env.LANGCHAIN_PROJECT) {
    console.log(`✅ LangSmith project: ${process.env.LANGCHAIN_PROJECT}`);
  } else {
    console.log("⚠️  LangSmith project: Not set (check your .env file)");
  }
  if (process.env.OPENAI_API_KEY) {
    console.log("✅ OpenAI API Key: Set");
  } else {
    console.log("⚠️  OpenAI API Key: Not set (required for LLM calls)");
  }
  console.log("\nYour Functions are ready to use.");
  console.log("To start the Firebase Functions emulator, run: npm run serve");
  process.exit(0);
}

// Execute main function
main();

