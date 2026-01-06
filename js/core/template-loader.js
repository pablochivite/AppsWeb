// Template Loader Utility
// Handles loading and injecting HTML templates into the DOM

// Template registry to cache loaded templates
const templateCache = new Map();

// Template map: maps container IDs to template file paths
const TEMPLATE_MAP = {
    'sidebar-container': 'html/components/sidebar.html',
    'page-home': 'html/pages/athlete/home.html',
    'page-calendar': 'html/pages/athlete/calendar.html',
    'page-modus': 'html/pages/athlete/modus.html',
    'page-explore': 'html/pages/athlete/explore.html',
    'page-profile': 'html/pages/athlete/profile.html',
    'page-coach-home': 'html/pages/coach/home.html',
    'page-coach-calendar': 'html/pages/coach/calendar.html',
    'page-coach-clients': 'html/pages/coach/clients.html',
    'voice-fab-container': 'html/components/voice-fab.html',
    'onboarding-overlay': 'html/overlays/onboarding.html',
    'session-overlay': 'html/overlays/session.html',
    'auth-overlay': 'html/overlays/auth.html'
};

/**
 * Load a single HTML template file
 * @param {string} path - Path to the template file
 * @returns {Promise<string>} HTML content
 */
export async function loadTemplate(path) {
    // Check cache first
    if (templateCache.has(path)) {
        return templateCache.get(path);
    }

    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load template: ${path} (${response.status})`);
        }
        const html = await response.text();
        templateCache.set(path, html);
        return html;
    } catch (error) {
        console.error(`Error loading template ${path}:`, error);
        throw error;
    }
}

/**
 * Inject HTML content into a DOM container
 * @param {string} containerId - ID of the container element
 * @param {string} html - HTML content to inject
 */
export function injectTemplate(containerId, html) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container not found: ${containerId}`);
        return false;
    }

    // Use innerHTML to inject the template
    container.innerHTML = html;
    return true;
}

/**
 * Load all templates and inject them into their containers
 * @returns {Promise<void>}
 */
export async function loadAllTemplates() {
    try {
        // Load all templates in parallel
        const loadPromises = Object.entries(TEMPLATE_MAP).map(async ([containerId, path]) => {
            try {
                const html = await loadTemplate(path);
                return { containerId, html };
            } catch (error) {
                console.error(`Failed to load template for ${containerId}:`, error);
                return { containerId, html: null, error };
            }
        });

        const results = await Promise.all(loadPromises);

        // Inject templates into containers
        results.forEach(({ containerId, html, error }) => {
            if (error) {
                console.error(`Skipping injection for ${containerId} due to error`);
                return;
            }
            if (html) {
                injectTemplate(containerId, html);
            }
        });

        console.log('All templates loaded and injected successfully');
    } catch (error) {
        console.error('Error loading templates:', error);
        throw error;
    }
}

