/**
 * Authentication UI Manager
 * 
 * Handles the authentication UI overlay (login, signup, password reset).
 * Manages form interactions and displays error messages.
 */

import { 
    login, 
    signup, 
    resetPassword, 
    loginWithGoogle 
} from '../core/auth-manager.js';

let currentForm = 'login'; // 'login', 'signup', 'reset'

/**
 * Initialize authentication UI
 * Sets up event listeners for auth forms
 */
export function initAuthUI() {
    setupLoginForm();
    setupSignupForm();
    setupResetForm();
    setupFormToggles();
    setupGoogleLogin();
}

/**
 * Show authentication overlay
 * @param {string} form - Form to show ('login', 'signup', 'reset')
 */
export function showAuthOverlay(form = 'login') {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) {
        console.error('Auth overlay not found');
        return;
    }
    
    currentForm = form;
    // Remove hidden from container
    overlay.classList.remove('hidden');
    
    // Show appropriate form
    showForm(form);
}

/**
 * Hide authentication overlay
 */
export function hideAuthOverlay() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
    
    // Reset forms
    resetForms();
}

/**
 * Show specific form
 * @param {string} form - Form name
 */
function showForm(form) {
    // Hide all forms
    document.getElementById('auth-login')?.classList.add('hidden');
    document.getElementById('auth-signup')?.classList.add('hidden');
    document.getElementById('auth-reset')?.classList.add('hidden');
    
    // Hide all errors
    hideAllErrors();
    
    // Show requested form
    const formElement = document.getElementById(`auth-${form}`);
    if (formElement) {
        formElement.classList.remove('hidden');
    }
}

/**
 * Setup login form
 */
function setupLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email')?.value;
        const password = document.getElementById('login-password')?.value;
        const submitBtn = document.getElementById('login-submit');
        const btnText = submitBtn?.querySelector('.login-btn-text');
        const btnLoading = submitBtn?.querySelector('.login-btn-loading');
        
        if (!email || !password) {
            showError('auth-error', 'Please fill in all fields');
            return;
        }
        
        // Show loading state
        setLoadingState(submitBtn, btnText, btnLoading, true);
        hideError('auth-error');
        
        try {
            await login(email, password);
            // Success - auth state change will handle navigation
            hideAuthOverlay();
        } catch (error) {
            showError('auth-error', getErrorMessage(error));
        } finally {
            setLoadingState(submitBtn, btnText, btnLoading, false);
        }
    });
}

/**
 * Setup signup form
 */
function setupSignupForm() {
    const form = document.getElementById('signup-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('signup-name')?.value;
        const email = document.getElementById('signup-email')?.value;
        const password = document.getElementById('signup-password')?.value;
        const submitBtn = document.getElementById('signup-submit');
        const btnText = submitBtn?.querySelector('.signup-btn-text');
        const btnLoading = submitBtn?.querySelector('.signup-btn-loading');
        
        if (!name || !email || !password) {
            showError('auth-signup-error', 'Please fill in all fields');
            return;
        }
        
        if (password.length < 6) {
            showError('auth-signup-error', 'Password must be at least 6 characters');
            return;
        }
        
        // Show loading state
        setLoadingState(submitBtn, btnText, btnLoading, true);
        hideError('auth-signup-error');
        
        try {
            await signup(email, password, name);
            // Success - auth state change will handle navigation
            hideAuthOverlay();
        } catch (error) {
            showError('auth-signup-error', getErrorMessage(error));
        } finally {
            setLoadingState(submitBtn, btnText, btnLoading, false);
        }
    });
}

/**
 * Setup password reset form
 */
function setupResetForm() {
    const form = document.getElementById('reset-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('reset-email')?.value;
        const submitBtn = document.getElementById('reset-submit');
        const btnText = submitBtn?.querySelector('.reset-btn-text');
        const btnLoading = submitBtn?.querySelector('.reset-btn-loading');
        
        if (!email) {
            showError('auth-reset-error', 'Please enter your email');
            return;
        }
        
        // Show loading state
        setLoadingState(submitBtn, btnText, btnLoading, true);
        hideError('auth-reset-error');
        hideSuccess('auth-reset-success');
        
        try {
            await resetPassword(email);
            showSuccess('auth-reset-success', 'Password reset email sent! Check your inbox.');
            form.reset();
        } catch (error) {
            showError('auth-reset-error', getErrorMessage(error));
        } finally {
            setLoadingState(submitBtn, btnText, btnLoading, false);
        }
    });
}

