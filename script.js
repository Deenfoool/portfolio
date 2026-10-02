const USER = 'Deenfoool';
const API = `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated&direction=desc`;
const HIDDEN_REPOS = new Set(['portfolio']);
const SCHEMA_URL = 'https://raw.githubusercontent.com/Deenfoool/portfolio/main/schemas/project.schema.json';
const ACTION_TYPES = new Set(['website', 'download', 'github', 'details']);
const KINDS = new Set(['web', 'app', 'game', 'mod', 'tool', 'service', 'library', 'plugin', 'other']);
const STATUSES = new Set(['active', 'released', 'experimental', 'paused', 'archived']);
const ACTION_SOURCES = new Set(['homepage', 'github-pages', 'github-release', 'direct', 'repository']);
const META_KEYS = new Set(['$schema', 'version', 'title', 'tagline', 'kind', 'status', 'featured', 'tags', 'primaryAction']);
const ACTION_KEYS = new Set(['type', 'label', 'source', 'url', 'assetPattern']);

const grid = document.querySelector('#projects-grid');
const search = document.querySelector('#search');
const filters = document.querySelector('#filters');
const empty = document.querySelector('#empty');

let repos = [];
let activeLanguage = 'Все';

const languageNames = {
  JavaScript:'JavaScript', TypeScript:'TypeScript', Python:'Python', HTML:'HTML',
  CSS:'CSS', Java:'Java', CPlusPlus:'C++', CSharp:'C#', Shell:'Shell',
  Go:'Go', Rust:'Rust', PHP:'PHP'
};

function esc(value='') {
  return String(value).replace(/[&<>'\"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'
  }[c]));
}

function formatNumber(n) {
  return Intl.NumberFormat('ru-RU', { notation:'compact', maximumFractionDigits:1 }).format(n || 0);
}

function relativeDate(date) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date)) / 86400000));
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 30) return `${days} дн. назад`;
  const months = Math.floor(days / 30);
  return `${months} мес. назад`;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every(key => allowed.has(key));
}

function validUri(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validProjectMeta(meta) {
  if (!isPlainObject(meta) || !hasOnlyKeys(meta, META_KEYS)) return false;
  if (meta.$schema !== undefined && meta.$schema !== SCHEMA_URL) return false;
  if (meta.version !== 1) return false;
  if (typeof meta.title !== 'string' || !meta.title.trim()) return false;
  if (meta.tagline !== undefined && (typeof meta.tagline !== 'string' || meta.tagline.length > 180)) return false;
  if (!KINDS.has(meta.kind)) return false;
  if (!STATUSES.has(meta.status)) return false;
  if (typeof meta.featured !== 'boolean') return false;

  if (meta.tags !== undefined) {
    if (!Array.isArray(meta.tags) || meta.tags.length > 8) return false;
    if (new Set(meta.tags).size !== meta.tags.length) return false;
    if (!meta.tags.every(tag => typeof tag === 'string' && tag.length >= 1 && tag.length <= 32)) return false;
  }

  const action = meta.primaryAction;
  if (!isPlainObject(action) || !hasOnlyKeys(action, ACTION_KEYS)) return false;
  if (!ACTION_TYPES.has(action.type)) return false;
  if (typeof action.label !== 'string' || !action.label.trim() || action.label.length > 48) return false;
  if (action.source !== undefined && !ACTION_SOURCES.has(action.source)) return false;
  if (action.url !== undefined && !validUri(action.url)) return false;
  if (action.assetPattern !== undefined && (
    typeof action.assetPattern !== 'string' ||
    action.assetPattern.length < 1 ||
    action.assetPattern.length > 120
  )) return false;

  return true;
}

function portfolioMetaUrl(repo) {
  const branch = repo.default_branch || 'main';
  return `https://raw.githubusercontent.com/${USER}/${repo.name}/${encodeURIComponent(branch)}/portfolio/project.json`;
}

async function loadPortfolioMeta(repo) {
  try {
    const response = await fetch(`${portfolioMetaUrl(repo)}?_=${Date.now()}`, { cache:'no-store' });
    if (response.status === 404) {
      console.warn(`[Portfolio] Hidden ${repo.name}: portfolio/project.json is missing`);
      return null;
    }
    if (!response.ok) {
      console.warn(`[Portfolio] Hidden ${repo.name}: project.json HTTP ${response.status}`);
      return null;
    }

    const meta = await response.json();
    if (!validProjectMeta(meta)) {
      console.warn(`[Portfolio] Hidden ${repo.name}: portfolio/project.json is invalid`);
      return null;
    }
    return meta;
  } catch (error) {
    console.warn(`[Portfolio] Hidden ${repo.name}: cannot read portfolio/project.json`, error);
    return null;
  }
}

// Обложка проекта хранится в portfolio/cover.png.
// Если файла нет, карточка переключается на GitHub OpenGraph, но пишет warning в console.
function repoImage(repo) {
  const branch = repo.default_branch || 'main';
  return {
    custom: `https://raw.githubusercontent.com/${USER}/${repo.name}/${encodeURIComponent(branch)}/portfolio/cover.png`,
    fallback: `https://opengraph.githubassets.com/1/${USER}/${repo.name}`
  };
}

function repoSiteUrl(repo) {
  const homepage = String(repo.homepage || '').trim();
  if (/^https?:\/\//i.test(homepage)) return homepage;
  if (!repo.has_pages) return '';

  const pagesRoot = `https://${USER}.github.io`;
  if (repo.name.toLowerCase() === `${USER.toLowerCase()}.github.io`) return `${pagesRoot}/`;
  return `${pagesRoot}/${encodeURIComponent(repo.name)}/`;
}

function metadataWebsiteUrl(repo) {
  const action = repo.portfolioMeta?.primaryAction;
  if (action?.type !== 'website') return '';
  if (action.url) return action.url;
  if (action.source === 'repository') return repo.html_url;
  if (action.source === 'homepage') return String(repo.homepage || '').trim();
  return repoSiteUrl(repo);
}

function getLanguages() {
  const langs = [...new Set(repos.map(r => r.language).filter(Boolean))];
  return ['Все', ...langs.slice(0, 7)];
}

function renderFilters() {
  filters.innerHTML = getLanguages().map(lang =>
    `<button class="filter ${lang === activeLanguage ? 'active':''}" data-lang="${esc(lang)}">${esc(languageNames[lang] || lang)}</button>`
  ).join('');

  filters.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => {
    activeLanguage = btn.dataset.lang;
    renderFilters();
    render();
  }));
}

