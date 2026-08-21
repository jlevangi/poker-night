/**
 * ui.js — shared UI fragments.
 *
 * One shape for the same kind of thing, on every screen.
 *
 * renderEmptyState({ icon, message, card })
 *   Renders the app's single empty-state shape: a large emoji icon over a
 *   short message, centered. card=true (default) wraps it in a neo-card for
 *   standalone blocks (a whole list that came back empty); card=false for
 *   empty states that fill an existing card or fixed-height container (chart
 *   areas, a card's body) so the card is not nested inside another card.
 *
 * Pass static copy (icon, message) — these strings are not escaped, so never
 * pass user input through this helper.
 *
 * Styling lives in css/styles/components/_lists.css (.empty-state*), which
 * uses theme variables, so dark mode is inherited automatically.
 */

export function renderEmptyState(options) {
    const { icon, message, card = true } = options || {};
    const className = card ? 'neo-card empty-state' : 'empty-state';
    return '<div class="' + className + '">' +
        '<div class="empty-state__icon">' + icon + '</div>' +
        '<p class="empty-state__message">' + message + '</p>' +
        '</div>';
}
