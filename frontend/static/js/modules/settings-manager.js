// Settings Manager - Handles slide-out settings menu
export default class SettingsManager {
    constructor(darkModeManager) {
        this.darkModeManager = darkModeManager;
        this.isOpen = false;
        
        this.settingsMenu = document.getElementById('settings-menu');
        this.settingsOverlay = document.getElementById('settings-overlay');
        this.settingsTrigger = document.getElementById('settings-trigger');
        this.settingsClose = document.getElementById('settings-close');
        this.themeToggle = document.getElementById('theme-toggle');
        
        this.init();
    }
    
    init() {
        // Settings trigger button
        if (this.settingsTrigger) {
            this.settingsTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggle();
            });
        }
        
        // Close button
        if (this.settingsClose) {
            this.settingsClose.addEventListener('click', () => {
                this.close();
            });
        }
        
        // Overlay click to close
        if (this.settingsOverlay) {
            this.settingsOverlay.addEventListener('click', () => {
                this.close();
            });
        }
        
        // Theme toggle
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Update theme button text based on current theme
        this.updateThemeButton();
        
        // Listen for theme changes
        document.addEventListener('themeChanged', () => {
            this.updateThemeButton();
        });
    }
    
    open() {
        this.isOpen = true;
        this.settingsMenu.classList.add('open');
        this.settingsOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    close() {
        this.isOpen = false;
        this.settingsMenu.classList.remove('open');
        this.settingsOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    toggleTheme() {
        if (this.darkModeManager) {
            this.darkModeManager.toggle();
            this.updateThemeButton();
        }
    }
    
    updateThemeButton() {
        const themeIcon = this.themeToggle?.querySelector('.theme-icon');
        const themeText = this.themeToggle?.querySelector('.theme-text');
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        if (themeIcon) {
            themeIcon.textContent = isDark ? '☀️' : '🌙';
        }
        
        if (themeText) {
            themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        }
    }
}