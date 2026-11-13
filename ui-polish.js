(() => {
  const ICON_ATTRS = { 'stroke-width': 1.8 };
  let scheduled = false;
  // GitHub is a brand icon and isn't part of the loaded Lucide icon set.
  const GITHUB_MARK = '<svg class="lucide github-mark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 .297a12 12 0 0 0-3.793 23.386c.6.111.82-.261.82-.577v-2.234c-3.338.726-4.043-1.416-4.043-1.416-.546-1.387-1.333-1.757-1.333-1.757-1.09-.745.083-.73.083-.73 1.205.084 1.838 1.236 1.838 1.236 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.304-5.466-1.332-5.466-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.323 3.301 1.23A11.527 11.527 0 0 1 12 6.894c1.02.005 2.045.138 3.004.404 2.291-1.553 3.297-1.23 3.297-1.23.655 1.652.243 2.873.12 3.176.77.84 1.235 1.91 1.235 3.221 0 4.61-2.805 5.624-5.475 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.218.694.825.576A12.001 12.001 0 0 0 12 .297z"/></svg>';
  const iconMarkup = name => name === 'github'
    ? GITHUB_MARK
    : `<i data-lucide="${name}" aria-hidden="true"></i>`;

  const iconizeGlyphSpan = (span) => {
    if (!span || span.dataset.lucideDone) return;
    const glyph = span.textContent.trim();
    const map = {
      '↗': 'arrow-up-right',
      '→': 'arrow-right',
      '↓': 'arrow-down',
      '↑': 'arrow-up'
    };
    const name = map[glyph];
    if (!name) return;
    span.dataset.lucideDone = '1';
    span.innerHTML = `<i data-lucide="${name}" aria-hidden="true"></i>`;
  };

  const setIconLabel = (el, icon, label, trailing = false) => {
    if (!el || el.dataset.iconized) return;
    el.dataset.iconized = '1';
    el.innerHTML = trailing
      ? `<span>${label}</span>${iconMarkup(icon)}`
      : `${iconMarkup(icon)}<span>${label}</span>`;
  };

  function polish(root = document) {
    root.querySelectorAll?.('span').forEach(iconizeGlyphSpan);

    root.querySelectorAll?.('.nav-github').forEach(el => setIconLabel(el, 'github', 'GitHub'));
    root.querySelectorAll?.('footer a[href*="github.com"]').forEach(el => {
      el.classList.add('footer-github');
      setIconLabel(el, 'github', 'GitHub');
    });
    root.querySelectorAll?.('.project-action.github').forEach(el => setIconLabel(el, 'github', 'GitHub'));
    root.querySelectorAll?.('.project-action.site').forEach(el => setIconLabel(el, 'external-link', 'Открыть сайт', true));
    root.querySelectorAll?.('.project-action.details').forEach(el => setIconLabel(el, 'expand', 'Подробнее', true));

    root.querySelectorAll?.('.featured-actions .button.primary').forEach(el => setIconLabel(el, 'expand', 'Подробнее', true));
    root.querySelectorAll?.('.featured-actions .button.ghost[href]').forEach(el => {
      const isGithub = el.href.includes('github.com');
      setIconLabel(el, isGithub ? 'github' : 'external-link', isGithub ? 'GitHub' : 'Открыть сайт', !isGithub);
    });

    const heroGithub = root.querySelector?.('.hero-actions .button.ghost[href*="github.com"]');
    if (heroGithub) setIconLabel(heroGithub, 'github', 'Открыть GitHub');

    const telegram = root.querySelector?.('.cta-actions a[href*="t.me/"]');
    if (telegram) setIconLabel(telegram, 'send', 'Написать в Telegram', true);
    const email = root.querySelector?.('.cta-actions a[href^="mailto:"]');
    if (email) setIconLabel(email, 'mail', 'Написать на почту', true);

    const modalClose = root.querySelector?.('.modal-close');
    if (modalClose && !modalClose.dataset.iconized) {
      modalClose.dataset.iconized = '1';
      modalClose.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
    }
    const prev = root.querySelector?.('#gallery-prev');
    if (prev && !prev.dataset.iconized) {
      prev.dataset.iconized = '1';
      prev.innerHTML = '<i data-lucide="chevron-left" aria-hidden="true"></i>';
    }
    const next = root.querySelector?.('#gallery-next');
    if (next && !next.dataset.iconized) {
      next.dataset.iconized = '1';
      next.innerHTML = '<i data-lucide="chevron-right" aria-hidden="true"></i>';
    }
    const searchIcon = root.querySelector?.('.search > span');
    if (searchIcon && !searchIcon.dataset.iconized) {
      searchIcon.dataset.iconized = '1';
      searchIcon.innerHTML = '<i data-lucide="search" aria-hidden="true"></i>';
    }

    root.querySelectorAll?.('#modal-actions .button').forEach(el => {
      if (el.dataset.iconized) return;
      const isGithub = el.href?.includes('github.com');
      setIconLabel(el, isGithub ? 'github' : 'external-link', isGithub ? 'GitHub' : 'Открыть проект', !isGithub);
    });

    // Replace legacy placeholders too, so re-renders can't cause repeated Lucide warnings.
    root.querySelectorAll?.('[data-lucide="github"]').forEach(el => { el.outerHTML = GITHUB_MARK; });

    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ attrs: ICON_ATTRS });
    }
  }

  function syncGalleryBackdrop() {
    const image = document.querySelector('#gallery-image');
    const stage = document.querySelector('.gallery-stage');
    if (!image || !stage || !image.src) return;
    const safe = image.src.replace(/"/g, '%22');
    stage.style.setProperty('--gallery-preview', `url("${safe}")`);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      polish(document);
      syncGalleryBackdrop();
    });
  }

  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  window.addEventListener('load', schedule, { once: true });

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['src'] });

  const galleryImage = document.querySelector('#gallery-image');
  galleryImage?.addEventListener('load', syncGalleryBackdrop);

  schedule();
})();
