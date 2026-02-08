// Onboarding Manager for athlete onboarding flow
import { saveOnboardingData, setUserRole, saveBaselineAssessment } from '../core/storage.js';
import { BaselineAssessmentManager } from './baseline-assessment-manager.js';

export class OnboardingManager {
    constructor(onRoleSelect, onComplete) {
        this.currentStep = 'role-selection';
        this.answers = {
            discomforts: [],
            primaryDiscipline: [],
            objectives: []
        };
        this.baselineManager = null;
        this.onRoleSelect = onRoleSelect; // Callback for role selection
        this.onComplete = onComplete; // Callback for completing onboarding
    }

    init() {
        // Don't show role selection immediately - wait for authentication
        // Only set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Role selection cards - use event delegation
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.onboarding-card');
            if (card) {
                e.preventDefault();
                e.stopPropagation();
                const role = card.getAttribute('data-role');
                console.log('Role selected:', role);
                if (role && this.onRoleSelect) {
                    this.onRoleSelect(role);
                }
            }
        });

        // Question answer handlers
        this.setupQuestionHandlers();
    }

    setupQuestionHandlers() {
        // Question 1: Discomforts (multi-select)
        document.querySelectorAll('[data-answer="discomfort"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.getAttribute('data-value');
                this.toggleDiscomfort(value);
            });
        });

        // Question 1: Next button
        const discomfortNext = document.getElementById('discomfort-next');
        if (discomfortNext) {
            discomfortNext.addEventListener('click', () => {
                if (this.answers.discomforts.length > 0) {
                    this.showQuestion(2);
                }
            });
        }

        // Question 2: Discipline (multi-select)
        document.querySelectorAll('[data-answer="discipline"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.getAttribute('data-value');
                this.toggleDiscipline(value);
            });
        });

        // Continue button (using event delegation)
        document.addEventListener('click', (e) => {
            // Handle Continue button click (Question 3)
            if (e.target && (e.target.id === 'discipline-complete' || e.target.closest('#discipline-complete'))) {
                e.preventDefault();
                e.stopPropagation();
                const btn = e.target.id === 'discipline-complete' ? e.target : e.target.closest('#discipline-complete');
                if (btn && !btn.hasAttribute('disabled') && btn.style.pointerEvents !== 'none') {
                    console.log('Continue button clicked. Disciplines:', this.answers.primaryDiscipline);
                    if (this.answers.primaryDiscipline.length > 0) {
                        console.log('Starting baseline assessment...');
                        this.startBaselineAssessment();
                    } else {
                        console.log('No disciplines selected');
                        alert('Please select at least one discipline to continue.');
                    }
                } else {
                    console.log('Button is disabled or not clickable');
                }
            }
        });
    }

    showRoleSelection() {
        this.hideAllSteps();
        const roleSelection = document.getElementById('onboarding-role-selection');
        if (roleSelection) {
            roleSelection.classList.remove('hidden');
        }
        this.currentStep = 'role-selection';
    }

    startAthleteFlow() {
        this.showQuestion(1); // Start with discomforts (question 1)
    }

    showQuestion(step) {
        this.hideAllSteps();
        const questionId = `onboarding-question-${step}`;
        const questionEl = document.getElementById(questionId);
        if (questionEl) {
            questionEl.classList.remove('hidden');
            this.currentStep = `question-${step}`;
            
            // Update UI state for question 2 (discipline)
            if (step === 2) {
                this.updateDisciplineUI();
            } else if (step === 1) {
                this.updateDiscomfortUI();
            }
        }
    }

    hideAllSteps() {
        document.querySelectorAll('[id^="onboarding-"]').forEach(el => {
            el.classList.add('hidden');
        });
    }

    handleAnswer(questionId, answer) {
        // This method is kept for future use if needed
    }

    toggleDiscomfort(value) {
        const index = this.answers.discomforts.indexOf(value);
        if (index > -1) {
            this.answers.discomforts.splice(index, 1);
        } else {
            // If selecting "None", clear others
            if (value === 'None') {
                this.answers.discomforts = ['None'];
            } else {
                // Remove "None" if selecting something else
                const noneIndex = this.answers.discomforts.indexOf('None');
                if (noneIndex > -1) {
                    this.answers.discomforts.splice(noneIndex, 1);
                }
                this.answers.discomforts.push(value);
            }
        }
        this.updateDiscomfortUI();
    }

    updateDiscomfortUI() {
        document.querySelectorAll('[data-answer="discomfort"]').forEach(btn => {
            const value = btn.getAttribute('data-value');
            if (this.answers.discomforts.includes(value)) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    toggleDiscipline(value) {
        const index = this.answers.primaryDiscipline.indexOf(value);
        if (index > -1) {
            this.answers.primaryDiscipline.splice(index, 1);
        } else {
            this.answers.primaryDiscipline.push(value);
        }
        console.log('Disciplines selected:', this.answers.primaryDiscipline);
        this.updateDisciplineUI();
    }

    updateDisciplineUI() {
        document.querySelectorAll('[data-answer="discipline"]').forEach(btn => {
            const value = btn.getAttribute('data-value');
            if (this.answers.primaryDiscipline.includes(value)) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
        
        // Enable/disable Continue button based on selections
        const continueBtn = document.getElementById('discipline-complete');
        if (continueBtn) {
            console.log('Updating button state. Disciplines:', this.answers.primaryDiscipline.length);
            if (this.answers.primaryDiscipline.length > 0) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.display = 'block';
                continueBtn.style.pointerEvents = 'auto';
                console.log('Button enabled');
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.display = 'block';
                continueBtn.style.pointerEvents = 'none';
                console.log('Button disabled');
            }
        } else {
            console.error('Continue button not found!');
        }
    }

    startBaselineAssessment() {
        // Initialize baseline assessment manager
        this.baselineManager = new BaselineAssessmentManager(async (assessment) => {
            await this.handleBaselineComplete(assessment);
        });
        this.baselineManager.init();
        
        // Show question 3 (first baseline assessment question)
        this.showQuestion(3);
    }

    async handleBaselineComplete(assessment) {
        console.log('Baseline assessment completed:', assessment);
        
        // Store objectives from assessment
        this.answers.objectives = assessment.objectives || [];
        
        // Save baseline assessment
        await saveBaselineAssessment(assessment);
        
        // Continue to complete onboarding
        await this.completeOnboarding();
    }

    async completeOnboarding() {
        console.log('completeOnboarding called');
        
        // Save onboarding data and role
        saveOnboardingData(this.answers);
        await setUserRole('athlete');
        
        // Save profile to Firestore (if authenticated)
        try {
            const { getAuthUser } = await import('../core/auth-manager.js');
            const { saveUserProfile } = await import('../core/storage.js');
            const user = getAuthUser();
            
            if (user) {
                const profile = await saveUserProfile({
                    preferredDisciplines: this.answers.primaryDiscipline || [],
                    discomforts: this.answers.discomforts || [],
                    equipment: [],
                    goals: this.answers.objectives || [],
                    objectives: this.answers.objectives || [],
                    currentMilestones: {}
                });
            }
        } catch (error) {
            console.error('Error saving onboarding to Firestore:', error);
            // Continue anyway - localStorage fallback is already saved
        }
        
        // Hide overlay with transition
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) {
            overlay.style.transition = 'opacity 0.3s ease-out';
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.style.display = 'none';
                console.log('Onboarding overlay hidden');
                
                // Call completion callback
                if (this.onComplete) {
                    this.onComplete('athlete');
                }
            }, 300);
        } else {
            // If overlay not found, call completion callback immediately
            console.log('Onboarding overlay not found, completing onboarding...');
            if (this.onComplete) {
                this.onComplete('athlete');
            }
        }
    }
}

