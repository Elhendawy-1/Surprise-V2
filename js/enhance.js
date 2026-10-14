/* Enhancements v1: reading-progress bar for the recipient gift page. */
(function () {
  'use strict';
  var bar = null;
  var ticking = false;

  function update() {
    ticking = false;
    var view = document.getElementById('recipient-view');
    var active = view && view.style.display !== 'none';
    if (!active) {
      if (bar) bar.style.display = 'none';
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'gift-progress';
      bar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bar);
    }
    bar.style.display = '';
    // The gift page is a fixed, self-scrolling container (not the window).
    var max = view.scrollHeight - view.clientHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, view.scrollTop / max)) : 0;
    bar.style.transform = 'scaleX(' + p + ')';
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  // scroll does not bubble, so capture it from the document
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  window.addEventListener('load', update);
})();
