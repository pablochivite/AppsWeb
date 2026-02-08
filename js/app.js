// Main Application Entry Point
// REGAIN - Movement Engineering System

// Import CSS so Vite processes it through PostCSS/Tailwind
import '../css/styles.css';

import { SPARouter } from './core/router.js';
import { setUserRole, getUserRole } from './core/storage.js';
import { updateNavigationForRole, animateProgressBars } from './core/ui-utils.js';
import { OnboardingManager } from './onboarding/onboarding-manager.js';
import { initializeAthleteApp } from './athlete/dashboard.js';
import { loadAllTemplates } from './core/template-loader.js';
import { initAuthManager, onAuthStateChanged, isAuthenticated } from './core/auth-manager.js';
import { initAuthUI, showAuthOverlay, hideAuthOverlay } from './ui/auth-ui.js';

// Global router instance
let router = null;

// Role Management
function showOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

async function selectRole(role) {
    console.log('selectRole called with:', role);
    // Always set role to 'athlete' since we only support athlete now
    await setUserRole('athlete');
    // Start onboarding questions
    console.log('Starting onboarding flow');
    onboardingManager.startAthleteFlow();
}

/**
 * Initialize mobile menu functionality
 */
function initializeMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const sidebarContainer = document.getElementById('sidebar-container');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (!mobileMenuButton || !sidebarContainer || !sidebarOverlay) {
        return;
    }
    
    // Toggle sidebar on button click
    mobileMenuButton.addEventListener('click', () => {
        sidebarContainer.classList.toggle('mobile-open');
        sidebarOverlay.classList.toggle('active');
        
        // Update icon
        const icon = mobileMenuButton.querySelector('i');
        if (icon) {
            if (sidebarContainer.classList.contains('mobile-open')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    });
    
    // Close sidebar when overlay is clicked
    sidebarOverlay.addEventListener('click', () => {
        sidebarContainer.classList.remove('mobile-open');
        sidebarOverlay.classList.remove('active');
        
        const icon = mobileMenuButton.querySelector('i');
        if (icon) {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
    
    // Close sidebar when clicking on nav items (mobile only)
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Only close on mobile
            if (window.innerWidth <= 768) {
                sidebarContainer.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
                
                const icon = mobileMenuButton.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        });
    });
    
    // Show/hide mobile menu button based on screen size
    function handleResize() {
        if (window.innerWidth <= 768) {
            mobileMenuButton.classList.remove('hidden');
        } else {
            mobileMenuButton.classList.add('hidden');
            // Ensure sidebar is not in mobile-open state on desktop
            sidebarContainer.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        }
    }
    
    // Check on load
    handleResize();
    
    // Check on resize
    window.addEventListener('resize', handleResize);
}

function initializeApp(role) {
    // Make sure onboarding overlay is hidden
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
    
    // Always use 'athlete' role
    const userRole = 'athlete';
    
    // Initialize router
    router = new SPARouter();
    router.init(userRole);
    
    // Update navigation for athlete
    updateNavigationForRole(userRole);
    
    // Initialize athlete functionality
    initializeAthleteApp(router);
    
    // Initialize mobile menu
    initializeMobileMenu();
    
    // Check if there's a page in the URL hash, otherwise default to home
    const pageFromHash = router.getPageFromHash();
    const initialPage = pageFromHash || 'home';
    router.navigateTo(initialPage, !!pageFromHash); // Only update hash if it wasn't already set
}

// Initialize onboarding manager with callbacks
const onboardingManager = new OnboardingManager(
    selectRole,  // onRoleSelect callback
    initializeApp // onComplete callback
);

// Block Sentry requests - MUST run immediately
// #region agent log
(function() {
    // Intercept fetch requests to block Sentry
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        if (url.includes('ingest.sentry.io') || url.includes('sentry.io')) {
            return Promise.reject(new Error('Sentry request blocked by application'));
        }
        return originalFetch.apply(this, args);
    };
    
    // Intercept XMLHttpRequest to block Sentry
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (typeof url === 'string' && (url.includes('ingest.sentry.io') || url.includes('sentry.io'))) {
            this._sentryBlocked = true;
            return;
        }
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
        if (this._sentryBlocked) {
            return;
        }
        return originalXHRSend.apply(this, args);
    };
    
    // Suppress Sentry errors in console - intercept early
    const originalError = console.error;
    console.error = function(...args) {
        const message = typeof args[0] === 'string' ? args[0] : args.map(String).join(' ');
        if (message.includes('sentry.io') || (message.includes('ERR_CONNECTION_CLOSED') && message.includes('ingest.sentry'))) {
            return; // Suppress the error
        }
        return originalError.apply(this, args);
    };
})();
// #endregion

