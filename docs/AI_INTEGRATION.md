# AI Integration for Training System Generation

## Overview

REGAIN now uses **OpenAI GPT-4 Turbo** to generate personalized training systems based on user profile data, baseline assessment, and REGAIN methodology principles.

## Why OpenAI GPT-4 Turbo?

- ✅ **Strong Reasoning**: Complex movement science and exercise selection
- ✅ **Follows Detailed Instructions**: Adheres to all REGAIN principles (breathing, holistic focus, variability, longevity, technique)
- ✅ **Avoids Repetition**: Never repeats exercise combinations across sessions
- ✅ **Structured Output**: Returns valid JSON matching our data structure
- ✅ **Cost-Effective**: ~$0.01-0.02 per training system generation
- ✅ **Reliable**: AI-powered generation is required for this application

## Setup

### 1. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Create a new API key
4. Copy the key

### 2. Configure Environment

Add your OpenAI API key to your `.env` file:

```bash
# Copy from config/env.template
cp config/env.template .env

# Add your OpenAI API key
VITE_OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Restart Development Server

After adding the API key, restart your development server:

```bash
npm run dev
```

## How It Works

### 1. User Clicks "Generate"

When a user clicks "Generate My First Plan" on the dashboard:

1. User profile data is collected (baseline assessment, physiological data, preferences)
2. Available exercises are loaded from database
3. AI service is called with comprehensive context
4. AI generates complete training system following REGAIN principles
5. Training system is saved to Firestore

### 2. AI Context Includes

**User Profile:**
- Baseline assessment (mobility, rotation, flexibility scores)
- Physiological data (age, activity level, height, weight, body fat %)
- Preferences (disciplines, goals, equipment, discomforts)
- Current milestones and progress

**Available Exercises:**
- Exercise IDs, names, disciplines
- Variation details (difficulty, target muscles, bilaterality)
- Filtered by user's preferences and limitations

**Configuration:**
- Days per week
- Training framework (Push/Pull, Upper/Lower, etc.)
- Start date

### 3. AI Generates

The AI generates:
- Complete weekly training system structure
- Individual sessions with 3 phases (warmup, workout, cooldown)
- Exercises with proper variations based on user's level
- Technique cues and correction reminders
- Progressive overload considerations

### 4. Error Handling

If AI generation fails (API error, network issue, etc.):
- Error is thrown and logged
- User is notified that AI generation is required
- This is an AI-driven application - AI generation is mandatory

## REGAIN Principles in AI Prompt

The AI is instructed to follow these mandatory principles:

1. **Breathing**: Cornerstone of every movement
2. **Holistic Focus**: Core as foundation, whole-body connection
3. **Variability**: Avoid mechanical repetition
4. **Longevity**: Joint and postural health over ego
5. **Technique**: Deliberate, precise, controlled movement

### Session Structure (Mandatory)

1. **Phase 1: Warm-up** - Joint preparation and mobility
2. **Phase 2: Workout** - Core + framework exercises
3. **Phase 3: Cool Down** - Stretching/mobility linked to Phase 2 muscles

### Movement Hierarchy (Priority Order)

1. **Posture** - Back and spinal protection (absolute priority)
2. **Mobility/Flexibility** - Predecessors to strength
3. **Rotation** - Include rotation patterns
4. **Mechanical Order**:
   - Bilateral BEFORE Unilateral
   - Static BEFORE Dynamic
   - Concentric BEFORE Eccentric

## Configuration

### Enable/Disable AI

By default, AI is enabled if `VITE_OPENAI_API_KEY` is set.

To disable AI (force rule-based generation):

```javascript
await generateWeeklySystem(userProfile, config, { useAI: false });
```

To force AI (fail if AI unavailable):

```javascript
await generateWeeklySystem(userProfile, config, { forceAI: true });
```

### API Model

Default model: `gpt-4-turbo-preview`

To change the model, edit `js/services/aiService.js`:

```javascript
const MODEL = 'gpt-4o'; // or 'gpt-4-turbo-preview'
```

## Cost Estimation

**Per Training System Generation:**
- Input tokens: ~2,000-3,000 tokens (user profile + exercises)
- Output tokens: ~1,500-2,500 tokens (full training system)
- Cost: ~$0.01-0.02 per generation (GPT-4 Turbo pricing)

**Monthly Estimates:**
- 100 users generating systems: ~$1-2/month
- 1,000 users: ~$10-20/month
- 10,000 users: ~$100-200/month

**Optimization Tips:**
- Limit exercise summaries sent to AI (currently 100 exercises max)
- Cache common exercise data
- Use GPT-4o for better cost/performance ratio

## Testing

### Test AI Generation

1. Ensure `.env` has `VITE_OPENAI_API_KEY` set
2. Start the app: `npm run dev`
3. Complete onboarding with baseline assessment
4. Click "Generate My First Plan"
5. Check browser console for `[AI]` logs

### Test Error Handling

1. Temporarily remove or invalidate `VITE_OPENAI_API_KEY`
2. Generate a training system
3. Should show error message that AI is required
4. Check console for `[AI]` error logs

## Troubleshooting

### "OpenAI API key not found"

**Solution:** Add `VITE_OPENAI_API_KEY` to your `.env` file

### "OpenAI API error: 401"

**Solution:** Your API key is invalid. Check:
- Key is correct in `.env`
- Key hasn't expired
- Key has proper permissions

### "OpenAI API error: 429"

**Solution:** Rate limit exceeded. Options:
- Wait before retrying
- Upgrade OpenAI plan
- Implement rate limiting in your app

### "Failed to parse AI response"

**Solution:** 
- Check browser console for full response
- AI may have returned invalid JSON
- Error will be thrown - user must retry or check API configuration
- Report issue with response text

### AI Generates Wrong Exercises

**Solution:**
- Check user profile data (baseline assessment, discomforts)
- Verify exercise filtering logic
- Review AI prompt in `js/services/aiService.js`
- Adjust prompt to be more specific

## Monitoring

### Console Logs

Watch for these log prefixes:
- `[AI]` - AI generation process

### Success Indicators

```
[AI] Starting AI-powered training system generation...
[AI] Sending request to OpenAI...
[AI] Received response, parsing...
[AI] Successfully generated training system
[AI] System: weekly, 3 days, Push/Pull
[AI] Sessions generated: 3
```

### Error Indicators

```
[AI] AI generation failed: [error message]
[AI] AI generation failed, falling back to rule-based generation
[Rule-Based] Starting rule-based generation...
```

## Future Enhancements

Potential improvements:
- [ ] Fine-tune model on REGAIN methodology
- [ ] Add streaming responses for better UX
- [ ] Cache common exercise combinations
- [ ] A/B test AI vs rule-based for different user segments
- [ ] Add user feedback loop to improve prompts
- [ ] Support for Claude/Gemini as alternatives

## Related Documentation

- `docs/FIRESTORE_SCHEMA.md` - Database structure
- `.cursor/indications/context/product-essence.mdc` - REGAIN principles
- `js/services/aiService.js` - AI service implementation
- `js/core/workout-engine.js` - Workout engine with AI integration

