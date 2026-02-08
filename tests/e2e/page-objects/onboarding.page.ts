import { Page, Locator } from '@playwright/test';

/**
 * Onboarding Page Object Model
 * 
 * Encapsulates onboarding UI interactions for E2E tests.
 */
export class OnboardingPage {
  readonly page: Page;
  readonly onboardingOverlay: Locator;
  readonly roleSelection: Locator;
  readonly athleteCard: Locator;
  readonly coachCard: Locator;
  readonly question1: Locator;
  readonly question2: Locator;
  readonly question3: Locator;
  readonly continueButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.onboardingOverlay = page.locator('#onboarding-overlay');
    this.roleSelection = page.locator('#onboarding-role-selection');
    this.athleteCard = page.locator('[data-role="athlete"]');
    this.coachCard = page.locator('[data-role="coach"]');
    this.question1 = page.locator('#onboarding-question-1');
    this.question2 = page.locator('#onboarding-question-2');
    this.question3 = page.locator('#onboarding-question-3');
    this.continueButton = page.locator('#discipline-complete');
  }

  /**
   * Wait for onboarding overlay to be visible
   */
  async waitForOnboarding() {
    await this.onboardingOverlay.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Select athlete role
   */
  async selectAthleteRole() {
    await this.waitForOnboarding();
    await this.athleteCard.click();
  }

  /**
   * Select coach role
   */
  async selectCoachRole() {
    await this.waitForOnboarding();
    await this.coachCard.click();
  }

  /**
   * Answer question 1 (Discomforts) - multi-select
   */
  async selectDiscomforts(values: string[]) {
    await this.question2.waitFor({ state: 'visible' });
    for (const value of values) {
      await this.page.locator(`[data-answer="discomfort"][data-value="${value}"]`).click();
    }
    await this.page.locator('#discomfort-next').click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Answer question 2 (Disciplines) - multi-select
   */
  async selectDisciplines(values: string[]) {
    await this.question2.waitFor({ state: 'visible' });
    for (const value of values) {
      await this.page.locator(`[data-answer="discipline"][data-value="${value}"]`).click();
    }
    await this.continueButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Complete full athlete onboarding flow
   */
  async completeAthleteOnboarding(answers: {
    discomforts: string[];
    disciplines: string[];
  }) {
    await this.selectAthleteRole();
    await this.selectDiscomforts(answers.discomforts);
    await this.selectDisciplines(answers.disciplines);
    // Wait for onboarding to complete and dashboard to appear
    await this.page.waitForSelector('#page-home', { timeout: 10000 });
  }
}

