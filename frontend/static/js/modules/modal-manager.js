// Modal module for handling popup dialogs
export default class ModalManager {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        
        // Check if modal exists
        if (!this.modal) {
            console.error(`Modal with ID '${modalId}' not found`);
            return;
        }
        
        // Initialize modal
        this.init();
    }
    
    init() {
        try {
            // Ensure modal is properly initialized with CSS classes only
            this.modal.removeAttribute('style');
            
            // Setup close buttons
            const modalCloseBtn = this.modal.querySelector('.modal-close-btn');
            if (modalCloseBtn) {
                modalCloseBtn.addEventListener('click', () => this.hide());
            }
            
            // Additional close/cancel buttons can be added through the setup method
        } catch (error) {
            console.error('Error initializing modal:', error);
        }
    }
    
    // Configure buttons and form elements
    setup({ closeButton, cancelButton, submitButton, additionalElements = {} }) {
        // Close button (X in the corner)
        if (closeButton && typeof closeButton === 'string') {
            const btn = document.getElementById(closeButton);
            if (btn) btn.addEventListener('click', () => this.hide());
        }
        
        // Cancel button (typically at the bottom)
        if (cancelButton && typeof cancelButton === 'string') {
            const btn = document.getElementById(cancelButton);
            if (btn) btn.addEventListener('click', () => this.hide());
        }
        
        // Submit button
        if (submitButton && typeof submitButton === 'object') {
            const { id, callback } = submitButton;
            const btn = document.getElementById(id);
            
            if (btn && typeof callback === 'function') {
                btn.addEventListener('click', callback);
            }
        }
        
        // Setup any additional elements
        Object.entries(additionalElements).forEach(([id, config]) => {
            const element = document.getElementById(id);
            
            if (!element) {
                console.error(`Element with ID '${id}' not found`);
                return;
            }
            
            // Add event listeners
            if (config.events) {
                Object.entries(config.events).forEach(([event, handler]) => {
                    element.addEventListener(event, handler);
                });
            }
            
            // Set default values
            if (config.value !== undefined) {
                element.value = config.value;
            }
        });
        
        return this; // Allow chaining
    }
    
    show() {
        try {
            if (!this.modal) {
                console.error("Modal element not found");
                alert("There was a problem showing the form. Please refresh the page and try again.");
                return;
            }

            // The .modal-overlay/.modal-content system in
            // components/_modals.css owns all dialog styling (backdrop,
            // sheet position, entrance). .active alone reveals it; nothing
            // is set inline anymore.
            this.modal.removeAttribute('style');
            this.modal.classList.add('active');
            // Keep the overlay at the end of body to avoid z-index issues
            document.body.appendChild(this.modal);
        } catch(e) {
            console.error("Error showing modal:", e);
            alert("There was a problem showing the form. Please try again later.");
        }

        return this; // Allow chaining
    }
    
    hide() {
        try {
            if (this.modal) {
                this.modal.classList.remove('active');
                this.modal.removeAttribute('style');
            }
        } catch(e) {
            console.error("Error hiding modal:", e);
        }

        return this; // Allow chaining
    }
}
