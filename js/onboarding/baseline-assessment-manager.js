/**
 * Baseline Assessment Manager
 * Handles the baseline mobility/rotation/flexibility assessment flow
 * Manages state, score calculation, and saving assessment data
 */

export class BaselineAssessmentManager {
    constructor(onComplete) {
        this.answers = {
            mobility: {
                overheadReach: null,
                shoulderRotation: null,
                hipFlexibility: null
            },
            rotation: {
                spinalRotation: null,
                dailyRotationFrequency: null
            },
            flexibility: {
                lowerBody: null,
                upperBody: null
            },
            physiological: {}
        };
        this.onComplete = onComplete;
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Mobility questions (4, 5, 6)
        // Question 4: Overhead Reach
        document.querySelectorAll('[data-answer="baseline-mobility-overhead"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = parseInt(btn.getAttribute('data-value'));
                this.answers.mobility.overheadReach = value;
                this.updateQuestion4UI();
            });
        });

        // Continue button for question 4
        const mobilityOverheadContinueBtn = document.getElementById('mobility-overhead-continue');
        if (mobilityOverheadContinueBtn) {
            mobilityOverheadContinueBtn.addEventListener('click', () => {
                if (this.answers.mobility.overheadReach !== null) {
                    this.showQuestion(5);
                } else {
                    alert('Please answer the question before continuing.');
                }
            });
        }

        // Question 5: Shoulder Rotation
        document.querySelectorAll('[data-answer="baseline-mobility-shoulder"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = parseInt(btn.getAttribute('data-value'));
                this.answers.mobility.shoulderRotation = value;
                this.updateQuestion5UI();
            });
        });

        // Continue button for question 5
        const mobilityShoulderContinueBtn = document.getElementById('mobility-shoulder-continue');
        if (mobilityShoulderContinueBtn) {
            mobilityShoulderContinueBtn.addEventListener('click', () => {
                if (this.answers.mobility.shoulderRotation !== null) {
                    this.showQuestion(6);
                } else {
                    alert('Please answer the question before continuing.');
                }
            });
        }

        // Question 6: Hip Flexibility
        document.querySelectorAll('[data-answer="baseline-mobility-hip"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = parseInt(btn.getAttribute('data-value'));
                this.answers.mobility.hipFlexibility = value;
                this.updateQuestion6UI();
            });
        });

        // Continue button for question 6
        const mobilityHipContinueBtn = document.getElementById('mobility-hip-continue');
        if (mobilityHipContinueBtn) {
            mobilityHipContinueBtn.addEventListener('click', () => {
                if (this.answers.mobility.hipFlexibility !== null) {
                    this.showQuestion(7);
                } else {
                    alert('Please answer the question before continuing.');
                }
            });
        }

        // Rotation questions (question 7 - Spinal Rotation)
        document.querySelectorAll('[data-answer="baseline-rotation-spinal"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = parseInt(btn.getAttribute('data-value'));
                this.answers.rotation.spinalRotation = value;
                this.updateQuestion7UI();
            });
        });

        // Continue button for question 7
        const rotationSpinalContinueBtn = document.getElementById('rotation-spinal-continue');
        if (rotationSpinalContinueBtn) {
            rotationSpinalContinueBtn.addEventListener('click', () => {
                if (this.answers.rotation.spinalRotation !== null) {
                    this.showQuestion(8);
                } else {
                    alert('Please answer the question before continuing.');
                }
            });
        }

        // Rotation frequency (question 8)
        document.querySelectorAll('[data-answer="baseline-rotation-frequency"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = parseInt(btn.getAttribute('data-value'));
                this.answers.rotation.dailyRotationFrequency = value;
                this.updateQuestion8UI();
            });
        });

        // Continue button for question 8
        const rotationFrequencyContinueBtn = document.getElementById('rotation-frequency-continue');
        if (rotationFrequencyContinueBtn) {
            rotationFrequencyContinueBtn.addEventListener('click', () => {
                if (this.answers.rotation.dailyRotationFrequency !== null) {
                    this.showQuestion(9);
                } else {
                    alert('Please answer the question before continuing.');
                }
            });
        }

        // Flexibility questions (question 9 - Lower Body)
        document.querySelectorAll('[data-answer="baseline-flexibility-lower"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = parseInt(btn.getAttribute('data-value'));
                this.answers.flexibility.lowerBody = value;
                this.updateQuestion9UI();
            });
        });

        // Continue button for question 9
        const flexibilityLowerContinueBtn = document.getElementById('flexibility-lower-continue');
        if (flexibilityLowerContinueBtn) {
            flexibilityLowerContinueBtn.addEventListener('click', () => {
                if (this.answers.flexibility.lowerBody !== null) {
                    this.showQuestion(10);
                } else {
                    alert('Please answer the question before continuing.');
                }
            });
        }

        // Upper Body Flexibility (question 10)
        document.querySelectorAll('[data-answer="baseline-flexibility-upper"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = parseInt(btn.getAttribute('data-value'));
                this.answers.flexibility.upperBody = value;
                this.updateQuestion10UI();
            });
        });

        // Continue button for question 10
        const flexibilityUpperContinueBtn = document.getElementById('flexibility-upper-continue');
        if (flexibilityUpperContinueBtn) {
            flexibilityUpperContinueBtn.addEventListener('click', () => {
                if (this.answers.flexibility.upperBody !== null) {
                    this.showQuestion(11); // Show intro to physiological data
                } else {
                    alert('Please answer the question before continuing.');
                }
            });
        }

        // Question 11: Physiological intro - Skip all or Continue
        const physiologicalSkipAllBtn = document.getElementById('physiological-skip-all');
        if (physiologicalSkipAllBtn) {
            physiologicalSkipAllBtn.addEventListener('click', () => {
                this.completeAssessment();
            });
        }

        const physiologicalStartBtn = document.getElementById('physiological-start');
        if (physiologicalStartBtn) {
            physiologicalStartBtn.addEventListener('click', () => {
                this.showQuestion(12);
            });
        }

        // Question 12: Age - Skip or Continue
        const ageSkipBtn = document.getElementById('age-skip');
        if (ageSkipBtn) {
            ageSkipBtn.addEventListener('click', () => {
                this.showQuestion(13);
            });
        }

        const ageInput = document.getElementById('physiological-age');
        if (ageInput) {
            ageInput.addEventListener('input', () => {
                this.updateAgeUI();
            });
        }

        const ageContinueBtn = document.getElementById('age-continue');
        if (ageContinueBtn) {
            ageContinueBtn.addEventListener('click', () => {
                if (ageInput && ageInput.value) {
                    const age = parseInt(ageInput.value);
                    if (age >= 18 && age <= 99) {
                        this.answers.physiological.age = age;
                        this.showQuestion(13);
                    } else {
                        alert('Please enter a valid age between 18 and 99.');
                    }
                }
            });
        }

        // Question 13: Activity Level
        document.querySelectorAll('[data-answer="physiological-activity"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.getAttribute('data-value');
                this.answers.physiological.activityLevel = value;
                this.updateActivityLevelUI();
            });
        });

        const activitySkipBtn = document.getElementById('activity-skip');
        if (activitySkipBtn) {
            activitySkipBtn.addEventListener('click', () => {
                this.showQuestion(14);
            });
        }

        const activityContinueBtn = document.getElementById('activity-continue');
        if (activityContinueBtn) {
            activityContinueBtn.addEventListener('click', () => {
                this.showQuestion(14);
            });
        }

        // Question 14: Height - Skip or Continue
        const heightSkipBtn = document.getElementById('height-skip');
        if (heightSkipBtn) {
            heightSkipBtn.addEventListener('click', () => {
                this.showQuestion(15);
            });
        }

        const heightInput = document.getElementById('physiological-height');
        if (heightInput) {
            heightInput.addEventListener('input', () => {
                this.updateHeightUI();
            });
        }

        const heightContinueBtn = document.getElementById('height-continue');
        if (heightContinueBtn) {
            heightContinueBtn.addEventListener('click', () => {
                if (heightInput && heightInput.value) {
                    const height = parseFloat(heightInput.value);
                    if (height >= 100 && height <= 250) {
                        this.answers.physiological.height = height;
                        this.showQuestion(15);
                    } else {
                        alert('Please enter a valid height between 100 and 250 cm.');
                    }
                }
            });
        }

        // Question 15: Weight - Skip or Continue
        const weightSkipBtn = document.getElementById('weight-skip');
        if (weightSkipBtn) {
            weightSkipBtn.addEventListener('click', () => {
                this.showQuestion(16);
            });
        }

        const weightInput = document.getElementById('physiological-weight');
        if (weightInput) {
            weightInput.addEventListener('input', () => {
                this.updateWeightUI();
            });
        }

        const weightContinueBtn = document.getElementById('weight-continue');
        if (weightContinueBtn) {
            weightContinueBtn.addEventListener('click', () => {
                if (weightInput && weightInput.value) {
                    const weight = parseFloat(weightInput.value);
                    if (weight >= 30 && weight <= 300) {
                        this.answers.physiological.weight = weight;
                        this.showQuestion(16);
                    } else {
                        alert('Please enter a valid weight between 30 and 300 kg.');
                    }
                }
            });
        }

        // Question 16: Body Fat % - Skip or Continue
        const bodyFatSkipBtn = document.getElementById('bodyfat-skip');
        if (bodyFatSkipBtn) {
            bodyFatSkipBtn.addEventListener('click', () => {
                this.showQuestion(17);
            });
        }

        const bodyFatInput = document.getElementById('physiological-bodyfat');
        if (bodyFatInput) {
            bodyFatInput.addEventListener('input', () => {
                this.updateBodyFatUI();
            });
        }

        const bodyFatContinueBtn = document.getElementById('bodyfat-continue');
        if (bodyFatContinueBtn) {
            bodyFatContinueBtn.addEventListener('click', () => {
                if (bodyFatInput && bodyFatInput.value) {
                    const bodyFat = parseFloat(bodyFatInput.value);
                    if (bodyFat >= 0 && bodyFat <= 100) {
                        this.answers.physiological.bodyFatPercent = bodyFat;
                        this.showQuestion(17);
                    } else {
                        alert('Please enter a valid body fat percentage between 0 and 100.');
                    }
                }
            });
        }

        // Question 17: Injury History - Skip or Finish
        const injurySkipBtn = document.getElementById('injury-skip');
        if (injurySkipBtn) {
            injurySkipBtn.addEventListener('click', () => {
                this.collectInjuryHistory();
                this.completeAssessment();
            });
        }

        const injuryInput = document.getElementById('physiological-injury');
        if (injuryInput) {
            injuryInput.addEventListener('input', () => {
                this.updateInjuryUI();
            });
        }

        const injuryCompleteBtn = document.getElementById('injury-complete');
        if (injuryCompleteBtn) {
            injuryCompleteBtn.addEventListener('click', () => {
                this.collectInjuryHistory();
                this.completeAssessment();
            });
        }
    }

    updateQuestion4UI() {
        // Update UI for question 4 (Overhead Reach)
        document.querySelectorAll('[data-answer="baseline-mobility-overhead"]').forEach(btn => {
            const value = parseInt(btn.getAttribute('data-value'));
            if (this.answers.mobility.overheadReach === value) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        // Enable/disable Continue button for question 4
        const continueBtn = document.getElementById('mobility-overhead-continue');
        if (continueBtn) {
            if (this.answers.mobility.overheadReach !== null) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }

    updateQuestion5UI() {
        // Update UI for question 5 (Shoulder Rotation)
        document.querySelectorAll('[data-answer="baseline-mobility-shoulder"]').forEach(btn => {
            const value = parseInt(btn.getAttribute('data-value'));
            if (this.answers.mobility.shoulderRotation === value) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        // Enable/disable Continue button for question 5
        const continueBtn = document.getElementById('mobility-shoulder-continue');
        if (continueBtn) {
            if (this.answers.mobility.shoulderRotation !== null) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }

    updateQuestion6UI() {
        // Update UI for question 6 (Hip Flexibility)
        document.querySelectorAll('[data-answer="baseline-mobility-hip"]').forEach(btn => {
            const value = parseInt(btn.getAttribute('data-value'));
            if (this.answers.mobility.hipFlexibility === value) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        // Enable/disable Continue button for question 6
        const continueBtn = document.getElementById('mobility-hip-continue');
        if (continueBtn) {
            if (this.answers.mobility.hipFlexibility !== null) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }

    updateQuestion7UI() {
        // Update UI for question 7 (Spinal Rotation)
        document.querySelectorAll('[data-answer="baseline-rotation-spinal"]').forEach(btn => {
            const value = parseInt(btn.getAttribute('data-value'));
            if (this.answers.rotation.spinalRotation === value) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        // Enable/disable Continue button for question 7
        const continueBtn = document.getElementById('rotation-spinal-continue');
        if (continueBtn) {
            if (this.answers.rotation.spinalRotation !== null) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }

    updateQuestion8UI() {
        // Update UI for question 8 (Rotation Frequency)
        document.querySelectorAll('[data-answer="baseline-rotation-frequency"]').forEach(btn => {
            const value = parseInt(btn.getAttribute('data-value'));
            if (this.answers.rotation.dailyRotationFrequency === value) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        // Enable/disable Continue button for question 8
        const continueBtn = document.getElementById('rotation-frequency-continue');
        if (continueBtn) {
            if (this.answers.rotation.dailyRotationFrequency !== null) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }

    updateQuestion9UI() {
        // Update UI for question 9 (Lower Body Flexibility)
        document.querySelectorAll('[data-answer="baseline-flexibility-lower"]').forEach(btn => {
            const value = parseInt(btn.getAttribute('data-value'));
            if (this.answers.flexibility.lowerBody === value) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        // Enable/disable Continue button for question 9
        const continueBtn = document.getElementById('flexibility-lower-continue');
        if (continueBtn) {
            if (this.answers.flexibility.lowerBody !== null) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }

    updateQuestion10UI() {
        // Update UI for question 10 (Upper Body Flexibility)
        document.querySelectorAll('[data-answer="baseline-flexibility-upper"]').forEach(btn => {
            const value = parseInt(btn.getAttribute('data-value'));
            if (this.answers.flexibility.upperBody === value) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        // Enable/disable Continue button for question 10
        const continueBtn = document.getElementById('flexibility-upper-continue');
        if (continueBtn) {
            if (this.answers.flexibility.upperBody !== null) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }


    updateActivityLevelUI() {
        document.querySelectorAll('[data-answer="physiological-activity"]').forEach(btn => {
            const value = btn.getAttribute('data-value');
            if (this.answers.physiological.activityLevel === value) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        // Enable/disable Continue button for question 13
        const continueBtn = document.getElementById('activity-continue');
        if (continueBtn) {
            if (this.answers.physiological.activityLevel !== null && this.answers.physiological.activityLevel !== undefined) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }

    updateAgeUI() {
        const ageInput = document.getElementById('physiological-age');
        const continueBtn = document.getElementById('age-continue');
        if (continueBtn && ageInput) {
            if (ageInput.value.trim()) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }

    updateHeightUI() {
        const heightInput = document.getElementById('physiological-height');
        const continueBtn = document.getElementById('height-continue');
        if (continueBtn && heightInput) {
            if (heightInput.value.trim()) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }

    updateWeightUI() {
        const weightInput = document.getElementById('physiological-weight');
        const continueBtn = document.getElementById('weight-continue');
        if (continueBtn && weightInput) {
            if (weightInput.value.trim()) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }

    updateBodyFatUI() {
        const bodyFatInput = document.getElementById('physiological-bodyfat');
        const continueBtn = document.getElementById('bodyfat-continue');
        if (continueBtn && bodyFatInput) {
            if (bodyFatInput.value.trim()) {
                continueBtn.removeAttribute('disabled');
                continueBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.style.pointerEvents = 'auto';
            } else {
                continueBtn.setAttribute('disabled', 'disabled');
                continueBtn.classList.add('opacity-50', 'cursor-not-allowed');
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.style.pointerEvents = 'none';
            }
        }
    }

    updateInjuryUI() {
        const injuryInput = document.getElementById('physiological-injury');
        const finishBtn = document.getElementById('injury-complete');
        if (finishBtn && injuryInput) {
            if (injuryInput.value.trim()) {
                finishBtn.removeAttribute('disabled');
                finishBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                finishBtn.style.opacity = '1';
                finishBtn.style.cursor = 'pointer';
                finishBtn.style.pointerEvents = 'auto';
            } else {
                finishBtn.setAttribute('disabled', 'disabled');
                finishBtn.classList.add('opacity-50', 'cursor-not-allowed');
                finishBtn.style.opacity = '0.5';
                finishBtn.style.cursor = 'not-allowed';
                finishBtn.style.pointerEvents = 'none';
            }
        }
    }

    collectInjuryHistory() {
        const injuryInput = document.getElementById('physiological-injury');
        if (injuryInput && injuryInput.value.trim()) {
            this.answers.physiological.injuryHistory = injuryInput.value.trim();
        }
    }


    showQuestion(step) {
        // Hide all onboarding questions
        document.querySelectorAll('[id^="onboarding-"]').forEach(el => {
            if (el.id.startsWith('onboarding-question-') || el.id.startsWith('onboarding-role-')) {
                el.classList.add('hidden');
            }
        });

        const questionId = `onboarding-question-${step}`;
        const questionEl = document.getElementById(questionId);
        if (questionEl) {
            questionEl.classList.remove('hidden');
        }
    }

    // Physiological data is now collected incrementally as users progress through questions 12-17
    // This method is kept for backwards compatibility but data is already collected

    calculateScores() {
        // Calculate mobility overall score (average of 3 tests)
        const mobilityScores = [
            this.answers.mobility.overheadReach,
            this.answers.mobility.shoulderRotation,
            this.answers.mobility.hipFlexibility
        ].filter(score => score !== null);
        
        const mobilityOverall = mobilityScores.length > 0 
            ? mobilityScores.reduce((a, b) => a + b, 0) / mobilityScores.length 
            : 3; // Default to middle if missing

        // Calculate rotation overall score
        // Spinal rotation (1-5) and daily frequency (1-4) - normalize frequency to 1-5 scale
        const spinalRotation = this.answers.rotation.spinalRotation || 3;
        const dailyFrequency = this.answers.rotation.dailyRotationFrequency || 2;
        const normalizedFrequency = ((dailyFrequency - 1) / 3) * 4 + 1; // Map 1-4 to 1-5
        const rotationOverall = (spinalRotation + normalizedFrequency) / 2;

        // Calculate flexibility overall score (average of 2 tests)
        const flexibilityScores = [
            this.answers.flexibility.lowerBody,
            this.answers.flexibility.upperBody
        ].filter(score => score !== null);
        
        const flexibilityOverall = flexibilityScores.length > 0
            ? flexibilityScores.reduce((a, b) => a + b, 0) / flexibilityScores.length
            : 3; // Default to middle if missing

        // Convert 1-5 scale to 0-100 scale for baseline metrics
        const scaleTo100 = (score) => {
            // 1 → 20, 2 → 40, 3 → 60, 4 → 80, 5 → 100
            return Math.round((score - 1) * 20 + 20);
        };

        return {
            mobility: {
                ...this.answers.mobility,
                overallScore: Math.round(mobilityOverall * 10) / 10 // Round to 1 decimal
            },
            rotation: {
                ...this.answers.rotation,
                overallScore: Math.round(rotationOverall * 10) / 10
            },
            flexibility: {
                ...this.answers.flexibility,
                overallScore: Math.round(flexibilityOverall * 10) / 10
            },
            physiological: Object.keys(this.answers.physiological).length > 0 
                ? this.answers.physiological 
                : undefined,
            baselineMetrics: {
                mobility: scaleTo100(mobilityOverall),
                rotation: scaleTo100(rotationOverall),
                flexibility: scaleTo100(flexibilityOverall)
            },
            version: '1.0'
        };
    }

    async completeAssessment() {
        const assessment = this.calculateScores();
        
        // Call completion callback with assessment data
        if (this.onComplete) {
            await this.onComplete(assessment);
        }
    }
}





