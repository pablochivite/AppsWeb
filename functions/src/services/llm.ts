/**
 * LLM Service
 * 
 * Centralized service for initializing and using LLM clients.
 * Uses OpenAI via LangChain for function calling.
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

/**
 * Initialize OpenAI Chat Model
 * Uses environment variable OPENAI_API_KEY
 */
export function getLLMClient(model: string = "gpt-4o-mini"): ChatOpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Please set it in your .env file or environment variables."
    );
  }

  return new ChatOpenAI({
    model: model,
    temperature: 0.7,
    openAIApiKey: apiKey,
  });
}

/**
 * Call LLM with function/tool calling
 * 
 * @param prompt - The prompt string to send to the LLM
 * @param functionDefinition - JSON schema for function calling
 * @param model - Model name (default: gpt-4o-mini)
 * @returns The parsed function call result
 */
export async function callLLMWithFunctionCalling<T = any>(
  prompt: string,
  functionDefinition: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  },
  model: string = "gpt-4o-mini"
): Promise<T> {
  const llm = getLLMClient(model);
  
  // Bind the function definition to the LLM using bindTools
  // In @langchain/openai v0.3+, bindTools accepts an array of tool definitions
  const llmWithFunction = llm.bindTools([
    {
      type: "function" as const,
      function: {
        name: functionDefinition.name,
        description: functionDefinition.description,
        parameters: functionDefinition.parameters,
      },
    },
  ]);

  // Create the prompt message
  const messages = [new HumanMessage(prompt)];

  // Call the LLM
  const response = await llmWithFunction.invoke(messages);

  // Extract tool calls from the response
  // In LangChain, tool_calls is an array on the message
  const toolCalls = response.tool_calls || [];
  
  if (toolCalls.length === 0) {
    // If no tool calls, check if there's content in the response
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
    throw new Error(
      `LLM did not call the function ${functionDefinition.name}. Response: ${content}`
    );
  }

  // Get the first tool call (should be our function)
  const toolCall = toolCalls[0];
  
  if (toolCall.name !== functionDefinition.name) {
    throw new Error(
      `Expected function call to ${functionDefinition.name}, but got ${toolCall.name}`
    );
  }

  // Parse the arguments from the tool call
  // toolCall.args should contain the parsed JSON arguments
  const args = toolCall.args;
  
  if (!args) {
    throw new Error(
      `Function call to ${functionDefinition.name} returned no arguments`
    );
  }
  
  return args as T;
}

