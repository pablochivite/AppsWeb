/**
 * AI Service for Training System Generation
 * 
 * Uses OpenAI GPT-4 Turbo to generate personalized training systems
 * based on user profile data, baseline assessment, and REGAIN principles.
 */

import { cleanFrameworkName } from '../core/constants.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4-turbo-preview'; // or 'gpt-4o' for newer models

/**
 * Get OpenAI API key from environment
 * @returns {string} API key
 */
function getApiKey() {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key not found. Please set VITE_OPENAI_API_KEY in your .env file');
    }
    return apiKey;
}

/**
 * Calculate which days of the week are training days
 * @param {number} daysPerWeek - Number of training days per week
 * @returns {Array<number>} Array of day of week numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
 */
function calculateTrainingDaysOfWeek(daysPerWeek) {
    // Default patterns for common training frequencies
    const patterns = {
        2: [1, 4], // Monday, Thursday
        3: [1, 3, 5], // Monday, Wednesday, Friday
        4: [1, 3, 5, 0], // Monday, Wednesday, Friday, Sunday
        5: [1, 2, 4, 5, 6], // Monday, Tuesday, Thursday, Friday, Saturday
        6: [1, 2, 3, 4, 5, 6], // Monday through Saturday
        7: [0, 1, 2, 3, 4, 5, 6] // Every day
    };
    
    // Return pattern if exists, otherwise distribute evenly
    if (patterns[daysPerWeek]) {
        return patterns[daysPerWeek];
    }
    
    // For other numbers, distribute evenly across the week
    const days = [];
    const step = Math.floor(7 / daysPerWeek);
    for (let i = 0; i < daysPerWeek; i++) {
        days.push((i * step + 1) % 7); // Start from Monday (1)
    }
    return days.sort((a, b) => a - b);
}

/**
 * Get the start of the week (Monday) for a given date
 * @param {Date} date - Date to get week start for
 * @returns {Date} Monday of that week
 */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
}

/**
 * Find the next occurrence of a specific day of week
 * @param {Date} today - Today's date
 * @param {number} targetDayOfWeek - Day of week to find (0=Sunday, 1=Monday, etc.)
 * @returns {Date} The next occurrence of that day
 */
function findNextTrainingDayForDayOfWeek(today, targetDayOfWeek) {
    const todayDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    let daysToAdd = targetDayOfWeek - todayDayOfWeek;
    if (daysToAdd < 0) {
        daysToAdd += 7; // Move to next week
    } else if (daysToAdd === 0) {
        // Today is the target day, return today
        return today;
    }
    
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + daysToAdd);
    return nextDay;
}

/**
 * Build the system prompt with REGAIN principles
 * @returns {string} System prompt
 */
