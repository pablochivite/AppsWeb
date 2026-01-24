import { Page, Locator } from '@playwright/test';

/**
 * Dashboard Page Object Model
 * 
 * Encapsulates dashboard UI interactions for E2E tests.
 */
export class DashboardPage {
  readonly page: Page;
  readonly dailySessionCard: Locator;
  readonly sessionTitle: Locator;
  readonly startSessionButton: Locator;
  readonly generatePlanButton: Locator;
  readonly emptyState: Locator;
  readonly sessionPhases: Locator;
  readonly phaseCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dailySessionCard = page.locator('#daily-session-card');
    this.sessionTitle = page.locator('#session-title');
    this.startSessionButton = page.locator('#start-session-btn');
    this.generatePlanButton = page.locator('#generate-plan-btn');
    this.emptyState = page.locator('text=Ready to Start?');
    this.sessionPhases = page.locator('#session-phases');
    this.phaseCards = page.locator('[data-phase]');
  }

  /**
   * Wait for dashboard to load
   */
  async waitForDashboard() {
    await this.page.waitForSelector('#page-home, #page-coach-home', { timeout: 10000 });
  }

  /**
   * Check if empty state is visible
   */
  async isEmptyState(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  /**
   * Click generate plan button
   */
  async generatePlan() {
    await this.generatePlanButton.click();
    // Wait for generation to complete (button text changes or session appears)
    // AI generation can take up to 2 minutes
    await this.page.waitForTimeout(2000); // Initial wait before full timeout in tests
  }

  /**
   * Click start session button
   */
  async startSession() {
    await this.startSessionButton.click();
  }

  /**
   * Expand a phase by clicking on it
   */
  async expandPhase(phaseKey: 'warmup' | 'workout' | 'cooldown') {
    const phaseCard = this.page.locator(`[data-phase="${phaseKey}"]`);
    await phaseCard.click();
  }

  /**
   * Get session title text
   */
  async getSessionTitle(): Promise<string> {
    return await this.sessionTitle.textContent() || '';
  }

  /**
   * Check if session is loaded
   */
  async hasSession(): Promise<boolean> {
    return await this.sessionTitle.isVisible();
  }
}

