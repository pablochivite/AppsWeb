/**
 * LangGraph Workflow Definition
 * 
 * Main workflow file for the training generation graph.
 * Define todos los nodos y sus conexiones (edges).
 */

import { StateGraph } from "@langchain/langgraph";
import { TrainingGraphState } from "../types/schemas";

// Importar todos los nodos
import { contextLoaderNode } from "../nodes/1-context-loader";
import { contextCleanerNode } from "../nodes/2-context-cleaner";
import { strategyNode } from "../nodes/3-strategy";
import { loopControllerNode } from "../nodes/4-loop-controller";
import { phaseOrchestratorNode } from "../nodes/5.1-phase-orchestrator";
import { filterEngineNode } from "../nodes/5.2-filter-engine";
import { variationCleanerNode } from "../nodes/5.3-variation-cleaner";
import { warmupSelectorNode } from "../nodes/5.4.1-warmup-selector";
import { workoutSelectorNode } from "../nodes/5.4.2-workout-selector";
import { cooldownSelectorNode } from "../nodes/5.4.3-cooldown-selector";
import { assemblerNode } from "../nodes/6-assembler";
import { invalidatorNode } from "../nodes/7-invalidator";
import { persistenceNode } from "../nodes/8-persistence";

/**
 * Crea y configura el grafo de LangGraph para la generación de entrenamientos
 */