function buildSystemPrompt() {
    return `You are an elite expert in kinesiology, mobility, corrective exercise, and movement science with specialized knowledge in the REGAIN methodology. Your expertise encompasses biomechanics, functional movement patterns, injury prevention, and evidence-based exercise prescription. You are a certified movement engineer and Pilates instructor who designs highly personalized training systems that prioritize longevity, awareness, holistic movement, and technical variability.

## REGAIN Methodology Pillars (MANDATORY)

1. **Breathing**: The cornerstone of every movement - predecessor of strength and stamina. Every exercise must emphasize proper breathing patterns.

2. **Holistic Focus**: Core muscles as the foundation. Focus on "connecting" the whole body (especially through the core) instead of isolating muscles. Alignment is KEY.

3. **Variability**: Avoid mechanical repetition to prevent "undertraining" of stabilizing muscles. Never repeat the exact same combination of exercises in consecutive sessions of the same training type.

4. **Longevity**: Joint and postural health over ego or maximum load. Achieve true strength through alignment of the totality of the body's muscles as a unified machine. Strength and muscle mass increases are attainable but must NEVER compromise alignment, breath, other muscles, or technique.

5. **Technique**: Movement must be deliberate, precise, and controlled. Avoid momentum and compensation patterns. Always include technique cues.

## Session Structure (MANDATORY ORDER)

Each session MUST follow this exact structure:

1. **Phase 1: Warm-up (Warm-up + Mobility)**: Joint preparation and activation
2. **Phase 2: Workout (Core + Framework)**: The central part of the session
3. **Phase 3: Cool Down (Stretching/Mobility)**: MANDATORY. Stretches must be mechanically linked to the muscles worked in Phase 2.

## Movement Hierarchy (Priority Order)

When selecting exercises, prioritize in this exact order:
1. **Posture**: Absolute priority on back and spinal protection
2. **Mobility/Flexibility**: Indispensable predecessors to strength
3. **Rotation**: Include rotation patterns (often forgotten in daily life)
4. **Mechanical Order**:
   - Bilateral BEFORE Unilateral
   - Static BEFORE Dynamic
   - Concentric BEFORE Eccentric

## Response Format

You must return a valid JSON object matching this exact structure:

\`\`\`json
{
  "system": {
    "type": "weekly",
    "daysPerWeek": number,
    "framework": "string (primary framework ONLY, e.g., 'Push/Pull', 'Upper/Lower', 'Chest/Back/Legs', 'Full Body', 'Push/Pull/Legs'). NEVER include discipline names like 'Animal Flow', 'Pilates', 'Yoga' - disciplines are separate fields.",
    "startDate": "YYYY-MM-DD"
  },
  "sessions": [
    {
      "day": number (1-indexed),
      "dayOfWeek": number (0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday),
      "date": "YYYY-MM-DD (date of first occurrence of this training day)",
      "discipline": "string",
      "workout": "string (framework label for this session, e.g., 'Push', 'Pull', 'Upper', 'Lower', 'Legs', 'Full Body')",
      "framework": "string (framework label for this session, same as workout. MUST be a training framework like 'Push', 'Pull', 'Upper', 'Lower', 'Legs', 'Full Body' - NEVER include discipline names)",
      "phases": {
        "warmup": [
          {
            "exerciseId": "string",
            "exerciseName": "string",
            "variationId": "string",
            "variationName": "string",
            "difficulty_score": number,
            "weight": number,
            "bilaterality": "bilateral" | "unilateral",
            "progression_type": "string",
            "target_muscles": {
              "primary": ["string"],
              "secondary": ["string"]
            },
            "technique_cues": ["string"]
          }
        ],
        "workout": [...same structure...],
        "cooldown": [...same structure...]
      }
    }
  ]
}
\`\`\`

## Important Rules

- NEVER repeat the exact same combination of exercises in consecutive sessions
- ALWAYS include correction reminders ("straight back," "reach for the wall," etc.)
- Respect user's discomforts - avoid exercises that target problematic areas
- Use only available equipment from the user's profile
- **CRITICAL**: The training system MUST be coherent with the user's baseline assessment and physiological data:
  - Match exercise difficulty to mobility, rotation, and flexibility scores
  - Address limitations identified in baseline assessment
  - Progress appropriately based on activity level and age
  - Consider injury history and physiological parameters (height, weight, body fat %)
- Consider user's age and activity level when selecting exercises and intensity
- Ensure progressive overload based on current milestones
- Balance disciplines across the week according to user preferences
- Each phase should have 3-8 appropriate exercises
- **USE ONLY EXERCISES FROM THE PROVIDED DATABASE** - Do not invent or reference exercises not in the available list

You must respond ONLY with valid JSON, no additional text.`;
}

/**
 * Build user context from profile data
 * @param {Object} userProfile - User profile object
 * @param {Array} availableExercises - Available exercises from database
 * @param {Object} config - Configuration (daysPerWeek, framework, startDate)
 * @param {Array} previousWeekSessions - Optional: Previous week's sessions for variety
 * @returns {string} User context prompt
 */
