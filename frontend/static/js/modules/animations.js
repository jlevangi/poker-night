// Animation utilities for the modern theme

/**
 * Animate a numeric value from start to end with easing
 * @param {HTMLElement} element - Element to update
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} duration - Animation duration in ms
 * @param {string} prefix - Text before the number (e.g., '$')
 * @param {string} suffix - Text after the number (e.g., '%')
 * @param {number} decimals - Number of decimal places
 */
export function animateValue(element, start, end, duration = 600, prefix = '', suffix = '', decimals = 0) {
    if (!element || start === end) {
        if (element) element.textContent = `${prefix}${end.toFixed(decimals)}${suffix}`;
        return;
    }

    const startTime = performance.now();

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);
        const current = start + (end - start) * easedProgress;

        element.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

/**
 * Apply staggered fade-in animation to child elements
 * @param {HTMLElement} container - Parent container
 * @param {string} selector - CSS selector for children to animate
 * @param {number} delayMs - Delay between each child in ms
 */
export function staggerChildren(container, selector, delayMs = 50) {
    if (!container) return;

    const children = container.querySelectorAll(selector);
    children.forEach((child, index) => {
        child.style.opacity = '0';
        child.style.transform = 'translateY(10px)';
        child.style.transition = `opacity 0.3s ease-out ${index * delayMs}ms, transform 0.3s ease-out ${index * delayMs}ms`;

        // Trigger the animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                child.style.opacity = '1';
                child.style.transform = 'translateY(0)';
            });
        });
    });
}

/**
 * Animate all elements with data-animate-value attribute in a container
 * Expected format: data-animate-value="end" with optional data-animate-prefix, data-animate-suffix, data-animate-decimals
 * @param {HTMLElement} container - Container to search within
 */
export function animateAllValues(container) {
    if (!container) return;

    const elements = container.querySelectorAll('[data-animate-value]');
    elements.forEach(el => {
        const end = parseFloat(el.dataset.animateValue);
        if (isNaN(end)) return;

        const prefix = el.dataset.animatePrefix || '';
        const suffix = el.dataset.animateSuffix || '';
        const decimals = parseInt(el.dataset.animateDecimals || '0', 10);

        animateValue(el, 0, end, 600, prefix, suffix, decimals);
    });
}
