# AI Baseline Optimization Tests

## Overview

These tests validate that the AI correctly optimizes exercise selection based on baseline assessment scores (mobility, rotation, flexibility). They compare training system outputs for users with different baseline profiles to ensure the AI is actually personalizing plans.

## Test Files

### 1. `ai-baseline-optimization.test.ts`
**Type**: Unit tests with mocked AI responses  
**Purpose**: Fast, deterministic tests that validate AI prompt construction and response handling

**What it tests:**
- ✅ Comparative analysis between low-score and high-score users
- ✅ Exercise selection prioritization (mobility, rotation, flexibility)
- ✅ Difficulty level selection based on baseline scores
- ✅ Baseline data inclusion in AI prompts
- ✅ Weekly balance of movement qualities

### 2. `ai-baseline-optimization.spec.ts` (E2E)
**Type**: End-to-end tests  
**Purpose**: Validates real AI behavior in browser environment

**What it tests:**
- ✅ Real AI API calls with different baseline profiles
- ✅ Network request validation
- ✅ Actual exercise selection differences

## Running the Tests

### Unit Tests (Fast - Uses Mocks)
```bash
# Run all baseline optimization tests
npm run test:unit -- tests/unit/services/ai-baseline-optimization.test.ts

# Run with watch mode
npm run test:unit:watch -- tests/unit/services/ai-baseline-optimization.test.ts

# Run with coverage
npm run test:unit:coverage -- tests/unit/services/ai-baseline-optimization.test.ts
```

### E2E Tests (Slow - Uses Real AI)
```bash
# Run E2E baseline optimization tests
npm run test:e2e -- tests/e2e/athlete/ai-baseline-optimization.spec.ts

# Note: Requires OpenAI API key and may take 1-2 minutes per test
```

## Test Scenarios

### Scenario 1: Low vs High Mobility Scores

**User A (Low Mobility: 30/100)**
- Overhead reach: 1/5
- Shoulder rotation: 1/5
- Hip flexibility: 2/5

**User B (High Mobility: 80/100)**
- Overhead reach: 5/5
- Shoulder rotation: 4/5
- Hip flexibility: 4/5

**Expected Result:**
- User A should get more mobility-focused exercises
- User A should have more mobility exercises in warmup phase
- User A should get lower difficulty exercises

### Scenario 2: Low vs High Rotation Scores

**User A (Low Rotation: 40/100)**
- Spinal rotation: 1/5
- Daily rotation frequency: 1/4

**User B (High Rotation: 70/100)**
- Spinal rotation: 4/5
- Daily rotation frequency: 3/4

**Expected Result:**
- User A should get more rotation-focused exercises
- User A should have rotation exercises in workout phase

### Scenario 3: Difficulty Selection

**User A (All Low Scores)**
- Mobility: 30, Rotation: 40, Flexibility: 50

**User B (All High Scores)**
- Mobility: 80, Rotation: 70, Flexibility: 60

**Expected Result:**
- User A should get lower average difficulty exercises
- User B should get higher difficulty exercises

## Understanding Test Results

### ✅ Test Passes
If tests pass, it means:
1. AI is receiving baseline assessment data correctly
2. AI prompts include instructions to prioritize based on scores
3. Mock responses reflect baseline-aware exercise selection
4. Exercise analysis correctly identifies movement quality focus

### ❌ Test Fails
If tests fail, it could mean:
1. **AI prompt not including baseline data** - Check `buildUserContext()` in `aiService.js`
2. **AI not following instructions** - May need to enhance prompt with more specific examples
3. **Exercise analysis logic incorrect** - Check `analyzeMovementQualityFocus()` function
4. **Mock responses not realistic** - Update `createMockAIResponseForProfile()` to better reflect AI behavior

## Validating Real AI Output

To validate that the **real AI** (not mocks) is optimizing correctly:

### Option 1: Manual Testing
1. Create two test users in your app
2. Complete onboarding with different baseline profiles:
   - User A: Low scores (mobility: 30, rotation: 40, flexibility: 50)
   - User B: High scores (mobility: 80, rotation: 70, flexibility: 60)
3. Generate training systems for both
4. Compare exercise selection:
   - Count mobility exercises in warmup
   - Count rotation exercises in workout
   - Check average difficulty scores
   - Verify User A gets more targeted exercises

### Option 2: E2E Tests with Real AI
1. Set up test users with different baseline profiles
2. Run E2E tests that actually call OpenAI API
3. Analyze generated training systems
4. Compare exercise selection between users

**Note**: Real AI tests require:
- OpenAI API key configured
- Test users with baseline assessments
- 1-2 minutes per test (AI generation time)
- API costs (~$0.01-0.02 per generation)

## Test Helper Functions

### `createUserA_LowScores()`
Creates a user profile with low baseline scores:
- Mobility: 30/100
- Rotation: 40/100
- Flexibility: 50/100

### `createUserB_HighScores()`
Creates a user profile with high baseline scores:
- Mobility: 80/100
- Rotation: 70/100
- Flexibility: 60/100

### `analyzeMovementQualityFocus(trainingSystem)`
Analyzes a training system and returns:
- `mobilityFocus`: Count of mobility-focused exercises
- `rotationFocus`: Count of rotation-focused exercises
- `flexibilityFocus`: Count of flexibility-focused exercises
- `averageDifficulty`: Average exercise difficulty
- `mobilityInWarmup`: Mobility exercises in warmup phase
- `rotationInWorkout`: Rotation exercises in workout phase
- `flexibilityInCooldown`: Flexibility exercises in cooldown phase

### `createMockAIResponseForProfile(baselineMetrics, daysPerWeek)`
Creates a realistic mock AI response that reflects baseline-aware exercise selection:
- Low mobility → More mobility exercises in warmup
- Low rotation → More rotation exercises in workout
- Low flexibility → More flexibility exercises in cooldown
- Low scores → Lower difficulty exercises

## Interpreting Results

### What Good Results Look Like

**User A (Low Scores) Training System:**
```
Warmup: 2 mobility exercises (shoulder reach, hip mobility)
Workout: 1 rotation exercise (spinal twist)
Cooldown: 1 flexibility exercise (hamstring stretch)
Average Difficulty: 2.5
```

**User B (High Scores) Training System:**
```
Warmup: 1 standard warmup exercise
Workout: 2 strength exercises
Cooldown: 1 standard stretch
Average Difficulty: 6.5
```

**Comparison:**
- User A has 2x more mobility exercises
- User A has rotation exercise (User B doesn't)
- User A has lower average difficulty
- ✅ AI is optimizing correctly!

### What Bad Results Look Like

If both users get similar exercise selection:
- ❌ AI may not be using baseline scores effectively
- ❌ Prompt may need enhancement
- ❌ Exercise database may not have proper categorization

## Next Steps

1. **Run unit tests** to verify prompt construction
2. **Run E2E tests** (if configured) to validate real AI behavior
3. **Manual testing** with real users to confirm optimization
4. **Enhance AI prompt** if tests reveal gaps
5. **Add exercise metadata** if categorization is missing

## Related Files

- `js/services/aiService.js` - AI service implementation
- `js/core/workout-engine.js` - Workout generation logic
- `tests/unit/services/aiService.test.ts` - General AI service tests
- `docs/AI_INTEGRATION.md` - AI integration documentation

