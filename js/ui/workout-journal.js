/**
 * WorkoutJournal
 *
 * Scrollable workout logger / journal for a full session.
 * - Renders all exercises as vertical cards.
 * - Each card shows a grid of sets with:
 *   Set # | Previous | Kg | Reps | Done
 * - Uses event delegation for all interactions.
 *
 * Expected options:
 *   - session: session object with phases { warmup, workout, cooldown }
 *   - userId: current user id
 *   - onSetUpdated(setKey, setState)
 *   - onSessionUpdated(stateSnapshot)
 *   - onAllSetsCompleted(stateSnapshot)
 */

import { getLastPerformance } from '../services/exerciseHistoryService.js';
import { saveSessionProgress } from '../core/storage.js';

export class WorkoutJournal {
  /**
   * @param {string} containerId
   * @param {Object} options
   */
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`WorkoutJournal: container "${containerId}" not found`);
    }

    this.session = options.session || null;
    this.userId = options.userId || null;

    this.onSetUpdated = options.onSetUpdated || null;
    this.onSessionUpdated = options.onSessionUpdated || null;
    this.onAllSetsCompleted = options.onAllSetsCompleted || null;

    // Flat list of sets to render
    this.sets = [];
    // Map setKey -> state {
    //   weight, reps, completed,
    //   prevWeight, prevReps, historyText,
    //   phase, exerciseId, variationId, setNumber
    // }
    this.currentSessionData = {};
  }

  /**
   * Initialize structure and render
   */
  async render() {
    if (!this.session || !this.session.phases) {
      this.container.innerHTML = '<div class="text-white/60 text-center py-8">No session data available.</div>';
      return;
    }

    this.buildSetsFromSession();
    await this.preloadHistory();
    this.renderHtml();
    this.attachEventListeners();
  }

  /**
   * Build a flat list of sets from the session phases/variations
   */
  buildSetsFromSession() {
    const phases = ['warmup', 'workout', 'cooldown'];
    const sets = [];

    phases.forEach((phaseName) => {
      const phaseVariations = this.session.phases[phaseName] || [];

      phaseVariations.forEach((variation, variationIndex) => {
        const exerciseId = variation.exerciseId;
        const variationId = variation.variationId || variation.id;
        const exerciseName = variation.exerciseName || variation.variationName || 'Exercise';

        // Default to 3 sets if not specified
        const totalSets = variation.sets || variation.totalSets || 3;

        for (let setNumber = 1; setNumber <= totalSets; setNumber++) {
          const setKey = `${exerciseId}-${variationId}-set-${setNumber}`;
          sets.push({
            key: setKey,
            phase: phaseName,
            exerciseId,
            variationId,
            exerciseName,
            variationIndex,
            setNumber
          });

          if (!this.currentSessionData[setKey]) {
            this.currentSessionData[setKey] = {
              phase: phaseName,
              exerciseId,
              variationId,
              setNumber,
              weight: '',
              reps: '',
              completed: false,
              // Ghost data from last session (per-set)
              prevWeight: null,
              prevReps: null,
              // Optional aggregated text for backwards compatibility
              historyText: ''
            };
          }
        }
      });
    });

    this.sets = sets;
  }

  /**
   * Preload last performance for each variation (ghost data)
   */
  async preloadHistory() {
    if (!this.userId) {
      return;
    }

    const uniquePairs = new Map();
    this.sets.forEach((set) => {
      const key = `${set.exerciseId}-${set.variationId}`;
      if (!uniquePairs.has(key)) {
        uniquePairs.set(key, { exerciseId: set.exerciseId, variationId: set.variationId });
      }
    });

    const historyPromises = [];
    uniquePairs.forEach(({ exerciseId, variationId }) => {
      historyPromises.push(
        this.loadHistoryForVariation(exerciseId, variationId)
      );
    });

    await Promise.all(historyPromises);
  }

  async loadHistoryForVariation(exerciseId, variationId) {
    if (!this.userId || !exerciseId || !variationId) return;

    try {
      const last = await getLastPerformance(this.userId, exerciseId, variationId);
      if (!last) return;

      const historyText = this.formatHistoryText(last);

      // Map per-set ghost data (prevWeight/prevReps) onto current session sets
      const lastSets = Array.isArray(last.sets) ? last.sets : [];

      const setsForVariation = this.sets
        .filter(
          (set) =>
            set.exerciseId === exerciseId && set.variationId === variationId
        )
        .sort((a, b) => a.setNumber - b.setNumber);

      setsForVariation.forEach((set, index) => {
        const setKey = set.key;
        const prevData = lastSets[index] || null;

        if (!this.currentSessionData[setKey]) {
          this.currentSessionData[setKey] = {
            phase: set.phase,
            exerciseId,
            variationId,
            setNumber: set.setNumber,
            weight: '',
            reps: '',
            completed: false,
            prevWeight: null,
            prevReps: null,
            historyText: ''
          };
        }

        const state = this.currentSessionData[setKey];
        state.prevWeight =
          prevData && typeof prevData.weight === 'number'
            ? prevData.weight
            : null;
        state.prevReps =
          prevData && typeof prevData.reps === 'number' ? prevData.reps : null;
        // Keep a shared "Last: xxkg x yy" text for legacy uses
        state.historyText = historyText || '';
      });
    } catch (error) {
      console.warn('WorkoutJournal: failed to load history for', exerciseId, variationId, error);
    }
  }

  /**
   * Format ghost data text: e.g. "Last: 80kg x 8"
   */
  formatHistoryText(lastPerformance) {
    if (!lastPerformance) return '';

    const parts = [];
    if (lastPerformance.weight !== undefined && lastPerformance.weight !== null) {
      parts.push(`${lastPerformance.weight}kg`);
    }
    if (lastPerformance.reps !== undefined && lastPerformance.reps !== null) {
      parts.push(`${lastPerformance.reps} reps`);
    }
    if (lastPerformance.time !== undefined && lastPerformance.time !== null) {
      const minutes = Math.floor(lastPerformance.time / 60);
      const seconds = lastPerformance.time % 60;
      parts.push(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }

    if (parts.length === 0) return '';
    return `Last: ${parts.join(' • ')}`;
  }

  /**
   * Render full journal HTML
   */
  renderHtml() {
    // Group sets by exercise card
    const cardsByKey = new Map();

    this.sets.forEach((set) => {
      const cardKey = `${set.phase}-${set.exerciseId}-${set.variationId}`;
      if (!cardsByKey.has(cardKey)) {
        cardsByKey.set(cardKey, {
          ...set,
          sets: []
        });
      }
      cardsByKey.get(cardKey).sets.push(set);
    });

    const cards = Array.from(cardsByKey.values());

    const cardsHtml = cards
      .map((card) => this.renderExerciseCard(card))
      .join('');

    this.container.innerHTML = `
      <div class="workout-journal space-y-6">
        ${cardsHtml || '<div class="text-white/60 text-center py-8">No exercises in this session.</div>'}
      </div>
    `;
  }

  renderExerciseCard(card) {
    const phaseLabel = this.getPhaseLabel(card.phase);

    // Renumber sets for display (1..n) even if underlying keys have gaps
    const rowsHtml = card.sets
      .map((set, index) => {
        const displayNumber = index + 1;
        const state = this.currentSessionData[set.key] || {};
        const completedClass = state.completed ? 'set-row set-row--done' : 'set-row';

        // Per-set ghost values from last session
        const prevWeightValue =
          state.prevWeight === null || state.prevWeight === undefined
            ? null
            : state.prevWeight;
        const prevRepsValue =
          state.prevReps === null || state.prevReps === undefined
            ? null
            : state.prevReps;

        const prevWeightDisplay =
          prevWeightValue === null || prevWeightValue === '-'
            ? '&mdash;'
            : `${prevWeightValue}kg`;
        const prevRepsDisplay =
          prevRepsValue === null || prevRepsValue === '-'
            ? '&mdash;'
            : `${prevRepsValue}`;

        return `
          <div 
            class="${completedClass}"
            data-role="set-row"
            data-set-key="${set.key}"
          >
            <div class="set-cell set-cell--index">#${displayNumber}</div>
            <div class="set-cell set-cell--previous">
              <span class="ghost-text">${prevWeightDisplay}</span>
            </div>
            <div class="set-cell set-cell--previous">
              <span class="ghost-text">${prevRepsDisplay}</span>
            </div>
            <div class="set-cell set-cell--input">
              <input 
                type="number"
                inputmode="decimal"
                min="0"
                step="0.5"
                class="set-input"
                placeholder="Kg"
                data-input="weight"
                data-prev-weight="${prevWeightValue ?? ''}"
                data-set-key="${set.key}"
                value="${state.weight ?? ''}"
              />
            </div>
            <div class="set-cell set-cell--input">
              <input 
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                class="set-input"
                placeholder="Reps"
                data-input="reps"
                data-set-key="${set.key}"
                value="${state.reps ?? ''}"
              />
            </div>
            <div class="set-cell set-cell--action">
              <button 
                class="set-delete-btn"
                data-action="delete-set"
                data-set-key="${set.key}"
                aria-label="Delete set"
              >
                &#128465;
              </button>
              <button 
                class="set-done-btn"
                data-action="toggle-done"
                data-set-key="${set.key}"
              >
                ${state.completed ? 'Done' : 'Mark'}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    const cardKey = `${card.phase}-${card.exerciseId}-${card.variationId}`;

    return `
      <section 
        class="exercise-card glass-strong"
        data-card-key="${cardKey}"
        data-phase="${card.phase}"
        data-exercise-id="${card.exerciseId}"
        data-variation-id="${card.variationId}"
      >
        <header class="exercise-card-header">
          <div>
            <div class="exercise-card-phase">${phaseLabel}</div>
            <h2 class="exercise-card-title">${card.exerciseName}</h2>
          </div>
        </header>
        <div class="exercise-card-grid-header">
          <div class="set-header-cell">Set</div>
          <div class="set-header-cell">Prev Kg</div>
          <div class="set-header-cell">Prev Reps</div>
          <div class="set-header-cell">Kg</div>
          <div class="set-header-cell">Reps</div>
          <div class="set-header-cell text-right">Done</div>
        </div>
        <div class="exercise-card-sets">
          ${rowsHtml}
        </div>
        <button 
          class="set-add-btn"
          data-action="add-set"
          data-card-key="${cardKey}"
        >
          <span>+</span>
          <span>Add Set</span>
        </button>
      </section>
    `;
  }

  getPhaseLabel(phase) {
    const map = {
      warmup: 'Warm-up',
      workout: 'Workout',
      cooldown: 'Cool Down'
    };
    return map[phase] || phase || '';
  }

  attachEventListeners() {
    // Prevent duplicate listeners
    this.detachEventListeners();

    this._handleClick = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      // Support clicks on inner elements (e.g. spans inside buttons)
      const actionEl = target.closest('[data-action]');
      if (!actionEl) return;

      const action = actionEl.dataset.action;
      if (action === 'toggle-done') {
        const setKey = actionEl.dataset.setKey;
        if (setKey) {
          this.handleToggleDone(setKey);
        }
      } else if (action === 'add-set') {
        const cardKey = actionEl.dataset.cardKey;
        if (cardKey) {
          this.handleAddSet(cardKey);
        }
      } else if (action === 'delete-set') {
        const setKey = actionEl.dataset.setKey;
        if (setKey) {
          this.handleDeleteSet(setKey);
        }
      }
    };

    this._handleInput = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      const inputName = target.dataset.input;
      const setKey = target.dataset.setKey;
      if (!inputName || !setKey) return;

      this.handleInputChange(setKey, inputName, target.value);
    };

    this.container.addEventListener('click', this._handleClick);
    this.container.addEventListener('input', this._handleInput);
  }

  detachEventListeners() {
    if (this._handleClick) {
      this.container.removeEventListener('click', this._handleClick);
    }
    if (this._handleInput) {
      this.container.removeEventListener('input', this._handleInput);
    }
  }

  handleInputChange(setKey, field, rawValue) {
    const value = rawValue === '' ? '' : Number(rawValue);

    if (!this.currentSessionData[setKey]) {
      this.currentSessionData[setKey] = {
        phase: '',
        exerciseId: '',
        variationId: '',
        setNumber: 1,
        weight: '',
        reps: '',
        completed: false,
        historyText: ''
      };
    }

    if (field === 'weight') {
      this.currentSessionData[setKey].weight = value;
    } else if (field === 'reps') {
      this.currentSessionData[setKey].reps = value;
    }

    if (this.onSetUpdated) {
      this.onSetUpdated(setKey, { ...this.currentSessionData[setKey] });
    }

    this.persistSession();
  }

  handleToggleDone(setKey) {
    const state = this.currentSessionData[setKey];
    if (!state) return;

    state.completed = !state.completed;

    const row = this.container.querySelector(`[data-role="set-row"][data-set-key="${setKey}"]`);
    const btn = this.container.querySelector(`button[data-action="toggle-done"][data-set-key="${setKey}"]`);
    if (row) {
      row.classList.toggle('set-row--done', state.completed);
    }
    if (btn) {
      btn.textContent = state.completed ? 'Done' : 'Mark';
    }

    if (this.onSetUpdated) {
      this.onSetUpdated(setKey, { ...state });
    }

    this.persistSession();

    if (this.areAllSetsCompleted() && this.onAllSetsCompleted) {
      this.onAllSetsCompleted(this.getSessionSnapshot());
    }
  }

  areAllSetsCompleted() {
    return this.sets.length > 0 && this.sets.every((set) => {
      const state = this.currentSessionData[set.key];
      return state && state.completed;
    });
  }

  persistSession() {
    const snapshot = this.getSessionSnapshot();

    if (this.onSessionUpdated) {
      this.onSessionUpdated(snapshot);
    }

    // Basic persistence to localStorage for resilience
    try {
      saveSessionProgress({
        sessionId: this.session?.date || this.session?.day,
        journalData: snapshot
      });
    } catch (error) {
      console.warn('WorkoutJournal: failed to save session progress', error);
    }
  }

  /**
   * Snapshot structure that SessionView can reuse
   */
  getSessionSnapshot() {
    return {
      sets: this.sets.slice(),
      currentSessionData: { ...this.currentSessionData }
    };
  }

  handleAddSet(cardKey) {
    // Look up the exercise card in the DOM to get reliable identifiers.
    // Using split('-') on cardKey is unsafe when IDs contain hyphens.
    const cardEl = this.container.querySelector(`[data-card-key="${cardKey}"]`);
    const phase = cardEl?.dataset.phase;
    const exerciseId = cardEl?.dataset.exerciseId;
    const variationId = cardEl?.dataset.variationId;

    if (!phase || !exerciseId || !variationId) {
      console.warn('WorkoutJournal: unable to resolve card data for add-set', { cardKey });
      return;
    }

    const existingForVariation = this.sets.filter(
      (set) => set.exerciseId === exerciseId && set.variationId === variationId
    );
    const nextNumber = existingForVariation.length + 1;
    const setKey = `${exerciseId}-${variationId}-set-${nextNumber}`;

    const exerciseName =
      existingForVariation[0]?.exerciseName || 'Exercise';

    this.sets.push({
      key: setKey,
      phase,
      exerciseId,
      variationId,
      exerciseName,
      variationIndex: existingForVariation[0]?.variationIndex ?? 0,
      setNumber: nextNumber
    });

    if (!this.currentSessionData[setKey]) {
      // Reuse history text from first set of this variation if available
      let historyText = '';
      if (existingForVariation[0]) {
        const refKey = existingForVariation[0].key;
        historyText = this.currentSessionData[refKey]?.historyText || '';
      }

      this.currentSessionData[setKey] = {
        phase,
        exerciseId,
        variationId,
        setNumber: nextNumber,
        weight: '',
        reps: '',
        completed: false,
        historyText
      };
    }

    this.renderHtml();
    this.persistSession();
  }

  handleDeleteSet(setKey) {
    this.sets = this.sets.filter((set) => set.key !== setKey);
    delete this.currentSessionData[setKey];

    if (this.onSetDeleted) {
      this.onSetDeleted(setKey);
    }

    this.renderHtml();
    this.persistSession();
  }
}
