/* Independent colour and winter themes. Snow rests on each host (no scroll lag). */
(() => {
  'use strict';
  const root=document.documentElement;
  const themeButton=document.getElementById('theme-toggle');
  const holidayButton=document.getElementById('holiday-toggle');
  if(!themeButton||!holidayButton)return;

  const THEME_KEY='portfolio-theme-v1';
  const HOLIDAY_KEY='portfolio-holiday-v1';
  const CAP_SELECTORS=[
    '.nav','.terminal-card','.stats','.featured-card','.project',
    '.modworks-entry-card','.cta','.support-card','.project-dialog',
    '.about-content'
  ].join(',');
  const GARLAND_SELECTORS=[
    '.nav','.stats','.modworks-entry-card','.cta',
    '.featured-section .section-heading','.projects-section .section-heading',
    '.support-card'
  ].join(',');
  const SNOWY_SELECTORS='.project.snowy-theme,.featured-card.snowy-theme,.project-dialog.snowy-theme';
  const persist=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
  const select=(selector,scope=document)=>{
    const found=[];
    if(scope.matches?.(selector))found.push(scope);
    scope.querySelectorAll?.(selector).forEach(el=>found.push(el));
    return found;
  };

  const snowOverlay=document.createElement('div');
  snowOverlay.id='holiday-snow';
  snowOverlay.setAttribute('aria-hidden','true');
  snowOverlay.innerHTML='<span class="holiday-fall holiday-fall-near"></span><span class="holiday-fall holiday-fall-far"></span>';
  document.body.appendChild(snowOverlay);

  // Only the dialog has to keep its overflow/scroll box. Other snow caps
  // are children of their cards, inheriting CSS hover and scroll transforms.
  const dialogCaps=document.createElement('div');
  dialogCaps.id='holiday-dialog-caps';
  dialogCaps.setAttribute('aria-hidden','true');
  document.body.appendChild(dialogCaps);

  const caps=new Map();
  let capSequence=0;
  const SVG_NS='http://www.w3.org/2000/svg';
  const hashSeed=text=>{
    let hash=2166136261;
    for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
    return hash>>>0;
  };
  const randomFrom=seed=>{
    let x=seed||1;
    return ()=>{
      x^=x<<13;x^=x>>>17;x^=x<<5;
      return (x>>>0)/4294967296;
    };
  };
  const heightFor=(host,rand)=>{
    const base=host.matches('.nav,.stats')?15:
      host.matches('.project,.featured-card')?19:
      host.matches('.project-dialog')?19:
      host.matches('.modworks-entry-card,.cta,.support-card')?22:18;
    return base+Math.round((rand()-.5)*6);
  };
  function createCap(host){
    const name=host.dataset.projectName||
      host.querySelector?.('[data-project-detail]')?.dataset.projectDetail||
      host.className||host.tagName;
    const rand=randomFrom(hashSeed(String(name)+':'+(++capSequence)));
    const cap=document.createElementNS(SVG_NS,'svg');
    cap.classList.add('holiday-cap');
    cap.setAttribute('viewBox','0 0 1000 26');
    cap.setAttribute('preserveAspectRatio','none');
    cap.setAttribute('aria-hidden','true');
    cap.setAttribute('focusable','false');
    cap.style.setProperty('--cap-height',heightFor(host,rand)+'px');

    // Shallow corners, softly uneven drifts in the middle. Each host gets
    // its own stable shape and thickness, rather than a repeated bitmap.
    const points=[];
    const count=12;
    for(let i=0;i<=count;i++){
      const edge=i===0||i===count;
      points.push({x:1000*i/count,
        y:edge?21+rand()*2:7+rand()*14});
    }
    let outline='M 0 26 L '+points[0].x+' '+points[0].y;
    for(let i=0;i<points.length-1;i++){
      const prev=points[Math.max(0,i-1)];
      const a=points[i],b=points[i+1];
      const next=points[Math.min(points.length-1,i+2)];
      const c1x=a.x+(b.x-prev.x)/6;
      const c1y=a.y+(b.y-prev.y)/6;
      const c2x=b.x-(next.x-a.x)/6;
      const c2y=b.y-(next.y-a.y)/6;
      outline+=' C '+c1x.toFixed(1)+' '+c1y.toFixed(1)+
        ' '+c2x.toFixed(1)+' '+c2y.toFixed(1)+
        ' '+b.x.toFixed(1)+' '+b.y.toFixed(1);
    }
    outline+=' L 1000 26 Z';
    const fill=document.createElementNS(SVG_NS,'path');
    fill.setAttribute('d',outline);
    fill.setAttribute('fill','#f8fcff');
    fill.setAttribute('stroke','#e6f3fa');
    fill.setAttribute('stroke-width','1.8');
    cap.appendChild(fill);
    return cap;
  }
  const wantsCap=host=>root.dataset.holiday==='on'||host.matches(SNOWY_SELECTORS);
  function ensureCap(host){
    if(caps.has(host))return;
    const cap=createCap(host);
    host.classList.add('holiday-cap-host');
    (host.matches('.project-dialog')?dialogCaps:host).appendChild(cap);
    caps.set(host,cap);
  }
  function pruneCaps(){
    for(const [host,cap] of caps){
      if(host.isConnected&&wantsCap(host))continue;
      cap.remove();
      host.classList.remove('holiday-cap-host');
      caps.delete(host);
    }
  }

  // The one exceptional cap follows the modal's entrance animation.
  // Page cards need no position polling at all.
  const projectModal=document.getElementById('project-modal');
  const dialog=projectModal?.querySelector('.project-dialog');
  let dialogFrame=0,dialogFollowUntil=0;
  function positionDialogCap(now){
    dialogFrame=0;
    if(!dialog||!caps.has(dialog))return;
    const cap=caps.get(dialog);
    const box=dialog.getBoundingClientRect();
    const height=parseFloat(cap.style.getPropertyValue('--cap-height'))||19;
    const visible=!projectModal.hidden&&box.width>0&&box.height>0;
    cap.hidden=!visible;
    if(visible){
      cap.style.width=box.width+'px';
      cap.style.height=height+'px';
      cap.style.transform='translate3d('+box.left+'px,'+(box.top-height+2)+'px,0)';
    }
    if(now<dialogFollowUntil&&!document.hidden){
      dialogFrame=requestAnimationFrame(positionDialogCap);
    }
  }
  function followDialog(ms=450){
    if(!dialog||!caps.has(dialog)||document.hidden)return;
    if(projectModal.hidden){caps.get(dialog).hidden=true;return;}
    dialogFollowUntil=Math.max(dialogFollowUntil,performance.now()+ms);
    if(!dialogFrame)dialogFrame=requestAnimationFrame(positionDialogCap);
  }
  function syncCaps(scope=document){
    if(root.dataset.holiday==='on')select(CAP_SELECTORS,scope).forEach(ensureCap);
    select(SNOWY_SELECTORS,scope).forEach(ensureCap);
    pruneCaps();
    followDialog();
  }
  function decorate(scope=document){
    if(root.dataset.holiday==='on'){
      select(GARLAND_SELECTORS,scope).forEach(host=>{
        if([...host.children].some(el=>el.classList.contains('holiday-garland')))return;
        host.classList.add('holiday-host');
        const lights=document.createElement('span');
        lights.className='holiday-garland';
        lights.setAttribute('aria-hidden','true');
        host.appendChild(lights);
      });
    }
    syncCaps(scope);
  }

  function applyTheme(value){
    const light=value==='light';
    root.dataset.theme=light?'light':'dark';
    themeButton.setAttribute('aria-pressed',String(light));
    themeButton.setAttribute('aria-label',light?'Включить тёмную тему':'Включить светлую тему');
    themeButton.title=light?'Переключить на ночь':'Переключить на день';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',light?'#f2f6f1':'#09090b');
    persist(THEME_KEY,root.dataset.theme);
  }
  function applyHoliday(enabled){
    root.dataset.holiday=enabled?'on':'off';
    holidayButton.setAttribute('aria-pressed',String(enabled));
    holidayButton.setAttribute('aria-label',enabled?'Выключить новогоднюю тему':'Включить новогоднюю тему');
    holidayButton.title=enabled?'Выключить снег и гирлянды':'Включить снег и гирлянды';
    snowOverlay.hidden=!enabled;
    if(enabled)decorate();
    else{
      document.querySelectorAll('.holiday-garland').forEach(el=>el.remove());
      document.querySelectorAll('.holiday-host').forEach(el=>el.classList.remove('holiday-host'));
      syncCaps(); // Standalone Snowy New Year keeps its own snowy edge.
    }
    persist(HOLIDAY_KEY,enabled?'on':'off');
  }
  themeButton.addEventListener('click',()=>applyTheme(root.dataset.theme==='light'?'dark':'light'));
  holidayButton.addEventListener('click',()=>applyHoliday(root.dataset.holiday!=='on'));
  applyTheme(root.dataset.theme);
  applyHoliday(root.dataset.holiday==='on');

  // GitHub API refreshes cards: attach to each new card, not to the viewport.
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='attributes'){
        if(record.target===dialog)decorate(dialog);
        else followDialog();
        continue;
      }
      for(const node of record.addedNodes){
        if(node.nodeType===1)decorate(node);
      }
    }
    pruneCaps();
  });
  ['projects-grid','featured-grid'].forEach(id=>{
    const grid=document.getElementById(id);
    if(grid)observer.observe(grid,{childList:true});
  });
  if(projectModal)observer.observe(projectModal,{attributes:true,attributeFilter:['hidden','class']});
  if(dialog){
    observer.observe(dialog,{attributes:true,attributeFilter:['class']});
    dialog.addEventListener('transitionrun',()=>followDialog(500));
    dialog.addEventListener('transitionend',()=>followDialog(100));
  }
  window.addEventListener('resize',()=>followDialog(400),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)followDialog(500)});
  decorate();
})();