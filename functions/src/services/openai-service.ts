/**
 * OpenAI Service
 * Provides LLM functionality using OpenAI API
 */

import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import * as functions from "firebase-functions";

// Initialize OpenAI client
let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    const apiKey = functions.config().openai?.key || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in environment or Firebase config.");
    }

    llm = new ChatOpenAI({
      modelName: "gpt-4-turbo-preview",
      temperature: 0.7,
      openAIApiKey: apiKey,
      configuration: {
        // Support for structured outputs if needed
      },
    });
  }
  return llm;
}

/**
 * Generic LLM call wrapper
 */
export async function callLLM(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options?: {
    temperature?: number;
    responseFormat?: "json_object" | "text";
  }
): Promise<string> {
  try {
    const chatModel = getLLM();
    
    // Convert messages to LangChain format
    const formattedMessages = messages.map((msg) => {
      if (msg.role === "system") {
        return { role: "system", content: msg.content };
      } else if (msg.role === "user") {
        return { role: "user", content: msg.content };
      } else {
        return { role: "assistant", content: msg.content };
      }
    });

    // Invoke with proper message format
    const response = await chatModel.invoke(formattedMessages);
    
    // Extract content from response
    if (typeof response.content === "string") {
      return response.content;
    } else if (response.content && typeof response.content === "object") {
      return JSON.stringify(response.content);
    } else {
      return String(response.content);
    }
  } catch (error) {
    console.error("Error calling LLM:", error);
    throw new Error(`LLM call failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Classify user intent using LLM
 * Returns: 'analysis', 'training', or 'clarification'
 */
export async function classifyIntent(query: string): Promise<"analysis" | "training" | "clarification"> {
  const prompt = `Clasifica esta consulta del usuario sobre su entrenamiento. Responde SOLO con una de estas opciones: 'analysis', 'training', o 'clarification'.

Reglas:
- 'analysis': Si pregunta sobre progreso, gráficos, estadísticas, evolución, métricas, o cómo va su entrenamiento
- 'training': Si solicita generar un plan, crear entrenamiento, o modificar su sistema de entrenamiento
- 'clarification': Si la consulta es ambigua o necesita más información

Consulta: "${query}"

Respuesta (solo la palabra):`;

  try {
    const response = await callLLM([
      { role: "system", content: "Eres un clasificador de intenciones. Responde solo con una palabra: analysis, training, o clarification." },
      { role: "user", content: prompt },
    ], { temperature: 0.3 });

    const cleaned = response.trim().toLowerCase();
    
    if (cleaned.includes("analysis")) {
      return "analysis";
    } else if (cleaned.includes("training")) {
      return "training";
    } else {
      return "clarification";
    }
  } catch (error) {
    console.error("Error classifying intent:", error);
    // Default to analysis if classification fails
    return "analysis";
  }
}

/**
 * Analyze training data with LLM
 */
export async function analyzeData(
  data: {
    completedSessions: any[];
    milestones: any[];
    baselineAssessment: any;
  },
  query: string
): Promise<{
  insights: string[];
  metrics: Record<string, number>;
  recommendations: string[];
}> {
  const prompt = `Eres un experto en análisis de entrenamiento y movimiento. Analiza estos datos de entrenamiento y responde la consulta del usuario.

CONSULTA DEL USuario: "${query}"

DATOS DISPONIBLES:
- Sesiones completadas: ${data.completedSessions.length}
- Milestones: ${JSON.stringify(data.milestones, null, 2)}
- Baseline Assessment: ${JSON.stringify(data.baselineAssessment, null, 2)}

Responde en formato JSON válido con esta estructura exacta:
{
  "insights": ["insight1", "insight2", ...],
  "metrics": {
    "mobility": número,
    "rotation": número,
    "flexibility": número,
    ...
  },
  "recommendations": ["recomendación1", "recomendación2", ...]
}

IMPORTANTE: Responde SOLO con JSON válido, sin texto adicional.`;

  try {
    const response = await callLLM([
      {
        role: "system",
        content: "Eres un analista de datos de entrenamiento. Responde siempre en formato JSON válido.",
      },
      { role: "user", content: prompt },
    ], { temperature: 0.7, responseFormat: "json_object" });

    // Parse and validate response
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No valid JSON found in response");
      }
    }

    // Validate structure
    const schema = z.object({
      insights: z.array(z.string()),
      metrics: z.record(z.number()),
      recommendations: z.array(z.string()),
    });

    return schema.parse(parsed);
  } catch (error) {
    console.error("Error analyzing data:", error);
    // Return default structure on error
    return {
      insights: ["No se pudieron analizar los datos en este momento."],
      metrics: {},
      recommendations: ["Intenta de nuevo más tarde."],
    };
  }
}

/**
 * Generate Chart.js specification using LLM
 */
export async function generateChartSpec(
  metrics: Record<string, number>,
  query: string
): Promise<{
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
}> {
  const prompt = `Genera una especificación JSON para Chart.js basada en estas métricas y la consulta del usuario.

CONSULTA: "${query}"

MÉTRICAS:
${JSON.stringify(metrics, null, 2)}

Responde SOLO con un objeto JSON válido con esta estructura exacta:
{
  "type": "line" | "bar" | "pie" | "radar",
  "data": {
    "labels": ["label1", "label2", ...],
    "datasets": [{
      "label": "string",
      "data": [número, número, ...],
      "backgroundColor": "color o array de colores",
      "borderColor": "color"
    }]
  },
  "options": {
    "responsive": true,
    "plugins": {
      "title": { "display": true, "text": "título del gráfico" },
      "legend": { "display": true }
    }
  }
}

IMPORTANTE: Responde SOLO con JSON válido, sin texto adicional.`;

  try {
    const response = await callLLM([
      {
        role: "system",
        content: "Eres un generador de especificaciones de gráficos Chart.js. Responde siempre en formato JSON válido.",
      },
      { role: "user", content: prompt },
    ], { temperature: 0.5, responseFormat: "json_object" });

    // Parse and validate response
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No valid JSON found in response");
      }
    }

    // Validate structure
    const schema = z.object({
      type: z.enum(["line", "bar", "pie", "radar"]),
      data: z.object({
        labels: z.array(z.string()),
        datasets: z.array(
          z.object({
            label: z.string(),
            data: z.array(z.number()),
            backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
            borderColor: z.string().optional(),
          })
        ),
      }),
      options: z.record(z.any()),
    });

    return schema.parse(parsed);
  } catch (error) {
    console.error("Error generating chart spec:", error);
    // Return default chart spec on error
    return {
      type: "line",
      data: {
        labels: Object.keys(metrics),
        datasets: [
          {
            label: "Métricas",
            data: Object.values(metrics),
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
    };
  }
}