function buildUserContext(userProfile, availableExercises, config, previousWeekSessions = []) {
    const { baselineAssessment, preferredDisciplines, discomforts, equipment, goals, currentMilestones } = userProfile;
    const { daysPerWeek, framework, startDate } = config;

    let context = `## User Profile

**Training Configuration:**
- Days per week: ${daysPerWeek}
- Framework: ${framework}
- Start date: ${startDate}

**Preferences:**
- Preferred disciplines: ${(preferredDisciplines || []).join(', ') || 'Not specified'}
- Goals: ${(goals || []).join(', ') || 'Not specified'}
- Equipment available: ${(equipment || []).join(', ') || 'None (bodyweight only)'}
- Areas of discomfort: ${(discomforts || []).join(', ') || 'None'}

**Current Progress:**
- Milestones: ${JSON.stringify(currentMilestones || {}, null, 2)}
`;

    if (baselineAssessment) {
        const { mobility, rotation, flexibility, physiological, baselineMetrics } = baselineAssessment;
        
        context += `
**Baseline Assessment:**

Mobility Scores:
- Overhead reach: ${mobility?.overheadReach || 'N/A'}/5
- Shoulder rotation: ${mobility?.shoulderRotation || 'N/A'}/5
- Hip flexibility: ${mobility?.hipFlexibility || 'N/A'}/5
- Overall mobility score: ${baselineMetrics?.mobility || 0}/100

Rotation Scores:
- Spinal rotation: ${rotation?.spinalRotation || 'N/A'}/5
- Daily rotation frequency: ${rotation?.dailyRotationFrequency || 'N/A'}/4
- Overall rotation score: ${baselineMetrics?.rotation || 0}/100

Flexibility Scores:
- Lower body: ${flexibility?.lowerBody || 'N/A'}/5
- Upper body: ${flexibility?.upperBody || 'N/A'}/5
- Overall flexibility score: ${baselineMetrics?.flexibility || 0}/100
`;

        if (physiological) {
            context += `
**Physiological Data:**
- Age: ${physiological.age || 'Not specified'}
- Activity level: ${physiological.activityLevel || 'Not specified'}
- Height: ${physiological.height ? `${physiological.height} cm` : 'Not specified'}
- Weight: ${physiological.weight ? `${physiological.weight} kg` : 'Not specified'}
- Body fat %: ${physiological.bodyFatPercent || 'Not specified'}
- Injury history: ${physiological.injuryHistory || 'None'}
`;
        }
    }

    context += `
**Available Exercises:** ${availableExercises.length} exercises available. Exercises are filtered by discipline, equipment, and discomforts. Use exercise IDs and variation IDs from the provided list.

## Task

Generate a complete ${daysPerWeek}-day weekly training system. 

**CRITICAL: Training days must follow a WEEKLY PATTERN, not consecutive days.**

For ${daysPerWeek} days per week, use these day patterns:
- 2 days: Monday, Thursday
- 3 days: Monday, Wednesday, Friday  
- 4 days: Monday, Wednesday, Friday, Sunday
- 5 days: Monday, Tuesday, Thursday, Friday, Saturday
- 6 days: Monday through Saturday
- 7 days: Every day

**CRITICAL: Training Framework vs Discipline - DO NOT CONFUSE THEM**

- **Training Framework**: The structure of how you train (e.g., "Push/Pull", "Upper/Lower", "Chest/Back/Legs", "Full Body", "Push/Pull/Legs"). These are the ONLY valid framework values.
- **Discipline**: The method or style of training (e.g., "Animal Flow", "Pilates", "Yoga", "Weights", "Calisthenics"). These are SEPARATE from frameworks.

**NEVER combine frameworks with disciplines in the framework field.** For example:
- ❌ WRONG: "Push/Pull and Animal Flow" 
- ❌ WRONG: "Animal Flow - Push"
- ✅ CORRECT: framework = "Push/Pull", discipline = "Animal Flow"

**IMPORTANT: Training systems can use MULTIPLE frameworks across different days.** For example:
- 4 days: 2 days Push/Pull, 1 day Upper/Lower, 1 day Full Body
- 3 days: 1 day Push, 1 day Pull, 1 day Legs
- 5 days: 2 days Push/Pull, 2 days Upper/Lower, 1 day Full Body

Each session MUST have:
1. A "dayOfWeek" field (0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday) indicating which day of the week this session occurs
2. A "framework" and "workout" field that describes the training focus for that specific day (e.g., "Push", "Pull", "Upper", "Lower", "Legs", "Full Body", "Chest", "Back") - MUST be a framework, NOT a discipline
3. A "discipline" field that describes the training method (e.g., "Animal Flow", "Pilates", "Yoga", "Weights", "Calisthenics")
4. A "date" field with the actual date (YYYY-MM-DD) for the first occurrence of this training day

The framework serves as a descriptive label for the session and will be displayed in the calendar. The discipline is used for exercise selection but should NOT appear in the framework field.

The training system MUST be coherent with the provided user data:

1. **Baseline Assessment**: Design exercises that address the user's mobility, rotation, and flexibility scores. If scores are low, prioritize corrective exercises and mobility work. If scores are high, challenge with appropriate progressions.

2. **Physiological Data**: Consider age, activity level, and body composition when selecting exercise intensity and volume.

3. **Discomforts**: Avoid exercises that target or exacerbate problematic areas.

4. **Goals & Objectives**: Align the training system with the user's stated goals and training objectives.

5. **Milestones**: Incorporate progressive overload based on current milestone progress.

Each session must follow the REGAIN methodology principles strictly. Use ONLY exercises from the provided database - reference exercise IDs and variation IDs exactly as provided.

${previousWeekSessions && previousWeekSessions.length > 0 ? `
**CRITICAL: EXERCISE VARIETY REQUIREMENT**

You are generating sessions for the NEXT WEEK. Below are the sessions from the CURRENT WEEK. You MUST ensure that the exercises in each session are DIFFERENT from the corresponding session of the current week, even though the framework (Push/Pull/Legs/etc.) remains the same.

**Current Week Sessions:**
${JSON.stringify(previousWeekSessions.map(s => ({
    dayOfWeek: s.dayOfWeek,
    framework: s.framework || s.workout,
    discipline: s.discipline,
    exercises: {
        warmup: s.phases?.warmup?.map(e => ({ exerciseId: e.exerciseId, exerciseName: e.exerciseName })) || [],
        workout: s.phases?.workout?.map(e => ({ exerciseId: e.exerciseId, exerciseName: e.exerciseName })) || [],
        cooldown: s.phases?.cooldown?.map(e => ({ exerciseId: e.exerciseId, exerciseName: e.exerciseName })) || []
    }
})), null, 2)}

**REQUIREMENT:** For each day of the week, the exercises MUST be different from the current week's session for that same day, while maintaining the same framework and discipline. This ensures variety and prevents mechanical repetition, which is a core REGAIN principle.
` : ''}

Return ONLY the JSON object matching the required structure.`;

    return context;
}

