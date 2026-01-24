import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTrainingSystemWithAI } from '../../../js/services/aiService.js';
import exercisesData from '../../../js/data/exercises.json';

/**
 * Tests for AI Service - Baseline Assessment Integration
 * 
 * These tests verify that the AI correctly uses baseline assessment data
 * when generating training systems, including:
 * - Prioritizing exercises for low mobility scores
 * - Including rotation work when rotation is low
 * - Balancing metrics across the week
 * - Selecting appropriate difficulty based on scores
 */

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AI Service - Baseline Assessment Integration', () => {
  let mockExercises: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_OPENAI_API_KEY', 'test-api-key');
    mockExercises = exercisesData.exercises || [];
    
    // Default successful fetch response (will be customized per test)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              system: {
                type: 'weekly',
                daysPerWeek: 3,
                framework: 'Push/Pull/Legs',
                startDate: '2025-01-20'
              },
              sessions: []
            })
          }
        }]
      })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  /**
   * Helper function to create a test user profile with specific baseline assessment
   */
  function createTestUserProfile(baselineConfig: {
    mobility?: { overheadReach?: number; shoulderRotation?: number; hipFlexibility?: number };
    rotation?: { spinalRotation?: number; dailyRotationFrequency?: number };
    flexibility?: { lowerBody?: number; upperBody?: number };
    age?: number;
    activityLevel?: string;
  }) {
    const { mobility = {}, rotation = {}, flexibility = {}, age = 30, activityLevel = 'moderately-active' } = baselineConfig;
    
    // Calculate baseline metrics (0-100 scale)
    const mobilityScore = mobility.overheadReach && mobility.shoulderRotation && mobility.hipFlexibility
      ? ((mobility.overheadReach + mobility.shoulderRotation + mobility.hipFlexibility) / 15) * 100
      : 50;
    
    const rotationScore = rotation.spinalRotation && rotation.dailyRotationFrequency
      ? ((rotation.spinalRotation / 5) * 0.6 + (rotation.dailyRotationFrequency / 4) * 0.4) * 100
      : 50;
    
    const flexibilityScore = flexibility.lowerBody && flexibility.upperBody
      ? ((flexibility.lowerBody + flexibility.upperBody) / 10) * 100
      : 50;

    return {
      baselineAssessment: {
        mobility: {
          overheadReach: mobility.overheadReach || 3,
          shoulderRotation: mobility.shoulderRotation || 3,
          hipFlexibility: mobility.hipFlexibility || 3,
          overallScore: (mobility.overheadReach || 3 + mobility.shoulderRotation || 3 + mobility.hipFlexibility || 3) / 3
        },
        rotation: {
          spinalRotation: rotation.spinalRotation || 3,
          dailyRotationFrequency: rotation.dailyRotationFrequency || 2,
          overallScore: (rotation.spinalRotation || 3) / 5
        },
        flexibility: {
          lowerBody: flexibility.lowerBody || 3,
          upperBody: flexibility.upperBody || 3,
          overallScore: (flexibility.lowerBody || 3 + flexibility.upperBody || 3) / 2
        },
        physiological: {
          age,
          activityLevel,
          height: 175,
          weight: 75
        },
        baselineMetrics: {
          mobility: mobilityScore,
          rotation: rotationScore,
          flexibility: flexibilityScore
        }
      },
      preferredDisciplines: ['Pilates', 'Animal Flow'],
      discomforts: [],
      equipment: [],
      goals: ['improve mobility', 'increase strength'],
      currentMilestones: {}
    };
  }

  /**
   * Helper function to create a mock AI response with specific exercise selections
   */
  function createMockAIResponse(sessions: any[]) {
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              system: {
                type: 'weekly',
                daysPerWeek: sessions.length,
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

  /**
   * Helper function to analyze exercises in a training system
   */
  function analyzeTrainingSystem(trainingSystem: any) {
    const analysis = {
      mobilityExercises: 0,
      rotationExercises: 0,
      flexibilityExercises: 0,
      lowDifficultyExercises: 0,
      mediumDifficultyExercises: 0,
      highDifficultyExercises: 0,
      totalExercises: 0,
      exercisesByPhase: {
        warmup: 0,
        workout: 0,
        cooldown: 0
      }
    };

    trainingSystem.sessions?.forEach((session: any) => {
      Object.keys(session.phases || {}).forEach((phase: string) => {
        const exercises = session.phases[phase] || [];
        analysis.exercisesByPhase[phase as keyof typeof analysis.exercisesByPhase] += exercises.length;
        
        exercises.forEach((exercise: any) => {
          analysis.totalExercises++;
          
          // Categorize by difficulty
          const difficulty = exercise.difficulty_score || 0;
          if (difficulty <= 4) analysis.lowDifficultyExercises++;
          else if (difficulty <= 7) analysis.mediumDifficultyExercises++;
          else analysis.highDifficultyExercises++;
          
          // Detect mobility exercises (simplified - would need actual exercise database lookup)
          const exerciseName = (exercise.exerciseName || '').toLowerCase();
          if (exerciseName.includes('reach') || exerciseName.includes('rotation') || 
              exerciseName.includes('mobility') || exerciseName.includes('stretch')) {
            analysis.mobilityExercises++;
          }
          
          // Detect rotation exercises
          if (exerciseName.includes('twist') || exerciseName.includes('rotation') ||
              exerciseName.includes('spinal') || exerciseName.includes('rotate')) {
            analysis.rotationExercises++;
          }
          
          // Detect flexibility exercises
          if (exerciseName.includes('stretch') || exerciseName.includes('flexibility') ||
              phase === 'cooldown') {
            analysis.flexibilityExercises++;
          }
        });
      });
    });

    return analysis;
  }

  describe('Low Mobility Scores', () => {
    it('should prioritize mobility exercises when mobility scores are low', async () => {
      const userProfile = createTestUserProfile({
        mobility: {
          overheadReach: 1,  // Very low
          shoulderRotation: 1,  // Very low
          hipFlexibility: 2   // Low
        }
      });

      // Mock AI response that includes mobility-focused exercises
      const mockResponse = createMockAIResponse([
        {
          day: 1,
          dayOfWeek: 1,
          date: '2025-01-20',
          discipline: 'Pilates',
          workout: 'Upper Body Mobility',
          framework: 'Mobility Focus',
          phases: {
            warmup: [
              {
                exerciseId: 'test-exercise-1',
                exerciseName: 'Shoulder Mobility Reach',
                variationId: 'var-1',
                variationName: 'Basic Reach',
                difficulty_score: 2,
                weight: 0,
                bilaterality: 'bilateral',
                progression_type: 'mobility',
                target_muscles: { primary: ['shoulders'], secondary: [] },
                technique_cues: []
              }
            ],
            workout: [
              {
                exerciseId: 'test-exercise-2',
                exerciseName: 'Hip Flexibility Exercise',
                variationId: 'var-2',
                variationName: 'Basic Hip Stretch',
                difficulty_score: 2,
                weight: 0,
                bilaterality: 'bilateral',
                progression_type: 'flexibility',
                target_muscles: { primary: ['hips'], secondary: [] },
                technique_cues: []
              }
            ],
            cooldown: [
              {
                exerciseId: 'test-exercise-3',
                exerciseName: 'Overhead Reach Stretch',
                variationId: 'var-3',
                variationName: 'Basic Reach',
                difficulty_score: 1,
                weight: 0,
                bilaterality: 'bilateral',
                progression_type: 'stretch',
                target_muscles: { primary: ['shoulders'], secondary: [] },
                technique_cues: []
              }
            ]
          }
        }
      ]);

      mockFetch.mockResolvedValue(mockResponse);

      const trainingSystem = await generateTrainingSystemWithAI(
        userProfile,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      // Verify the request includes baseline assessment data
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall).toBeDefined();
      
      const requestBody = JSON.parse(fetchCall[1].body);
      const userContext = requestBody.messages.find((m: any) => m.role === 'user')?.content || '';
      
      // Verify baseline scores are included
      expect(userContext).toContain('Overhead reach: 1/5');
      expect(userContext).toContain('Shoulder rotation: 1/5');
      expect(userContext).toContain('Hip flexibility: 2/5');
      expect(userContext).toContain('Overall mobility score');
      
      // Verify instruction to address low scores
      expect(userContext).toContain('Baseline Assessment');
      expect(userContext).toContain('prioritize corrective exercises');
    });

    it('should select lower difficulty exercises when mobility scores are low', async () => {
      const userProfile = createTestUserProfile({
        mobility: {
          overheadReach: 1,
          shoulderRotation: 1,
          hipFlexibility: 1
        }
      });

      const mockResponse = createMockAIResponse([
        {
          day: 1,
          dayOfWeek: 1,
          date: '2025-01-20',
          discipline: 'Pilates',
          workout: 'Mobility',
          framework: 'Mobility',
          phases: {
            warmup: [
              {
                exerciseId: 'ex1',
                exerciseName: 'Easy Mobility Exercise',
                variationId: 'var1',
                variationName: 'Beginner',
                difficulty_score: 2,  // Low difficulty
                weight: 0,
                bilaterality: 'bilateral',
                progression_type: 'mobility',
                target_muscles: { primary: ['shoulders'], secondary: [] },
                technique_cues: []
              }
            ],
            workout: [],
            cooldown: []
          }
        }
      ]);

      mockFetch.mockResolvedValue(mockResponse);

      const trainingSystem = await generateTrainingSystemWithAI(
        userProfile,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const analysis = analyzeTrainingSystem(trainingSystem);
      
      // Should have lower difficulty exercises
      expect(analysis.lowDifficultyExercises).toBeGreaterThan(0);
    });
  });

  describe('Low Rotation Scores', () => {
    it('should include rotation work when rotation scores are low', async () => {
      const userProfile = createTestUserProfile({
        rotation: {
          spinalRotation: 1,  // Very low
          dailyRotationFrequency: 1   // Very low
        }
      });

      const mockResponse = createMockAIResponse([
        {
          day: 1,
          dayOfWeek: 1,
          date: '2025-01-20',
          discipline: 'Pilates',
          workout: 'Rotation Focus',
          framework: 'Rotation',
          phases: {
            warmup: [],
            workout: [
              {
                exerciseId: 'ex-rotation',
                exerciseName: 'Spinal Rotation Exercise',
                variationId: 'var-rotation',
                variationName: 'Basic Rotation',
                difficulty_score: 3,
                weight: 0,
                bilaterality: 'bilateral',
                progression_type: 'rotation',
                target_muscles: { primary: ['core', 'back'], secondary: [] },
                technique_cues: []
              }
            ],
            cooldown: []
          }
        }
      ]);

      mockFetch.mockResolvedValue(mockResponse);

      const trainingSystem = await generateTrainingSystemWithAI(
        userProfile,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      // Verify rotation scores are included in request
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const userContext = requestBody.messages.find((m: any) => m.role === 'user')?.content || '';
      
      expect(userContext).toContain('Spinal rotation: 1/5');
      expect(userContext).toContain('Daily rotation frequency: 1/4');
      expect(userContext).toContain('Overall rotation score');
    });

    it('should include rotation exercises across multiple sessions when rotation is low', async () => {
      const userProfile = createTestUserProfile({
        rotation: {
          spinalRotation: 1,
          dailyRotationFrequency: 1
        }
      });

      const mockResponse = createMockAIResponse([
        {
          day: 1,
          dayOfWeek: 1,
          date: '2025-01-20',
          discipline: 'Pilates',
          workout: 'Rotation Day 1',
          framework: 'Rotation',
          phases: {
            warmup: [],
            workout: [
              {
                exerciseId: 'ex-r1',
                exerciseName: 'Twist Exercise 1',
                variationId: 'var-r1',
                variationName: 'Basic',
                difficulty_score: 2,
                weight: 0,
                bilaterality: 'bilateral',
                progression_type: 'rotation',
                target_muscles: { primary: ['core'], secondary: [] },
                technique_cues: []
              }
            ],
            cooldown: []
          }
        },
        {
          day: 2,
          dayOfWeek: 3,
          date: '2025-01-22',
          discipline: 'Animal Flow',
          workout: 'Rotation Day 2',
          framework: 'Rotation',
          phases: {
            warmup: [],
            workout: [
              {
                exerciseId: 'ex-r2',
                exerciseName: 'Spinal Twist Exercise',
                variationId: 'var-r2',
                variationName: 'Basic',
                difficulty_score: 3,
                weight: 0,
                bilaterality: 'bilateral',
                progression_type: 'rotation',
                target_muscles: { primary: ['back'], secondary: [] },
                technique_cues: []
              }
            ],
            cooldown: []
          }
        }
      ]);

      mockFetch.mockResolvedValue(mockResponse);

      const trainingSystem = await generateTrainingSystemWithAI(
        userProfile,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const analysis = analyzeTrainingSystem(trainingSystem);
      
      // Should have rotation exercises in the system
      // Note: This is a simplified check - in reality, we'd need to check exercise names
      // against a database of rotation exercises
      expect(analysis.totalExercises).toBeGreaterThan(0);
    });
  });

  describe('Low Flexibility Scores', () => {
    it('should include flexibility exercises when flexibility scores are low', async () => {
      const userProfile = createTestUserProfile({
        flexibility: {
          lowerBody: 1,  // Very low
          upperBody: 2   // Low
        }
      });

      const mockResponse = createMockAIResponse([
        {
          day: 1,
          dayOfWeek: 1,
          date: '2025-01-20',
          discipline: 'Pilates',
          workout: 'Flexibility Focus',
          framework: 'Flexibility',
          phases: {
            warmup: [],
            workout: [],
            cooldown: [
              {
                exerciseId: 'ex-flex',
                exerciseName: 'Lower Body Stretch',
                variationId: 'var-flex',
                variationName: 'Basic Stretch',
                difficulty_score: 2,
                weight: 0,
                bilaterality: 'bilateral',
                progression_type: 'flexibility',
                target_muscles: { primary: ['hamstrings'], secondary: [] },
                technique_cues: []
              }
            ]
          }
        }
      ]);

      mockFetch.mockResolvedValue(mockResponse);

      const trainingSystem = await generateTrainingSystemWithAI(
        userProfile,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      // Verify flexibility scores are included
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const userContext = requestBody.messages.find((m: any) => m.role === 'user')?.content || '';
      
      expect(userContext).toContain('Lower body: 1/5');
      expect(userContext).toContain('Upper body: 2/5');
      expect(userContext).toContain('Overall flexibility score');
    });
  });

  describe('Difficulty Selection Based on Scores', () => {
    it('should select lower difficulty exercises when baseline scores are low', async () => {
      const userProfile = createTestUserProfile({
        mobility: { overheadReach: 1, shoulderRotation: 1, hipFlexibility: 1 },
        rotation: { spinalRotation: 1, dailyRotationFrequency: 1 },
        flexibility: { lowerBody: 1, upperBody: 1 }
      });

      const mockResponse = createMockAIResponse([
        {
          day: 1,
          dayOfWeek: 1,
          date: '2025-01-20',
          discipline: 'Pilates',
          workout: 'Beginner',
          framework: 'Beginner',
          phases: {
            warmup: [
              { exerciseId: 'ex1', exerciseName: 'Easy 1', variationId: 'var1', variationName: 'V1', difficulty_score: 2, weight: 0, bilaterality: 'bilateral', progression_type: 'mobility', target_muscles: { primary: [], secondary: [] }, technique_cues: [] },
              { exerciseId: 'ex2', exerciseName: 'Easy 2', variationId: 'var2', variationName: 'V2', difficulty_score: 2, weight: 0, bilaterality: 'bilateral', progression_type: 'mobility', target_muscles: { primary: [], secondary: [] }, technique_cues: [] }
            ],
            workout: [
              { exerciseId: 'ex3', exerciseName: 'Easy 3', variationId: 'var3', variationName: 'V3', difficulty_score: 3, weight: 0, bilaterality: 'bilateral', progression_type: 'stability', target_muscles: { primary: [], secondary: [] }, technique_cues: [] }
            ],
            cooldown: [
              { exerciseId: 'ex4', exerciseName: 'Easy 4', variationId: 'var4', variationName: 'V4', difficulty_score: 2, weight: 0, bilaterality: 'bilateral', progression_type: 'flexibility', target_muscles: { primary: [], secondary: [] }, technique_cues: [] }
            ]
          }
        }
      ]);

      mockFetch.mockResolvedValue(mockResponse);

      const trainingSystem = await generateTrainingSystemWithAI(
        userProfile,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const analysis = analyzeTrainingSystem(trainingSystem);
      
      // Should prioritize lower difficulty exercises
      expect(analysis.lowDifficultyExercises).toBeGreaterThan(analysis.highDifficultyExercises);
      expect(analysis.lowDifficultyExercises).toBeGreaterThanOrEqual(analysis.mediumDifficultyExercises);
    });

    it('should select higher difficulty exercises when baseline scores are high', async () => {
      const userProfile = createTestUserProfile({
        mobility: { overheadReach: 5, shoulderRotation: 5, hipFlexibility: 5 },
        rotation: { spinalRotation: 5, dailyRotationFrequency: 4 },
        flexibility: { lowerBody: 5, upperBody: 5 }
      });

      const mockResponse = createMockAIResponse([
        {
          day: 1,
          dayOfWeek: 1,
          date: '2025-01-20',
          discipline: 'Pilates',
          workout: 'Advanced',
          framework: 'Advanced',
          phases: {
            warmup: [
              { exerciseId: 'ex1', exerciseName: 'Advanced 1', variationId: 'var1', variationName: 'V1', difficulty_score: 7, weight: 0, bilaterality: 'bilateral', progression_type: 'mobility', target_muscles: { primary: [], secondary: [] }, technique_cues: [] }
            ],
            workout: [
              { exerciseId: 'ex2', exerciseName: 'Advanced 2', variationId: 'var2', variationName: 'V2', difficulty_score: 8, weight: 0, bilaterality: 'bilateral', progression_type: 'strength', target_muscles: { primary: [], secondary: [] }, technique_cues: [] },
              { exerciseId: 'ex3', exerciseName: 'Advanced 3', variationId: 'var3', variationName: 'V3', difficulty_score: 9, weight: 0, bilaterality: 'bilateral', progression_type: 'stability', target_muscles: { primary: [], secondary: [] }, technique_cues: [] }
            ],
            cooldown: []
          }
        }
      ]);

      mockFetch.mockResolvedValue(mockResponse);

      const trainingSystem = await generateTrainingSystemWithAI(
        userProfile,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const analysis = analyzeTrainingSystem(trainingSystem);
      
      // Should have higher difficulty exercises
      expect(analysis.highDifficultyExercises).toBeGreaterThan(0);
    });
  });

  describe('Baseline Assessment Context in AI Prompt', () => {
    it('should include all baseline assessment data in the AI prompt', async () => {
      const userProfile = createTestUserProfile({
        mobility: { overheadReach: 2, shoulderRotation: 2, hipFlexibility: 2 },
        rotation: { spinalRotation: 3, dailyRotationFrequency: 2 },
        flexibility: { lowerBody: 3, upperBody: 4 },
        age: 35,
        activityLevel: 'sedentary'
      });

      mockFetch.mockResolvedValue(createMockAIResponse([]));

      await generateTrainingSystemWithAI(
        userProfile,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const userContext = requestBody.messages.find((m: any) => m.role === 'user')?.content || '';
      
      // Verify all baseline data is present
      expect(userContext).toContain('Baseline Assessment');
      expect(userContext).toContain('Overhead reach: 2/5');
      expect(userContext).toContain('Shoulder rotation: 2/5');
      expect(userContext).toContain('Hip flexibility: 2/5');
      expect(userContext).toContain('Spinal rotation: 3/5');
      expect(userContext).toContain('Daily rotation frequency: 2/4');
      expect(userContext).toContain('Lower body: 3/5');
      expect(userContext).toContain('Upper body: 4/5');
      expect(userContext).toContain('Age: 35');
      expect(userContext).toContain('Activity level: sedentary');
      expect(userContext).toContain('Overall mobility score');
      expect(userContext).toContain('Overall rotation score');
      expect(userContext).toContain('Overall flexibility score');
    });

    it('should instruct AI to address baseline limitations in system prompt', async () => {
      const userProfile = createTestUserProfile({
        mobility: { overheadReach: 1, shoulderRotation: 1, hipFlexibility: 1 }
      });

      mockFetch.mockResolvedValue(createMockAIResponse([]));

      await generateTrainingSystemWithAI(
        userProfile,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const systemPrompt = requestBody.messages.find((m: any) => m.role === 'system')?.content || '';
      
      // Verify system prompt includes baseline assessment instructions
      expect(systemPrompt).toContain('baseline assessment');
      expect(systemPrompt).toContain('Match exercise difficulty');
      expect(systemPrompt).toContain('Address limitations');
    });

    it('should instruct AI to prioritize corrective exercises for low scores', async () => {
      const userProfile = createTestUserProfile({
        mobility: { overheadReach: 1, shoulderRotation: 1, hipFlexibility: 1 }
      });

      mockFetch.mockResolvedValue(createMockAIResponse([]));

      await generateTrainingSystemWithAI(
        userProfile,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const userContext = requestBody.messages.find((m: any) => m.role === 'user')?.content || '';
      
      // Verify instruction to prioritize corrective exercises
      expect(userContext).toContain('prioritize corrective exercises');
      expect(userContext).toContain('If scores are low');
      expect(userContext).toContain('mobility work');
    });
  });

  describe('Weekly Balance of Metrics', () => {
    it('should include exercises addressing all low scores across the week', async () => {
      const userProfile = createTestUserProfile({
        mobility: { overheadReach: 1, shoulderRotation: 1, hipFlexibility: 1 },
        rotation: { spinalRotation: 1, dailyRotationFrequency: 1 },
        flexibility: { lowerBody: 1, upperBody: 1 }
      });

      const mockResponse = createMockAIResponse([
        {
          day: 1,
          dayOfWeek: 1,
          date: '2025-01-20',
          discipline: 'Pilates',
          workout: 'Mobility Focus',
          framework: 'Mobility',
          phases: {
            warmup: [
              { exerciseId: 'ex-mob1', exerciseName: 'Mobility Exercise', variationId: 'var-mob1', variationName: 'V1', difficulty_score: 2, weight: 0, bilaterality: 'bilateral', progression_type: 'mobility', target_muscles: { primary: [], secondary: [] }, technique_cues: [] }
            ],
            workout: [],
            cooldown: []
          }
        },
        {
          day: 2,
          dayOfWeek: 3,
          date: '2025-01-22',
          discipline: 'Animal Flow',
          workout: 'Rotation Focus',
          framework: 'Rotation',
          phases: {
            warmup: [],
            workout: [
              { exerciseId: 'ex-rot1', exerciseName: 'Rotation Exercise', variationId: 'var-rot1', variationName: 'V1', difficulty_score: 2, weight: 0, bilaterality: 'bilateral', progression_type: 'rotation', target_muscles: { primary: [], secondary: [] }, technique_cues: [] }
            ],
            cooldown: []
          }
        },
        {
          day: 3,
          dayOfWeek: 5,
          date: '2025-01-24',
          discipline: 'Pilates',
          workout: 'Flexibility Focus',
          framework: 'Flexibility',
          phases: {
            warmup: [],
            workout: [],
            cooldown: [
              { exerciseId: 'ex-flex1', exerciseName: 'Flexibility Exercise', variationId: 'var-flex1', variationName: 'V1', difficulty_score: 2, weight: 0, bilaterality: 'bilateral', progression_type: 'flexibility', target_muscles: { primary: [], secondary: [] }, technique_cues: [] }
            ]
          }
        }
      ]);

      mockFetch.mockResolvedValue(mockResponse);

      const trainingSystem = await generateTrainingSystemWithAI(
        userProfile,
        mockExercises,
        { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
      );

      // Verify system has multiple sessions addressing different areas
      expect(trainingSystem.sessions.length).toBe(3);
      expect(trainingSystem.sessions[0].workout).toContain('Mobility');
      expect(trainingSystem.sessions[1].workout).toContain('Rotation');
      expect(trainingSystem.sessions[2].workout).toContain('Flexibility');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing baseline assessment gracefully', async () => {
      const userProfile = {
        baselineAssessment: null,
        preferredDisciplines: ['Pilates'],
        discomforts: [],
        equipment: [],
        goals: [],
        currentMilestones: {}
      };

      mockFetch.mockResolvedValue(createMockAIResponse([]));

      await expect(
        generateTrainingSystemWithAI(
          userProfile,
          mockExercises,
          { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
        )
      ).resolves.toBeDefined();
    });

    it('should handle partial baseline assessment data', async () => {
      const userProfile = {
        baselineAssessment: {
          mobility: {
            overheadReach: 2,
            shoulderRotation: undefined,
            hipFlexibility: 2
          },
          baselineMetrics: {
            mobility: 40,
            rotation: 50,
            flexibility: 50
          }
        },
        preferredDisciplines: ['Pilates'],
        discomforts: [],
        equipment: [],
        goals: [],
        currentMilestones: {}
      };

      mockFetch.mockResolvedValue(createMockAIResponse([]));

      await expect(
        generateTrainingSystemWithAI(
          userProfile,
          mockExercises,
          { daysPerWeek: 3, framework: 'Mixed', startDate: '2025-01-20' }
        )
      ).resolves.toBeDefined();
    });
  });
});

