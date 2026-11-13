(() => {
  const USER='Deenfoool';
  const API=`https://api.github.com/users/${USER}/repos?per_page=100&sort=updated&direction=desc`;
  const HIDDEN=new Set(['portfolio','suit-case-glider','deenfoool']);
  const Releases=window.PortfolioReleases;
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
  let modalOpenRequest=0;
  let returnFocus=null;
  const galleryCache=new Map();

  const esc=(v='')=>String(v).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const rel=date=>{
    const d=Math.max(0,Math.floor((Date.now()-new Date(date))/86400000));
    if(d===0)return'сегодня'; if(d===1)return'вчера'; if(d<30)return`${d} дн. назад`;
    const m=Math.floor(d/30); return m<12?`${m} мес. назад`:new Intl.DateTimeFormat('ru-RU',{month:'short',year:'numeric'}).format(new Date(date));
  };
  const topics=r=>Array.isArray(r.topics)?r.topics:[];
  const visibleTopics=r=>topics(r).filter(t=>t.toLowerCase()!=='featured');
  const isFeatured=r=>topics(r).some(t=>String(t).toLowerCase()==='featured');
  const cleanRepos=data=>(Array.isArray(data)?data:[]).filter(r=>!r.fork&&!r.archived&&!HIDDEN.has(String(r.name||'').toLowerCase()));
  const site=r=>{
    const home=String(r.homepage||'').trim();
    if(/^https?:\/\//i.test(home))return home;
    if(!r.has_pages)return'';
    return `https://${USER}.github.io/${encodeURIComponent(r.name)}/`;
  };
  // One media convention for every project, including featured cards:
  // portfolio/cover.png, otherwise portfolio/cover.jpg, then GitHub OG.
  // Optional gallery: gallery/01.png .. 10.png.
  const portfolioMediaBase=r=>{
    const branch=r.default_branch||'main';
    return `https://raw.githubusercontent.com/${USER}/${encodeURIComponent(r.name)}/${encodeURIComponent(branch)}/portfolio`;
  };
  const cover=r=>({
    custom:portfolioMediaBase(r)+'/cover.png',
    alternate:portfolioMediaBase(r)+'/cover.jpg',
    fallback:`https://opengraph.githubassets.com/1/${USER}/${encodeURIComponent(r.name)}`
  });
  // Try the same image extensions in the same order for ALL repositories.
  const coverOnError=img=>
    `this.onerror=function(){this.onerror=null;this.src='${esc(img.fallback)}'};this.src='${esc(img.alternate)}'`;

  function readCachedRepos(){
    try{
      const cached=JSON.parse(localStorage.getItem('deenfoool-repos')||'null');
      return cleanRepos(cached?.data);
    }catch{return[];}
  }

  function featuredCard(r){
    const img=cover(r), live=site(r), tags=visibleTopics(r).slice(0,3);
    const downloadable=Releases?.has(r.name)===true, title=r.name;
    const destination=downloadable?Releases.url(r):live||r.html_url;
    const action=downloadable?'Скачать':live?'Открыть сайт':'GitHub';
    return `<article class="featured-card">
      <button class="featured-media" type="button" data-project-detail="${esc(r.name)}">
        <img src="${esc(img.custom)}" alt="${esc(title)}" loading="lazy" onerror="${coverOnError(img)}">
        <span class="featured-badge">FEATURED</span>
      </button>
      <div class="featured-body">
        <div class="featured-kicker">${esc(r.language||'Project')} · ${rel(r.updated_at)}</div>
        <button class="featured-title" type="button" data-project-detail="${esc(r.name)}">${esc(title)} <span>↗</span></button>
        <p>${esc(r.description||'Проект из моего GitHub — открой карточку, чтобы посмотреть подробнее.')}</p>
        <div class="featured-bottom">
          ${tags.length?`<div class="featured-topics">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}
          <div class="featured-actions">
            <button class="button primary" type="button" data-project-detail="${esc(r.name)}">Подробнее <span>→</span></button>
            <a class="button ghost" href="${esc(destination)}" target="_blank" rel="noreferrer">${action} ↗</a>
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderFeatured(){
    if(!featuredGrid)return;
    const list=repos.filter(isFeatured).slice(0,3);
    featuredGrid.innerHTML=list.length
      ? list.map(featuredCard).join('')
      : '<div class="loading-card">Пока нет проектов с топиком featured.</div>';
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


  // A cover is displayed as soon as it is ready. Gallery images are discovered
  // in the background, rather than blocking the controls on 12 network requests.
  function galleryCandidates(r){
    const base=portfolioMediaBase(r);
    return Array.from({length:10},(_,i)=>`${base}/gallery/${String(i+1).padStart(2,'0')}.png`);
  }

  const probe=(url,timeout=5500)=>new Promise(resolve=>{
    const img=new Image();
    let settled=false;
    const settle=value=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      img.onload=null;
      img.onerror=null;
      resolve(value);
    };
    const timer=setTimeout(()=>settle(null),timeout);
    img.onload=()=>settle(url);
    img.onerror=()=>settle(null);
    img.src=url;
  });

  function updateGallery(name='Project'){
    const total=gallery.length;
    if(total){
      const url=gallery[galleryIndex];
      if(galleryImage.getAttribute('src')!==url) galleryImage.src=url;
      galleryImage.alt=`${name} — изображение ${galleryIndex+1} из ${total}`;
    }else{
      galleryImage.removeAttribute('src');
      galleryImage.alt='';
    }
    const hasMultiple=total>1;
    galleryPrev.hidden=!hasMultiple;
    galleryNext.hidden=!hasMultiple;
    galleryPrev.disabled=!hasMultiple;
    galleryNext.disabled=!hasMultiple;
    galleryCount.textContent=`${total?galleryIndex+1:0} / ${total}`;
    galleryDots.innerHTML=total>1
      ?gallery.map((_,i)=>`<button class="gallery-dot ${i===galleryIndex?'active':''}" type="button" data-gallery-index="${i}" aria-label="Изображение ${i+1} из ${total}" aria-current="${i===galleryIndex?'true':'false'}"></button>`).join('')
      :'';
  }

  function setGallery(i){
    if(!modal||modal.hidden||gallery.length<2)return;
    galleryIndex=(i+gallery.length)%gallery.length;
    updateGallery(document.querySelector('#modal-title')?.textContent||'Project');
  }

  async function loadGallery(r){
    const id=++galleryRequest;
    const cacheKey=r.name.toLowerCase();
    gallery=[];
    galleryIndex=0;
    galleryLoading.hidden=false;
    updateGallery(r.name);

    const cached=galleryCache.get(cacheKey);
    if(cached?.length){
      gallery=cached.slice();
      galleryLoading.hidden=true;
      updateGallery(r.name);
      return;
    }

    const current=()=>id===galleryRequest && !modal.hidden;
    const images=cover(r);
    const discovered=new Array(10).fill(null);
    let primary=null;

    // The image that is being viewed stays selected if another image is found.
    const refresh=()=>{
      if(!current()||!primary)return;
      const selected=gallery[galleryIndex];
      gallery=[primary,...discovered.filter(Boolean)];
      galleryIndex=Math.max(0,gallery.indexOf(selected));
      galleryLoading.hidden=true;
      updateGallery(r.name);
    };

    // Start the extra images now, but reveal the first cover immediately.
    const extra=galleryCandidates(r).map(async(url,index)=>{
      discovered[index]=await probe(url);
      refresh();
    });
    primary=await probe(images.custom) || await probe(images.alternate) || images.fallback;
    if(!current())return;
    refresh();
    await Promise.all(extra);
    if(!current())return;
    galleryCache.set(cacheKey,gallery.slice());
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


  function renderModalActions(r) {
    const live=site(r);
    const downloadable=Releases?.has(r.name)===true;
    const link=(href, text, variant) => '<a class="button ' + variant + '" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + text + ' <span>↗</span></a>';
    const download=downloadable ? link(Releases.url(r), 'Скачать', 'primary') : '';
    const website=live ? link(live, 'Открыть сайт', downloadable ? 'ghost' : 'primary') : '';
    document.querySelector('#modal-format').textContent=downloadable?'Релиз GitHub':live?'Live project':'Open source';
    document.querySelector('#modal-actions').innerHTML=download+website+link(r.html_url,'GitHub','ghost');
  }

  async function openModal(name){
    const openRequest=++modalOpenRequest;
    const invoker=document.activeElement;
    const r=await ensureRepo(name);
    if(openRequest!==modalOpenRequest||!r)return;
    const tags=visibleTopics(r);
    document.querySelector('#modal-title').textContent=r.name;
    document.querySelector('#modal-description').textContent=r.description||'Описание проекта пока не добавлено в GitHub. Можно перейти в репозиторий или открыть живую версию проекта.';
    document.querySelector('#modal-language').textContent=r.language||'—';
    document.querySelector('#modal-updated').textContent=rel(r.updated_at);
    document.querySelector('#modal-stars').textContent=String(r.stargazers_count||0);
    document.querySelector('#modal-topics').innerHTML=tags.length?tags.map(t=>'<span>'+esc(t)+'</span>').join(''):'<span>GitHub project</span>';
    if(modal.hidden) returnFocus=invoker;
    modal.dataset.projectName=r.name;
    renderModalActions(r);
    modal.hidden=false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(()=>{ if(openRequest===modalOpenRequest&&!modal.hidden)modal.classList.add('open'); });
    document.querySelector('.modal-close')?.focus({preventScroll:true});
    loadGallery(r);
    void Releases?.check(r);
  }

  function closeModal(){
    ++modalOpenRequest;
    if(!modal||modal.hidden)return;
    ++galleryRequest; // Ignore any pending image probes for the closed card.
    modal.classList.remove('open');
    modal.hidden=true; // Immediate hit-testing/focus reset; no stale animation timer.
    modal.removeAttribute('data-project-name');
    galleryLoading.hidden=true;
    document.body.classList.remove('modal-open');
    const target=returnFocus;
    returnFocus=null;
    if(target?.isConnected && typeof target.focus==='function') target.focus({preventScroll:true});
  }

  document.addEventListener('click',e=>{
    const detail=e.target.closest('[data-project-detail]');
    if(detail){e.preventDefault();void openModal(detail.dataset.projectDetail);return;}

    const card=e.target.closest('#projects-grid .project');
    const coverLink=e.target.closest('#projects-grid .project-cover, #projects-grid .project-title-link');
    if(card&&coverLink){e.preventDefault();void openModal(card.dataset.projectName||repoFromHref(coverLink.href));}
  });

  // Modal controls are handled on the modal, independently of project card links.
  modal?.addEventListener('click',e=>{
    if(e.target.closest('[data-modal-close]')){
      e.preventDefault();
      closeModal();
      return;
    }
    if(e.target.closest('#gallery-prev')){
      e.preventDefault();
      setGallery(galleryIndex-1);
      return;
    }
    if(e.target.closest('#gallery-next')){
      e.preventDefault();
      setGallery(galleryIndex+1);
      return;
    }
    const dot=e.target.closest('[data-gallery-index]');
    if(dot){
      e.preventDefault();
      setGallery(Number(dot.dataset.galleryIndex));
    }
  });

  document.addEventListener('keydown',e=>{
    if(!modal||modal.hidden)return;
    if(e.key==='Escape'){
      e.preventDefault();
      closeModal();
    }else if((e.key==='ArrowLeft'||e.key==='ArrowRight') && !e.altKey&&!e.ctrlKey&&!e.metaKey){
      e.preventDefault();
      setGallery(galleryIndex+(e.key==='ArrowLeft'?-1:1));
    }else if(e.key==='Tab'){
      // Keep keyboard focus inside the open project dialog.
      const dialog=modal.querySelector('.project-dialog');
      const controls=[...dialog.querySelectorAll('a[href],button:not([disabled]):not([hidden])')]
        .filter(el=>el.getClientRects().length);
      if(!controls.length)return;
      const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
    }
  });

  if(projectsGrid){
    new MutationObserver(enhanceProjectCards).observe(projectsGrid,{childList:true,subtree:true});
    enhanceProjectCards();
  }


  Releases?.onChange((name, available) => {
    const repo=repos.find(r=>r.name.toLowerCase()===name);
    if (!repo) return;
    if (isFeatured(repo)) renderFeatured();
    if (modal && !modal.hidden && modal.dataset.projectName?.toLowerCase()===name) {
      renderModalActions(repo);
    }
  });

  repos=readCachedRepos();
  if(repos.length){renderFeatured();Releases?.scan(repos);}

  fetch(`${API}&_=${Date.now()}`,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'})
    .then(r=>{if(!r.ok)throw new Error(`GitHub API ${r.status}`);return r.json();})
    .then(data=>{
      repos=cleanRepos(data);
      renderFeatured();
      enhanceProjectCards();
      Releases?.scan(repos);
    })
    .catch(()=>{
      enhanceProjectCards();
    });
})();
