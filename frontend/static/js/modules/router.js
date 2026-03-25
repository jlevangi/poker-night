// Router module for handling navigation with keep-alive pages
export default class Router {
    constructor(appContent, pageManager, dataCache) {
        this.appContent = appContent;
        this.pageManager = pageManager;
        this.dataCache = dataCache;
        this.routes = {};
        this.skeletons = {};
        this.titles = {};
        this.routeChangeListeners = [];
        this._transitioning = false;
        this.historyStack = [];
        this._isNavigatingBack = false;
        Router.instance = this;

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

    // Register a title for a route (used for cached page display)
    registerTitle(path, title) {
        this.titles[path] = title;
        return this;
    }

    onRouteChange(listener) {
        this.routeChangeListeners.push(listener);
        return this;
    }

    // Route to the current hash
    route() {
        const path = window.location.hash.slice(1) || 'dashboard';
        this._recordNavigation(path);
        this.loadContent(path);
        this.updateActiveNavButton();
        this._emitRouteChange(path);
        return this;
    }

    static getBackPath(fallbackPath = 'dashboard') {
        const router = Router.instance;
        if (router && router.historyStack.length > 1) {
            return router.historyStack[router.historyStack.length - 2];
        }
        return fallbackPath;
    }

    static navigateBack(fallbackPath = 'dashboard') {
        const router = Router.instance;

        if (router && router.historyStack.length > 1) {
            router.historyStack.pop();
            const previousPath = router.historyStack[router.historyStack.length - 1];
            router._isNavigatingBack = true;
            window.location.hash = `#${previousPath}`;
            return;
        }

        window.location.hash = `#${fallbackPath}`;
    }

    // Get the base route key from a path
    _getRouteKey(path) {
        if (path.includes('/')) {
            return path.split('/')[0];
        }
        return path;
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

    async _refreshVisiblePage(routeKey, handler) {
        const container = this.pageManager.getContainer(routeKey);
        if (!container || !handler) {
            return;
        }

        container.classList.add('page-refreshing');

        try {
            await handler();
            container.classList.add('page-refresh-enter');
            let cleaned = false;
            const cleanup = () => {
                if (cleaned) return;
                cleaned = true;
                container.classList.remove('page-refresh-enter');
                container.removeEventListener('animationend', cleanup);
            };
            container.addEventListener('animationend', cleanup);
            setTimeout(cleanup, 250);
        } finally {
            container.classList.remove('page-refreshing');
        }
    }

    // Load content for the current route with keep-alive pages
    async loadContent(path) {
        if (this._transitioning) {
            this._pendingPath = path;
            return;
        }
        this._transitioning = true;

        try {
            const routeKey = this._getRouteKey(path);
            const isTopLevel = this.pageManager.isTopLevel(routeKey);
            const isDetail = path.includes('/');

            if (isTopLevel) {
                // Set title for cached pages
                if (this.titles[routeKey]) {
                    document.title = this.titles[routeKey];
                }

                if (this.pageManager.isLoaded(routeKey) && this.dataCache.isFreshForRoute(routeKey)) {
                    // Case 1: loaded + fresh → instant show, no fetch
                    this.pageManager.show(routeKey);
                } else if (this.pageManager.isLoaded(routeKey)) {
                    // Case 2: loaded + stale → show immediately, refresh in-place
                    this.pageManager.show(routeKey);
                    const handler = this.routes[routeKey];
                    if (handler) {
                        await this._refreshVisiblePage(routeKey, handler);
                        this.dataCache.markFresh(routeKey);
                    }
                } else {
                    // Case 3: never loaded → show skeleton, fetch, render with animation
                    const container = this.pageManager.getContainer(routeKey);
                    container.innerHTML = this._getSkeletonHtml(path);
                    this.pageManager.show(routeKey);

                    const handler = this.routes[routeKey];
                    if (handler) {
                        await handler();
                        this.pageManager.markLoaded(routeKey);
                        this.dataCache.markFresh(routeKey);
                        // Enter animation for first load only
                        container.classList.add('page-enter');
                        let cleaned = false;
                        const cleanup = () => {
                            if (cleaned) return;
                            cleaned = true;
                            container.classList.remove('page-enter');
                            container.removeEventListener('animationend', cleanup);
                        };
                        container.addEventListener('animationend', cleanup);
                        // Fallback in case animationend never fires (e.g. background tab)
                        setTimeout(cleanup, 300);
                    }
                }
            } else if (isDetail) {
                // Case 4: detail page → always re-render
                const [basePath, id] = path.split('/');
                const handler = this.routes[`${basePath}/:id`];

                if (handler) {
                    const container = this.pageManager.getContainer('detail');
                    container.innerHTML = this._getSkeletonHtml(path);
                    this.pageManager.show('detail');
                    await handler(id);
                }
            } else {
                // Unknown route
                const handler = this.routes[path];
                if (handler) {
                    const container = this.pageManager.getContainer('detail');
                    container.innerHTML = '';
                    this.pageManager.show('detail');
                    await handler();
                } else {
                    const container = this.pageManager.getContainer('detail');
                    container.innerHTML = '<div class="skeleton-page"><h2>Page Not Found</h2></div>';
                    this.pageManager.show('detail');
                }
            }
        } catch (error) {
            console.error("Error loading content:", error);
            const container = this.pageManager.getContainer('detail');
            container.innerHTML = `<div class="skeleton-page"><p>Error loading content: ${error.message}. Check console.</p></div>`;
            this.pageManager.show('detail');
        } finally {
            this._transitioning = false;
            if (this._pendingPath) {
                const next = this._pendingPath;
                this._pendingPath = null;
                this.loadContent(next);
            }
        }
    }

    // Update active nav button based on current hash
    updateActiveNavButton() {
        const currentHash = window.location.hash.slice(1) || 'dashboard';

        // Update bottom navigation (mobile) for route buttons only
        document.querySelectorAll('.bottom-nav .nav-btn[data-hash], .neo-bottom-nav .neo-nav-mobile-btn[data-hash]').forEach(btn => {
            if (btn.dataset && btn.dataset.hash && (btn.dataset.hash === `#${currentHash}` ||
               (btn.dataset.hash === '#dashboard' && currentHash === ''))) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update desktop navigation for route links only
        document.querySelectorAll('.desktop-nav a[href], .neo-desktop-nav .neo-nav-btn[href]').forEach(link => {
            const linkHash = link.getAttribute('href');
            if (linkHash === `#${currentHash}` ||
               (linkHash === '#dashboard' && currentHash === '')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    _emitRouteChange(path) {
        this.routeChangeListeners.forEach(listener => {
            try {
                listener(path);
            } catch (error) {
                console.error('Error in route change listener:', error);
            }
        });
    }

    _recordNavigation(path) {
        if (this._isNavigatingBack) {
            this._isNavigatingBack = false;
            return;
        }

        const currentPath = this.historyStack[this.historyStack.length - 1];
        const previousPath = this.historyStack[this.historyStack.length - 2];

        if (path === currentPath) {
            return;
        }

        // Keep the in-app stack aligned when the user uses browser back/forward.
        if (path === previousPath) {
            this.historyStack.pop();
            return;
        }

        this.historyStack.push(path);
    }
}
