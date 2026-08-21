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
 * renderSkeletonPage(blocks)
 *   The standard page-level loading wrapper (.skeleton-page: max-width
 *   1200px, centered, mobile-aware padding). `blocks` is an array of HTML
 *   strings (the other helpers' output).
 *
 * renderSkeleton({ classes, style })
 *   One shimmer block: a .skeleton div plus any extra classes (e.g.
 *   'neo-card', 'skeleton-text', 'skeleton-row', 'skeleton-btn') and an
 *   optional inline style fragment (e.g. 'width: 50%; margin-bottom: 1rem;').
 *   Prefer percentage widths — the page reflows with the screen.
 *
 * renderSkeletonStatGrid({ count })
 *   A 2-column grid of full-shimmer stat-card placeholders — the app's
 *   standard stats loading shape.
 *
 * renderSkeletonRows({ count, height })
 *   A vertical stack of 48px list-row placeholders (.skeleton-row, rounded
 *   ends) — the app's standard list loading shape. Pass a larger `height`
 *   (e.g. '4rem') when the real list renders taller cards.
 *
 * Pass static copy (icon, message) — these strings are not escaped, so never
 * pass user input through this helper.
 *
 * Styling lives in css/styles/utils/_skeletons.css (skeletons) and
 * css/styles/components/_lists.css (.empty-state*); both use theme variables,
 * so dark mode is inherited automatically.
 */

export function renderEmptyState(options) {
    const { icon, message, card = true } = options || {};
    const className = card ? 'neo-card empty-state' : 'empty-state';
    return '<div class="' + className + '">' +
        '<div class="empty-state__icon">' + icon + '</div>' +
        '<p class="empty-state__message">' + message + '</p>' +
        '</div>';
}

export function renderSkeletonPage(blocks) {
    return '<div class="skeleton-page">' + (blocks || []).join('') + '</div>';
}

export function renderSkeleton(options) {
    const { classes = '', style = '' } = options || {};
    const className = 'skeleton' + (classes ? ' ' + classes : '');
    return '<div class="' + className + '"' + (style ? ' style="' + style + '"' : '') + '></div>';
}

export function renderSkeletonStatGrid(options) {
    const { count = 4 } = options || {};
    let html = '<div class="skeleton-grid">';
    for (let i = 0; i < count; i++) {
        html += renderSkeleton({ classes: 'neo-stat-card skeleton-stat' });
    }
    return html + '</div>';
}

export function renderSkeletonRows(options) {
    const { count = 3, height } = options || {};
    let html = '<div class="skeleton-list">';
    for (let i = 0; i < count; i++) {
        html += renderSkeleton({ classes: 'skeleton-row', style: height ? 'height: ' + height + ';' : '' });
    }
    return html + '</div>';
}