// Always show onboarding on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Load all templates first
    try {
        await loadAllTemplates();
        console.log('Templates loaded successfully');
        
        // Initialize mobile menu after templates are loaded
        initializeMobileMenu();
    } catch (error) {
        console.error('Failed to load templates:', error);
        // Continue execution even if templates fail to load
        // This allows the app to function with minimal degradation
    }
    
    // Initialize authentication (popup flow doesn't need redirect result checking)
    await initAuthManager();
    
    initAuthUI();
    
    // Hide all pages first
    document.querySelectorAll('[id^="page-"]').forEach(page => {
        page.classList.add('hidden');
    });
    
    // CRITICAL: Ensure templates are loaded and overlay exists before subscribing
    // The onAuthStateChanged callback fires immediately, so we need the overlay to exist
    const authOverlayCheck = document.getElementById('auth-overlay');
    if (!authOverlayCheck) {
        console.error('[DEBUG] CRITICAL: Auth overlay not found after template loading!');
        console.error('[DEBUG] This means templates may not have loaded correctly');
    } else {
        console.log('[DEBUG] Auth overlay exists, ready to subscribe to auth state');
    }
    
    // Check authentication state
    // This will fire immediately with currentUser (which should be null in E2E mode)
    onAuthStateChanged(async (user) => {
        console.log('[DEBUG] app.js onAuthStateChanged fired, user:', user ? user.uid : 'null');
        console.log('[DEBUG] Auth overlay exists:', !!document.getElementById('auth-overlay'));
        
        if (!user) {
            // STEP 1: User not authenticated - show login
            console.log('[DEBUG] User not authenticated, showing login overlay');
            
            // Ensure onboarding overlay is hidden
            const onboardingOverlay = document.getElementById('onboarding-overlay');
            if (onboardingOverlay) {
                onboardingOverlay.classList.add('hidden');
                onboardingOverlay.style.display = 'none';
            }
            
            // Ensure auth overlay element exists (templates should be loaded by now)
            const authOverlay = document.getElementById('auth-overlay');
            if (!authOverlay) {
                console.error('[DEBUG] CRITICAL: Auth overlay not found when trying to show it!');
                console.error('[DEBUG] This means templates may not have loaded properly');
                // Retry with exponential backoff
                let retries = 0;
                const maxRetries = 5;
                const retryInterval = 100;
                
                const retryShowOverlay = () => {
                    retries++;
                    const retryOverlay = document.getElementById('auth-overlay');
                    if (retryOverlay) {
                        console.log(`[DEBUG] Auth overlay found on retry ${retries}, showing now`);
                        showAuthOverlay('login');
                    } else if (retries < maxRetries) {
                        console.log(`[DEBUG] Retrying to find auth overlay (attempt ${retries}/${maxRetries})`);
                        setTimeout(retryShowOverlay, retryInterval * retries);
                    } else {
                        console.error('[DEBUG] Auth overlay still not found after all retries');
                    }
                };
                
                setTimeout(retryShowOverlay, retryInterval);
                return;
            }
            
            // CRITICAL: Wait for template content to be loaded before showing
            // Check if the template has been injected (look for inner content)
            const hasTemplateContent = authOverlay.innerHTML.trim() !== '' || 
                                      authOverlay.querySelector('.auth-overlay') !== null ||
                                      authOverlay.querySelector('#auth-login') !== null;
            
            if (!hasTemplateContent) {
                console.warn('[DEBUG] Auth overlay exists but template content not loaded yet. Waiting...');
                // Wait for template to load, then show overlay
                const checkTemplate = setInterval(() => {
                    const overlay = document.getElementById('auth-overlay');
                    if (overlay && (overlay.innerHTML.trim() !== '' || overlay.querySelector('#auth-login') !== null)) {
                        clearInterval(checkTemplate);
                        console.log('[DEBUG] Template content loaded, showing overlay now');
                        showAuthOverlay('login');
                    }
                }, 50);
                
                // Timeout after 2 seconds
                setTimeout(() => {
                    clearInterval(checkTemplate);
                    const overlay = document.getElementById('auth-overlay');
                    if (overlay) {
                        console.warn('[DEBUG] Template content timeout, showing overlay anyway');
                        showAuthOverlay('login');
                    }
                }, 2000);
                return;
            }
            
            // Show the overlay
            showAuthOverlay('login');
            
            // Verify it's actually visible (defensive check with multiple attempts)
            let verifyAttempts = 0;
            const maxVerifyAttempts = 10;
            const verifyInterval = 100;
            
            const verifyVisibility = () => {
                verifyAttempts++;
                const verifyOverlay = document.getElementById('auth-overlay');
                if (verifyOverlay) {
                    const isHidden = verifyOverlay.classList.contains('hidden');
                    const computedStyle = window.getComputedStyle(verifyOverlay);
                    const computedDisplay = computedStyle.display;
                    const computedVisibility = computedStyle.visibility;
                    const computedOpacity = computedStyle.opacity;
                    const isVisible = !isHidden && 
                                    computedDisplay !== 'none' && 
                                    computedVisibility !== 'hidden' &&
                                    computedOpacity !== '0';
                    
                    if (!isVisible && verifyAttempts < maxVerifyAttempts) {
                        console.warn(`[DEBUG] Auth overlay not visible (attempt ${verifyAttempts}/${maxVerifyAttempts}). Forcing visibility...`);
                        verifyOverlay.classList.remove('hidden');
                        verifyOverlay.style.display = 'flex';
                        verifyOverlay.style.visibility = 'visible';
                        verifyOverlay.style.opacity = '1';
                        setTimeout(verifyVisibility, verifyInterval);
                    } else if (!isVisible) {
                        console.error('[DEBUG] Auth overlay still not visible after all verification attempts');
                    } else {
                        console.log('[DEBUG] Auth overlay is now visible');
                    }
                }
            };
            
            setTimeout(verifyVisibility, 50);
            
            return;
        }
        
        // User is authenticated - hide auth overlay (force hide to ensure it's hidden)
        console.log('[DEBUG] User authenticated, hiding auth overlay and checking role...');
        hideAuthOverlay(true);
        
        // Get user role
        const role = await getUserRole();
        console.log('[DEBUG] User role from storage:', role);
        
        if (!role) {
            // STEP 2: No role set - show onboarding for athlete
            console.log('[DEBUG] User authenticated but no role set, showing onboarding');
            
            // Ensure auth overlay is hidden
            const authOverlay = document.getElementById('auth-overlay');
            if (authOverlay) {
                authOverlay.classList.add('hidden');
                authOverlay.style.display = 'none';
            }
            
            // Show onboarding overlay with role selection
            const overlay = document.getElementById('onboarding-overlay');
            if (overlay) {
                overlay.classList.remove('hidden');
                overlay.style.zIndex = '100';
                overlay.style.display = 'flex';
                overlay.style.visibility = 'visible';
                overlay.style.opacity = '1';
                console.log('[DEBUG] Onboarding overlay shown for role selection');
            } else {
                console.error('[DEBUG] Onboarding overlay not found!');
            }
            
            // Only show role selection, don't start athlete flow yet
            onboardingManager.showRoleSelection();
        } else {
            // Role exists - initialize app
            console.log('[DEBUG] User authenticated with role:', role);
            
            // Ensure both overlays are hidden
            const authOverlay = document.getElementById('auth-overlay');
            if (authOverlay) {
                authOverlay.classList.add('hidden');
                authOverlay.style.display = 'none';
            }
            
            const onboardingOverlay = document.getElementById('onboarding-overlay');
            if (onboardingOverlay) {
                onboardingOverlay.classList.add('hidden');
                onboardingOverlay.style.display = 'none';
            }
            
            initializeApp(role);
        }
    });
    
    // Initialize onboarding manager (sets up event listeners only, doesn't show anything)
    // The manager will only show UI when explicitly called after authentication
    onboardingManager.init();
});

// Animate progress bars on page load
window.addEventListener('load', () => {
    animateProgressBars();
});

