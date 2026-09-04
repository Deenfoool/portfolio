(() => {
  const USER='Deenfoool';
  const API=`https://api.github.com/users/${USER}/repos?per_page=100&sort=updated&direction=desc`;
  const HIDDEN=new Set(['portfolio']);
  const featuredGrid=document.querySelector('#featured-grid');
  const projectsGrid=document.querySelector('#projects-grid');
  const modal=document.querySelector('#project-modal');
  const galleryImage=document.querySelector('#gallery-image');
  const galleryLoading=document.querySelector('#gallery-loading');
  const galleryPrev=document.querySelector('#gallery-prev');
  const galleryNext=document.querySelector('#gallery-next');
  const galleryDots=document.querySelector('#gallery-dots');
  const galleryCount=document.querySelector('#gallery-count');
  let repos=[];
  let gallery=[];
  let galleryIndex=0;
  let galleryRequest=0;

  const esc=(v='')=>String(v).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const rel=date=>{
    const d=Math.max(0,Math.floor((Date.now()-new Date(date))/86400000));
    if(d===0)return'сегодня'; if(d===1)return'вчера'; if(d<30)return`${d} дн. назад`;
    const m=Math.floor(d/30); return m<12?`${m} мес. назад`:new Intl.DateTimeFormat('ru-RU',{month:'short',year:'numeric'}).format(new Date(date));
  };
  const topics=r=>Array.isArray(r.topics)?r.topics:[];
  const visibleTopics=r=>topics(r).filter(t=>t.toLowerCase()!=='featured');
  const isFeatured=r=>topics(r).some(t=>t.toLowerCase()==='featured');
  const cleanRepos=data=>(Array.isArray(data)?data:[]).filter(r=>!r.fork&&!r.archived&&!HIDDEN.has(String(r.name||'').toLowerCase()));
  const site=r=>{
    const home=String(r.homepage||'').trim();
    if(/^https?:\/\//i.test(home))return home;
    if(!r.has_pages)return'';
    return `https://${USER}.github.io/${encodeURIComponent(r.name)}/`;
  };
  const cover=r=>{
    const branch=r.default_branch||'main';
    return {
      custom:`https://raw.githubusercontent.com/${USER}/${r.name}/${encodeURIComponent(branch)}/portfolio.png`,
      fallback:`https://opengraph.githubassets.com/1/${USER}/${r.name}`
    };
  };

  function readCachedRepos(){
    try{
      const cached=JSON.parse(localStorage.getItem('deenfoool-repos')||'null');
      return cleanRepos(cached?.data);
    }catch{return[];}
  }

  function featuredCard(r){
    const img=cover(r), live=site(r), tags=visibleTopics(r).slice(0,3);
    return `<article class="featured-card">
      <button class="featured-media" type="button" data-project-detail="${esc(r.name)}">
        <img src="${esc(img.custom)}" alt="${esc(r.name)}" loading="lazy" onerror="this.onerror=null;this.src='${esc(img.fallback)}'">
        <span class="featured-badge">FEATURED</span>
      </button>
      <div class="featured-body">
        <div class="featured-kicker">${esc(r.language||'Project')} · ${rel(r.updated_at)}</div>
        <button class="featured-title" type="button" data-project-detail="${esc(r.name)}">${esc(r.name)} <span>↗</span></button>
        <p>${esc(r.description||'Проект из моего GitHub — открой карточку, чтобы посмотреть подробнее.')}</p>
        ${tags.length?`<div class="featured-topics">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}
        <div class="featured-actions">
          <button class="button primary" type="button" data-project-detail="${esc(r.name)}">Подробнее <span>→</span></button>
          ${live?`<a class="button ghost" href="${esc(live)}" target="_blank" rel="noreferrer">Открыть сайт ↗</a>`:`<a class="button ghost" href="${esc(r.html_url)}" target="_blank" rel="noreferrer">GitHub ↗</a>`}
        </div>
      </div>
    </article>`;
  }

  function renderFeatured(){
    if(!featuredGrid)return;
    const pinned=repos.filter(isFeatured);
    const list=(pinned.length?pinned:repos).slice(0,3);
    featuredGrid.innerHTML=list.length?list.map(featuredCard).join(''):'<div class="loading-card">Пока нет проектов для показа.</div>';
  }

  function repoFromHref(href){
    try{return decodeURIComponent(new URL(href).pathname.split('/').filter(Boolean).pop()||'')}catch{return'';}
  }

  function enhanceProjectCards(){
    if(!projectsGrid)return;
    projectsGrid.querySelectorAll('.project').forEach(card=>{
      const title=card.querySelector('.project-title strong')?.textContent?.trim();
      const githubLink=card.querySelector('a[href*="github.com/Deenfoool/"]');
      const name=title||repoFromHref(githubLink?.href||'');
      if(!name)return;

      card.dataset.projectName=name;
      if(card.dataset.enhanced)return;
      card.dataset.enhanced='1';

      const actions=card.querySelector('.project-actions');
      if(actions&&!actions.querySelector('[data-project-detail]')){
        actions.insertAdjacentHTML('afterbegin',`<button class="project-action details" type="button" data-project-detail="${esc(name)}">Подробнее <span>→</span></button>`);
      }
    });
  }

  function galleryCandidates(r){
    const branch=r.default_branch||'main';
    const base=`https://raw.githubusercontent.com/${USER}/${r.name}/${encodeURIComponent(branch)}`;
    return [`${base}/portfolio.png`,...Array.from({length:5},(_,i)=>`${base}/portfolio-${i+1}.png`)];
  }

  const probe=url=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(url);img.onerror=()=>resolve(null);img.src=url;});

  function updateGallery(name='Project'){
    const total=gallery.length||1;
    if(gallery.length){galleryImage.src=gallery[galleryIndex];galleryImage.alt=`${name} — изображение ${galleryIndex+1}`;}
    galleryPrev.hidden=total<=1; galleryNext.hidden=total<=1;
    galleryCount.textContent=`${gallery.length?galleryIndex+1:1} / ${total}`;
    galleryDots.innerHTML=gallery.map((_,i)=>`<button class="gallery-dot ${i===galleryIndex?'active':''}" type="button" data-gallery-index="${i}" aria-label="Изображение ${i+1}"></button>`).join('');
  }

  function setGallery(i){
    if(!gallery.length)return;
    galleryIndex=(i+gallery.length)%gallery.length;
    updateGallery(document.querySelector('#modal-title')?.textContent||'Project');
  }

  async function loadGallery(r){
    const id=++galleryRequest;
    gallery=[];
    galleryIndex=0;
    galleryImage.removeAttribute('src');
    galleryLoading.hidden=false;
    updateGallery(r.name);
    const found=(await Promise.all(galleryCandidates(r).map(probe))).filter(Boolean);
    if(id!==galleryRequest)return;
    gallery=found.length?found:[cover(r).fallback];
    galleryLoading.hidden=true;
    updateGallery(r.name);
  }

  async function ensureRepo(name){
    let r=repos.find(x=>x.name===name);
    if(r&&Array.isArray(r.topics))return r;
    try{
      const response=await fetch(`https://api.github.com/repos/${USER}/${encodeURIComponent(name)}`,{headers:{Accept:'application/vnd.github+json'}});
      if(!response.ok)throw new Error(`GitHub API ${response.status}`);
      const fresh=await response.json();
      const idx=repos.findIndex(x=>x.name===fresh.name);
      if(idx>=0)repos[idx]=fresh;else repos.push(fresh);
      return fresh;
    }catch{return r||null;}
  }

  async function openModal(name){
    const r=await ensureRepo(name);
    if(!r)return;
    const live=site(r), tags=visibleTopics(r);
    document.querySelector('#modal-title').textContent=r.name;
    document.querySelector('#modal-description').textContent=r.description||'Описание проекта пока не добавлено в GitHub. Можно перейти в репозиторий или открыть живую версию проекта.';
    document.querySelector('#modal-language').textContent=r.language||'—';
    document.querySelector('#modal-updated').textContent=rel(r.updated_at);
    document.querySelector('#modal-stars').textContent=String(r.stargazers_count||0);
    document.querySelector('#modal-format').textContent=live?'Live project':'Open source';
    document.querySelector('#modal-topics').innerHTML=tags.length?tags.map(t=>`<span>${esc(t)}</span>`).join(''):'<span>GitHub project</span>';
    document.querySelector('#modal-actions').innerHTML=`${live?`<a class="button primary" href="${esc(live)}" target="_blank" rel="noreferrer">Открыть проект <span>↗</span></a>`:''}<a class="button ghost" href="${esc(r.html_url)}" target="_blank" rel="noreferrer">GitHub <span>↗</span></a>`;
    modal.hidden=false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(()=>modal.classList.add('open'));
    document.querySelector('.modal-close')?.focus({preventScroll:true});
    loadGallery(r);
  }

  function closeModal(){
    if(!modal||modal.hidden)return;
    galleryRequest++;
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
    setTimeout(()=>{if(!modal.classList.contains('open'))modal.hidden=true;},180);
  }

  document.addEventListener('click',e=>{
    const detail=e.target.closest('[data-project-detail]');
    if(detail){e.preventDefault();openModal(detail.dataset.projectDetail);return;}

    const card=e.target.closest('#projects-grid .project');
    const coverLink=e.target.closest('#projects-grid .project-cover, #projects-grid .project-title-link');
    if(card&&coverLink){e.preventDefault();openModal(card.dataset.projectName||repoFromHref(coverLink.href));return;}

    if(e.target.closest('[data-modal-close]')){closeModal();return;}
    const dot=e.target.closest('[data-gallery-index]');
    if(dot)setGallery(Number(dot.dataset.galleryIndex));
  });

  galleryPrev?.addEventListener('click',()=>setGallery(galleryIndex-1));
  galleryNext?.addEventListener('click',()=>setGallery(galleryIndex+1));
  document.addEventListener('keydown',e=>{
    if(!modal||modal.hidden)return;
    if(e.key==='Escape')closeModal();
    if(e.key==='ArrowLeft')setGallery(galleryIndex-1);
    if(e.key==='ArrowRight')setGallery(galleryIndex+1);
  });

  if(projectsGrid){
    new MutationObserver(enhanceProjectCards).observe(projectsGrid,{childList:true,subtree:true});
    enhanceProjectCards();
  }

  repos=readCachedRepos();
  if(repos.length)renderFeatured();

  fetch(`${API}&_=${Date.now()}`,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'})
    .then(r=>{if(!r.ok)throw new Error(`GitHub API ${r.status}`);return r.json();})
    .then(data=>{
      repos=cleanRepos(data);
      renderFeatured();
      enhanceProjectCards();
    })
    .catch(()=>{
      if(!repos.length&&featuredGrid)featuredGrid.innerHTML='<div class="loading-card">Избранные проекты временно не загрузились.</div>';
      enhanceProjectCards();
    });
})();
