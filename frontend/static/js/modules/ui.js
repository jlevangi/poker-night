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
 * showPageError(container, { icon, message, actionLabel, actionClass, onAction })
 *   The app's single error-state shape: the same neo-card + icon + message
 *   family as renderEmptyState, plus one optional action button. Sets
 *   container.innerHTML and binds the button itself, so a failed load is a
 *   single call. Options: icon (default '⚠️'), message — ESCAPED, so passing
 *   error.message is safe (renderEmptyState is static-copy only; do not mix
 *   the two), actionLabel + onAction (pass both to render and wire the
 *   button, or neither for a message-only error), actionClass (default
 *   'neo-btn-red' for a "Try Again" retry; use 'neo-btn-green' for
 *   navigation actions like Back).
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
 * renderEmptyState takes static copy — its strings are not escaped.
 * showPageError escapes the message (dynamic error text); its actionLabel
 * is still static copy.
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

/**
 * Escape HTML special characters so dynamic text (e.g. error.message) is
 * safe to inject via innerHTML. Uses the same textContent round-trip
 * pattern as the escapeHtml helpers in the page modules.
 */
function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = value === null || value === undefined ? '' : String(value);
    return node.innerHTML;
}

/**
 * Render the standard page-level error state into the given container and,
 * when actionLabel and onAction are both provided, bind the action button.
 * See the module header for the full options list.
 */
export function showPageError(container, options) {
    const opts = options || {};
    const icon = opts.icon || '⚠️';
    const actionLabel = opts.actionLabel;
    const actionClass = opts.actionClass || 'neo-btn-red';
    const onAction = opts.onAction;
    let html = '<div class="neo-card empty-state">' +
        '<div class="empty-state__icon">' + icon + '</div>' +
        '<p class="empty-state__message">' + escapeHtml(opts.message || 'Something went wrong.') + '</p>';
    const hasAction = typeof onAction === 'function' && !!actionLabel;
    if (hasAction) {
        html += '<button type="button" class="neo-btn ' + actionClass + ' empty-state__action">' + actionLabel + '</button>';
    }
    container.innerHTML = html + '</div>';
    if (hasAction) {
        const button = container.querySelector('.empty-state__action');
        if (button) button.addEventListener('click', onAction);
    }
}