function attachCoverFallbacks() {
  grid.querySelectorAll('img[data-cover-fallback]').forEach(img => {
    img.addEventListener('error', () => {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = '1';
      console.warn(`[Portfolio] ${img.dataset.repo}: portfolio/cover.png is missing or unavailable; using GitHub OpenGraph fallback`);
      img.src = img.dataset.coverFallback;
    }, { once:true });
  });
}

function render() {
  const query = search.value.trim().toLowerCase();
  const shown = repos.filter(repo => {
    const meta = repo.portfolioMeta;
    const text = [
      repo.name,
      meta?.title,
      meta?.tagline,
      ...(Array.isArray(meta?.tags) ? meta.tags : []),
      repo.description,
      repo.language
    ].filter(Boolean).join(' ').toLowerCase();

    return (!query || text.includes(query)) &&
      (activeLanguage === 'Все' || repo.language === activeLanguage);
  });

  empty.hidden = shown.length !== 0;
  grid.innerHTML = shown.map((repo, i) => {
    const image = repoImage(repo);
    const meta = repo.portfolioMeta;
    const title = meta.title;
    const description = meta.tagline || repo.description || 'Проект без описания.';
    const siteUrl = metadataWebsiteUrl(repo);

    return `
    <article class="project" data-project-name="${esc(repo.name)}">
      <a class="project-cover" href="${esc(repo.html_url)}" target="_blank" rel="noreferrer" aria-label="Открыть ${esc(title)}">
        <div class="project-image">
          <img
            class="project-cover-img"
            src="${esc(image.custom)}"
            data-cover-fallback="${esc(image.fallback)}"
            data-repo="${esc(repo.name)}"
            alt="${esc(title)}"
            loading="lazy">
          <span class="project-index">${String(i+1).padStart(2,'0')}</span>
        </div>
      </a>
      <div class="project-body">
        <a class="project-title-link" href="${esc(repo.html_url)}" target="_blank" rel="noreferrer">
          <div class="project-title"><strong>${esc(title)}</strong><span>↗</span></div>
        </a>
        <p class="project-desc">${esc(description)}</p>
        <div class="project-meta">
          ${repo.language
            ? `<span class="language"><i class="lang-dot"></i>${esc(languageNames[repo.language] || repo.language)}</span>`
            : '<span class="language">Project</span>'}
          <span>${relativeDate(repo.updated_at)}</span>
          <span class="stars">★ ${formatNumber(repo.stargazers_count)}</span>
        </div>
        <div class="project-actions">
          <a class="project-action github" href="${esc(repo.html_url)}" target="_blank" rel="noreferrer">GitHub <span>↗</span></a>
          ${siteUrl ? `<a class="project-action site" href="${esc(siteUrl)}" target="_blank" rel="noreferrer">Открыть сайт <span>↗</span></a>` : ''}
        </div>
      </div>
    </article>`;
  }).join('');

  attachCoverFallbacks();
}

