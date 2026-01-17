// Athlete Session View - Active workout player/interface
import { updateMilestone, getCurrentVariation, getNextVariation, isMilestoneAchieved } from '../core/workout-engine.js';
import { getUserProfile, saveUserProfile, saveSessionProgress, getSessionProgress, clearSessionProgress } from '../core/storage.js';
import { getAuthUser } from '../core/auth-manager.js';
import { saveSessionOnComplete } from '../../src/ui/session-view.js';

export class SessionView {
    constructor(session) {
        this.session = session;
        this.currentPhaseIndex = 0;
        this.currentVariationIndex = 0;
        this.currentSet = 1;
        this.completedSets = [];
        this.startedAt = new Date().toISOString();
        this.pausedAt = null;
        this.isPaused = false;
        this.phases = ['warmup', 'workout', 'cooldown'];
        this.currentPhase = this.phases[this.currentPhaseIndex];
        this.userProfile = null; // Will be loaded async
    }

    /**
     * Render and show full-screen session UI
     */
    async render() {
        const overlay = document.getElementById('session-overlay');
        if (!overlay) {
            console.error('Session overlay not found in HTML');
            return;
        }

        // Load user profile
        if (!this.userProfile) {
            this.userProfile = await getUserProfile();
        }

        overlay.classList.remove('hidden');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start session
        this.startSession();
    }

    /**
     * Set up event listeners for session controls
     */
    setupEventListeners() {
        const backBtn = document.getElementById('session-back-btn');
        const pauseBtn = document.getElementById('session-pause-btn');
        const completeBtn = document.getElementById('session-complete-btn');

        if (backBtn) {
            backBtn.onclick = () => this.handleBack();
        }

        if (pauseBtn) {
            pauseBtn.onclick = () => this.togglePause();
        }

        if (completeBtn) {
            completeBtn.onclick = () => this.completeSet().catch(err => console.error('Error completing set:', err));
        }
    }

    /**
     * Start session tracking
     */
    startSession() {
        // Check for saved progress
        const savedProgress = getSessionProgress();
        if (savedProgress && savedProgress.sessionId === (this.session.date || this.session.day)) {
            if (confirm('Resume previous session?')) {
                this.resumeFromSaved(savedProgress);
                return;
            }
        }

        // Start fresh
        this.currentPhaseIndex = 0;
        this.currentVariationIndex = 0;
        this.currentSet = 1;
        this.completedSets = [];
        this.updateProgress();
    }

    /**
     * Resume session from saved progress
     */
    resumeFromSaved(savedProgress) {
        this.currentPhaseIndex = savedProgress.phaseIndex || 0;
        this.currentVariationIndex = savedProgress.variationIndex || 0;
        this.currentSet = savedProgress.currentSet || 1;
        this.completedSets = savedProgress.completedSets || [];
        this.updateProgress();
    }

    /**
     * Update progress bar and current exercise display
     */
    updateProgress() {
        // Calculate total variations across all phases
        let totalVariations = 0;
        let currentVariationCount = 0;

        this.phases.forEach((phase, phaseIdx) => {
            const phaseVariations = this.session.phases[phase] || [];
            totalVariations += phaseVariations.length;
            
            if (phaseIdx < this.currentPhaseIndex) {
                currentVariationCount += phaseVariations.length;
            } else if (phaseIdx === this.currentPhaseIndex) {
                currentVariationCount += this.currentVariationIndex;
            }
        });

        // Update progress bar
        const progressPercent = totalVariations > 0 
            ? (currentVariationCount / totalVariations) * 100 
            : 0;
        
        const progressBar = document.getElementById('session-progress-bar');
        const progressText = document.getElementById('session-progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${progressPercent}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${currentVariationCount + 1} / ${totalVariations}`;
        }

        // Update phase indicator
        const phaseIndicator = document.getElementById('session-phase-indicator');
        if (phaseIndicator) {
            const phaseNames = {
                warmup: 'Warm-up',
                workout: 'Workout',
                cooldown: 'Cool Down'
            };
            phaseIndicator.textContent = phaseNames[this.currentPhase] || this.currentPhase;
        }

        // Show current variation
        this.showCurrentVariation();
    }

    /**
     * Display current variation
     */
    showCurrentVariation() {
        const currentPhase = this.phases[this.currentPhaseIndex];
        const phaseVariations = this.session.phases[currentPhase] || [];
        
        if (phaseVariations.length === 0 || this.currentVariationIndex >= phaseVariations.length) {
            // Move to next phase
            this.moveToNextPhase();
            return;
        }

        const variation = phaseVariations[this.currentVariationIndex];
        
        // Update variation name
        const variationNameEl = document.getElementById('session-variation-name');
        if (variationNameEl) {
            variationNameEl.textContent = variation.variationName || variation.exerciseName || 'Exercise';
        }

        // Update set counter
        const currentSetEl = document.getElementById('session-current-set');
        if (currentSetEl) {
            currentSetEl.textContent = this.currentSet;
        }

        // Update reps (if available, otherwise show "-")
        const currentRepsEl = document.getElementById('session-current-reps');
        if (currentRepsEl) {
            currentRepsEl.textContent = variation.reps || '-';
        }

        // Update technique cues
        const cuesList = document.getElementById('session-cues-list');
        if (cuesList && variation.technique_cues) {
            cuesList.innerHTML = variation.technique_cues.map(cue => 
                `<li class="text-sm text-white/80 flex items-start">
                    <i class="fas fa-circle text-white/40 text-xs mt-1.5 mr-2"></i>
                    <span>${cue}</span>
                </li>`
            ).join('');
        }
    }