export function createTrainingGraph() {
  const workflow = new StateGraph<TrainingGraphState>({
    channels: {
      // 1. INPUTS
      userProfile: {
        reducer: (x: TrainingGraphState["userProfile"], y: TrainingGraphState["userProfile"]) => y ?? x,
        default: () => null,
      },
      availableVariations: {
        reducer: (x: TrainingGraphState["availableVariations"], y: TrainingGraphState["availableVariations"]) => y ?? x,
        default: () => [],
      },
      
      // 2. GESTIÓN DE VARIABILIDAD
      initialBlacklist: {
        reducer: (x: TrainingGraphState["initialBlacklist"], y: TrainingGraphState["initialBlacklist"]) => y ?? x,
        default: () => [],
      },
      sessionUsedIds: {
        reducer: (x: TrainingGraphState["sessionUsedIds"], y: TrainingGraphState["sessionUsedIds"]) => {
          // Para sessionUsedIds, queremos acumular (append)
          if (!y) return x;
          if (!x) return y;
          return [...x, ...y];
        },
        default: () => [],
      },
      
      // 3. ORQUESTACIÓN
      weeklyPlan: {
        reducer: (x: TrainingGraphState["weeklyPlan"], y: TrainingGraphState["weeklyPlan"]) => y ?? x,
        default: () => null,
      },
      finalSessions: {
        reducer: (x: TrainingGraphState["finalSessions"], y: TrainingGraphState["finalSessions"]) => {
          // El nodo assembler ya construye el array completo con todas las sesiones anteriores + la nueva
          // Por lo tanto, y contiene el estado completo y debemos usarlo directamente
          // Esto evita duplicación cuando assembler ya incluye las sesiones anteriores
          if (!y) return x;
          return y;
        },
        default: () => [],
      },
      
      // 4. CONTROL DE BUCLE
      currentDayIndex: {
        reducer: (x: TrainingGraphState["currentDayIndex"], y: TrainingGraphState["currentDayIndex"]) => y ?? x,
        default: () => 0,
      },
      currentSessionContext: {
        reducer: (x: TrainingGraphState["currentSessionContext"], y: TrainingGraphState["currentSessionContext"]) => y ?? x,
        default: () => undefined,
      },
      
      // 5. POOLS Y SELECCIONES
      scoredPool: {
        reducer: (x: TrainingGraphState["scoredPool"], y: TrainingGraphState["scoredPool"]) => y ?? x,
        default: () => ({
          warmup: [],
          workout: [],
          cooldown: [],
        }),
      },
      selectedVariations: {
        reducer: (x: TrainingGraphState["selectedVariations"], y: TrainingGraphState["selectedVariations"]) => {
          // Si y es null/undefined, retornar x
          if (!y) return x;
          // Si x es null/undefined, retornar y
          if (!x) return y;
          // Fusionar propiedades de forma inteligente:
          // - Si y tiene contenido (array con elementos), usar y
          // - Si y está vacío pero x tiene contenido, preservar x
          // - Si ambos están vacíos, usar []
          return {
            warmup: (y.warmup && y.warmup.length > 0) ? y.warmup : (x.warmup && x.warmup.length > 0 ? x.warmup : []),
            workout: (y.workout && y.workout.length > 0) ? y.workout : (x.workout && x.workout.length > 0 ? x.workout : []),
            cooldown: (y.cooldown && y.cooldown.length > 0) ? y.cooldown : (x.cooldown && x.cooldown.length > 0 ? x.cooldown : []),
          };
        },
        default: () => ({
          warmup: [],
          workout: [],
          cooldown: [],
        }),
      },
    },
  });

  // Añadir todos los nodos al grafo
  // Usar 'as any' para evitar problemas de tipos con LangGraph 0.0.20
  workflow.addNode("contextLoader" as any, contextLoaderNode);
  workflow.addNode("contextCleaner" as any, contextCleanerNode);
  workflow.addNode("strategy" as any, strategyNode);
  workflow.addNode("loopController" as any, loopControllerNode);
  workflow.addNode("phaseOrchestrator" as any, phaseOrchestratorNode);
  workflow.addNode("filterEngine" as any, filterEngineNode);
  workflow.addNode("variationCleaner" as any, variationCleanerNode);
  workflow.addNode("warmupSelector" as any, warmupSelectorNode);
  workflow.addNode("workoutSelector" as any, workoutSelectorNode);
  workflow.addNode("cooldownSelector" as any, cooldownSelectorNode);
  workflow.addNode("assembler" as any, assemblerNode);
  workflow.addNode("invalidator" as any, invalidatorNode);
  workflow.addNode("persistence" as any, persistenceNode);

  // Definir el punto de entrada
  (workflow.setEntryPoint as any)("contextLoader");

  // Definir edges secuenciales (fase inicial)
  (workflow.addEdge as any)("contextLoader", "contextCleaner");
  (workflow.addEdge as any)("contextCleaner", "strategy");
  (workflow.addEdge as any)("strategy", "loopController");

  // Loop Controller tiene lógica condicional
  (workflow.addConditionalEdges as any)(
    "loopController",
    (state: TrainingGraphState) => {
      const shouldContinue =
        state.weeklyPlan &&
        state.currentDayIndex < state.weeklyPlan.totalTrainingDays;
      
      return shouldContinue ? "continue_loop" : "end_loop";
    },
    {
      continue_loop: "phaseOrchestrator",
      end_loop: "persistence",
    }
  );

  // Flujo dentro del bucle (generación de sesión)
  (workflow.addEdge as any)("phaseOrchestrator", "filterEngine");
  (workflow.addEdge as any)("filterEngine", "variationCleaner");

  // Nodos paralelos (5.4.1, 5.4.2, 5.4.3) - se ejecutan todos después de variationCleaner
  // En LangGraph, añadir múltiples edges desde el mismo nodo crea ejecución en paralelo
  (workflow.addEdge as any)("variationCleaner", "warmupSelector");
  (workflow.addEdge as any)("variationCleaner", "workoutSelector");
  (workflow.addEdge as any)("variationCleaner", "cooldownSelector");

  // Después de los selectores paralelos, todos van a assembler
  // LangGraph esperará automáticamente a que todos los selectores terminen antes de ejecutar assembler
  (workflow.addEdge as any)("warmupSelector", "assembler");
  (workflow.addEdge as any)("workoutSelector", "assembler");
  (workflow.addEdge as any)("cooldownSelector", "assembler");

  // Assembler va a invalidator
  (workflow.addEdge as any)("assembler", "invalidator");

  // Invalidator vuelve al loop controller
  (workflow.addEdge as any)("invalidator", "loopController");

  // Marcar persistence como nodo final del workflow
  // Esto evita el error "dead-end" ya que persistence es intencionalmente el punto de terminación
  (workflow.setFinishPoint as any)("persistence");

  // Compilar y retornar el grafo
  return workflow.compile();
}
