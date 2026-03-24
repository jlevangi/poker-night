// Thin event bus for cross-page data invalidation
const EventBus = {
    on(event, handler) {
        window.addEventListener(event, handler);
    },

    off(event, handler) {
        window.removeEventListener(event, handler);
    },

    emit(event, detail = null) {
        window.dispatchEvent(new CustomEvent(event, { detail }));
    }
};

export default EventBus;
