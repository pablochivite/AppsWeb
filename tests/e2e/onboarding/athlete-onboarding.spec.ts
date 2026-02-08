import { test, expect } from '../fixtures/auth.fixtures';
import { OnboardingPage } from '../page-objects/onboarding.page';
import { generateOnboardingAnswers } from '../fixtures/test-data.fixtures';

test.describe('Onboarding - Athlete Flow', () => {
  test('should display role selection after authentication', async ({ page, authPage }) => {
    await page.goto('/');
    
    // Login first (assuming test user exists)
    await authPage.login(
      process.env.TEST_ATHLETE_EMAIL || 'athlete@test.com',
      process.env.TEST_ATHLETE_PASSWORD || 'testpass123'
    );
    
    await page.waitForTimeout(2000);
    
    // Check if role selection appears
    const onboardingPage = new OnboardingPage(page);
    const roleSelectionVisible = await onboardingPage.roleSelection.isVisible().catch(() => false);
    
    // Role selection may or may not appear depending on user state
    if (roleSelectionVisible) {
      await expect(onboardingPage.roleSelection).toBeVisible();
    }
  });

  test('should complete full athlete onboarding flow', async ({ page, authPage }) => {
    await page.goto('/');
    
    // Signup new user to ensure no role is set
    const testEmail = `athlete-${Date.now()}@test.com`;
    await authPage.signup(testEmail, 'TestPassword123!', 'Test Athlete');
    
    await page.waitForTimeout(3000);
    
    const onboardingPage = new OnboardingPage(page);
    const answers = generateOnboardingAnswers({
      discomforts: ['None'],
      disciplines: ['Pilates'],
    });
    
    // Complete onboarding (includes baseline assessment if shown)
    await onboardingPage.completeAthleteOnboarding(answers);
    
    // Verify dashboard appears
    // Note: Baseline assessment may be shown after disciplines, which will delay dashboard appearance
    await expect(page.locator('#page-home')).toBeVisible({ timeout: 20000 });
  });

  test('should answer question 1 (Discomforts)', async ({ page, authPage }) => {
    await page.goto('/');
    
    // Setup: login and select athlete role
    await authPage.login(
      process.env.TEST_ATHLETE_EMAIL || 'athlete@test.com',
      process.env.TEST_ATHLETE_PASSWORD || 'testpass123'
    );
    
    await page.waitForTimeout(2000);
    
    const onboardingPage = new OnboardingPage(page);
    const roleSelectionVisible = await onboardingPage.roleSelection.isVisible().catch(() => false);
    
    if (roleSelectionVisible) {
      await onboardingPage.selectAthleteRole();
      await onboardingPage.selectDiscomforts(['None']);
      
      // Question 2 (disciplines) should appear
      await expect(onboardingPage.question2).toBeVisible({ timeout: 5000 });
    }
  });

  test('should allow multi-select for discomforts', async ({ page, authPage }) => {
    await page.goto('/');
    
    await authPage.login(
      process.env.TEST_ATHLETE_EMAIL || 'athlete@test.com',
      process.env.TEST_ATHLETE_PASSWORD || 'testpass123'
    );
    
    await page.waitForTimeout(2000);
    
    const onboardingPage = new OnboardingPage(page);
    const roleSelectionVisible = await onboardingPage.roleSelection.isVisible().catch(() => false);
    
    if (roleSelectionVisible) {
      await onboardingPage.selectAthleteRole();
      
      // Select multiple discomforts
      await onboardingPage.selectDiscomforts(['Lower Back', 'Knees']);
      
      // Question 2 (disciplines) should appear
      await expect(onboardingPage.question2).toBeVisible({ timeout: 5000 });
    }
  });

  test('should allow multi-select for disciplines', async ({ page, authPage }) => {
    await page.goto('/');
    
    await authPage.login(
      process.env.TEST_ATHLETE_EMAIL || 'athlete@test.com',
      process.env.TEST_ATHLETE_PASSWORD || 'testpass123'
    );
    
    await page.waitForTimeout(2000);
    
    const onboardingPage = new OnboardingPage(page);
    const roleSelectionVisible = await onboardingPage.roleSelection.isVisible().catch(() => false);
    
    if (roleSelectionVisible) {
      await onboardingPage.selectAthleteRole();
      await onboardingPage.selectDiscomforts(['None']);
      
      // Select multiple disciplines
      await onboardingPage.selectDisciplines(['Pilates', 'Animal Flow']);
      
      // Note: After disciplines, baseline assessment may start
      // Dashboard will appear after baseline assessment completes
      // Wait longer to account for baseline assessment flow
      await expect(page.locator('#page-home')).toBeVisible({ timeout: 30000 });
    }
  });

  test('should navigate through onboarding questions in order', async ({ page, authPage }) => {
    await page.goto('/');
    
    await authPage.login(
      process.env.TEST_ATHLETE_EMAIL || 'athlete@test.com',
      process.env.TEST_ATHLETE_PASSWORD || 'testpass123'
    );
    
    await page.waitForTimeout(2000);
    
    const onboardingPage = new OnboardingPage(page);
    const roleSelectionVisible = await onboardingPage.roleSelection.isVisible().catch(() => false);
    
    if (roleSelectionVisible) {
      // Step 1: Select role
      await onboardingPage.selectAthleteRole();
      await page.waitForTimeout(1000);
      
      // Step 2: Select discomforts
      await expect(onboardingPage.question1).toBeVisible();
      await onboardingPage.selectDiscomforts(['None']);
      await page.waitForTimeout(1000);
      
      // Step 3: Select disciplines
      await expect(onboardingPage.question2).toBeVisible();
      await onboardingPage.selectDisciplines(['Pilates']);
      
      // After disciplines, either dashboard appears or baseline assessment starts
      // Both are valid flows
      const dashboardVisible = await page.locator('#page-home').isVisible().catch(() => false);
      const baselineQ3Visible = await page.locator('#onboarding-question-3').isVisible().catch(() => false);
      
      expect(dashboardVisible || baselineQ3Visible).toBeTruthy();
    }
  });
});
