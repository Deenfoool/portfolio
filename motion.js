(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const revealSelector = [
    '.hero-copy', '.terminal-card', '.stats > div', '.featured-section .section-heading',
    '.featured-card', '.projects-section .section-heading', '.toolbar', '.project',
    '.about-label', '.about-content', '.cta-copy', '.cta-actions', '.support-card', 'footer'
  ].join(',');

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -7% 0px' });

  function markReveal(root = document) {
    const nodes = [];
    if (root.matches?.(revealSelector)) nodes.push(root);
    root.querySelectorAll?.(revealSelector).forEach(node => nodes.push(node));

    nodes.forEach(node => {
      if (node.dataset.motionReveal) return;
      node.dataset.motionReveal = '1';
      node.classList.add('motion-reveal');
      const siblings = node.parentElement ? [...node.parentElement.children] : [];
      const index = Math.max(0, siblings.indexOf(node));
      node.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 55}ms`);
    });
    return nodes;
  }

  const initialReveal = markReveal(document);
  document.documentElement.classList.add('motion-enabled');
  initialReveal.forEach(node => revealObserver.observe(node));

  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<span></span>';
  document.body.appendChild(progress);
  const progressBar = progress.firstElementChild;

  function updateScrollProgress() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const value = Math.min(1, Math.max(0, window.scrollY / max));
    progressBar.style.transform = `scaleX(${value})`;
  }
  updateScrollProgress();
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress, { passive: true });

  const stats = document.querySelector('#stats');
  let statsVisible = false;
  const statNodes = ['repo-count', 'star-count', 'language-count', 'follower-count']
    .map(id => document.getElementById(id)).filter(Boolean);

  function animateStat(el) {
    if (!statsVisible || el.dataset.counted === '1' || el.dataset.counting === '1') return;
    const finalText = el.textContent.trim();
    if (!/^\d[\d\s]*$/.test(finalText)) return;
    const target = Number(finalText.replace(/\s/g, ''));
    if (!Number.isFinite(target)) return;

    el.dataset.counting = '1';
    const start = performance.now();
    const duration = 820;
    const formatter = new Intl.NumberFormat('ru-RU');

    const frame = now => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatter.format(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(frame);
      else {
        el.textContent = finalText;
        el.dataset.counting = '0';
        el.dataset.counted = '1';
      }
    };
    requestAnimationFrame(frame);
  }

  if (stats) {
    const statsObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      statsVisible = true;
      statNodes.forEach(animateStat);
      statsObserver.disconnect();
    }, { threshold: 0.35 });
    statsObserver.observe(stats);

    statNodes.forEach(el => {
      new MutationObserver(() => {
        if (el.dataset.counting !== '1') animateStat(el);
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  const hero = document.querySelector('.hero');
  if (hero && finePointer) {
    hero.addEventListener('pointermove', event => {
      const rect = hero.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      hero.style.setProperty('--hero-copy-x', `${nx * -8}px`);
      hero.style.setProperty('--hero-copy-y', `${ny * -6}px`);
      hero.style.setProperty('--hero-card-x', `${nx * 13}px`);
      hero.style.setProperty('--hero-card-y', `${ny * 10}px`);
    });
    hero.addEventListener('pointerleave', () => {
      ['--hero-copy-x','--hero-copy-y','--hero-card-x','--hero-card-y'].forEach(name => hero.style.setProperty(name, '0px'));
    });

    const updateHeroScroll = () => {
      const y = Math.min(window.scrollY, 700);
      hero.style.setProperty('--hero-scroll-copy', `${y * 0.018}px`);
      hero.style.setProperty('--hero-scroll-card', `${y * -0.028}px`);
    };
    updateHeroScroll();
    window.addEventListener('scroll', updateHeroScroll, { passive: true });
  }

  function setupTilt(card) {
    if (!finePointer || card.dataset.motionTilt) return;
    card.dataset.motionTilt = '1';
    card.classList.add('motion-tilt');
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      card.style.setProperty('--tilt-x', `${(0.5 - y) * 4.2}deg`);
      card.style.setProperty('--tilt-y', `${(x - 0.5) * 5.2}deg`);
      card.style.setProperty('--light-x', `${x * 100}%`);
      card.style.setProperty('--light-y', `${y * 100}%`);
      card.style.setProperty('--light-opacity', '1');
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
      card.style.setProperty('--light-opacity', '0');
    });
  }

  function setupProjectPan(card) {
    if (!finePointer || card.dataset.motionPan) return;
    card.dataset.motionPan = '1';
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--cover-pan-x', `${x * -3}px`);
      card.style.setProperty('--cover-pan-y', `${y * -2}px`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--cover-pan-x', '0px');
      card.style.setProperty('--cover-pan-y', '0px');
    });
  }

  function setupMagnetic(el) {
    if (!finePointer || el.dataset.motionMagnetic) return;
    el.dataset.motionMagnetic = '1';
    el.classList.add('motion-magnetic');
    el.addEventListener('pointermove', event => {
      const rect = el.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 6;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 4;
      el.style.setProperty('--mag-x', `${x}px`);
      el.style.setProperty('--mag-y', `${y}px`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--mag-x', '0px');
      el.style.setProperty('--mag-y', '0px');
    });
  }

  function setupInteractive(root = document) {
    const revealNodes = markReveal(root);
    revealNodes.forEach(node => revealObserver.observe(node));

    const featured = [];
    if (root.matches?.('.featured-card')) featured.push(root);
    root.querySelectorAll?.('.featured-card').forEach(el => featured.push(el));
    featured.forEach(setupTilt);

    const projects = [];
    if (root.matches?.('.project')) projects.push(root);
    root.querySelectorAll?.('.project').forEach(el => projects.push(el));
    projects.forEach(setupProjectPan);

    const controls = [];
    if (root.matches?.('.button,.project-action,.support-button')) controls.push(root);
    root.querySelectorAll?.('.button,.project-action,.support-button').forEach(el => controls.push(el));
    controls.forEach(setupMagnetic);
  }
  setupInteractive(document);

  const dynamicObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) setupInteractive(node);
    }));
    updateScrollProgress();
  });
  dynamicObserver.observe(document.body, { childList: true, subtree: true });

  const galleryImage = document.querySelector('#gallery-image');
  if (galleryImage) {
    const galleryObserver = new MutationObserver(() => {
      if (!galleryImage.getAttribute('src')) return;
      galleryImage.classList.add('gallery-switching');
      window.setTimeout(() => galleryImage.classList.remove('gallery-switching'), 500);
    });
    galleryObserver.observe(galleryImage, { attributes: true, attributeFilter: ['src'] });
    galleryImage.addEventListener('load', () => {
      requestAnimationFrame(() => galleryImage.classList.remove('gallery-switching'));
    });
  }

  if (finePointer) {
    const aura = document.createElement('div');
    aura.className = 'cursor-aura';
    aura.setAttribute('aria-hidden', 'true');
    document.body.appendChild(aura);
    let auraFrame = 0;
    let cx = -500, cy = -500;
    window.addEventListener('pointermove', event => {
      cx = event.clientX; cy = event.clientY;
      aura.classList.add('active');
      if (auraFrame) return;
      auraFrame = requestAnimationFrame(() => {
        auraFrame = 0;
        aura.style.setProperty('--cursor-x', `${cx}px`);
        aura.style.setProperty('--cursor-y', `${cy}px`);
      });
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => aura.classList.remove('active'));
  }
})();