/**
 * Parse and validate AI response
 * @param {string} responseText - Raw response from AI
 * @returns {Object} Parsed training system object
 */
function parseAIResponse(responseText) {
    try {
        // Try to extract JSON from response (in case there's markdown formatting)
        let jsonText = responseText.trim();
        
        // Remove markdown code blocks if present
        jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Remove any leading/trailing text
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        }
        
        const parsed = JSON.parse(jsonText);
        
        // Validate structure
        if (!parsed.system || !parsed.sessions || !Array.isArray(parsed.sessions)) {
            throw new Error('Invalid response structure: missing system or sessions');
        }
        
        return parsed;
    } catch (error) {
        console.error('Error parsing AI response:', error);
        console.error('Response text:', responseText);
        throw new Error(`Failed to parse AI response: ${error.message}`);
    }
}

/**
 * Generate training system using AI
 * @param {Object} userProfile - User profile with baseline assessment, preferences, etc.
 * @param {Array} availableExercises - Available exercises from database
 * @param {Object} config - Configuration (daysPerWeek, framework, startDate)
 * @param {Array} previousWeekSessions - Optional: Previous week's sessions to ensure exercise variety
 * @returns {Promise<Object>} Generated training system object
 */
export async function generateTrainingSystemWithAI(userProfile, availableExercises, config, previousWeekSessions = []) {
    try {
        console.log('[AI] Starting AI-powered training system generation...');
        if (previousWeekSessions && previousWeekSessions.length > 0) {
            console.log(`[AI] Including ${previousWeekSessions.length} previous week sessions for variety`);
        }
        
        const apiKey = getApiKey();
        const systemPrompt = buildSystemPrompt();
        const userContext = buildUserContext(userProfile, availableExercises, config, previousWeekSessions);
        
        // Include exercise summaries (not full data, just key info to reduce token usage)
        const exerciseSummaries = availableExercises.slice(0, 100).map(ex => ({
            id: ex.id,
            name: ex.name,
            discipline: ex.discipline,
            variations: ex.variations?.map(v => ({
                id: v.id,
                name: v.name,
                difficulty_score: v.difficulty_score,
                target_muscles: v.target_muscles,
                bilaterality: v.bilaterality
            })) || []
        }));
        
        const exerciseContext = `\n**Exercises Summary (${exerciseSummaries.length} available):**\n${JSON.stringify(exerciseSummaries, null, 2)}\n`;
        
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userContext + exerciseContext
            }
        ];
        
        console.log('[AI] Sending request to OpenAI...');
        
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: messages,
                temperature: 0.7, // Balance between creativity and consistency
                max_tokens: 4000, // Enough for a full training system
                response_format: { type: 'json_object' } // Force JSON output (requires compatible model)
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
        }
        
        const data = await response.json();
        const assistantMessage = data.choices[0]?.message?.content;
        
        if (!assistantMessage) {
            throw new Error('No response from OpenAI API');
        }
        
        console.log('[AI] Received response, parsing...');
        
        const parsed = parseAIResponse(assistantMessage);
        
        console.log('[AI] Successfully generated training system');
        console.log(`[AI] System: ${parsed.system.type}, ${parsed.system.daysPerWeek} days, ${parsed.system.framework}`);
        console.log(`[AI] Sessions generated: ${parsed.sessions.length}`);
        
        // Process sessions to ensure they have dayOfWeek and correct dates
        const processedSessions = parsed.sessions.map((session, index) => {
            // Calculate training days of week pattern
            const daysPerWeek = parsed.system.daysPerWeek || config.daysPerWeek;
            const trainingDaysOfWeek = calculateTrainingDaysOfWeek(daysPerWeek);
            
            // If session doesn't have dayOfWeek, assign based on pattern
            if (session.dayOfWeek === undefined && trainingDaysOfWeek[index] !== undefined) {
                session.dayOfWeek = trainingDaysOfWeek[index];
            }
            
            // Calculate or validate session date
            // Always ensure dates respect the startDate
            const today = new Date();
            const weekStart = getWeekStart(today);
            weekStart.setHours(0, 0, 0, 0);
            
            // If generating for next week (previousWeekSessions provided), add 7 days
            if (previousWeekSessions && previousWeekSessions.length > 0) {
                weekStart.setDate(weekStart.getDate() + 7);
            }
            
            const dayOfWeek = session.dayOfWeek !== undefined ? session.dayOfWeek : trainingDaysOfWeek[index];
            const daysToAdd = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday (0) to 6 for calculation
            const expectedSessionDate = new Date(weekStart);
            expectedSessionDate.setDate(weekStart.getDate() + daysToAdd);
            expectedSessionDate.setHours(0, 0, 0, 0);
            const expectedDateStr = expectedSessionDate.toISOString().split('T')[0];
            
            // Get the system start date
            const systemStartDate = parsed.system.startDate || config.startDate;
            const startDateObj = systemStartDate ? new Date(systemStartDate) : expectedSessionDate;
            startDateObj.setHours(0, 0, 0, 0);
            
            // If session doesn't have a valid date, calculate it
            if (!session.date || session.date === '') {
                session.date = expectedDateStr;
            } else {
                // Validate that the session date is not before startDate
                const sessionDateStr = typeof session.date === 'string' 
                    ? session.date.split('T')[0] 
                    : new Date(session.date).toISOString().split('T')[0];
                const sessionDateObj = new Date(sessionDateStr);
                sessionDateObj.setHours(0, 0, 0, 0);
                
                // If session date is before startDate, recalculate it
                if (sessionDateObj.getTime() < startDateObj.getTime()) {
                    console.warn(`[AI] Session date ${sessionDateStr} is before startDate ${systemStartDate}, recalculating to ${expectedDateStr}`);
                    session.date = expectedDateStr;
                }
            }
            
            // Clean framework to remove any discipline names
            const sessionFramework = cleanFrameworkName(session.framework || session.workout || 'Unknown');
            
            return {
                ...session,
                // Ensure framework is set and cleaned (use workout if framework not provided)
                framework: sessionFramework,
                editable: true
            };
        });
        
        // Calculate training days pattern
        const daysPerWeek = parsed.system.daysPerWeek || config.daysPerWeek;
        const trainingDaysOfWeek = calculateTrainingDaysOfWeek(daysPerWeek);
        
        // Use the Monday of the generation week as the system start date
        // If generating for next week (previousWeekSessions provided), use next week's Monday
        // Otherwise, use the current week's Monday
        const today = new Date();
        const systemWeekStart = getWeekStart(today);
        systemWeekStart.setHours(0, 0, 0, 0);
        
        // If generating for next week, add 7 days
        if (previousWeekSessions && previousWeekSessions.length > 0) {
            systemWeekStart.setDate(systemWeekStart.getDate() + 7);
        }
        
        const systemStartDate = systemWeekStart.toISOString().split('T')[0];
        
        // Clean the system framework to remove any discipline names
        const systemFramework = cleanFrameworkName(parsed.system.framework || config.framework);
        
        return {
            id: `weekly-system-${Date.now()}`,
            type: parsed.system.type || 'weekly',
            startDate: systemStartDate,
            daysPerWeek: daysPerWeek,
            framework: systemFramework,
            trainingDaysOfWeek: trainingDaysOfWeek, // Store which days of week are training days
            sessions: processedSessions,
            editable: true,
            createdAt: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('[AI] Error generating training system:', error);
        throw new Error(`AI generation failed: ${error.message}`);
    }
}

/**
 * DEPRECATED: Fallback to rule-based generation if AI fails
 * NOTE: This function is kept for backwards compatibility but should NOT be used.
 * This is an AI-driven app - AI generation failures should throw errors, not fall back to rules.
 * 
 * @deprecated Use generateTrainingSystemWithAI directly instead
 * @param {Function} fallbackFunction - Function to call if AI fails (should not be used)
 * @param {Object} userProfile - User profile
 * @param {Array} availableExercises - Available exercises
 * @param {Object} config - Configuration
 * @returns {Promise<Object>} Generated training system
 */
export async function generateWithAIFallback(userProfile, availableExercises, config, fallbackFunction) {
    console.warn('[AI] WARNING: generateWithAIFallback is deprecated. This is an AI-driven app - falling back to rules is not allowed.');
    // In an AI-driven app, we should never fall back to rules
    // If AI fails, throw error instead
    try {
        return await generateTrainingSystemWithAI(userProfile, availableExercises, config);
    } catch (error) {
        console.error('[AI] AI generation failed. This app requires AI - not falling back to rules:', error.message);
        throw new Error(`AI generation required but failed: ${error.message}. This is an AI-driven application.`);
    }
}

