// Router module for handling navigation with page transitions and skeletons
export default class Router {
    constructor(appContent) {
        this.appContent = appContent;
        this.routes = {};
        this.skeletons = {};
        this._transitioning = false;

        // Setup event listeners
        window.addEventListener('hashchange', () => this.route());
    }

    // Register a route handler
    register(path, handler) {
        this.routes[path] = handler;
        return this; // Allow chaining
    }

    // Register a skeleton for a route
    registerSkeleton(path, skeletonFn) {
        this.skeletons[path] = skeletonFn;
        return this;
    }

    // Route to the current hash
    route() {
        const path = window.location.hash.slice(1) || 'dashboard';
        this.loadContent(path);
        this.updateActiveNavButton();
        return this;
    }

    // Get skeleton HTML for a given path
    _getSkeletonHtml(path) {
        const basePath = path.includes('/') ? path.split('/')[0] : path;

        // Check for exact match first, then parameterized
        if (this.skeletons[path]) return this.skeletons[path]();
        if (this.skeletons[basePath]) return this.skeletons[basePath]();
        if (path.includes('/') && this.skeletons[`${basePath}/:id`]) {
            return this.skeletons[`${basePath}/:id`]();
        }

        // Default skeleton
        return `
            <div class="skeleton-page">
                <div class="skeleton skeleton-card-lg"></div>
                <div class="skeleton-grid">
                    <div class="skeleton skeleton-stat"></div>
                    <div class="skeleton skeleton-stat"></div>
                </div>
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
            </div>
        `;
    }

    // Load content for the current route with transitions
    async loadContent(path) {
        if (this._transitioning) return;
        this._transitioning = true;

        try {
            // Phase 1: Exit animation (if there's existing content)
            if (this.appContent.innerHTML.trim()) {
                this.appContent.classList.add('page-exit');
                await new Promise(resolve => setTimeout(resolve, 150));
                this.appContent.classList.remove('page-exit');
            }

            // Phase 2: Show skeleton
            this.appContent.innerHTML = this._getSkeletonHtml(path);
            this.appContent.classList.add('page-enter');

            // Phase 3: Load actual content
            if (path.includes('/')) {
                const [basePath, id] = path.split('/');
                const handler = this.routes[`${basePath}/:id`];

                if (handler) {
                    // Remove enter class before handler renders
                    this.appContent.classList.remove('page-enter');
                    await handler(id);
                    // Re-add enter animation for the loaded content
                    this.appContent.classList.add('page-enter');
                    this._cleanupAnimation();
                    return;
                }
            }

            const handler = this.routes[path];
            if (handler) {
                this.appContent.classList.remove('page-enter');
                await handler();
                this.appContent.classList.add('page-enter');
                this._cleanupAnimation();
            } else {
                this.appContent.innerHTML = '<div class="skeleton-page"><h2>Page Not Found</h2></div>';
                this._cleanupAnimation();
            }
        } catch (error) {
            console.error("Error loading content:", error);
            this.appContent.innerHTML = `<div class="skeleton-page"><p>Error loading content: ${error.message}. Check console.</p></div>`;
        } finally {
            this._transitioning = false;
        }
    }

    // Clean up animation classes after they finish
    _cleanupAnimation() {
        const handler = () => {
            this.appContent.classList.remove('page-enter');
            this.appContent.removeEventListener('animationend', handler);
        };
        this.appContent.addEventListener('animationend', handler);
    }

    // Update active nav button based on current hash
    updateActiveNavButton() {
        const currentHash = window.location.hash.slice(1) || 'dashboard';

        // Update bottom navigation (mobile) - exclude settings button
        document.querySelectorAll('.bottom-nav .nav-btn, .neo-bottom-nav .neo-nav-mobile-btn:not(#settings-trigger)').forEach(btn => {
            if (btn.dataset && btn.dataset.hash && (btn.dataset.hash === `#${currentHash}` ||
               (btn.dataset.hash === '#dashboard' && currentHash === ''))) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update desktop navigation
        document.querySelectorAll('.desktop-nav a, .neo-desktop-nav .neo-nav-btn').forEach(link => {
            const linkHash = link.getAttribute('href');
            if (linkHash === `#${currentHash}` ||
               (linkHash === '#dashboard' && currentHash === '')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
}
