// Athlete Session View - Active workout player/interface
import { updateMilestone, getCurrentVariation, getNextVariation, isMilestoneAchieved } from '../core/workout-engine.js';
import { getUserProfile, saveUserProfile, saveSessionProgress, getSessionProgress, clearSessionProgress } from '../core/storage.js';
import { getAuthUser } from '../core/auth-manager.js';
import { saveSessionOnComplete } from '../../src/ui/session-view.js';
import { WorkoutJournal } from '../ui/workout-journal.js';
import { getAllExercises } from '../../src/services/exerciseService.js';

/**
 * Show completion modal with streak information
 * @param {string} userId - User ID
 */
async function showCompletionModal(userId) {
    try {
        // Load completion modal template if not already loaded
        const modalContainer = document.getElementById('completion-modal-container');
        if (modalContainer && !modalContainer.querySelector('#completion-modal')) {
            const { loadTemplate, injectTemplate } = await import('../core/template-loader.js');
            const html = await loadTemplate('html/components/completion-modal.html');
            injectTemplate('completion-modal-container', html);
        }
        
        const modal = document.getElementById('completion-modal');
        const modalContent = modal?.querySelector('.completion-modal-content');
        const streakInfo = document.getElementById('completion-streak-info');
        const streakValue = document.getElementById('completion-streak-value');
        const closeBtn = document.getElementById('completion-modal-close');
        
        if (!modal || !closeBtn) {
            console.warn('Completion modal not found, falling back to alert');
            alert('Session completed! Great work!');
            return;
        }
        
        // Fetch fresh profile data to get updated streak
        // Wait a bit for Firestore transaction to complete
        setTimeout(async () => {
            if (userId) {
                try {
                    const { getUserProfile } = await import('../services/dbService.js');
                    const profile = await getUserProfile(userId, { skipCache: true });
                    if (profile && profile.currentStreak !== undefined && profile.currentStreak > 0) {
                        if (streakInfo && streakValue) {
                            streakValue.textContent = profile.currentStreak;
                            streakInfo.classList.remove('hidden');
                        }
                    }
                } catch (error) {
                    console.error('Error fetching streak for modal:', error);
                    // Continue without streak info
                }
            }
        }, 500);
        
        // Show modal with animation
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            if (modalContent) {
                modalContent.style.transform = 'scale(1)';
                modalContent.style.opacity = '1';
            }
        });
        
        // Close button handler
        const closeModal = () => {
            if (modalContent) {
                modalContent.style.transform = 'scale(0.95)';
                modalContent.style.opacity = '0';
            }
            setTimeout(() => {
                modal.classList.add('hidden');
                if (streakInfo) {
                    streakInfo.classList.add('hidden');
                }
                // Reset for next time
                if (modalContent) {
                    modalContent.style.transform = 'scale(0.95)';
                    modalContent.style.opacity = '0';
                }
            }, 300);
        };
        
        closeBtn.onclick = closeModal;
        
        // Also close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
    } catch (error) {
        console.error('Error showing completion modal:', error);
        // Fallback to alert
        alert('Session completed! Great work!');
    }
}

export class SessionView {
    constructor(session) {
        this.session = session;
        this.completedSets = [];
        this.setData = {}; // Store weight/reps/time for each set
        this.startedAt = new Date().toISOString();
        this.pausedAt = null;
        this.isPaused = false;
        this.userProfile = null; // Will be loaded async
        this.journal = null; // WorkoutJournal instance
        this.allExercises = null; // Cache of all exercises for lookup
        this.userId = null; // User ID for history lookup
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

        // Load user profile and get user ID
        if (!this.userProfile) {
            this.userProfile = await getUserProfile();
        }
        
        const authUser = getAuthUser();
        this.userId = authUser?.uid || null;

        // Load all exercises for lookup
        try {
            this.allExercises = await getAllExercises();
        } catch (error) {
            console.warn('Failed to load exercises for lookup:', error);
            this.allExercises = [];
        }

        overlay.classList.remove('hidden');
        
        // Set up event listeners
        this.setupEventListeners();

        // Initialize workout journal
        this.initializeWorkoutJournal();
    }

    /**
     * Initialize workout journal component
     */
    async initializeWorkoutJournal() {
        try {
            this.journal = new WorkoutJournal('workout-journal-container', {
                session: this.session,
                userId: this.userId,
                onSetUpdated: (setKey, state) => {
                    // Maintain backward-compatible structures expected by saveSessionOnComplete
                    this.setData[setKey] = {
                        weight: state.weight ?? undefined,
                        reps: state.reps ?? undefined,
                        time: state.time ?? undefined,
                        completed: !!state.completed,
                        notes: state.notes
                    };

                    if (state.completed && !this.completedSets.includes(setKey)) {
                        this.completedSets.push(setKey);
                    } else if (!state.completed && this.completedSets.includes(setKey)) {
                        this.completedSets = this.completedSets.filter(key => key !== setKey);
                    }
                },
                onSessionUpdated: () => {
                    // Save lightweight progress snapshot for resume support
                    this.saveProgress();
                },
                onAllSetsCompleted: async () => {
                    await this.endSession().catch(err => console.error('Error in endSession:', err));
                }
            });

            await this.journal.render();
        } catch (error) {
            console.error('Failed to initialize workout journal:', error);
        }
    }