    /**
     * Complete current set and move to next
     */
    async completeSet() {
        const currentPhase = this.phases[this.currentPhaseIndex];
        const phaseVariations = this.session.phases[currentPhase] || [];
        const variation = phaseVariations[this.currentVariationIndex];
        
        if (!variation) {
            this.moveToNextPhase();
            return;
        }

        // Mark set as completed
        const setKey = `${variation.exerciseId}-${variation.variationId}-set-${this.currentSet}`;
        this.completedSets.push(setKey);

        // Default to 3 sets per variation (can be customized)
        const totalSets = 3;
        
        if (this.currentSet < totalSets) {
            // Move to next set
            this.currentSet++;
        } else {
            // Complete variation - update milestone
            await this.completeVariation(variation);
            
            // Move to next variation
            this.currentSet = 1;
            this.currentVariationIndex++;
        }

        // Save progress
        this.saveProgress();

        // Update display
        this.updateProgress();
    }

    /**
     * Complete variation and update milestone
     */
    async completeVariation(variation) {
        if (!variation || !variation.exerciseId || !variation.variationId) return;

        // Ensure user profile is loaded
        if (!this.userProfile) {
            this.userProfile = await getUserProfile();
        }

        // Update milestone
        const updatedMilestones = updateMilestone(
            variation.exerciseId,
            variation.variationId,
            this.userProfile.currentMilestones || {}
        );

        // Update user profile
        this.userProfile.currentMilestones = updatedMilestones;
        await saveUserProfile(this.userProfile);

        // Check if milestone achieved (3 sessions)
        if (isMilestoneAchieved(variation.exerciseId, variation.variationId, updatedMilestones)) {
            console.log(`Milestone achieved for ${variation.exerciseId}/${variation.variationId}`);
            // Future: Show notification or suggest next variation
        }
    }

    /**
     * Move to next phase
     */
    moveToNextPhase() {
        this.currentPhaseIndex++;
        
        if (this.currentPhaseIndex >= this.phases.length) {
            // Session complete - call async endSession and handle promise
            this.endSession().catch(err => {
                console.error('Error in endSession:', err);
            });
            return;
        }

        this.currentPhase = this.phases[this.currentPhaseIndex];
        this.currentVariationIndex = 0;
        this.currentSet = 1;
        this.updateProgress();
    }

    /**
     * Toggle pause state
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('session-pause-btn');
        
        if (pauseBtn) {
            if (this.isPaused) {
                pauseBtn.innerHTML = '<i class="fas fa-play text-white text-xl"></i>';
                this.pauseSession();
            } else {
                pauseBtn.innerHTML = '<i class="fas fa-pause text-white text-xl"></i>';
                this.resumeSession();
            }
        }
    }

    /**
     * Pause session and save progress
     */
    pauseSession() {
        this.pausedAt = new Date().toISOString();
        this.saveProgress();
    }

    /**
     * Resume session
     */
    resumeSession() {
        this.pausedAt = null;
        // Progress already loaded in startSession if resuming
    }

    /**
     * Save session progress
     */
    saveProgress() {
        const progress = {
            sessionId: this.session.date || this.session.day,
            currentPhase: this.currentPhase,
            phaseIndex: this.currentPhaseIndex,
            variationIndex: this.currentVariationIndex,
            currentSet: this.currentSet,
            completedSets: this.completedSets,
            startedAt: this.startedAt,
            pausedAt: this.pausedAt
        };

        saveSessionProgress(progress);
    }

    /**
     * Handle back button
     */
    handleBack() {
        if (confirm('Are you sure you want to exit? Your progress will be saved.')) {
            this.pauseSession();
            this.hide();
        }
    }

    /**
     * End session and update milestones
     */
    async endSession() {
        try {
            // Get current user ID
            const user = getAuthUser();
            if (!user || !user.uid) {
                console.error('Cannot save session: User not authenticated');
                // Still allow session to complete even if save fails
            } else {
                // Save completed session to Firestore before redirecting
                await saveSessionOnComplete(this, user.uid);
                console.log('✓ Session saved successfully to Firestore');
            }
        } catch (error) {
            console.error('Error saving session to Firestore:', error);
            // Don't block session completion if save fails
            // User can still complete the session, but streak won't update
        }
        
        // Final milestone updates are already done per variation
        // Clear saved progress
        clearSessionProgress();
        
        // Show completion message
        alert('Session completed! Great work!');
        
        // Hide overlay
        this.hide();
        
        // Refresh dashboard to show updated milestones
        if (window.initDashboard) {
            window.initDashboard();
        }
    }

    /**
     * Hide session overlay
     */
    hide() {
        const overlay = document.getElementById('session-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
}