async function getGithubRepos() {
  const cached = JSON.parse(localStorage.getItem('deenfoool-repos') || 'null');
  if (cached && Date.now() - cached.time < 600000 && Array.isArray(cached.data)) {
    return cached.data;
  }

  const response = await fetch(API, { headers:{Accept:'application/vnd.github+json'} });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);

  const data = await response.json();
  localStorage.setItem('deenfoool-repos', JSON.stringify({time:Date.now(), data}));
  return data;
}

async function load() {
  try {
    const githubRepos = await getGithubRepos();
    const candidates = githubRepos.filter(repo =>
      !repo.fork &&
      !repo.archived &&
      !HIDDEN_REPOS.has(String(repo.name || '').toLowerCase())
    );

    const checked = await Promise.all(candidates.map(async repo => {
      const portfolioMeta = await loadPortfolioMeta(repo);
      return portfolioMeta ? {...repo, portfolioMeta} : null;
    }));

    repos = checked.filter(Boolean);

    window.__portfolioRepos = repos;
    document.dispatchEvent(new CustomEvent('portfolio:repos-ready', { detail:{ repos } }));

    document.querySelector('#repo-count').textContent = repos.length;
    document.querySelector('#star-count').textContent = formatNumber(repos.reduce((sum, repo) => sum + repo.stargazers_count, 0));
    document.querySelector('#language-count').textContent = new Set(repos.map(repo => repo.language).filter(Boolean)).size;
    document.querySelector('#terminal-projects').textContent =
      repos.slice(0,4).map(repo => repo.portfolioMeta?.title || repo.name).join('  ') || 'no published projects';

    renderFilters();
    render();

    fetch(`https://api.github.com/users/${USER}`)
      .then(r => r.json())
      .then(user => {
        if (typeof user.followers === 'number') {
          document.querySelector('#follower-count').textContent = formatNumber(user.followers);
        }
      })
      .catch(() => {});
  } catch (error) {
    console.error('[Portfolio] Failed to load repositories', error);
    grid.innerHTML = `<div class="loading-card">Не удалось загрузить GitHub. <a href="https://github.com/${USER}" target="_blank" rel="noreferrer" style="color:#a3e635">Открыть профиль ↗</a></div>`;
    document.querySelector('#terminal-projects').textContent = 'github api unavailable';
  }
}

search.addEventListener('input', render);
document.querySelector('#year').textContent = new Date().getFullYear();
load();

// Живая зелёная сетка на фоне: точки слегка смещаются волнами,
// поэтому отдельные ячейки постоянно растягиваются и сжимаются.
(function initAnimatedGrid(){
  const canvas = document.querySelector('#grid-bg');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  const spacing = 72;
  let width = 0, height = 0, dpr = 1;

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function point(col,row,t){
    const x = col * spacing;
    const y = row * spacing;
    const wave1 = Math.sin(x * 0.010 + t * 0.00075 + Math.sin(y * 0.006)) * 15;
    const wave2 = Math.cos(y * 0.012 - t * 0.00055 + Math.cos(x * 0.005)) * 12;
    const ripple = Math.sin((x + y) * 0.004 - t * 0.0009) * 8;
    return {
      x: x + wave1 + ripple,
      y: y + wave2 + ripple * 0.45
    };
  }

  function draw(t){
    ctx.clearRect(0,0,width,height);
    const cols = Math.ceil(width / spacing) + 3;
    const rows = Math.ceil(height / spacing) + 3;
    ctx.lineWidth = 1;

    for(let row = -1; row < rows; row++){
      ctx.beginPath();
      for(let col = -1; col < cols; col++){
        const p = point(col,row,t);
        if(col === -1) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);
      }
      ctx.strokeStyle = 'rgba(163,230,53,0.095)';
      ctx.stroke();
    }

    for(let col = -1; col < cols; col++){
      ctx.beginPath();
      for(let row = -1; row < rows; row++){
        const p = point(col,row,t);
        if(row === -1) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);
      }
      ctx.strokeStyle = 'rgba(163,230,53,0.095)';
      ctx.stroke();
    }

    const spots = [
      [width * 0.18, height * 0.24],
      [width * 0.72, height * 0.38],
      [width * 0.47, height * 0.78]
    ];

    spots.forEach(([sx,sy],i)=>{
      const pulse = (Math.sin(t * 0.0011 + i * 2.2) + 1) * 0.5;
      const radius = 90 + pulse * 80;
      const glow = ctx.createRadialGradient(sx,sy,0,sx,sy,radius);
      glow.addColorStop(0,'rgba(163,230,53,0.045)');
      glow.addColorStop(1,'rgba(163,230,53,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx-radius,sy-radius,radius*2,radius*2);
    });

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize',resize,{passive:true});
  requestAnimationFrame(draw);
})();
