// EditSessionManager
// Handles the Edit Session drawer lifecycle and local session structure editing

import { loadTemplate } from '../core/template-loader.js';
import { searchExercises, getAISuggestions } from '../services/exerciseSearchService.js';
import { saveSessionToSystem } from '../services/dbService.js';
import { getAuthUser } from '../core/auth-manager.js';

const PHASE_KEYS = ['warmup', 'workout', 'cooldown'];

export class EditSessionManager {
    constructor() {
        this.initialized = false;
        this.session = null;
        this.editedPhases = {
            warmup: [],
            workout: [],
            cooldown: []
        };
        this.userId = null;
        this.systemId = null;
        this.pendingAction = null; // { type: 'add' | 'replace', phase, index? }
        this.loading = false;
    }

    async initIfNeeded() {
        if (this.initialized) return;

        // Inject drawer template into container if not present
        let container = document.getElementById('edit-session-drawer-container');
        if (!container) {
            console.warn('[EditSessionManager] Container #edit-session-drawer-container not found');
            return;
        }

        if (!container.firstElementChild) {
            const html = await loadTemplate('html/components/edit-session-drawer.html');
            container.innerHTML = html;
        }

        this.root = document.getElementById('edit-session-drawer');
        if (!this.root) {
            console.warn('[EditSessionManager] Drawer root not found after template injection');
            return;
        }

        this.panel = this.root.querySelector('[data-edit-session-panel]');
        this.backdrop = this.root.querySelector('[data-edit-session-backdrop]');
        this.closeBtn = this.root.querySelector('[data-edit-session-close]');
        this.cancelBtn = this.root.querySelector('[data-edit-session-cancel]');
        this.saveBtn = this.root.querySelector('[data-edit-session-save]');
        this.searchInput = this.root.querySelector('#edit-session-search-input');
        this.searchResults = this.root.querySelector('#edit-session-search-results');

        this.phaseLists = {};
        this.phaseCountLabels = {};
        this.phaseAddButtons = {};
        this.phaseAISuggestButtons = {};

        PHASE_KEYS.forEach(phase => {
            this.phaseLists[phase] = this.root.querySelector(`[data-phase-list="${phase}"]`);
            this.phaseCountLabels[phase] = this.root.querySelector(`[data-phase-count-label="${phase}"]`);
            this.phaseAddButtons[phase] = this.root.querySelector(`[data-phase-add="${phase}"]`);
            this.phaseAISuggestButtons[phase] = this.root.querySelector(`[data-phase-ai-suggest="${phase}"]`);
        });

        // Wire static events
        if (this.backdrop) {
            this.backdrop.addEventListener('click', () => this.close());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.close());
        }
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => this.handleSave());
        }

        if (this.searchInput) {
            this.searchInput.addEventListener('input', this.debounce(() => {
                const query = this.searchInput.value.trim();
                this.handleSearch(query);
            }, 300));
        }

        PHASE_KEYS.forEach(phase => {
            const addBtn = this.phaseAddButtons[phase];
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    this.pendingAction = { type: 'add', phase };
                    this.searchInput?.focus();
                });
            }

            const aiBtn = this.phaseAISuggestButtons[phase];
            if (aiBtn) {
                aiBtn.addEventListener('click', () => this.handleAISuggestions(phase));
            }
        });

        this.initialized = true;
    }

    debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    }

    /**
     * Open drawer with a given session and training system id
     * @param {Object} session - Current session object
     * @param {string} systemId - Training system ID
     */
    async open(session, systemId) {
        await this.initIfNeeded();
        if (!this.root) return;

        const user = getAuthUser();
        this.userId = user?.uid || null;
        this.systemId = systemId || null;
        this.session = session ? JSON.parse(JSON.stringify(session)) : null;

        this.loadSession(this.session);
        this.renderPhases();

        this.root.classList.remove('hidden');
        // Trigger slide-in
        requestAnimationFrame(() => {
            if (this.panel) {
                this.panel.classList.remove('translate-x-full');
            }
        });
    }

    close() {
        if (!this.root || !this.panel) return;
        this.panel.classList.add('translate-x-full');
        setTimeout(() => {
            this.root.classList.add('hidden');
            this.clearSearchResults();
            this.pendingAction = null;
        }, 250);
    }

    loadSession(session) {
        if (!session || !session.phases) {
            this.editedPhases = {
                warmup: [],
                workout: [],
                cooldown: []
            };
            return;
        }

        this.editedPhases = {
            warmup: Array.isArray(session.phases.warmup) ? [...session.phases.warmup] : [],
            workout: Array.isArray(session.phases.workout) ? [...session.phases.workout] : [],
            cooldown: Array.isArray(session.phases.cooldown) ? [...session.phases.cooldown] : []
        };
    }

    renderPhases() {
        PHASE_KEYS.forEach(phase => {
            const listEl = this.phaseLists[phase];
            const labelEl = this.phaseCountLabels[phase];
            if (!listEl) return;

            const items = this.editedPhases[phase] || [];
            listEl.innerHTML = '';

            items.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800';

                const left = document.createElement('div');
                left.className = 'flex flex-col';

                const title = document.createElement('span');
                title.className = 'text-xs font-medium text-white';
                title.textContent = item.variationName || item.exerciseName || 'Exercise';

                const subtitle = document.createElement('span');
                subtitle.className = 'text-[11px] text-white/60';
                subtitle.textContent = item.exerciseName || '';

                left.appendChild(title);
                if (subtitle.textContent) {
                    left.appendChild(subtitle);
                }

                const actions = document.createElement('div');
                actions.className = 'flex items-center gap-2';

                const replaceBtn = document.createElement('button');
                replaceBtn.type = 'button';
                replaceBtn.className = 'text-[11px] text-white/70 hover:text-white px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors';
                replaceBtn.textContent = 'Replace';
                replaceBtn.addEventListener('click', () => {
                    this.pendingAction = { type: 'replace', phase, index };
                    this.searchInput?.focus();
                });

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 transition-colors';
                removeBtn.textContent = 'Remove';
                removeBtn.addEventListener('click', () => {
                    this.removeExerciseFromPhase(phase, index);
                });

                actions.appendChild(replaceBtn);
                actions.appendChild(removeBtn);

                row.appendChild(left);
                row.appendChild(actions);

                listEl.appendChild(row);
            });

            if (labelEl) {
                const count = items.length;
                labelEl.textContent = count === 1 ? '1 exercise' : `${count} exercises`;
            }
        });
    }

    addExerciseToPhase(phase, exercise, variation) {
        if (!PHASE_KEYS.includes(phase)) return;
        const target = this.editedPhases[phase] || [];
        target.push(this.buildSessionItem(exercise, variation));
        this.editedPhases[phase] = target;
        this.renderPhases();
    }

    removeExerciseFromPhase(phase, index) {
        if (!PHASE_KEYS.includes(phase)) return;
        const target = this.editedPhases[phase] || [];
        if (index < 0 || index >= target.length) return;
        target.splice(index, 1);
        this.editedPhases[phase] = target;
        this.renderPhases();
    }

    replaceExercise(phase, index, exercise, variation) {
        if (!PHASE_KEYS.includes(phase)) return;
        const target = this.editedPhases[phase] || [];
        if (index < 0 || index >= target.length) return;
        target[index] = this.buildSessionItem(exercise, variation);
        this.editedPhases[phase] = target;
        this.renderPhases();
    }

    buildSessionItem(exercise, variation) {
        return {
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            variationId: variation.id,
            variationName: variation.name,
            difficulty_score: variation.difficulty_score || 0,
            weight: variation.weight || 0,
            bilaterality: variation.bilaterality,
            progression_type: variation.progression_type,
            target_muscles: variation.target_muscles,
            technique_cues: variation.technique_cues,
            sets: null,
            reps: null
        };
    }

    async handleSearch(query) {
        this.clearSearchResults();
        if (!query || query.length < 2) {
            return;
        }

        try {
            this.setLoading(true);
            const results = await searchExercises(query, {
                // Default to workout if no pending action yet
                phase: this.pendingAction?.phase || 'workout'
            });
            this.renderSearchResults(results);
        } catch (error) {
            console.error('[EditSessionManager] Error searching exercises:', error);
        } finally {
            this.setLoading(false);
        }
    }

    async handleAISuggestions(phase) {
        this.clearSearchResults();
        try {
            this.setLoading(true);
            const context = {
                phase,
                currentSession: this.session,
                currentPhaseItems: this.editedPhases[phase] || []
            };
            const suggestions = await getAISuggestions(phase, context);
            this.renderSearchResults(suggestions, true);
        } catch (error) {
            console.error('[EditSessionManager] Error getting AI suggestions:', error);
        } finally {
            this.setLoading(false);
        }
    }

    renderSearchResults(results, fromAI = false) {
        if (!this.searchResults) return;
        this.searchResults.innerHTML = '';

        if (!results || results.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-xs text-white/50';
            empty.textContent = fromAI ? 'No AI suggestions available.' : 'No exercises found.';
            this.searchResults.appendChild(empty);
            return;
        }

        results.forEach(result => {
            const { exercise, variation, reason } = result;
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'w-full text-left px-3 py-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-white/30 transition-colors';

            const title = document.createElement('div');
            title.className = 'text-xs font-semibold text-white flex justify-between items-center';
            title.innerHTML = `<span>${variation.name}</span>${fromAI ? '<span class="text-[10px] text-emerald-300/80">AI</span>' : ''}`;

            const subtitle = document.createElement('div');
            subtitle.className = 'text-[11px] text-white/60 mt-0.5';
            subtitle.textContent = exercise.name;

            card.appendChild(title);
            card.appendChild(subtitle);

            if (reason) {
                const reasonEl = document.createElement('div');
                reasonEl.className = 'text-[10px] text-white/50 mt-0.5';
                reasonEl.textContent = reason;
                card.appendChild(reasonEl);
            }

            card.addEventListener('click', () => {
                const action = this.pendingAction || { type: 'add', phase: 'workout' };
                if (action.type === 'replace' && typeof action.index === 'number') {
                    this.replaceExercise(action.phase, action.index, exercise, variation);
                } else {
                    this.addExerciseToPhase(action.phase, exercise, variation);
                }
                this.pendingAction = null;
                this.clearSearchResults();
                if (this.searchInput) {
                    this.searchInput.value = '';
                }
            });

            this.searchResults.appendChild(card);
        });
    }

    clearSearchResults() {
        if (this.searchResults) {
            this.searchResults.innerHTML = '';
        }
    }

    setLoading(isLoading) {
        this.loading = isLoading;
        if (this.saveBtn) {
            this.saveBtn.disabled = isLoading;
        }
    }

    async handleSave() {
        if (!this.session || !this.userId || !this.systemId) {
            console.warn('[EditSessionManager] Missing session, userId or systemId for save');
            this.close();
            return;
        }

        // Optional basic validation: ensure workout has at least 1 exercise
        const workoutCount = (this.editedPhases.workout || []).length;
        if (workoutCount === 0) {
            alert('Please add at least one exercise to the Workout phase.');
            return;
        }

        const updatedSession = {
            ...this.session,
            phases: {
                warmup: this.editedPhases.warmup || [],
                workout: this.editedPhases.workout || [],
                cooldown: this.editedPhases.cooldown || []
            },
            updatedAt: new Date().toISOString()
        };

        try {
            this.setLoading(true);
            await saveSessionToSystem(this.userId, this.systemId, updatedSession);
            this.session = updatedSession;
            this.close();
            // Trigger a custom event so dashboard can refresh UI if needed
            const event = new CustomEvent('session-updated', { detail: { session: updatedSession } });
            window.dispatchEvent(event);
        } catch (error) {
            console.error('[EditSessionManager] Error saving session:', error);
            alert('There was a problem saving your changes. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }
}


