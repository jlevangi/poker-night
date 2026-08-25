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
 *   single call. The message carries .empty-state--error (reads the danger
 *   token) so a failed load never reads as an empty list.
 *   error.message is safe (renderEmptyState is static-copy only; do not mix
 *   the two), actionLabel + onAction (pass both to render and wire the
 *   button, or neither for a message-only error), actionClass (default
 *   'neo-btn-red' for a "Try Again" retry; use 'neo-btn-green' for
 *   navigation actions like Back).
 *
 * renderAwardCard(award)
 *   One award from an imported PokerNow log: icon, award name, the winner
 *   (linked to their profile when the award carries a player_id), and the
 *   one-line reason. Every field is escaped — award text is derived from
 *   log data, not static copy.
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
 * Styling lives in css/styles/utils/_skeletons.css (loading, empty, and
 * error states); every value reads theme tokens, so dark mode is
 * inherited automatically.
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
export function escapeHtml(value) {
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
    let html = '<div class="neo-card empty-state empty-state--error">' +
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

/**
 * One award card: icon, award name, who won it, and why.
 *
 * Shared so a night's awards look the same being previewed on the import
 * screen and read back later on the session page. Every field comes from
 * parsed log data rather than static copy, so every field is escaped.
 */
export function renderAwardCard(award) {
    const name = escapeHtml(award.player_name || award.name);
    const who = award.player_id
        ? '<a href="#player/' + escapeHtml(award.player_id) + '" style="color: inherit; text-decoration: none;">' + name + '</a>'
        : name;
    return '<div class="award-card">' +
        '<div class="award-card__icon">' + escapeHtml(award.icon) + '</div>' +
        '<div class="award-card__body">' +
        '<div class="award-card__title">' + escapeHtml(award.title) + '</div>' +
        '<div class="award-card__name">' + who + '</div>' +
        '<div class="award-card__detail">' + escapeHtml(award.detail) + '</div>' +
        '</div></div>';
}