    /**
     * Set up event listeners for session controls
     */
    setupEventListeners() {
        const backBtn = document.getElementById('session-back-btn');
        const pauseBtn = document.getElementById('session-pause-btn');
        const completeBtn = document.getElementById('session-finish-btn');

        if (backBtn) {
            backBtn.onclick = () => this.handleBack();
        }

        if (pauseBtn) {
            pauseBtn.onclick = () => this.togglePause();
        }

        if (completeBtn) {
            completeBtn.onclick = () => this.endSession().catch(err => console.error('Error ending session:', err));
        }
    }

    /**
     * Start session tracking
     */
    startSession() {
        // Journal-based session no longer uses wizard progression,
        // but we keep startedAt/pausedAt tracking and progress persistence.
        this.completedSets = [];
        this.setData = {};
    }

    /**
     * Update progress bar
     * For the journal, we base progress on completed sets vs total sets.
     */
    updateProgress() {
        const allSets = this.journal?.sets || [];
        const totalSets = allSets.length;
        const completedCount = allSets.filter(set => {
            const key = set.key;
            const data = this.setData[key];
            return data && data.completed;
        }).length;

        const progressPercent = totalSets > 0
            ? (completedCount / totalSets) * 100
            : 0;

        const progressBar = document.getElementById('session-progress-bar');
        const progressText = document.getElementById('session-progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${progressPercent}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${completedCount} / ${totalSets}`;
        }
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
            setData: this.setData, // Include set performance data
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
        // Get current user ID (define at function scope so it's available later)
        const user = getAuthUser();
        
        try {
            if (!user || !user.uid) {
                console.error('Cannot save session: User not authenticated');
                // Still allow session to complete even if save fails
            } else {
                // Save completed session to Firestore before redirecting
                await saveSessionOnComplete(this, user.uid);
                console.log('✓ Session saved successfully to Firestore');
                
                // Mark session as completed in training system
                try {
                    const { getTrainingSystem, saveTrainingSystem } = await import('../core/storage.js');
                    const trainingSystem = await getTrainingSystem();
                    
                    if (trainingSystem && trainingSystem.sessions) {
                        const sessionDate = this.session.date || new Date().toISOString().split('T')[0];
                        const sessionIndex = trainingSystem.sessions.findIndex(s => s.date === sessionDate);
                        
                        if (sessionIndex !== -1) {
                            // Mark session as completed
                            trainingSystem.sessions[sessionIndex] = {
                                ...trainingSystem.sessions[sessionIndex],
                                completed: true,
                                completedAt: new Date().toISOString()
                            };
                            
                            await saveTrainingSystem(trainingSystem);
                            console.log('✓ Session marked as completed in training system');
                        }
                    }
                } catch (error) {
                    console.error('Error marking session as completed:', error);
                    // Non-critical, continue
                }
            }
        } catch (error) {
            console.error('Error saving session to Firestore:', error);
            // Don't block session completion if save fails
            // User can still complete the session, but streak won't update
        }
        
        // Final milestone updates are already done per variation
        // Clear saved progress
        clearSessionProgress();
        
        // Hide session overlay first
        this.hide();
        
        // Show completion modal with updated streak
        await showCompletionModal(user?.uid);
        
        // Refresh dashboard to show updated streak and milestones
        if (window.initDashboard) {
            // Delay to ensure Firestore transaction completes and user sees the modal
            setTimeout(async () => {
                // Force refresh profile data from Firestore by clearing ALL caches
                const { getAuthUser } = await import('../core/auth-manager.js');
                const refreshUser = getAuthUser();
                if (refreshUser) {
                    // Clear profile cache
                    const profileCacheKey = `firestore_cache_profile_${refreshUser.uid}`;
                    localStorage.removeItem(profileCacheKey);
                    localStorage.removeItem('userProfile');
                    
                    // Clear training system cache to force refresh of session list
                    const trainingSystemCacheKey = `firestore_cache_training_system_${refreshUser.uid}`;
                    localStorage.removeItem(trainingSystemCacheKey);
                    localStorage.removeItem('trainingSystem');
                    
                    // Clear completed sessions cache
                    const completedSessionsCacheKey = `firestore_cache_completed_sessions_${refreshUser.uid}`;
                    localStorage.removeItem(completedSessionsCacheKey);
                    
                    console.log('[SessionView] ✓ All caches cleared, refreshing dashboard...');
                }
                
                // Refresh dashboard
                await window.initDashboard();
                console.log('[SessionView] ✓ Dashboard refreshed');
            }, 1500); // Reduced delay - 1.5 seconds should be enough
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
