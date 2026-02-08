/**
 * Prompts para el Nodo 5.1: Phase Orchestrator
 * 
 * Selecciona las tags adecuadas para la sesión actual.
 * Utiliza function/tool calling para garantizar JSON estructurado.
 */

/**
 * Template del prompt para seleccionar tags
 */
export function getPhaseOrchestratorPrompt(
  trainingDayFocus: string,
  trainingDayDescription: string,
  trainingSystemGoal: string,
  availableTags: string[]
): string {
  return `ROLE: You are an Elite Physiotherapist and Strength & Conditioning Coach specializing in exercise selection and movement pattern analysis.

You need to select the most relevant tags for a training session based on the following context:

### TRAINING DAY CONTEXT

**Focus:**
${trainingDayFocus}

**Session Description:**
${trainingDayDescription}

**System Goal (How this session contributes to the overall training system):**
${trainingSystemGoal}

### AVAILABLE TAGS

The following tags are available for selection. You must select only the tags that are relevant to this specific training session:

**Anatomy Tags:**
${availableTags.filter(tag => ['chest', 'back', 'legs', 'shoulders', 'core'].includes(tag)).map(tag => `- ${tag}`).join('\n')}

**Movement Pattern Tags:**
${availableTags.filter(tag => ['push', 'pull', 'squat', 'hinge', 'lunge', 'rotation'].includes(tag)).map(tag => `- ${tag}`).join('\n')}

**Modality/Attribute Tags:**
${availableTags.filter(tag => ['unilateral', 'bilateral', 'isometric', 'explosive', 'plyometric'].includes(tag)).map(tag => `- ${tag}`).join('\n')}

### TASK

Select the most relevant tags for this training session. Consider:
1. The primary focus areas mentioned in the session description
2. The movement patterns that will be emphasized
3. The training modalities that align with the system goal
4. Select 3-8 tags that best represent the session's focus

### GUIDELINES

- Select tags that accurately represent the session's primary focus
- Include both anatomy and movement pattern tags when relevant
- Include modality tags only when they are a key characteristic of the session
- Do not select tags that are not directly relevant to the session
- Prioritize specificity: select tags that precisely match the session description

Select the most appropriate tags for this training session.`;
}

/**
 * Definición de la función/tool para el LLM
 * Garantiza que el LLM devuelva un array de tags seleccionadas
 */
export function getPhaseOrchestratorFunctionDefinition() {
  return {
    name: "select_target_tags",
    description: "Selects the most relevant tags for a training session based on the session description and system goal. Returns an array of tag strings.",
    parameters: {
      type: "object",
      properties: {
        targetTags: {
          type: "array",
          description: "Array of selected tags that best represent the training session. Should include 3-8 relevant tags from the available tags list.",
          items: {
            type: "string",
          },
          minItems: 3,
          maxItems: 8,
        },
      },
      required: ["targetTags"],
    },
  };
}

