// Dark Mode Manager
export default class DarkModeManager {
    constructor() {
        this.storageKey = 'gamble-king-dark-mode';
        this.toggleButton = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        // Get the toggle button
        this.toggleButton = document.getElementById('dark-mode-toggle');
        
        if (!this.toggleButton) {
            console.warn('Dark mode toggle button not found');
            return;
        }

        // Set up event listener
        this.toggleButton.addEventListener('click', () => this.toggle());

        // Apply saved theme or detect system preference
        this.applyTheme(this.getTheme());
        
        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!this.hasUserPreference()) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    getTheme() {
        // Check if user has a saved preference
        const savedTheme = localStorage.getItem(this.storageKey);
        if (savedTheme) {
            return savedTheme;
        }

        // Default to dark mode if no user preference
        return 'dark';
    }

    hasUserPreference() {
        return localStorage.getItem(this.storageKey) !== null;
    }

    applyTheme(theme) {
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update toggle button
        this.updateToggleButton(theme);
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(theme);
        
        console.log(`Applied ${theme} theme`);
    }

    updateToggleButton(theme) {
        if (!this.toggleButton) return;
        
        // Update button icon and title
        if (theme === 'dark') {
            this.toggleButton.textContent = '☀️';
            this.toggleButton.title = 'Switch to Light Mode';
        } else {
            this.toggleButton.textContent = '🌙';
            this.toggleButton.title = 'Switch to Dark Mode';
        }
    }

    updateMetaThemeColor(theme) {
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            if (theme === 'dark') {
                metaThemeColor.setAttribute('content', '#1a1a1a');
            } else {
                metaThemeColor.setAttribute('content', '#3367D6');
            }
        }
    }

    toggle() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Save user preference
        localStorage.setItem(this.storageKey, newTheme);
        
        // Apply new theme
        this.applyTheme(newTheme);
        
        console.log(`Toggled to ${newTheme} mode`);
    }

    getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }

    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            console.error('Invalid theme. Use "light" or "dark"');
            return;
        }
        
        localStorage.setItem(this.storageKey, theme);
        this.applyTheme(theme);
    }
}