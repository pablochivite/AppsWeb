/**
 * Prompts para los Nodos 5.4.1, 5.4.2, 5.4.3: Selectors
 * 
 * Seleccionan variaciones para cada fase (warmup, workout, cooldown).
 * Utiliza function/tool calling para garantizar JSON estructurado.
 */

/**
 * Template del prompt para seleccionar variaciones de warmup
 */
export function getWarmupSelectorPrompt(
  focus: string,
  description: string,
  systemGoal: string,
  scoredVariations: Array<{ id: string; name: string; score: number; tags: string[]; disciplines: string[] }>
): string {
  const variationsList = scoredVariations
    .map((v, idx) => {
      const tagsStr = v.tags?.length > 0 ? v.tags.join(", ") : "none";
      const disciplinesStr = v.disciplines?.length > 0 ? v.disciplines.join(", ") : "none";
      return `${idx + 1}. **${v.name}** (Score: ${v.score?.toFixed(2) || "0.00"})
   - Tags: ${tagsStr}
   - Disciplines: ${disciplinesStr}
   - ID: ${v.id}`;
    })
    .join("\n\n");

  return `ROLE: You are an Elite Physiotherapist and Strength & Conditioning Coach specializing in the 20-35 age demographic.
Your expertise lies in designing "Holistic Strength" systems: balancing hypertrophy and raw strength with rigorous mobility, flexibility, and longevity protocols.

### TRAINING SESSION CONTEXT

**Focus:** ${focus}

**Session Description:**
${description}

**System Goal (How this session contributes to the overall training system):**
${systemGoal}

### WARMUP PHASE GUIDELINES

The warmup phase prepares the body for the main workout by:
- Activating the cardiovascular system (light cardio, dynamic movements)
- Mobilizing joints and increasing range of motion
- Activating core stability
- Preparing movement patterns that will be used in the workout

**Selection Criteria:**
- Select 3-5 variations that progressively prepare the body
- Prioritize movements that align with the session's focus
- Include mobility work relevant to the workout phase
- Consider the system goal when selecting activation patterns
- Use scores as guidance, but prioritize movement quality and progression

### AVAILABLE VARIATIONS (Pre-scored by relevance)

${variationsList}

### SCORE EXPLANATION

Each variation has been scored (0.0 to 1.0) based on tag matching with the session's target tags. Higher scores indicate better alignment with the session focus. However, consider the overall warmup progression and movement quality, not just scores.

### TASK

Select 3-5 variations that create an effective warmup sequence for this training session. Consider:
1. Progressive activation (start lighter, build intensity)
2. Movement pattern preparation for the workout
3. Alignment with the session focus and system goal
4. Balance between mobility, activation, and light cardio

Select the most appropriate warmup variations for this training session.`;
}

/**
 * Template del prompt para seleccionar variaciones de workout
 */
export function getWorkoutSelectorPrompt(
  focus: string,
  description: string,
  systemGoal: string,
  scoredVariations: Array<{ id: string; name: string; score: number; tags: string[]; disciplines: string[] }>
): string {
  const variationsList = scoredVariations
    .map((v, idx) => {
      const tagsStr = v.tags?.length > 0 ? v.tags.join(", ") : "none";
      const disciplinesStr = v.disciplines?.length > 0 ? v.disciplines.join(", ") : "none";
      return `${idx + 1}. **${v.name}** (Score: ${v.score?.toFixed(2) || "0.00"})
   - Tags: ${tagsStr}
   - Disciplines: ${disciplinesStr}
   - ID: ${v.id}`;
    })
    .join("\n\n");

  return `ROLE: You are an Elite Physiotherapist and Strength & Conditioning Coach specializing in the 20-35 age demographic.
Your expertise lies in designing "Holistic Strength" systems: balancing hypertrophy and raw strength with rigorous mobility, flexibility, and longevity protocols.

### TRAINING SESSION CONTEXT

**Focus:** ${focus}

**Session Description:**
${description}

**System Goal (How this session contributes to the overall training system):**
${systemGoal}

### WORKOUT PHASE GUIDELINES

The workout phase is the core of the training session, focusing on:
- Primary strength and hypertrophy development
- Movement pattern mastery
- Progressive overload
- Holistic strength development (strength without compromising mobility)

**Selection Criteria:**
- Select 4-6 variations that comprehensively address the session focus
- **CRITICAL: Include variations from at least 2 different disciplines** to ensure movement diversity
- Prioritize movements that directly target the session's focus areas
- Balance between different movement patterns (push/pull, squat/hinge, etc.)
- Consider the system goal for long-term development
- Use scores as guidance, but prioritize movement quality and discipline diversity

### AVAILABLE VARIATIONS (Pre-scored by relevance)

${variationsList}

### SCORE EXPLANATION

Each variation has been scored (0.0 to 1.0) based on tag matching with the session's target tags. Higher scores indicate better alignment with the session focus. However, prioritize discipline diversity and movement quality over scores alone.

### TASK

Select 4-6 variations that create a comprehensive workout for this training session. Consider:
1. **Direct alignment with the session focus** - The workout phase IS the session's purpose, not complementary
2. **MANDATORY REQUIREMENT: Include at least 2 different disciplines** (e.g., Pilates, Animal Flow, Calisthenics, etc.) - This is non-negotiable and will cause selection failure if not met
3. Movement pattern balance and variety
4. Progressive difficulty and intensity appropriate for strength/hypertrophy development
5. Load and fatigue management aligned with the session purpose
6. Alignment with the system goal

**CRITICAL**: If you cannot find variations from at least 2 different disciplines that align with the session focus, you must still select from 2+ disciplines even if it means slightly lower scores. Discipline diversity is mandatory.

Select the most appropriate workout variations for this training session.`;
}

