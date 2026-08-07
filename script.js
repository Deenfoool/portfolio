const USER = 'Deenfoool';
const API = `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated&direction=desc`;
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

// Для каждого проекта сначала используется portfolio.png из корня репозитория.
// Если файла нет, карточка автоматически переключается на GitHub OpenGraph.
function repoImage(repo) {
  const branch = repo.default_branch || 'main';
  return {
    custom: `https://raw.githubusercontent.com/${USER}/${repo.name}/${encodeURIComponent(branch)}/portfolio.png`,
    fallback: `https://opengraph.githubassets.com/1/${USER}/${repo.name}`
  };
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
    return `
    <a class="project" href="${esc(repo.html_url)}" target="_blank" rel="noreferrer">
      <div class="project-image"><img src="${esc(image.custom)}" alt="${esc(repo.name)}" loading="lazy" onerror="this.onerror=null;this.src='${esc(image.fallback)}'"><span class="project-index">${String(i+1).padStart(2,'0')}</span></div>
      <div class="project-body">
        <div class="project-title"><span>${esc(repo.name)}</span><span>↗</span></div>
        <p class="project-desc">${esc(repo.description || 'Проект без описания — загляни в репозиторий, чтобы узнать больше.')}</p>
        <div class="project-meta">
          ${repo.language ? `<span class="language"><i class="lang-dot"></i>${esc(languageNames[repo.language] || repo.language)}</span>` : '<span class="language">Project</span>'}
          <span>${relativeDate(repo.updated_at)}</span>
          <span class="stars">★ ${formatNumber(repo.stargazers_count)}</span>
        </div>
      </div>
    </a>`;
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
    repos = repos.filter(r => !r.fork && !r.archived);
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
