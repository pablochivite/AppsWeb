/**
 * Test Data Fixtures
 * 
 * Provides test data generators and fixtures for E2E tests.
 */

export const testUsers = {
  athlete: {
    email: process.env.TEST_ATHLETE_EMAIL || 'athlete@test.com',
    password: process.env.TEST_ATHLETE_PASSWORD || 'testpass123',
    displayName: 'Test Athlete',
  },
  coach: {
    email: process.env.TEST_COACH_EMAIL || 'coach@test.com',
    password: process.env.TEST_COACH_PASSWORD || 'testpass123',
    displayName: 'Test Coach',
  },
};

/**
 * Generate a unique test email
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${random}@test.com`;
}

/**
 * Generate test user profile data
 */
export function generateTestUserProfile(overrides = {}) {
  return {
    preferredDisciplines: ['Pilates'],
    discomforts: [],
    equipment: [],
    goals: [],
    ...overrides,
  };
}

/**
 * Generate test onboarding answers
 */
export function generateOnboardingAnswers(overrides = {}) {
  return {
    discomforts: ['None'],
    disciplines: ['Pilates'],
    ...overrides,
  };
}

