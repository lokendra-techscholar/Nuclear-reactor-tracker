(function () {
  'use strict';

  // Enhances the static dropdown nav: click/keyboard toggling, outside-click
  // close, and active-state highlighting based on the current page.
  function init() {
    const nav = document.querySelector('.page-nav');
    if (!nav) return;

    const items = Array.from(nav.querySelectorAll('.nav-item.has-dropdown'));

    items.forEach(item => {
      const toggle = item.querySelector('.nav-toggle');
      if (!toggle) return;
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = item.classList.contains('open');
        closeAll();
        if (!isOpen) {
          item.classList.add('open');
          toggle.setAttribute('aria-expanded', 'true');
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) closeAll();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });

    function closeAll() {
      items.forEach(item => {
        item.classList.remove('open');
        const t = item.querySelector('.nav-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }

    // Active-state highlighting
    let page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (page === '') page = 'index.html';

    nav.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href').toLowerCase();
      if (href === page) {
        a.classList.add('active');
        const parentItem = a.closest('.nav-item.has-dropdown');
        if (parentItem) {
          const t = parentItem.querySelector('.nav-toggle');
          if (t) t.classList.add('active');
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