/**
 * Template del prompt para seleccionar variaciones de cooldown
 */
export function getCooldownSelectorPrompt(
  focus: string,
  description: string,
  systemGoal: string,
  scoredVariations: Array<{ id: string; name: string; score: number; tags: string[]; disciplines: string[] }>
): string {
  const variationsList = scoredVariations
    .map((v, idx) => {
      const tagsStr = v.tags?.length > 0 ? v.tags.join(", ") : "none";
      const disciplinesStr = v.disciplines?.length > 0 ? v.disciplines.join(", ") : "none";
      return `${idx + 1}. **${v.name}** (Score: ${v.score?.toFixed(2) || "0.00"})
   - Tags: ${tagsStr}
   - Disciplines: ${disciplinesStr}
   - ID: ${v.id}`;
    })
    .join("\n\n");

  return `ROLE: You are an Elite Physiotherapist and Strength & Conditioning Coach specializing in the 20-35 age demographic.
Your expertise lies in designing "Holistic Strength" systems: balancing hypertrophy and raw strength with rigorous mobility, flexibility, and longevity protocols.

### TRAINING SESSION CONTEXT

**Focus:** ${focus}

**Session Description:**
${description}

**System Goal (How this session contributes to the overall training system):**
${systemGoal}

### COOLDOWN PHASE GUIDELINES

The cooldown phase promotes recovery and longevity by:
- Restoring mobility and flexibility after intense work
- Facilitating recovery through gentle movement
- Addressing any movement restrictions from the workout
- Supporting long-term joint health and movement quality

**Selection Criteria:**
- Select 3-4 variations that promote recovery and mobility
- Focus on mobility and flexibility work
- Address areas worked during the workout phase
- Consider the system goal for long-term mobility maintenance
- Use scores as guidance, but prioritize recovery and mobility benefits

### AVAILABLE VARIATIONS (Pre-scored by relevance)

${variationsList}

### SCORE EXPLANATION

Each variation has been scored (0.0 to 1.0) based on tag matching with the session's target tags. Higher scores indicate better alignment with the session focus. However, prioritize recovery and mobility benefits over scores alone.

### TASK

Select 3-4 variations that create an effective cooldown sequence for this training session. Consider:
1. Recovery and mobility restoration
2. Addressing areas worked during the workout
3. Flexibility and joint health
4. Alignment with the session focus and system goal

Select the most appropriate cooldown variations for this training session.`;
}

/**
 * Definición de la función/tool para seleccionar variaciones
 * Garantiza que el LLM devuelva un array de ExerciseVariation
 */
export function getSelectorFunctionDefinition(phase: "warmup" | "workout" | "cooldown") {
  const phaseInfo = {
    warmup: {
      minItems: 3,
      maxItems: 5,
      description: "Select 3-5 warmup variations that progressively prepare the body for the workout",
    },
    workout: {
      minItems: 4,
      maxItems: 6,
      description: "Select 4-6 workout variations that comprehensively address the session focus. Must include at least 2 different disciplines.",
    },
    cooldown: {
      minItems: 3,
      maxItems: 4,
      description: "Select 3-4 cooldown variations that promote recovery and mobility",
    },
  };

  const info = phaseInfo[phase];

  return {
    name: `select_${phase}_variations`,
    description: info.description,
    parameters: {
      type: "object",
      properties: {
        selectedVariations: {
          type: "array",
          description: `Array of selected ${phase} variations. Each variation must be selected from the provided list by its ID.`,
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "The ID of the selected variation (must match one from the provided list)",
              },
            },
            required: ["id"],
          },
          minItems: info.minItems,
          maxItems: info.maxItems,
        },
      },
      required: ["selectedVariations"],
    },
  };
}

