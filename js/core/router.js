// SPA Navigation System
export class SPARouter {
    constructor() {
        this.currentPage = 'home';
        this.userRole = null;
    }

    init(role) {
        this.userRole = role;
        
        // Remove any existing listeners to avoid duplicates
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            // Clone and replace to remove all event listeners
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
        });
        
        // Set up navigation listeners
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                this.navigateTo(page);
            });
        });

        // Listen for hash changes (back/forward buttons)
        window.addEventListener('hashchange', () => {
            const page = this.getPageFromHash();
            if (page && page !== this.currentPage) {
                this.navigateTo(page, false); // false = don't update hash since it's already updated
            }
        });
    }

    /**
     * Get page name from URL hash
     * @returns {string|null} Page name or null if invalid
     */
    getPageFromHash() {
        const hash = window.location.hash;
        if (!hash || hash === '#') {
            return null;
        }
        
        // Remove the # and get the page name
        const page = hash.substring(1);
        
        // Validate that the page exists
        const pageElement = document.getElementById(`page-${page}`);
        if (pageElement) {
            return page;
        }
        
        return null;
    }

    navigateTo(page, updateHash = true) {
        // Hide all pages
        document.querySelectorAll('[id^="page-"]').forEach(pageEl => {
            pageEl.classList.add('hidden');
        });

        // Show target page with fade-in
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            targetPage.classList.add('page-content');
        }

        // Update active nav state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeNav = document.querySelector(`[data-page="${page}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }

        this.currentPage = page;

        // Update URL hash to maintain page state on reload
        if (updateHash) {
            window.location.hash = page;
        }
    }
}

