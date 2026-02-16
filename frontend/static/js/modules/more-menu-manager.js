// More Menu Manager - Handles bottom sheet "More" menu on mobile
export default class MoreMenuManager {
    constructor(darkModeManager) {
        this.darkModeManager = darkModeManager;
        this.isOpen = false;

        this.menu = document.getElementById('more-menu');
        this.overlay = document.getElementById('more-overlay');
        this.trigger = document.getElementById('more-trigger');
        this.closeBtn = document.getElementById('more-close');
        this.themeToggle = document.getElementById('more-theme-toggle');

        this.init();
    }

    init() {
        // Trigger button
        if (this.trigger) {
            this.trigger.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggle();
            });
        }

        // Close button
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        // Overlay click
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.close());
        }

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Navigation items inside More menu
        if (this.menu) {
            this.menu.querySelectorAll('.neo-more-item[data-hash]').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const hash = item.getAttribute('data-hash');
                    if (hash) {
                        this.close();
                        setTimeout(() => {
                            window.location.hash = hash;
                        }, 100);
                    }
                });
            });
        }

        // Theme toggle
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // Update theme button text on init
        this.updateThemeButton();
    }

    open() {
        this.isOpen = true;
        if (this.menu) this.menu.classList.add('open');
        if (this.overlay) this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.isOpen = false;
        if (this.menu) this.menu.classList.remove('open');
        if (this.overlay) this.overlay.classList.remove('active');
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
            themeIcon.textContent = isDark ? '\u2600\uFE0F' : '\uD83C\uDF19';
        }
        if (themeText) {
            themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        }
    }

    updateActiveItems() {
        const currentHash = window.location.hash || '#dashboard';
        const currentPage = currentHash.split('/')[0].replace('#', '') || 'dashboard';

        // Update items inside the More menu
        if (this.menu) {
            this.menu.querySelectorAll('.neo-more-item[data-hash]').forEach(item => {
                item.classList.remove('active');
                const hash = item.getAttribute('data-hash');
                if (hash === `#${currentPage}`) {
                    item.classList.add('active');
                }
            });
        }

        // Update More trigger active state (active when a secondary page is shown)
        if (this.trigger) {
            const secondaryPages = ['calendar', 'stats'];
            if (secondaryPages.includes(currentPage)) {
                this.trigger.classList.add('active');
            } else {
                this.trigger.classList.remove('active');
            }
        }
    }
}
