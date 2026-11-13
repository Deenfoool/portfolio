(() => {
  const ICON_ATTRS = { 'stroke-width': 1.8 };
  let scheduled = false;
  // GitHub is a brand icon and isn't part of the loaded Lucide icon set.
  const GITHUB_MARK = '<img class="github-mark brand-icon" src="assets/icons/github.svg" alt="" aria-hidden="true" width="19" height="19" decoding="async">';
  const iconMarkup = name => name === 'github'
    ? `<span class="github-icon-slot" aria-hidden="true">${GITHUB_MARK}</span>`
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

  // GitHub release pages are download actions, not repository links.
  const isReleaseLink = el => /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/(?:latest|tag\/[^/?#]+)(?:[/?#]|$)/i.test(el?.href || '');

  function polish(root = document) {
    root.querySelectorAll?.('span').forEach(iconizeGlyphSpan);

    root.querySelectorAll?.('.nav-github').forEach(el => setIconLabel(el, 'github', 'GitHub'));
    root.querySelectorAll?.('footer a[href*="github.com"]').forEach(el => {
      el.classList.add('footer-github');
      setIconLabel(el, 'github', 'GitHub');
    });
    root.querySelectorAll?.('.project-action.download').forEach(el => setIconLabel(el, 'download', 'Скачать'));
    root.querySelectorAll?.('.project-action.github').forEach(el => setIconLabel(el, 'github', 'GitHub'));
    root.querySelectorAll?.('.project-action.site').forEach(el => setIconLabel(el, 'external-link', 'Открыть сайт', true));
    root.querySelectorAll?.('.project-action.details').forEach(el => setIconLabel(el, 'expand', 'Подробнее', true));

    root.querySelectorAll?.('.featured-actions .button.primary').forEach(el => {
      if (isReleaseLink(el)) setIconLabel(el, 'download', 'Скачать');
      else setIconLabel(el, 'expand', 'Подробнее', true);
    });
    root.querySelectorAll?.('.featured-actions .button.ghost[href]').forEach(el => {
      if (isReleaseLink(el)) setIconLabel(el, 'download', 'Скачать');
      else {
        const isGithub = el.href.includes('github.com');
        setIconLabel(el, isGithub ? 'github' : 'external-link', isGithub ? 'GitHub' : 'Открыть сайт', !isGithub);
      }
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
      if (isReleaseLink(el)) setIconLabel(el, 'download', 'Скачать');
      else {
        const isGithub = el.href?.includes('github.com');
        setIconLabel(el, isGithub ? 'github' : 'external-link', isGithub ? 'GitHub' : 'Открыть проект', !isGithub);
      }
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
