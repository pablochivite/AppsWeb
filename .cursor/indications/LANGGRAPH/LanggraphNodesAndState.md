DESCRIPCIÓN DEL GRAFO (LANGGRAPH)
Despues del Nodo 1: context loader *DETERMINISTICO*
userProfile: TODOS LOS CAMPOS
variations: TODOS LOS CAMPOS
este nodo simplemente carga los datos desde firebase y los IDs de las variaciones a omitir (luego entenderás)

Despues del nodo 2: context cleaner *DETERMINISTICO*
userProfile: 4 CAMPOS:  metrics discomforts, objectives, PreferredDiscipline, blackListedVariationIds
variations: 3 CAMPOS: Disciplines, tags phase, name
***este nodo limpia los campos del perfil y de las variaciones para que el estado sea más simple***

Después del nodo 3: strategy  *PROBABILISTICO*
Contexto: {userProfile: 4 CAMPOS:  metrics discomforts, objectives, PreferredDiscipline} —> nodo 2
WeeklyPlan: 5 CAMPOS: nº training days en el plan, qué dias se entrena, fecha de cada sesion que se va a generar, descripcion clara y propósito cada training day, descripcion clara y proposito del traning system
***este nodo hace una llamada al LLM para que esboce profesionalmente el WeeklyPlan basándose en los datos del usuario***

Después del nodo 4: Loop controller *DETERMINISTICO*
Este nodo simplemente mira si currentDayIndex<WeeklyPlan.length?
—> SÍ —>Nodo 5.1
—> NO—> END
***este nodo controla el bucle para que genere el mismo numero de sesiones que training days hay en la semana***

Después del nodo 5.1: Phase Orchestrator  *PROBABILISTICO*
Contexto: {WeeklyPlan:  descripcion clara y propósito del training day en currentDayIndex, descripcion clara y proposito del traning system} y lista de todos los tags (un campo de las variaciones) disponibles en tu BD.
LLM selecciona Tags adecuados para esa sesión
***este nodo hace una llamada al LLM para que seleccione las tags que han de poseer las variaciones en base a las características especificada en el campo que describe esta sesión (donde la fecha de la sesión coincide con currentDayIndex) en WeeklyPlan***

Después del nodo 5.2: Filter Engine *DETERMINISTICO*
Toma lista de variaciones excepto las que coinciden con initialBlacklist **VARIABILIDAD INTERSEMANAL**

La lógica antes de ejecutar paso A y B:

// Pseudo-código mental para el Nodo 5.2
const variacionesCandidatas = allVariations.filter(variation => {
// 1. ¿La usé la semana pasada? (initialBlacklist)
if (state.initialBlacklist.includes([variation.id](variation.id)) return false;

// 2. ¿La he usado ya esta semana (ayer o antes de ayer)? (sessionUsedIds)
if (state.sessionUsedIds.includes([variation.id](variation.id)) return false;

return true;
});
5.2 A—> Hard Filter—>filtra por fase
5.2 B—> Scoring filter —> js Fuzzy logic —> asigna una puntuacion a las tags que dio el LLM en 5.1. Las variaciones cuyas tags más coincidan con las que seleccionó el LLM tendrán score más alto
***este nodo devuelve un json con separación por fases donde cada fase contiene las variaciones con las puntuaciones***

Después del nodo 5.3: Variation cleaner *DETERMINISTICO*
Descarta las variaciones con mala puntuación
***este nodo devuelve el mismo json que en el nodo anterior pero sin las variaciones que no nos sirven, para no saturar la ventana de contexto al LLM en el próximo nodo***

Después del nodo 5.4.1: Selector warmup *PROBABILISTICO*
Contexto: Contexto: {WeeklyPlan:  descripcion clara y propósito del training day en currentDayIndex, descripcion clara y proposito del traning system} + prompt de cómo es la fase warmup y se le explica como van las scores
Selecciona las variaciones más adecuadas para la fase warmup
***estos nodos 5.4.1, 5.4.2 y 5.4.3 se ejecutan en paralelo. El 5.4.1 hace una llamada al LLM para que seleccione las variaciones adecuadas para la fase warmup en base al weeklyPlan + prompt de cómo es la fase warmup***

Después del nodo 5.4.2: Selector workout *PROBABILISTICO*
Contexto: Contexto: {WeeklyPlan:  descripcion clara y propósito del training day en currentDayIndex, descripcion clara y proposito del traning system} + prompt de cómo es la fase workout y se le explica como van las scores
Selecciona las variaciones más adecuadas para la fase workout
Restricción: minimo 2 disciplinas en fase workout
***estos nodos 5.4.1, 5.4.2 y 5.4.3 se ejecutan en paralelo. El 5.4.2 hace una llamada al LLM para que seleccione las variaciones adecuadas para la fase workout en base al weeklyPlan + prompt de cómo es la fase workout***

Después del nodo 5.4.3: Selector cooldown *PROBABILISTICO*
Contexto: Contexto: {WeeklyPlan:  descripcion clara y propósito del training day en currentDayIndex, descripcion clara y proposito del traning system} + prompt de cómo es la fase cooldown y se le explica como van las scores
Selecciona las variaciones más adecuadas para la fase cooldown
***estos nodos 5.4.1, 5.4.2 y 5.4.3 se ejecutan en paralelo. El 5.4.3 hace una llamada al LLM para que seleccione las variaciones adecuadas para la fase cooldown en base al weeklyPlan + prompt de cómo es la fase cooldown***

Después del nodo 6: Assembler *DETERMINISTICO*
Session: warmup (con sus variaciones), workout (con sus variaciones), cooldown (con sus variaciones)
Añade {session} a finalSessions
***este nodo construye el objeto session que es la agregacion del output json de los nodos 5.4.1, 5.4.2 y 5.4.3. Añade el objeto session a finalSessions***

Después del nodo 7: Invalidator *DETERMINISTICO*
Identifica el 50% de las variaciones de warmup
Identifica el 50% de las variaciones de workout
Identifica el 50% de las variaciones de cooldown
Incrementa currentDayIndex +1  —> vuelve al nodo 4: loop controller hasta que currentDayIndex=WeeklyPlan.length?
***este nodo añade los ID’s del 50% de las variaciones de warmup, 50% de las variaciones de workout y 50% de las variaciones de cooldown a state.sessionUsedIds (que irá acumulando IDs cada vez que se genera una sesion y después de que se hayan terminado de generar todas las sesiones de la semana, sobreescribirá blackListedVariationIds) para seguir el principio de variabilidad y omitir usar esas variaciones en las sesiones de la próxima semana **VARIABILIDAD INTRASEMANAL**:Este nodo debe: Leer el estado actual (state.sessionUsedIds), Identificar los nuevos IDs a bloquear de la sesión recién generada (el 50% que mencionaste), Fusionar ambos arrays (Spread Operator), Retornar la lista combinada completa.***

Al concluir la ejecución del grafo (cuando `currentDayIndex === WeeklyPlan.length`), se activa el **Protocolo de Persistencia Atómica** (Node 8). Este proceso es crítico para transformar el estado temporal de la ejecución en memoria a largo plazo." cuando currentDayIndex === WeeklyPlan.length, el contenido de blackListedVariationIds (campo en la colección users en firebase) se sustituye por sessionUsedIds (donde se han ido acumulando tras cada iteración del bucle todas las variaciones usadas en las sesiones de esta semana). O sea, sessionUserIds sobreescribe blackListedVariationIds para variabilidad intersemanal. La proxima vez que se ejecute el grafo (una semana después), se leerá blackListedVariationIds para crear initialBlackList en el estado, se utilizará en el bucle hasta que currentDayIndex === WeeklyPlan.length de nuevo y se volverá a sobreescribir blackListedVariationIds con la acumulación de sessionUsedIds.

**Lógica de Ejecución:**

1. **Acumulación Intra-Semanal (Memoria de Corto Plazo):**
Durante el bucle de generación (Nodos 4 -> 7), la variable de estado `blacklistedVariationIds` crece monótonamente. El Nodo 7 agrega los IDs de las sesiones recién generadas para evitar repeticiones dentro de la misma semana (*intra-week variability*).
2. **Persistencia Inter-Semanal (Memoria de Largo Plazo):**
    - **A. Archivo del Training System:**
    Se crea un nuevo documento en `users/{uid}/sessions/sessions_week_{timestamp}`. Este documento vuelca el objeto `weeklyPlan` y el array `finalSessions`, sirviendo como historial inmutable del entrenamiento generado.
    - **B. Actualización del Estado del Usuario (FIFO Rolling Window):**
    Se actualiza el documento raíz `users/{uid}` (base de datos firebase). El campo `blacklistedVariationIds` en la base de datos (en la coleccion users) se sobrescribe aplicando una lógica de **FIFO (First-In, First-Out). Esto crea un ciclo rotativo perfecto: Variaciones de la Semana A bloquean a Semana B, variaciones de Semana B bloquea a Semana C pero liberan las variaciones de la semana A.**


    functions/src/
├── nodes/
│   ├── 1-context-loader.ts          # Nodo 1: Context Loader
│   ├── 2-context-cleaner.ts         # Nodo 2: Context Cleaner
│   ├── 3-strategy.ts                # Nodo 3: Strategy (LLM)
│   ├── 4-loop-controller.ts         # Nodo 4: Loop Controller
│   ├── 5.1-phase-orchestrator.ts    # Nodo 5.1: Phase Orchestrator (LLM)
│   ├── 5.2-filter-engine.ts         # Nodo 5.2: Filter Engine
│   ├── 5.3-variation-cleaner.ts     # Nodo 5.3: Variation Cleaner
│   ├── 5.4-selectors.ts             # Nodos 5.4.1, 5.4.2, 5.4.3 (paralelos)
│   ├── 6-assembler.ts               # Nodo 6: Assembler
│   ├── 7-invalidator.ts             # Nodo 7: Invalidator
│   └── 8-persistence.ts             # Nodo 8: Persistence Protocol
├── graph/
│   └── workflow.ts                  # Definición del grafo y edges
├── prompts/
│   ├── strategy.ts                  # Prompts para nodo 3
│   ├── phase-orchestrator.ts        # Prompts para nodo 5.1
│   └── selectors.ts                 # Prompts para nodos 5.4.x
└── types/
    └── schemas.ts                   # Ya lo tienes