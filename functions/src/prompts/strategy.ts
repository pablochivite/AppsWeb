/**
 * Prompts para el Nodo 3: Strategy
 * 
 * Genera el WeeklyPlan basándose en el perfil del usuario.
 * Utiliza function/tool calling para garantizar JSON estructurado.
 */

/**
 * Template del prompt para generar el WeeklyPlan
 */
export function getStrategyPrompt(userProfile: {
  metrics: { mobility: number; flexibility: number; rotation: number };
  discomforts: string[];
  objectives: string[];
  preferredDisciplines: string[];
}): string {
  const { metrics, discomforts, objectives, preferredDisciplines } = userProfile;

  return `ROLE: You are an Elite Physiotherapist and Strength & Conditioning Coach specializing in the 20-35 age demographic who essentially seek to gain strength without compromising mobility and flexibility.
Your expertise lies in designing "Holistic Strength" systems: balancing hypertrophy and raw strength with rigorous mobility, flexibility, and longevity protocols.

You will design a training plan based on the following user profile:

1. **Baseline Metrics** (Range 0-100, where <40 is poor and >80 is excellent):
   - Mobility: ${metrics.mobility}
   - Flexibility: ${metrics.flexibility}
   - Rotation: ${metrics.rotation}

2. **Physical Discomforts/Injuries:**
${discomforts.length > 0 ? discomforts.map(d => `   - ${d}`).join("\n") : "   - None specified"}

3. **Primary Objectives:**
${objectives.length > 0 ? objectives.map(o => `   - ${o}`).join("\n") : "   - Not specified"}

4. **Preferred Discipline:**
${preferredDisciplines.length > 0 ? preferredDisciplines.map(d => `   - ${d}`).join("\n") : "   - Not specified"}

### TASK

Generate a **Permanent Weekly Training Plan**.
This plan serves as the architectural skeleton for the user's weekly training cycle. It defines *when* they train and *what* the focus and purpose are, but not the specific exercises (that happens later).

### CRITICAL GUIDELINES

1. **Holistic Balance:** The plan MUST cover all major muscle groups and movement patterns within the week. Do not neglect antagonists.
2. **Data-Driven Adjustments:**
   - If **Metrics** are low (<40), you MUST dedicate specific focus in the 'systemGoal' or 'focus' descriptions to address these deficits (e.g., "Legs + Hip Mobility Focus").
   - If **Discomforts** are present, explicitly structure the focus to avoid aggravating them (e.g., if "Lower Back Pain", avoid "Heavy Spinal Loading" focus).
3. **Discipline Integration:** If the user prefers a discipline (e.g., Calisthenics), the 'focus' and 'description' should reflect that terminology, but the biomechanical foundation must remain solid.
4. **Volume & Frequency:** Assign a realistic 'totalTrainingDays' (3 to 6) based on the ambitiousness of the user's objectives.
5. **Permanence:** This structure repeats every week. It must be sustainable.

### IMPORTANT

- DO NOT include the "startDate" field - it will be calculated automatically
- The plan must be realistic and sustainable
- Ensure adequate rest days
- The plan must allow for weekly variability in exercise selection

Generate a professional, balanced plan aligned with Holistic Strength principles.`;
}

/**
 * Function/tool definition for the LLM
 * Ensures the LLM returns a structured WeeklyPlan
 */
export function getStrategyFunctionDefinition() {
  return {
    name: "generate_weekly_plan",
    description: "Generates a permanent weekly training plan based on the user profile. The plan must be holistic, balanced, and promote strength gain through technique and alignment.",
    parameters: {
      type: "object",
      properties: {
        totalTrainingDays: {
          type: "number",
          description: "Total number of training days per week (typically between 3 and 6)",
          minimum: 1,
          maximum: 7,
        },
        trainingDays: {
          type: "array",
          description: "Array of numbers representing the days of the week when training occurs. 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday",
          items: {
            type: "number",
            minimum: 0,
            maximum: 6,
          },
          minItems: 1,
          maxItems: 7,
        },
        goalDescription: {
          type: "string",
          description: "Clear description of the overall purpose of the training system and how it aligns with the user's objectives",
        },
        schedule: {
          type: "array",
          description: "Array of ScheduledTrainingDay objects, one for each training day. The order must match trainingDays",
          items: {
            type: "object",
            properties: {
              dayIndex: {
                type: "number",
                description: "Day of the week index (0=Sunday, 1=Monday, ..., 6=Saturday). Must match the corresponding element in trainingDays",
                minimum: 0,
                maximum: 6,
              },
              focus: {
                type: "string",
                description: "Muscle group or primary focus area for this training day (e.g., 'Legs and glutes', 'Core and stability', 'Upper body and rotation')",
              },
              description: {
                type: "string",
                description: "Clear and detailed description of the purpose of this specific session",
              },
              systemGoal: {
                type: "string",
                description: "How this session contributes to the overall training system goal",
              },
            },
            required: ["dayIndex", "focus", "description", "systemGoal"],
          },
        },
      },
      required: ["totalTrainingDays", "trainingDays", "goalDescription", "schedule"],
    },
  };
}