/**
 * Setup form toggle buttons
 */
function setupFormToggles() {
    // Login to Signup
    document.getElementById('auth-signup-toggle')?.addEventListener('click', () => {
        showForm('signup');
    });
    
    // Signup to Login
    document.getElementById('auth-login-toggle')?.addEventListener('click', () => {
        showForm('login');
    });
    
    // Login to Reset
    document.getElementById('auth-forgot-password')?.addEventListener('click', () => {
        showForm('reset');
    });
    
    // Reset to Login
    document.getElementById('auth-reset-back')?.addEventListener('click', () => {
        showForm('login');
    });
}

/**
 * Setup Google login button
 */
function setupGoogleLogin() {
    document.getElementById('auth-google-login')?.addEventListener('click', async () => {
        const btn = document.getElementById('auth-google-login');
        const originalText = btn?.innerHTML;
        
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing in...';
            }
            
            hideError('auth-error');
            await loginWithGoogle();
            hideAuthOverlay();
        } catch (error) {
            showError('auth-error', getErrorMessage(error));
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    });
}

/**
 * Show error message
 * @param {string} errorId - Error element ID
 * @param {string} message - Error message
 */
function showError(errorId, message) {
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

/**
 * Hide error message
 * @param {string} errorId - Error element ID
 */
function hideError(errorId) {
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
        errorEl.classList.add('hidden');
    }
}

/**
 * Show success message
 * @param {string} successId - Success element ID
 * @param {string} message - Success message
 */
function showSuccess(successId, message) {
    const successEl = document.getElementById(successId);
    if (successEl) {
        successEl.textContent = message;
        successEl.classList.remove('hidden');
    }
}

/**
 * Hide success message
 * @param {string} successId - Success element ID
 */
function hideSuccess(successId) {
    const successEl = document.getElementById(successId);
    if (successEl) {
        successEl.classList.add('hidden');
    }
}

/**
 * Hide all errors
 */
function hideAllErrors() {
    hideError('auth-error');
    hideError('auth-signup-error');
    hideError('auth-reset-error');
    hideSuccess('auth-reset-success');
}

/**
 * Set loading state for button
 * @param {HTMLElement} btn - Button element
 * @param {HTMLElement} btnText - Text span
 * @param {HTMLElement} btnLoading - Loading span
 * @param {boolean} loading - Loading state
 */
function setLoadingState(btn, btnText, btnLoading, loading) {
    if (!btn || !btnText || !btnLoading) return;
    
    if (loading) {
        btn.disabled = true;
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
    } else {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
    }
}

/**
 * Reset all forms
 */
function resetForms() {
    document.getElementById('login-form')?.reset();
    document.getElementById('signup-form')?.reset();
    document.getElementById('reset-form')?.reset();
    hideAllErrors();
    showForm('login');
}

/**
 * Get user-friendly error message from Firebase error
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 */
function getErrorMessage(error) {
    const message = error.message || 'An error occurred';
    
    // Map Firebase error codes to user-friendly messages
    if (message.includes('auth/user-not-found')) {
        return 'No account found with this email';
    } else if (message.includes('auth/wrong-password') || message.includes('auth/invalid-credential')) {
        return 'Incorrect password';
    } else if (message.includes('auth/email-already-in-use')) {
        return 'An account with this email already exists';
    } else if (message.includes('auth/weak-password')) {
        return 'Password is too weak. Please use at least 6 characters';
    } else if (message.includes('auth/invalid-email')) {
        return 'Invalid email address';
    } else if (message.includes('auth/network-request-failed')) {
        return 'Network error. Please check your connection';
    } else if (message.includes('auth/too-many-requests')) {
        return 'Too many attempts. Please try again later';
    }
    
    return message;
}

