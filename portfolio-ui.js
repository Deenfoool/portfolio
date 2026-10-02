(() => {
  const USER='Deenfoool';
  const API=`https://api.github.com/users/${USER}/repos?per_page=100&sort=updated&direction=desc`;
  const HIDDEN=new Set(['portfolio']);
  const ACTION_TYPES=new Set(['website','download','github','details']);
  const KIND_LABELS={web:'Web',app:'App',game:'Game',mod:'Mod',tool:'Tool',service:'Service',library:'Library',plugin:'Plugin',other:'Project'};
  const STATUS_LABELS={active:'Active',released:'Released',experimental:'Experimental',paused:'Paused',archived:'Archived'};
  const featuredGrid=document.querySelector('#featured-grid');
  const projectsGrid=document.querySelector('#projects-grid');
  const modal=document.querySelector('#project-modal');
  const galleryImage=document.querySelector('#gallery-image');
  const galleryLoading=document.querySelector('#gallery-loading');
  const galleryPrev=document.querySelector('#gallery-prev');
  const galleryNext=document.querySelector('#gallery-next');
  const galleryDots=document.querySelector('#gallery-dots');
  const galleryCount=document.querySelector('#gallery-count');
  const metaCache=new Map();
  const metaPromises=new Map();
  const releasePromises=new Map();
  let repos=[];
  let gallery=[];
  let galleryIndex=0;
  let galleryRequest=0;
  let featuredRenderRequest=0;

  const esc=(v='')=>String(v).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const rel=date=>{
    const d=Math.max(0,Math.floor((Date.now()-new Date(date))/86400000));
    if(d===0)return'сегодня'; if(d===1)return'вчера'; if(d<30)return`${d} дн. назад`;
    const m=Math.floor(d/30); return m<12?`${m} мес. назад`:new Intl.DateTimeFormat('ru-RU',{month:'short',year:'numeric'}).format(new Date(date));
  };
  const topics=r=>Array.isArray(r.topics)?r.topics:[];
  const visibleTopics=r=>topics(r).filter(t=>t.toLowerCase()!=='featured');
  const topicFeatured=r=>topics(r).some(t=>t.toLowerCase()==='featured');
  const cleanRepos=data=>(Array.isArray(data)?data:[]).filter(r=>!r.fork&&!r.archived&&!HIDDEN.has(String(r.name||'').toLowerCase()));
  const pagesUrl=r=>`https://${USER}.github.io/${encodeURIComponent(r.name)}/`;
  const site=r=>{
    const home=String(r.homepage||'').trim();
    if(/^https?:\/\//i.test(home))return home;
    if(!r.has_pages)return'';
    return pagesUrl(r);
  };
  const cover=r=>{
    const branch=r.default_branch||'main';
    return {
      custom:`https://raw.githubusercontent.com/${USER}/${r.name}/${encodeURIComponent(branch)}/portfolio/cover.png`,
      fallback:`https://opengraph.githubassets.com/1/${USER}/${r.name}`
    };
  };
  const metaUrl=r=>{
    const branch=r.default_branch||'main';
    return `https://raw.githubusercontent.com/${USER}/${r.name}/${encodeURIComponent(branch)}/portfolio/project.json`;
  };

  function validMeta(meta){
    return !!meta&&typeof meta==='object'&&meta.version===1&&typeof meta.title==='string'&&meta.title.trim()&&meta.primaryAction&&ACTION_TYPES.has(meta.primaryAction.type)&&typeof meta.primaryAction.label==='string'&&meta.primaryAction.label.trim();
  }

  async function loadProjectMeta(r){
    if(!r?.name)return null;
    if(metaCache.has(r.name))return metaCache.get(r.name);
    if(metaPromises.has(r.name))return metaPromises.get(r.name);
    const promise=fetch(metaUrl(r),{cache:'no-store'})
      .then(async response=>{
        if(response.status===404)return null;
        if(!response.ok)throw new Error(`project.json ${response.status}`);
        const meta=await response.json();
        if(!validMeta(meta)){
          console.warn(`[Portfolio] Invalid project.json for ${r.name}`);
          return null;
        }
        return meta;
      })
      .catch(()=>null)
      .then(meta=>{
        metaCache.set(r.name,meta);
        metaPromises.delete(r.name);
        return meta;
      });
    metaPromises.set(r.name,promise);
    return promise;
  }

  function globRegex(pattern='*'){
    const escaped=String(pattern).replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.');
    return new RegExp(`^${escaped}$`,'i');
  }

  async function latestReleaseTarget(r,pattern){
    const key=`${r.name}:${pattern||'*'}`;
    if(releasePromises.has(key))return releasePromises.get(key);
    const promise=fetch(`https://api.github.com/repos/${USER}/${encodeURIComponent(r.name)}/releases/latest`,{headers:{Accept:'application/vnd.github+json'}})
      .then(async response=>{
        if(!response.ok)return null;
        const release=await response.json();
        const assets=Array.isArray(release.assets)?release.assets:[];
        const matcher=pattern?globRegex(pattern):null;
        const asset=matcher?assets.find(item=>matcher.test(item.name||'')):assets[0];
        if(asset?.browser_download_url){
          return {href:asset.browser_download_url,version:release.tag_name||'',fileName:asset.name||'',size:asset.size||0,indirect:false};
        }
        if(release.html_url)return {href:release.html_url,version:release.tag_name||'',fileName:'',size:0,indirect:true};
        return null;
      })
      .catch(()=>null);
    releasePromises.set(key,promise);
    return promise;
  }

  async function resolvePrimaryAction(r,meta){
    if(!meta?.primaryAction){
      const live=site(r);
      return live
        ? {type:'website',label:'Открыть сайт',href:live}
        : {type:'github',label:'GitHub',href:r.html_url};
    }

    const action=meta.primaryAction;
    if(action.type==='details')return {type:'details',label:action.label||'Подробнее',href:''};
    if(action.type==='github')return {type:'github',label:action.label||'GitHub',href:action.url||r.html_url};

    if(action.type==='website'){
      let href='';
      if(action.url)href=action.url;
      else if(action.source==='homepage')href=String(r.homepage||'').trim();
      else if(action.source==='github-pages')href=site(r)||pagesUrl(r);
      else if(action.source==='repository')href=r.html_url;
      else href=site(r);
      return {type:'website',label:action.label||'Открыть сайт',href:href||r.html_url};
    }

    if(action.type==='download'){
      if(action.source==='github-release'){
        const release=await latestReleaseTarget(r,action.assetPattern);
        if(release)return {type:'download',label:action.label||'Скачать',...release};
        return {type:'download',label:action.label||'Скачать',href:`https://github.com/${USER}/${encodeURIComponent(r.name)}/releases`,indirect:true};
      }
      const href=action.url||(
        action.source==='repository' ? r.html_url :
        action.source==='homepage' ? String(r.homepage||'').trim() : ''
      );
      return {type:'download',label:action.label||'Скачать',href:href||r.html_url,indirect:!action.url};
    }

    return {type:'details',label:'Подробнее',href:''};
  }

  function actionAnchor(action,className){
    if(!action||action.type==='details'||!action.href)return'';
    const glyph=action.type==='download'?'↓':'↗';
    const title=action.version?`${action.label} · ${action.version}`:action.label;
    return `<a class="${esc(className)} ${action.type==='download'?'download':''}" href="${esc(action.href)}" target="_blank" rel="noreferrer" data-action-type="${esc(action.type)}" data-action-label="${esc(action.label)}" title="${esc(title)}">${esc(action.label)} <span>${glyph}</span></a>`;
  }

  function readCachedRepos(){
    try{
      const cached=JSON.parse(localStorage.getItem('deenfoool-repos')||'null');
      return cleanRepos(cached?.data);
    }catch{return[];}
  }

  function isFeatured(r,meta){
    return typeof meta?.featured==='boolean'?meta.featured:topicFeatured(r);
  }

  function featuredCard(r,meta){
    const img=cover(r);
    const tags=(Array.isArray(meta?.tags)&&meta.tags.length?meta.tags:visibleTopics(r)).slice(0,3);
    const title=meta?.title||r.name;
    const desc=meta?.tagline||r.description||'Проект из моего GitHub — открой карточку, чтобы посмотреть подробнее.';
    return `<article class="featured-card" data-repo="${esc(r.name)}">
      <button class="featured-media" type="button" data-project-detail="${esc(r.name)}">
        <img src="${esc(img.custom)}" alt="${esc(title)}" loading="lazy" onerror="this.onerror=null;this.src='${esc(img.fallback)}'">
        <span class="featured-badge">FEATURED</span>
      </button>
      <div class="featured-body">
        <div class="featured-kicker">${esc(r.language||meta?.kind||'Project')} · ${rel(r.updated_at)}</div>
        <button class="featured-title" type="button" data-project-detail="${esc(r.name)}">${esc(title)} <span>↗</span></button>
        <p>${esc(desc)}</p>
        ${tags.length?`<div class="featured-topics">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}
        <div class="featured-actions">
          <button class="button primary" type="button" data-project-detail="${esc(r.name)}">Подробнее <span>→</span></button>
          <span class="featured-action-slot"></span>
        </div>
      </div>
    </article>`;
  }

  async function renderFeatured(){
    if(!featuredGrid)return;
    const request=++featuredRenderRequest;
    const entries=await Promise.all(repos.map(async r=>({r,meta:await loadProjectMeta(r)})));
    if(request!==featuredRenderRequest)return;
    const pinned=entries.filter(({r,meta})=>isFeatured(r,meta));
    const list=(pinned.length?pinned:entries).slice(0,3);
    featuredGrid.innerHTML=list.length?list.map(({r,meta})=>featuredCard(r,meta)).join(''):'<div class="loading-card">Пока нет проектов для показа.</div>';

    await Promise.all(Array.from(featuredGrid.querySelectorAll('.featured-card')).map(async card=>{
      const entry=list.find(item=>item.r.name===card.dataset.repo);
      if(!entry)return;
      const action=await resolvePrimaryAction(entry.r,entry.meta);
      const slot=card.querySelector('.featured-action-slot');
      if(slot)slot.innerHTML=action.type==='details'?'':actionAnchor(action,'button ghost meta-primary-action');
    }));
  }

  function repoFromHref(href){
    try{return decodeURIComponent(new URL(href).pathname.split('/').filter(Boolean).pop()||'')}catch{return'';}
  }

  async function hydrateProjectCard(card,name){
    if(!card||card.dataset.metadataLoaded)return;
    card.dataset.metadataLoaded='1';
    const r=await ensureRepo(name);
    if(!r)return;
    const meta=await loadProjectMeta(r);
    if(!meta)return;

    const strong=card.querySelector('.project-title strong');
    if(strong&&meta.title)strong.textContent=meta.title;
    const desc=card.querySelector('.project-desc');
    if(desc&&meta.tagline)desc.textContent=meta.tagline;

    const actions=card.querySelector('.project-actions');
    if(!actions)return;
    actions.querySelectorAll('.project-action.site,.project-action.meta-action').forEach(el=>el.remove());
    const action=await resolvePrimaryAction(r,meta);
    if(action.type!=='details'&&action.type!=='github'){
      actions.insertAdjacentHTML('beforeend',actionAnchor(action,`project-action meta-action ${action.type==='website'?'site':''}`));
    }
  }

  function enhanceProjectCards(){
    if(!projectsGrid)return;
    projectsGrid.querySelectorAll('.project').forEach(card=>{
      const title=card.querySelector('.project-title strong')?.textContent?.trim();
      const githubLink=card.querySelector('a[href*="github.com/Deenfoool/"]');
      const name=card.dataset.projectName||title||repoFromHref(githubLink?.href||'');
      if(!name)return;

      card.dataset.projectName=name;
      if(!card.dataset.enhanced){
        card.dataset.enhanced='1';
        const actions=card.querySelector('.project-actions');
        if(actions&&!actions.querySelector('[data-project-detail]')){
          actions.insertAdjacentHTML('afterbegin',`<button class="project-action details" type="button" data-project-detail="${esc(name)}">Подробнее <span>→</span></button>`);
        }
      }
      hydrateProjectCard(card,name);
    });
  }

  function galleryCandidates(r){
    const branch=r.default_branch||'main';
    const base=`https://raw.githubusercontent.com/${USER}/${r.name}/${encodeURIComponent(branch)}/portfolio`;
    return [
      `${base}/cover.png`,
      ...Array.from({length:10},(_,i)=>`${base}/gallery/${String(i+1).padStart(2,'0')}.png`)
    ];
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

  async function loadGallery(r,title=r.name){
    const id=++galleryRequest;
    gallery=[];
    galleryIndex=0;
    galleryImage.removeAttribute('src');
    galleryLoading.hidden=false;
    updateGallery(title);
    const found=(await Promise.all(galleryCandidates(r).map(probe))).filter(Boolean);
    if(id!==galleryRequest)return;
    gallery=found.length?found:[cover(r).fallback];
    galleryLoading.hidden=true;
    updateGallery(title);
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

  function formatLabel(meta,r){
    if(!meta)return site(r)?'Live project':'Open source';
    const kind=KIND_LABELS[meta.kind]||'Project';
    const status=STATUS_LABELS[meta.status]||'';
    return status?`${kind} · ${status}`:kind;
  }

  async function openModal(name){
    const r=await ensureRepo(name);
    if(!r)return;
    const meta=await loadProjectMeta(r);
    const title=meta?.title||r.name;
    const tags=(Array.isArray(meta?.tags)&&meta.tags.length?meta.tags:visibleTopics(r));
    const action=await resolvePrimaryAction(r,meta);

    document.querySelector('#modal-title').textContent=title;
    document.querySelector('#modal-description').textContent=meta?.tagline||r.description||'Описание проекта пока не добавлено в GitHub. Можно перейти в репозиторий или открыть живую версию проекта.';
    document.querySelector('#modal-language').textContent=r.language||'—';
    document.querySelector('#modal-updated').textContent=rel(r.updated_at);
    document.querySelector('#modal-stars').textContent=String(r.stargazers_count||0);
    document.querySelector('#modal-format').textContent=formatLabel(meta,r);
    document.querySelector('#modal-topics').innerHTML=tags.length?tags.map(t=>`<span>${esc(t)}</span>`).join(''):'<span>GitHub project</span>';

    const githubAction={type:'github',label:'GitHub',href:r.html_url};
    let actionsHtml='';
    if(action.type==='github')actionsHtml=actionAnchor({...action,label:action.label||'GitHub'},'button primary');
    else if(action.type==='details')actionsHtml=actionAnchor(githubAction,'button ghost');
    else actionsHtml=`${actionAnchor(action,'button primary meta-primary-action')}${actionAnchor(githubAction,'button ghost')}`;
    document.querySelector('#modal-actions').innerHTML=actionsHtml;

    modal.hidden=false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(()=>modal.classList.add('open'));
    document.querySelector('.modal-close')?.focus({preventScroll:true});
    loadGallery(r,title);
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
  if(repos.length){renderFeatured();enhanceProjectCards();}

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
