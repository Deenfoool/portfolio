(() => {
  const ICON_ATTRS = { 'stroke-width': 1.8 };
  let scheduled = false;

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
      ? `<span>${label}</span><i data-lucide="${icon}" aria-hidden="true"></i>`
      : `<i data-lucide="${icon}" aria-hidden="true"></i><span>${label}</span>`;
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
