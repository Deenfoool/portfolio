const USER = 'Deenfoool';
const API = `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated&direction=desc`;
const HIDDEN_REPOS = new Set(['portfolio']);
const grid = document.querySelector('#projects-grid');
const search = document.querySelector('#search');
const filters = document.querySelector('#filters');
const empty = document.querySelector('#empty');
let repos = [];
let activeLanguage = 'Все';

const languageNames = { JavaScript:'JavaScript', TypeScript:'TypeScript', Python:'Python', HTML:'HTML', CSS:'CSS', Java:'Java', CPlusPlus:'C++', CSharp:'C#', Shell:'Shell', Go:'Go', Rust:'Rust', PHP:'PHP' };

function esc(value='') {
  return String(value).replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
}
function formatNumber(n) { return Intl.NumberFormat('ru-RU', { notation:'compact', maximumFractionDigits:1 }).format(n || 0); }
function relativeDate(date) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date)) / 86400000));
  if(days === 0) return 'сегодня'; if(days === 1) return 'вчера'; if(days < 30) return `${days} дн. назад`;
  const months = Math.floor(days / 30); return `${months} мес. назад`;
}

// Обложка проекта хранится в portfolio/cover.png.
// Если файла нет, карточка автоматически переключается на GitHub OpenGraph.
function repoImage(repo) {
  const branch = repo.default_branch || 'main';
  return {
    custom: `https://raw.githubusercontent.com/${USER}/${repo.name}/${encodeURIComponent(branch)}/portfolio/cover.png`,
    fallback: `https://opengraph.githubassets.com/1/${USER}/${repo.name}`
  };
}

// Предпочитаем явный homepage из настроек репозитория.
// Если он не указан, но GitHub Pages включён, строим стандартный Pages URL.
function repoSiteUrl(repo) {
  const homepage = String(repo.homepage || '').trim();
  if (/^https?:\/\//i.test(homepage)) return homepage;
  if (!repo.has_pages) return '';

  const pagesRoot = `https://${USER}.github.io`;
  if (repo.name.toLowerCase() === `${USER.toLowerCase()}.github.io`) return `${pagesRoot}/`;
  return `${pagesRoot}/${encodeURIComponent(repo.name)}/`;
}

function getLanguages() {
  const langs = [...new Set(repos.map(r => r.language).filter(Boolean))];
  return ['Все', ...langs.slice(0, 7)];
}
function renderFilters() {
  filters.innerHTML = getLanguages().map(lang => `<button class="filter ${lang === activeLanguage ? 'active':''}" data-lang="${esc(lang)}">${esc(languageNames[lang] || lang)}</button>`).join('');
  filters.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => { activeLanguage = btn.dataset.lang; renderFilters(); render(); }));
}
function render() {
  const query = search.value.trim().toLowerCase();
  const shown = repos.filter(repo => {
    const text = `${repo.name} ${repo.description || ''} ${repo.language || ''}`.toLowerCase();
    return (!query || text.includes(query)) && (activeLanguage === 'Все' || repo.language === activeLanguage);
  });
  empty.hidden = shown.length !== 0;
  grid.innerHTML = shown.map((repo, i) => {
    const image = repoImage(repo);
    const siteUrl = repoSiteUrl(repo);
    return `
    <article class="project">
      <a class="project-cover" href="${esc(repo.html_url)}" target="_blank" rel="noreferrer" aria-label="Открыть ${esc(repo.name)} на GitHub">
        <div class="project-image"><img src="${esc(image.custom)}" alt="${esc(repo.name)}" loading="lazy" onerror="this.onerror=null;this.src='${esc(image.fallback)}'"><span class="project-index">${String(i+1).padStart(2,'0')}</span></div>
      </a>
      <div class="project-body">
        <a class="project-title-link" href="${esc(repo.html_url)}" target="_blank" rel="noreferrer">
          <div class="project-title"><strong>${esc(repo.name)}</strong><span>↗</span></div>
        </a>
        <p class="project-desc">${esc(repo.description || 'Проект без описания — загляни в репозиторий, чтобы узнать больше.')}</p>
        <div class="project-meta">
          ${repo.language ? `<span class="language"><i class="lang-dot"></i>${esc(languageNames[repo.language] || repo.language)}</span>` : '<span class="language">Project</span>'}
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
}
async function load() {
  try {
    const cached = JSON.parse(localStorage.getItem('deenfoool-repos') || 'null');
    if (cached && Date.now() - cached.time < 600000) repos = cached.data;
    else {
      const response = await fetch(API, { headers:{Accept:'application/vnd.github+json'} });
      if (!response.ok) throw new Error(`GitHub API ${response.status}`);
      repos = await response.json();
      localStorage.setItem('deenfoool-repos', JSON.stringify({time:Date.now(), data:repos}));
    }
    repos = repos.filter(r => !r.fork && !r.archived && !HIDDEN_REPOS.has(r.name.toLowerCase()));
    document.querySelector('#repo-count').textContent = repos.length;
    document.querySelector('#star-count').textContent = formatNumber(repos.reduce((s,r)=>s+r.stargazers_count,0));
    document.querySelector('#language-count').textContent = new Set(repos.map(r=>r.language).filter(Boolean)).size;
    document.querySelector('#terminal-projects').textContent = repos.slice(0,4).map(r=>r.name).join('  ');
    renderFilters(); render();
    fetch(`https://api.github.com/users/${USER}`).then(r=>r.json()).then(u=>{ if(typeof u.followers === 'number') document.querySelector('#follower-count').textContent = formatNumber(u.followers); }).catch(()=>{});
  } catch (error) {
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

    // Несколько мягких "живых" участков, где сетка визуально сильнее пульсирует.
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
