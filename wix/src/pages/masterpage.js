/**
 * Velo global site code — runs on every page.
 * Destination in the Wix repo:  src/pages/masterpage.js
 */

$w.onReady(function () {
  // Reveal-on-scroll parity with the Astro build. In the Studio editor, give
  // any element the custom CSS class `reveal` for this to apply.
  if (typeof IntersectionObserver === 'undefined') return;

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced) return;

  // Wix elements animate via the $w API rather than raw DOM nodes; wire up
  // per-section reveals here as sections are added in the Studio editor.
});
