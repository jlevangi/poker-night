// Manages persistent page containers for keep-alive navigation
const TOP_LEVEL_PAGES = ['dashboard', 'sessions', 'players', 'calendar', 'stats'];

export default class PageManager {
    constructor(appContent) {
        this.appContent = appContent;
        this._containers = {};
        this._loaded = {};
        this._activePage = null;
        this._lifecycleHandlers = {};

        // Remove any server-rendered placeholder content before mounting keep-alive containers.
        this.appContent.replaceChildren();

        // Create persistent containers
        for (const page of TOP_LEVEL_PAGES) {
            const div = document.createElement('div');
            div.className = 'page-container';
            div.dataset.page = page;
            appContent.appendChild(div);
            this._containers[page] = div;
        }

        // Single shared container for detail pages
        const detailDiv = document.createElement('div');
        detailDiv.className = 'page-container';
        detailDiv.dataset.page = 'detail';
        appContent.appendChild(detailDiv);
        this._containers['detail'] = detailDiv;
    }

    getContainer(routeKey) {
        return this._containers[routeKey] || this._containers['detail'];
    }

    isTopLevel(routeKey) {
        return TOP_LEVEL_PAGES.includes(routeKey);
    }

    isLoaded(routeKey) {
        return !!this._loaded[routeKey];
    }

    markLoaded(routeKey) {
        this._loaded[routeKey] = true;
    }

    invalidate(routeKey) {
        delete this._loaded[routeKey];
    }

    show(routeKey) {
        const containerKey = this.isTopLevel(routeKey) ? routeKey : 'detail';

        // Hide current active container
        if (this._activePage && this._activePage !== containerKey) {
            const prev = this._containers[this._activePage];
            if (prev) {
                prev.classList.remove('active');
            }
            // Fire onHide lifecycle
            this._fireLifecycle(this._activePage, 'onHide');
        }

        // Show target container
        const target = this._containers[containerKey];
        if (target) {
            target.classList.add('active');
        }

        this._activePage = containerKey;

        // Fire onShow lifecycle
        this._fireLifecycle(containerKey, 'onShow');
    }

    registerLifecycle(routeKey, handlers) {
        this._lifecycleHandlers[routeKey] = handlers;
    }

    _fireLifecycle(containerKey, event) {
        const handlers = this._lifecycleHandlers[containerKey];
        if (handlers && handlers[event]) {
            handlers[event]();
        }
    }
}
