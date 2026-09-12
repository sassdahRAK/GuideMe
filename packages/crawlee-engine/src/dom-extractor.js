/**
 * DOM element extraction utilities for the Crawlee-based crawler.
 */

/**
 * Check if an element is visible in the viewport.
 * @param {Object} el - DOM element
 * @returns {boolean}
 */
export function isElementVisible(el) {
  if (!el) return false;
  try {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  } catch {
    return true;
  }
}

/**
 * Extract all interactive buttons/links/elements from the current page.
 * @param {Object} page - Playwright page object
 * @returns {Promise<Array<Object>>}
 */
export async function extractInteractiveElements(page) {
  const buttons = await page.evaluate(() => {
    const isVisible = (el) => {
      try {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      } catch { return false; }
    };

    return Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .filter(isVisible)
      .map((el, index) => ({
        index,
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.getAttribute('aria-label') || '').trim(),
        href: el.getAttribute('href') || null,
        id: el.id || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        role: el.getAttribute('role') || '',
        className: el.className || '',
      }));
  });

  return buttons;
}
