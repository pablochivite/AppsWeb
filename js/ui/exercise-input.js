/**
 * Exercise Input Component
 * 
 * Dynamic input component for exercise performance tracking.
 * Displays inputs based on exercise type (weight/reps/time) and shows last performance.
 */

import {
  determineExerciseType,
  getExerciseInputs,
  validateExerciseInput,
  getDefaultValues,
  formatExerciseType
} from '../services/exerciseTypeService.js';
import { getLastPerformance } from '../services/exerciseHistoryService.js';

export class ExerciseInput {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with ID "${containerId}" not found`);
    }

    this.options = {
      onValueChange: options.onValueChange || null,
      showLastPerformance: options.showLastPerformance !== false,
      userId: options.userId || null,
      ...options
    };

    this.currentExercise = null;
    this.currentVariation = null;
    this.exerciseType = null;
    this.lastPerformance = null;
    this.values = {
      weight: null,
      reps: null,
      time: null
    };
  }

  /**
   * Initialize the component with an exercise and variation
   * @param {Object} exercise - Exercise object
   * @param {Object} variation - Variation object
   */
  async initialize(exercise, variation) {
    this.currentExercise = exercise;
    this.currentVariation = variation;
    this.exerciseType = determineExerciseType(exercise, variation);
    
    // Load last performance if userId is available
    if (this.options.userId && this.options.showLastPerformance) {
      try {
        this.lastPerformance = await getLastPerformance(
          this.options.userId,
          exercise.id,
          variation.id || variation.variationId
        );
      } catch (error) {
        console.warn('Failed to load last performance:', error);
        this.lastPerformance = null;
      }
    }

    // Get default values
    const defaults = getDefaultValues(this.exerciseType, variation, this.lastPerformance);
    this.values = {
      weight: defaults.weight || null,
      reps: defaults.reps || null,
      time: defaults.time || null
    };

    this.render();
  }

  /**
   * Render the component
   */
  render() {
    if (!this.currentExercise || !this.currentVariation) {
      this.container.innerHTML = '<div class="text-white/60">No exercise selected</div>';
      return;
    }

    const inputs = getExerciseInputs(this.exerciseType);
    const exerciseTypeLabel = formatExerciseType(this.exerciseType);

    let html = `
      <div class="exercise-input-container">
        <div class="mb-4">
          <span class="text-xs text-white/60">Exercise Type: ${exerciseTypeLabel}</span>
        </div>
    `;

    // Show last performance if available
    if (this.lastPerformance && this.options.showLastPerformance) {
      html += this.renderLastPerformance();
    }

    // Render inputs based on exercise type
    html += '<div class="flex flex-col gap-4">';

    if (inputs.weight) {
      html += this.renderWeightInput();
    }

    if (inputs.reps) {
      html += this.renderRepsInput();
    }

    if (inputs.time) {
      html += this.renderTimeInput();
    }

    html += '</div>';

    // Add "Use Last" button if last performance exists
    if (this.lastPerformance && this.options.showLastPerformance) {
      html += `
        <button 
          id="use-last-btn" 
          class="mt-4 w-full bg-white/10 hover:bg-white/20 text-white text-sm py-2 rounded-lg transition-colors"
        >
          Use Last Performance
        </button>
      `;
    }

    html += '</div>';

    this.container.innerHTML = html;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render last performance section
   */
  renderLastPerformance() {
    const last = this.lastPerformance;
    const parts = [];

    if (last.weight !== undefined && last.weight !== null) {
      parts.push(`${last.weight}kg`);
    }
    if (last.reps !== undefined && last.reps !== null) {
      parts.push(`${last.reps} reps`);
    }
    if (last.time !== undefined && last.time !== null) {
      const minutes = Math.floor(last.time / 60);
      const seconds = last.time % 60;
      parts.push(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }

    if (parts.length === 0) return '';

    return `
      <div class="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
        <div class="text-xs text-white/60 mb-1">Last Time</div>
        <div class="text-sm text-white font-medium">${parts.join(' • ')}</div>
      </div>
    `;
  }

  /**
   * Render weight input
   */
  renderWeightInput() {
    const value = this.values.weight || 0;
    return `
      <div class="input-group">
        <label class="text-sm text-white/60 mb-2 block">Weight (kg)</label>
        <div class="flex items-center gap-3">
          <button 
            class="input-btn-minus w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold transition-colors"
            data-input="weight"
            data-action="decrease"
          >-</button>
          <input 
            type="number" 
            id="input-weight" 
            class="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-center text-lg font-semibold focus:outline-none focus:border-white/40"
            value="${value}"
            min="0"
            step="0.5"
            data-input="weight"
          />
          <button 
            class="input-btn-plus w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold transition-colors"
            data-input="weight"
            data-action="increase"
          >+</button>
        </div>
      </div>
    `;
  }

  /**
   * Render reps input
   */
  renderRepsInput() {
    const value = this.values.reps || 0;
    return `
      <div class="input-group">
        <label class="text-sm text-white/60 mb-2 block">Reps</label>
        <div class="flex items-center gap-3">
          <button 
            class="input-btn-minus w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold transition-colors"
            data-input="reps"
            data-action="decrease"
          >-</button>
          <input 
            type="number" 
            id="input-reps" 
            class="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-center text-lg font-semibold focus:outline-none focus:border-white/40"
            value="${value}"
            min="0"
            step="1"
            data-input="reps"
          />
          <button 
            class="input-btn-plus w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold transition-colors"
            data-input="reps"
            data-action="increase"
          >+</button>
        </div>
      </div>
    `;
  }

  /**
   * Render time input (with timer functionality)
   */
  renderTimeInput() {
    const value = this.values.time || 0;
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;

    return `
      <div class="input-group">
        <label class="text-sm text-white/60 mb-2 block">Time</label>
        <div class="flex items-center gap-3">
          <button 
            class="input-btn-minus w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold transition-colors"
            data-input="time"
            data-action="decrease"
          >-</button>
          <div class="flex-1 flex items-center justify-center gap-2 bg-white/10 border border-white/20 rounded-lg px-4 py-3">
            <input 
              type="number" 
              id="input-time-minutes" 
              class="w-16 bg-transparent text-white text-center text-lg font-semibold focus:outline-none"
              value="${minutes}"
              min="0"
              max="59"
              data-input="time-minutes"
            />
            <span class="text-white/60">:</span>
            <input 
              type="number" 
              id="input-time-seconds" 
              class="w-16 bg-transparent text-white text-center text-lg font-semibold focus:outline-none"
              value="${seconds.toString().padStart(2, '0')}"
              min="0"
              max="59"
              data-input="time-seconds"
            />
          </div>
          <button 
            class="input-btn-plus w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold transition-colors"
            data-input="time"
            data-action="increase"
          >+</button>
        </div>
        <button 
          id="timer-btn" 
          class="mt-2 w-full bg-white/10 hover:bg-white/20 text-white text-sm py-2 rounded-lg transition-colors"
        >
          Start Timer
        </button>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // +/- buttons
    this.container.querySelectorAll('[data-action="increase"], [data-action="decrease"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const inputType = btn.getAttribute('data-input');
        const action = btn.getAttribute('data-action');
        this.handleButtonClick(inputType, action);
      });
    });

    // Input fields
    this.container.querySelectorAll('input[type="number"]').forEach(input => {
      input.addEventListener('input', (e) => {
        const inputType = e.target.getAttribute('data-input');
        this.handleInputChange(inputType, e.target.value);
      });
    });

    // Use Last button
    const useLastBtn = this.container.querySelector('#use-last-btn');
    if (useLastBtn) {
      useLastBtn.addEventListener('click', () => {
        this.useLastPerformance();
      });
    }

    // Timer button
    const timerBtn = this.container.querySelector('#timer-btn');
    if (timerBtn) {
      timerBtn.addEventListener('click', () => {
        this.startTimer();
      });
    }
  }

  /**
   * Handle +/- button clicks
   */
  handleButtonClick(inputType, action) {
    const step = inputType === 'weight' ? 0.5 : (inputType === 'time' ? 5 : 1);
    const currentValue = this.values[inputType] || 0;
    
    if (action === 'increase') {
      this.values[inputType] = currentValue + step;
    } else {
      this.values[inputType] = Math.max(0, currentValue - step);
    }

    this.updateInputDisplay(inputType);
    this.notifyValueChange();
  }

  /**
   * Handle input field changes
   */
  handleInputChange(inputType, value) {
    if (inputType === 'time-minutes' || inputType === 'time-seconds') {
      const minutes = parseInt(this.container.querySelector('#input-time-minutes')?.value || 0);
      const seconds = parseInt(this.container.querySelector('#input-time-seconds')?.value || 0);
      this.values.time = minutes * 60 + seconds;
    } else {
      this.values[inputType] = parseFloat(value) || 0;
    }

    this.notifyValueChange();
  }

  /**
   * Update input display after value change
   */
  updateInputDisplay(inputType) {
    if (inputType === 'time') {
      const minutes = Math.floor(this.values.time / 60);
      const seconds = this.values.time % 60;
      const minutesInput = this.container.querySelector('#input-time-minutes');
      const secondsInput = this.container.querySelector('#input-time-seconds');
      if (minutesInput) minutesInput.value = minutes;
      if (secondsInput) secondsInput.value = seconds.toString().padStart(2, '0');
    } else {
      const input = this.container.querySelector(`#input-${inputType}`);
      if (input) input.value = this.values[inputType];
    }
  }

  /**
   * Use last performance values
   */
  useLastPerformance() {
    if (!this.lastPerformance) return;

    if (this.lastPerformance.weight !== undefined) {
      this.values.weight = this.lastPerformance.weight;
    }
    if (this.lastPerformance.reps !== undefined) {
      this.values.reps = this.lastPerformance.reps;
    }
    if (this.lastPerformance.time !== undefined) {
      this.values.time = this.lastPerformance.time;
    }

    this.render();
  }

  /**
   * Start timer for time-based exercises
   */
  startTimer() {
    const timerBtn = this.container.querySelector('#timer-btn');
    if (!timerBtn) return;

    if (this.timerInterval) {
      // Stop timer
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      timerBtn.textContent = 'Start Timer';
      timerBtn.classList.remove('bg-red-500/20');
    } else {
      // Start timer
      const startTime = Date.now();
      timerBtn.textContent = 'Stop Timer';
      timerBtn.classList.add('bg-red-500/20');

      this.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        this.values.time = elapsed;
        this.updateInputDisplay('time');
        this.notifyValueChange();
      }, 1000);
    }
  }

  /**
   * Notify parent component of value change
   */
  notifyValueChange() {
    if (this.options.onValueChange) {
      this.options.onValueChange(this.getValues());
    }
  }

  /**
   * Get current values
   * @returns {Object} Current input values
   */
  getValues() {
    return { ...this.values };
  }

  /**
   * Set values programmatically
   * @param {Object} values - Values to set
   */
  setValues(values) {
    if (values.weight !== undefined) this.values.weight = values.weight;
    if (values.reps !== undefined) this.values.reps = values.reps;
    if (values.time !== undefined) this.values.time = values.time;
    this.render();
  }

  /**
   * Validate current values
   * @returns {Object} Validation result
   */
  validate() {
    return validateExerciseInput(this.exerciseType, this.values);
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.container.innerHTML = '';
  }
}

