// Common UI utility functions
// Shared UI helpers for glassmorphism, transitions, and common interactions

/**
 * Apply glassmorphism effect to an element
 * @param {HTMLElement} element - Element to apply glass effect to
 * @param {string} strength - 'standard' or 'strong'
 */
export function applyGlassEffect(element, strength = 'standard') {
    if (strength === 'strong') {
        element.classList.add('glass-strong');
    } else {
        element.classList.add('glass');
    }
}

/**
 * Show element with fade-in animation
 * @param {HTMLElement} element - Element to show
 */
export function fadeIn(element) {
    element.classList.remove('hidden');
    element.style.animation = 'fadeIn 0.4s ease-in-out';
}

/**
 * Hide element with fade-out animation
 * @param {HTMLElement} element - Element to hide
 * @param {Function} callback - Optional callback after fade-out
 */
export function fadeOut(element, callback) {
    element.style.transition = 'opacity 0.3s ease-out';
    element.style.opacity = '0';
    setTimeout(() => {
        element.classList.add('hidden');
        if (callback) callback();
    }, 300);
}

/**
 * Update navigation active state
 * @param {string} pageId - Page identifier (data-page value)
 */
export function updateActiveNav(pageId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNav = document.querySelector(`[data-page="${pageId}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
}

/**
 * Update navigation for athlete role
 * @param {string} role - Always 'athlete' (kept for compatibility)
 */
export function updateNavigationForRole(role) {
    // Show all navigation items (all are athlete items now)
    const athleteNavItems = document.querySelectorAll('.athlete-nav-item');
    athleteNavItems.forEach(item => {
        item.style.display = 'block';
    });
    
    // Update active state for first nav item
    const firstNav = document.querySelector('.athlete-nav-item .nav-item');
    if (firstNav) {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        firstNav.classList.add('active');
    }
}

/**
 * Animate progress bars on page load
 */
export function animateProgressBars() {
    const progressBars = document.querySelectorAll('.progress-bar');
    progressBars.forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0%';
        setTimeout(() => {
            bar.style.width = width;
        }, 100);
    });
}

/**
 * Normalize discipline field to always return an array
 * Handles both string (legacy) and array (new) formats
 * @param {string|string[]|undefined} discipline - Discipline field from session
 * @returns {string[]} Array of disciplines
 */
export function normalizeDisciplines(discipline) {
    if (!discipline) return [];
    if (Array.isArray(discipline)) return discipline;
    if (typeof discipline === 'string') return [discipline];
    return [];
}

/**
 * Format disciplines for display (e.g., "Pilates, Weights, Crossfit")
 * @param {string|string[]|undefined} discipline - Discipline field from session
 * @returns {string} Formatted string for display
 */
export function formatDisciplines(discipline) {
    const disciplines = normalizeDisciplines(discipline);
    if (disciplines.length === 0) return '';
    if (disciplines.length === 1) return disciplines[0];
    return disciplines.join(', ');
}

