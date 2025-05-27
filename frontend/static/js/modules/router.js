// Router module for handling navigation
export default class Router {
    constructor(appContent) {
        this.appContent = appContent;
        this.routes = {};
        
        // Setup event listeners
        window.addEventListener('hashchange', () => this.route());
        
        // Handle mobile bottom navigation
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active states
                document.querySelectorAll('.bottom-nav .nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Navigate to the page
                window.location.hash = btn.dataset.hash;
            });
        });
    }
    
    // Register a route handler
    register(path, handler) {
        this.routes[path] = handler;
        return this; // Allow chaining
    }
    
    // Route to the current hash
    route() {
        const path = window.location.hash.slice(1) || 'dashboard';
        this.loadContent(path);
        this.updateActiveNavButton();
        return this;
    }
    
    // Load content for the current route
    async loadContent(path) {
        this.appContent.innerHTML = `<p>Loading ${path}...</p>`;
        
        try {
            // Check if it's a path with parameters
            if (path.includes('/')) {
                const [basePath, id] = path.split('/');
                
                // Check if we have a registered route for this path pattern
                const handler = this.routes[`${basePath}/:id`];
                
                if (handler) {
                    await handler(id);
                    return;
                }
            }
            
            // Check for exact path match
            const handler = this.routes[path];
            
            if (handler) {
                await handler();
            } else {
                this.appContent.innerHTML = '<h2>Page Not Found</h2>';
            }
        } catch (error) {
            console.error("Error loading content:", error);
            this.appContent.innerHTML = `<p>Error loading content: ${error.message}. Check console.</p>`;
        }
    }
    
    // Update active nav button based on current hash
    updateActiveNavButton() {
        const currentHash = window.location.hash.slice(1) || 'dashboard';
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
            if (btn.dataset.hash === `#${currentHash}` || 
               (btn.dataset.hash === '#dashboard' && currentHash === '')) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}
