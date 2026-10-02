(() => {
  const USER='Deenfoool';
  const SCHEMA_URL='https://raw.githubusercontent.com/Deenfoool/portfolio/main/schemas/project.schema.json';
  const ACTION_TYPES=new Set(['website','download','github','details']);
  const KINDS=new Set(['web','app','game','mod','tool','service','library','plugin','other']);
  const STATUSES=new Set(['active','released','experimental','paused','archived']);
  const ACTION_SOURCES=new Set(['homepage','github-pages','github-release','direct','repository']);
  const META_KEYS=new Set(['$schema','version','title','tagline','kind','status','featured','tags','primaryAction']);
  const ACTION_KEYS=new Set(['type','label','source','url','assetPattern']);
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

  const releasePromises=new Map();
  let repos=[];
  let gallery=[];
  let galleryIndex=0;
  let galleryRequest=0;
  let featuredRenderRequest=0;

  const esc=(v='')=>String(v).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const rel=date=>{
    const d=Math.max(0,Math.floor((Date.now()-new Date(date))/86400000));
    if(d===0)return'сегодня';
    if(d===1)return'вчера';
    if(d<30)return`${d} дн. назад`;
    const m=Math.floor(d/30);
    return m<12?`${m} мес. назад`:new Intl.DateTimeFormat('ru-RU',{month:'short',year:'numeric'}).format(new Date(date));
  };
  const topics=r=>Array.isArray(r.topics)?r.topics:[];
  const visibleTopics=r=>topics(r).filter(t=>t.toLowerCase()!=='featured');

  function isPlainObject(value){
    return !!value&&typeof value==='object'&&!Array.isArray(value);
  }

  function hasOnlyKeys(value,allowed){
    return Object.keys(value).every(key=>allowed.has(key));
  }

  function validUri(value){
    if(typeof value!=='string'||!value.trim())return false;
    try{new URL(value);return true;}catch{return false;}
  }

  function validMeta(meta){
    if(!isPlainObject(meta)||!hasOnlyKeys(meta,META_KEYS))return false;
    if(meta.$schema!==undefined&&meta.$schema!==SCHEMA_URL)return false;
    if(meta.version!==1)return false;
    if(typeof meta.title!=='string'||!meta.title.trim())return false;
    if(meta.tagline!==undefined&&(typeof meta.tagline!=='string'||meta.tagline.length>180))return false;
    if(!KINDS.has(meta.kind))return false;
    if(!STATUSES.has(meta.status))return false;
    if(typeof meta.featured!=='boolean')return false;

    if(meta.tags!==undefined){
      if(!Array.isArray(meta.tags)||meta.tags.length>8)return false;
      if(new Set(meta.tags).size!==meta.tags.length)return false;
      if(!meta.tags.every(tag=>typeof tag==='string'&&tag.length>=1&&tag.length<=32))return false;
    }

    const action=meta.primaryAction;
    if(!isPlainObject(action)||!hasOnlyKeys(action,ACTION_KEYS))return false;
    if(!ACTION_TYPES.has(action.type))return false;
    if(typeof action.label!=='string'||!action.label.trim()||action.label.length>48)return false;
    if(action.source!==undefined&&!ACTION_SOURCES.has(action.source))return false;
    if(action.url!==undefined&&!validUri(action.url))return false;
    if(action.assetPattern!==undefined&&(
      typeof action.assetPattern!=='string'||
      action.assetPattern.length<1||
      action.assetPattern.length>120
    ))return false;

    return true;
  }

  const cleanRepos=data=>(Array.isArray(data)?data:[]).filter(r=>validMeta(r?.portfolioMeta));
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

  function isFeatured(meta){
    return meta?.featured===true;
  }

  function globRegex(pattern='*'){
    const escaped=String(pattern).replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.');
    return new RegExp(`^${escaped}$`,'i');
  }

  async function latestReleaseTarget(r,pattern){
    const key=`${r.name}:${pattern||'*'}`;
    if(releasePromises.has(key))return releasePromises.get(key);

    const promise=fetch(`https://api.github.com/repos/${USER}/${encodeURIComponent(r.name)}/releases/latest`,{
      headers:{Accept:'application/vnd.github+json'}
    })
      .then(async response=>{
        if(!response.ok)return null;
        const release=await response.json();
        const assets=Array.isArray(release.assets)?release.assets:[];
        const matcher=pattern?globRegex(pattern):null;
        const asset=matcher?assets.find(item=>matcher.test(item.name||'')):assets[0];

        if(asset?.browser_download_url){
          return {
            href:asset.browser_download_url,
            version:release.tag_name||'',
            fileName:asset.name||'',
            size:asset.size||0,
            indirect:false
          };
        }
        if(release.html_url){
          return {href:release.html_url,version:release.tag_name||'',fileName:'',size:0,indirect:true};
        }
        return null;
      })
      .catch(()=>null);

    releasePromises.set(key,promise);
    return promise;
  }

  async function resolvePrimaryAction(r,meta){
    const action=meta.primaryAction;

    if(action.type==='details')return {type:'details',label:action.label,href:''};
    if(action.type==='github')return {type:'github',label:action.label,href:action.url||r.html_url};

    if(action.type==='website'){
      let href='';
      if(action.url)href=action.url;
      else if(action.source==='homepage')href=String(r.homepage||'').trim();
      else if(action.source==='github-pages')href=site(r)||pagesUrl(r);
      else if(action.source==='repository')href=r.html_url;
      else href=site(r);
      return {type:'website',label:action.label,href:href||r.html_url};
    }

    if(action.type==='download'){
      if(action.source==='github-release'){
        const release=await latestReleaseTarget(r,action.assetPattern);
        if(release)return {type:'download',label:action.label,...release};
        return {
          type:'download',
          label:action.label,
          href:`https://github.com/${USER}/${encodeURIComponent(r.name)}/releases`,
          indirect:true
        };
      }

      const href=action.url||(
        action.source==='repository' ? r.html_url :
        action.source==='homepage' ? String(r.homepage||'').trim() : ''
      );
      return {type:'download',label:action.label,href:href||r.html_url,indirect:!action.url};
    }

    return {type:'details',label:'Подробнее',href:''};
  }

  function actionAnchor(action,className){
    if(!action||action.type==='details'||!action.href)return'';
    const glyph=action.type==='download'?'↓':'↗';
    const title=action.version?`${action.label} · ${action.version}`:action.label;
    return `<a class="${esc(className)} ${action.type==='download'?'download':''}" href="${esc(action.href)}" target="_blank" rel="noreferrer" data-action-type="${esc(action.type)}" data-action-label="${esc(action.label)}" title="${esc(title)}">${esc(action.label)} <span>${glyph}</span></a>`;
  }

  function featuredCard(r,meta){
    const img=cover(r);
    const tags=(Array.isArray(meta.tags)&&meta.tags.length?meta.tags:visibleTopics(r)).slice(0,3);
    const title=meta.title;
    const desc=meta.tagline||r.description||'Проект из моего GitHub — открой карточку, чтобы посмотреть подробнее.';

    return `<article class="featured-card" data-repo="${esc(r.name)}">
      <button class="featured-media" type="button" data-project-detail="${esc(r.name)}">
        <img src="${esc(img.custom)}" alt="${esc(title)}" loading="lazy" data-featured-cover="${esc(r.name)}" onerror="if(!this.dataset.fallbackApplied){this.dataset.fallbackApplied='1';console.warn('[Portfolio] ${esc(r.name)}: portfolio/cover.png is missing or unavailable; using GitHub OpenGraph fallback');this.src='${esc(img.fallback)}'}">
        <span class="featured-badge">FEATURED</span>
      </button>
      <div class="featured-body">
        <div class="featured-kicker">${esc(r.language||meta.kind||'Project')} · ${rel(r.updated_at)}</div>
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
    const entries=repos
      .map(r=>({r,meta:r.portfolioMeta}))
      .filter(({meta})=>validMeta(meta));

    const list=entries.filter(({meta})=>isFeatured(meta)).slice(0,3);
    if(request!==featuredRenderRequest)return;

    featuredGrid.innerHTML=list.length
      ? list.map(({r,meta})=>featuredCard(r,meta)).join('')
      : '<div class="loading-card">Избранных проектов пока нет.</div>';

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

  function findRepo(name){
    return repos.find(repo=>repo.name===name)||null;
  }

  async function hydrateProjectCard(card,name){
    if(!card||card.dataset.metadataLoaded)return;
    card.dataset.metadataLoaded='1';

    const r=findRepo(name);
    if(!r||!validMeta(r.portfolioMeta)){
      card.remove();
      return;
    }

    const meta=r.portfolioMeta;
    const strong=card.querySelector('.project-title strong');
    if(strong)strong.textContent=meta.title;
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

  const probe=url=>new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(url);
    img.onerror=()=>resolve(null);
    img.src=url;
  });

  function updateGallery(name='Project'){
    const total=gallery.length||1;
    if(gallery.length){
      galleryImage.src=gallery[galleryIndex];
      galleryImage.alt=`${name} — изображение ${galleryIndex+1}`;
    }
    galleryPrev.hidden=total<=1;
    galleryNext.hidden=total<=1;
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

    const candidates=galleryCandidates(r);
    const found=(await Promise.all(candidates.map(probe))).filter(Boolean);
    if(id!==galleryRequest)return;

    if(!found.includes(candidates[0])){
      console.warn(`[Portfolio] ${r.name}: portfolio/cover.png is missing or unavailable; modal will use GitHub OpenGraph fallback`);
    }

    gallery=found.length?found:[cover(r).fallback];
    galleryLoading.hidden=true;
    updateGallery(title);
  }

  function formatLabel(meta){
    const kind=KIND_LABELS[meta.kind]||'Project';
    const status=STATUS_LABELS[meta.status]||'';
    return status?`${kind} · ${status}`:kind;
  }

  async function openModal(name){
    const r=findRepo(name);
    if(!r||!validMeta(r.portfolioMeta))return;

    const meta=r.portfolioMeta;
    const title=meta.title;
    const tags=(Array.isArray(meta.tags)&&meta.tags.length?meta.tags:visibleTopics(r));
    const action=await resolvePrimaryAction(r,meta);

    document.querySelector('#modal-title').textContent=title;
    document.querySelector('#modal-description').textContent=meta.tagline||r.description||'Описание проекта пока не добавлено.';
    document.querySelector('#modal-language').textContent=r.language||'—';
    document.querySelector('#modal-updated').textContent=rel(r.updated_at);
    document.querySelector('#modal-stars').textContent=String(r.stargazers_count||0);
    document.querySelector('#modal-format').textContent=formatLabel(meta);
    document.querySelector('#modal-topics').innerHTML=tags.length?tags.map(t=>`<span>${esc(t)}</span>`).join(''):'<span>GitHub project</span>';

    const githubAction={type:'github',label:'GitHub',href:r.html_url};
    let actionsHtml='';
    if(action.type==='github'){
      actionsHtml=actionAnchor(action,'button primary');
    }else if(action.type==='details'){
      actionsHtml=actionAnchor(githubAction,'button ghost');
    }else{
      actionsHtml=`${actionAnchor(action,'button primary meta-primary-action')}${actionAnchor(githubAction,'button ghost')}`;
    }
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
    setTimeout(()=>{
      if(!modal.classList.contains('open'))modal.hidden=true;
    },180);
  }

  document.addEventListener('click',e=>{
    const detail=e.target.closest('[data-project-detail]');
    if(detail){
      e.preventDefault();
      openModal(detail.dataset.projectDetail);
      return;
    }

    const card=e.target.closest('#projects-grid .project');
    const coverLink=e.target.closest('#projects-grid .project-cover, #projects-grid .project-title-link');
    if(card&&coverLink){
      e.preventDefault();
      openModal(card.dataset.projectName||repoFromHref(coverLink.href));
      return;
    }

    if(e.target.closest('[data-modal-close]')){
      closeModal();
      return;
    }

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
  }

  function applyRepos(data){
    repos=cleanRepos(data);
    renderFeatured();
    enhanceProjectCards();
  }

  document.addEventListener('portfolio:repos-ready',event=>{
    applyRepos(event.detail?.repos||[]);
  });

  if(Array.isArray(window.__portfolioRepos)){
    applyRepos(window.__portfolioRepos);
  }
})();
