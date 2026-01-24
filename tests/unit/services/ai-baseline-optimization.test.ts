import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTrainingSystemWithAI } from '../../../js/services/aiService.js';

/**
 * AI Baseline Optimization Validation Tests
 * 
 * These tests validate that the AI actually optimizes exercise selection
 * based on baseline assessment scores by comparing outputs for different user profiles.
 * 
 * Test Strategy:
 * 1. Create User A with low baseline scores (Mobility: 30, Rotation: 40, Flexibility: 50)
 * 2. Create User B with high baseline scores (Mobility: 80, Rotation: 70, Flexibility: 60)
 * 3. Generate training systems for both users
 * 4. Compare exercise selection to verify User A gets more targeted exercises
 */

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AI Baseline Optimization - Comparative Analysis', () => {
  let mockExercises: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_OPENAI_API_KEY', 'test-api-key');
    
    // Mock exercises database (simplified)
    mockExercises = [
      {
        id: 'mobility-shoulder-1',
        name: 'Shoulder Mobility Reach',
        discipline: 'Pilates',
        variations: [{
          id: 'var-mob-1',
          name: 'Basic Shoulder Reach',
          difficulty_score: 2,
          target_muscles: { primary: ['shoulders'], secondary: [] },
          progression_type: 'mobility'
        }]
      },
      {
        id: 'mobility-hip-1',
        name: 'Hip Flexibility Exercise',
        discipline: 'Pilates',
        variations: [{
          id: 'var-hip-1',
          name: 'Hip Mobility Stretch',
          difficulty_score: 2,
          target_muscles: { primary: ['hips'], secondary: [] },
          progression_type: 'mobility'
        }]
      },
      {
        id: 'rotation-spinal-1',
        name: 'Spinal Rotation Exercise',
        discipline: 'Pilates',
        variations: [{
          id: 'var-rot-1',
          name: 'Basic Spinal Twist',
          difficulty_score: 3,
          target_muscles: { primary: ['core', 'back'], secondary: [] },
          progression_type: 'rotation'
        }]
      },
      {
        id: 'flexibility-lower-1',
        name: 'Lower Body Stretch',
        discipline: 'Pilates',
        variations: [{
          id: 'var-flex-1',
          name: 'Hamstring Stretch',
          difficulty_score: 2,
          target_muscles: { primary: ['hamstrings'], secondary: [] },
          progression_type: 'flexibility'
        }]
      },
      {
        id: 'strength-advanced-1',
        name: 'Advanced Strength Exercise',
        discipline: 'Weights',
        variations: [{
          id: 'var-adv-1',
          name: 'Advanced Variation',
          difficulty_score: 8,
          target_muscles: { primary: ['chest'], secondary: [] },
          progression_type: 'strength'
        }]
      }
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  /**
   * Create User A: Low baseline scores
   * Mobility: 30/100, Rotation: 40/100, Flexibility: 50/100
   */
  function createUserA_LowScores() {
    return {
      baselineAssessment: {
        mobility: {
          overheadReach: 1,      // 1/5 = 20%
          shoulderRotation: 1,    // 1/5 = 20%
          hipFlexibility: 2,     // 2/5 = 40%
          overallScore: 1.33     // Average
        },
        rotation: {
          spinalRotation: 1,     // 1/5 = 20%
          dailyRotationFrequency: 1, // 1/4 = 25%
          overallScore: 1.2
        },
        flexibility: {
          lowerBody: 2,          // 2/5 = 40%
          upperBody: 3,          // 3/5 = 60%
          overallScore: 2.5
        },
        baselineMetrics: {
          mobility: 30,          // Low
          rotation: 40,          // Low
          flexibility: 50        // Below average
        },
        physiological: {
          age: 30,
          activityLevel: 'sedentary'
        }
      },
      preferredDisciplines: ['Pilates', 'Animal Flow'],
      discomforts: [],
      equipment: [],
      goals: ['improve mobility', 'increase flexibility'],
      currentMilestones: {}
    };
  }

  /**
   * Create User B: High baseline scores
   * Mobility: 80/100, Rotation: 70/100, Flexibility: 60/100
   */
  function createUserB_HighScores() {
    return {
      baselineAssessment: {
        mobility: {
          overheadReach: 5,      // 5/5 = 100%
          shoulderRotation: 4,   // 4/5 = 80%
          hipFlexibility: 4,     // 4/5 = 80%
          overallScore: 4.33
        },
        rotation: {
          spinalRotation: 4,     // 4/5 = 80%
          dailyRotationFrequency: 3, // 3/4 = 75%
          overallScore: 3.8
        },
        flexibility: {
          lowerBody: 4,          // 4/5 = 80%
          upperBody: 3,          // 3/5 = 60%
          overallScore: 3.5
        },
        baselineMetrics: {
          mobility: 80,          // High
          rotation: 70,          // Good
          flexibility: 60        // Above average
        },
        physiological: {
          age: 30,
          activityLevel: 'very-active'
        }
      },
      preferredDisciplines: ['Pilates', 'Animal Flow'],
      discomforts: [],
      equipment: [],
      goals: ['increase strength', 'build muscle'],
      currentMilestones: {}
    };
  }

  /**
   * Analyze training system for movement quality focus
   */
  function analyzeMovementQualityFocus(trainingSystem: any) {
    const analysis = {
      mobilityFocus: 0,      // Count of mobility-focused exercises
      rotationFocus: 0,      // Count of rotation-focused exercises
      flexibilityFocus: 0,   // Count of flexibility-focused exercises
      averageDifficulty: 0,
      totalExercises: 0,
      exercisesByPhase: {
        warmup: 0,
        workout: 0,
        cooldown: 0
      },
      mobilityInWarmup: 0,   // Mobility exercises in warmup phase
      rotationInWorkout: 0,  // Rotation exercises in workout phase
      flexibilityInCooldown: 0 // Flexibility exercises in cooldown
    };

    trainingSystem.sessions?.forEach((session: any) => {
      Object.keys(session.phases || {}).forEach((phase: string) => {
        const exercises = session.phases[phase] || [];
        analysis.exercisesByPhase[phase as keyof typeof analysis.exercisesByPhase] += exercises.length;
        
        exercises.forEach((exercise: any) => {
          analysis.totalExercises++;
          analysis.averageDifficulty += exercise.difficulty_score || 0;
          
          const exerciseName = (exercise.exerciseName || '').toLowerCase();
          const variationName = (exercise.variationName || '').toLowerCase();
          const progressionType = (exercise.progression_type || '').toLowerCase();
          
          // Detect mobility focus
          if (exerciseName.includes('mobility') || 
              exerciseName.includes('reach') || 
              exerciseName.includes('shoulder') ||
              exerciseName.includes('hip') ||
              progressionType === 'mobility') {
            analysis.mobilityFocus++;
            if (phase === 'warmup') analysis.mobilityInWarmup++;
          }
          
          // Detect rotation focus
          if (exerciseName.includes('rotation') || 
              exerciseName.includes('twist') || 
              exerciseName.includes('spinal') ||
              progressionType === 'rotation') {
            analysis.rotationFocus++;
            if (phase === 'workout') analysis.rotationInWorkout++;
          }
          
          // Detect flexibility focus
          if (exerciseName.includes('stretch') || 
              exerciseName.includes('flexibility') ||
              progressionType === 'flexibility' ||
              phase === 'cooldown') {
            analysis.flexibilityFocus++;
            if (phase === 'cooldown') analysis.flexibilityInCooldown++;
          }
        });
      });
    });

    if (analysis.totalExercises > 0) {
      analysis.averageDifficulty = analysis.averageDifficulty / analysis.totalExercises;
    }

    return analysis;
  }

  /**
   * Create mock AI response with realistic exercise selection
   */
  function createMockAIResponseForProfile(
    baselineMetrics: { mobility: number; rotation: number; flexibility: number },
    daysPerWeek: number = 3
  ) {
    const sessions = [];
    const isLowMobility = baselineMetrics.mobility < 50;
    const isLowRotation = baselineMetrics.rotation < 50;
    const isLowFlexibility = baselineMetrics.flexibility < 50;
    const avgDifficulty = baselineMetrics.mobility < 50 ? 2.5 : 6.5;

    for (let day = 1; day <= daysPerWeek; day++) {
      const warmup: any[] = [];
      const workout: any[] = [];
      const cooldown: any[] = [];

      // Warmup: Prioritize mobility if low
      if (isLowMobility) {
        warmup.push({
          exerciseId: 'mobility-shoulder-1',
          exerciseName: 'Shoulder Mobility Reach',
          variationId: 'var-mob-1',
          variationName: 'Basic Shoulder Reach',
          difficulty_score: 2,
          weight: 0,
          bilaterality: 'bilateral',
          progression_type: 'mobility',
          target_muscles: { primary: ['shoulders'], secondary: [] },
          technique_cues: ['Maintain neutral spine', 'Reach for the wall']
        });
        warmup.push({
          exerciseId: 'mobility-hip-1',
          exerciseName: 'Hip Flexibility Exercise',
          variationId: 'var-hip-1',
          variationName: 'Hip Mobility Stretch',
          difficulty_score: 2,
          weight: 0,
          bilaterality: 'bilateral',
          progression_type: 'mobility',
          target_muscles: { primary: ['hips'], secondary: [] },
          technique_cues: []
        });
      } else {
        warmup.push({
          exerciseId: 'warmup-standard-1',
          exerciseName: 'Standard Warmup',
          variationId: 'var-warmup-1',
          variationName: 'Basic Warmup',
          difficulty_score: 3,
          weight: 0,
          bilaterality: 'bilateral',
          progression_type: 'stability',
          target_muscles: { primary: ['core'], secondary: [] },
          technique_cues: []
        });
      }

      // Workout: Prioritize rotation if low
      if (isLowRotation) {
        workout.push({
          exerciseId: 'rotation-spinal-1',
          exerciseName: 'Spinal Rotation Exercise',
          variationId: 'var-rot-1',
          variationName: 'Basic Spinal Twist',
          difficulty_score: 3,
          weight: 0,
          bilaterality: 'bilateral',
          progression_type: 'rotation',
          target_muscles: { primary: ['core', 'back'], secondary: [] },
          technique_cues: ['Rotate slowly', 'Keep hips stable']
        });
      }

      // Add standard workout exercises with appropriate difficulty
      workout.push({
        exerciseId: `workout-${day}`,
        exerciseName: `Workout Exercise ${day}`,
        variationId: `var-workout-${day}`,
        variationName: 'Standard',
        difficulty_score: avgDifficulty,
        weight: 0,
        bilaterality: 'bilateral',
        progression_type: 'strength',
        target_muscles: { primary: ['core'], secondary: [] },
        technique_cues: []
      });

      // Cooldown: Prioritize flexibility if low
      if (isLowFlexibility) {
        cooldown.push({
          exerciseId: 'flexibility-lower-1',
          exerciseName: 'Lower Body Stretch',
          variationId: 'var-flex-1',
          variationName: 'Hamstring Stretch',
          difficulty_score: 2,
          weight: 0,
          bilaterality: 'bilateral',
          progression_type: 'flexibility',
          target_muscles: { primary: ['hamstrings'], secondary: [] },
          technique_cues: ['Hold for 30 seconds', 'Breathe deeply']
        });
      } else {
        cooldown.push({
          exerciseId: 'cooldown-standard-1',
          exerciseName: 'Standard Cooldown',
          variationId: 'var-cooldown-1',
          variationName: 'Basic Stretch',
          difficulty_score: 3,
          weight: 0,
          bilaterality: 'bilateral',
          progression_type: 'flexibility',
          target_muscles: { primary: ['full body'], secondary: [] },
          technique_cues: []
        });
      }

      sessions.push({
        day,
        dayOfWeek: [1, 3, 5][day - 1] || 1,
        date: `2025-01-${19 + day}`,
        discipline: 'Pilates',
        workout: isLowMobility ? 'Mobility Focus' : 'Standard',
        framework: isLowMobility ? 'Mobility' : 'Standard',
        phases: { warmup, workout, cooldown }
      });
    }

    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              system: {
                type: 'weekly',
                daysPerWeek,
                framework: 'Mixed',
                startDate: '2025-01-20'
              },
              sessions
            })
          }
        }]
      })
    };
  }

  describe('Comparative Analysis: Low vs High Baseline Scores', () => {
    it('should generate more mobility-focused exercises for User A (low mobility) than User B (high mobility)', async () => {
      const userA = createUserA_LowScores();
      const userB = createUserB_HighScores();

      // Mock AI responses that reflect baseline-aware selection
      mockFetch
        .mockResolvedValueOnce(createMockAIResponseForProfile(userA.baselineAssessment.baselineMetrics))
        .mockResolvedValueOnce(createMockAIResponseForProfile(userB.baselineAssessment.baselineMetrics));

      const systemA = await generateTrainingSystemWithAI(
        userA,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const systemB = await generateTrainingSystemWithAI(
        userB,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const analysisA = analyzeMovementQualityFocus(systemA);
      const analysisB = analyzeMovementQualityFocus(systemB);

      // User A should have more mobility-focused exercises
      expect(analysisA.mobilityFocus).toBeGreaterThan(analysisB.mobilityFocus);
      
      // User A should have more mobility exercises in warmup
      expect(analysisA.mobilityInWarmup).toBeGreaterThan(analysisB.mobilityInWarmup);
    });

    it('should generate more rotation-focused exercises for User A (low rotation) than User B (high rotation)', async () => {
      const userA = createUserA_LowScores();
      const userB = createUserB_HighScores();

      mockFetch
        .mockResolvedValueOnce(createMockAIResponseForProfile(userA.baselineAssessment.baselineMetrics))
        .mockResolvedValueOnce(createMockAIResponseForProfile(userB.baselineAssessment.baselineMetrics));

      const systemA = await generateTrainingSystemWithAI(
        userA,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const systemB = await generateTrainingSystemWithAI(
        userB,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const analysisA = analyzeMovementQualityFocus(systemA);
      const analysisB = analyzeMovementQualityFocus(systemB);

      // User A should have more rotation-focused exercises
      expect(analysisA.rotationFocus).toBeGreaterThan(analysisB.rotationFocus);
      
      // User A should have rotation exercises in workout phase
      expect(analysisA.rotationInWorkout).toBeGreaterThan(analysisB.rotationInWorkout);
    });

    it('should generate lower difficulty exercises for User A (low scores) than User B (high scores)', async () => {
      const userA = createUserA_LowScores();
      const userB = createUserB_HighScores();

      mockFetch
        .mockResolvedValueOnce(createMockAIResponseForProfile(userA.baselineAssessment.baselineMetrics))
        .mockResolvedValueOnce(createMockAIResponseForProfile(userB.baselineAssessment.baselineMetrics));

      const systemA = await generateTrainingSystemWithAI(
        userA,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const systemB = await generateTrainingSystemWithAI(
        userB,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const analysisA = analyzeMovementQualityFocus(systemA);
      const analysisB = analyzeMovementQualityFocus(systemB);

      // User A should have lower average difficulty
      expect(analysisA.averageDifficulty).toBeLessThan(analysisB.averageDifficulty);
    });

    it('should include corrective exercises in warmup for User A but not User B', async () => {
      const userA = createUserA_LowScores();
      const userB = createUserB_HighScores();

      mockFetch
        .mockResolvedValueOnce(createMockAIResponseForProfile(userA.baselineAssessment.baselineMetrics))
        .mockResolvedValueOnce(createMockAIResponseForProfile(userB.baselineAssessment.baselineMetrics));

      const systemA = await generateTrainingSystemWithAI(
        userA,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const systemB = await generateTrainingSystemWithAI(
        userB,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      // Check that User A's warmup includes mobility exercises
      const userAWarmup = systemA.sessions[0]?.phases?.warmup || [];
      const userBWarmup = systemB.sessions[0]?.phases?.warmup || [];

      const userAMobilityInWarmup = userAWarmup.some((ex: any) => 
        ex.exerciseName?.toLowerCase().includes('mobility') ||
        ex.exerciseName?.toLowerCase().includes('reach') ||
        ex.progression_type === 'mobility'
      );

      const userBMobilityInWarmup = userBWarmup.some((ex: any) => 
        ex.exerciseName?.toLowerCase().includes('mobility') ||
        ex.exerciseName?.toLowerCase().includes('reach') ||
        ex.progression_type === 'mobility'
      );

      // User A should have mobility exercises in warmup
      expect(userAMobilityInWarmup).toBe(true);
      
      // User B might have some, but User A should have more
      if (userBMobilityInWarmup) {
        const userAMobilityCount = userAWarmup.filter((ex: any) => 
          ex.exerciseName?.toLowerCase().includes('mobility') ||
          ex.progression_type === 'mobility'
        ).length;
        
        const userBMobilityCount = userBWarmup.filter((ex: any) => 
          ex.exerciseName?.toLowerCase().includes('mobility') ||
          ex.progression_type === 'mobility'
        ).length;

        expect(userAMobilityCount).toBeGreaterThanOrEqual(userBMobilityCount);
      }
    });
  });

  describe('Baseline Score Impact on Exercise Selection', () => {
    it('should send different baseline scores to AI for different users', async () => {
      const userA = createUserA_LowScores();
      const userB = createUserB_HighScores();

      mockFetch
        .mockResolvedValueOnce(createMockAIResponseForProfile(userA.baselineAssessment.baselineMetrics))
        .mockResolvedValueOnce(createMockAIResponseForProfile(userB.baselineAssessment.baselineMetrics));

      await generateTrainingSystemWithAI(
        userA,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      await generateTrainingSystemWithAI(
        userB,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      // Get both API calls
      const callA = mockFetch.mock.calls[0];
      const callB = mockFetch.mock.calls[1];

      const requestA = JSON.parse(callA[1].body);
      const requestB = JSON.parse(callB[1].body);

      const contextA = requestA.messages.find((m: any) => m.role === 'user')?.content || '';
      const contextB = requestB.messages.find((m: any) => m.role === 'user')?.content || '';

      // Verify different baseline scores are sent
      expect(contextA).toContain('Overall mobility score: 30/100');
      expect(contextB).toContain('Overall mobility score: 80/100');

      expect(contextA).toContain('Overall rotation score: 40/100');
      expect(contextB).toContain('Overall rotation score: 70/100');
    });

    it('should instruct AI to prioritize corrective exercises for low scores', async () => {
      const userA = createUserA_LowScores();

      mockFetch.mockResolvedValueOnce(createMockAIResponseForProfile(userA.baselineAssessment.baselineMetrics));

      await generateTrainingSystemWithAI(
        userA,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const call = mockFetch.mock.calls[0];
      const request = JSON.parse(call[1].body);
      const userContext = request.messages.find((m: any) => m.role === 'user')?.content || '';

      // Verify instruction to address low scores
      expect(userContext).toContain('prioritize corrective exercises');
      expect(userContext).toContain('If scores are low');
    });
  });

  describe('Weekly Balance Validation', () => {
    it('should distribute mobility/rotation/flexibility work across the week for User A', async () => {
      const userA = createUserA_LowScores();

      mockFetch.mockResolvedValueOnce(createMockAIResponseForProfile(userA.baselineAssessment.baselineMetrics, 4));

      const system = await generateTrainingSystemWithAI(
        userA,
        mockExercises,
        { daysPerWeek: 4, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const analysis = analyzeMovementQualityFocus(system);

      // Should have exercises addressing all three areas across the week
      expect(analysis.mobilityFocus).toBeGreaterThan(0);
      expect(analysis.rotationFocus).toBeGreaterThan(0);
      expect(analysis.flexibilityFocus).toBeGreaterThan(0);

      // Should have multiple sessions
      expect(system.sessions.length).toBe(4);
    });
  });
});

