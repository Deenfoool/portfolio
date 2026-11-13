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
  // The dialog has its own unclipped frame; caps for every block now
  // belong to the same moving DOM subtree as their host.
  const caps=new Map();
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
      host.matches('.project-dialog')?18:
      host.matches('.modworks-entry-card,.cta,.support-card')?21:17;
    return base+Math.round((rand()-.5)*4);
  };
  const capKey=host=>{
    const kind=CAP_SELECTORS.split(',').find(sel=>host.matches(sel))||host.tagName.toLowerCase();
    const project=host.dataset.projectName||
      host.querySelector?.('[data-project-detail]')?.dataset.projectDetail||
      host.closest?.('[data-project-name]')?.dataset.projectName||'';
    return kind+':'+project;
  };
  function createCap(host){
    // A stable hash means each project keeps its own varied shape across
    // refreshes, filtering and toggling the holiday decorations.
    const rand=randomFrom(hashSeed(capKey(host)));
    const cap=document.createElementNS(SVG_NS,'svg');
    cap.classList.add('holiday-cap');
    cap.setAttribute('viewBox','0 0 1000 26');
    cap.setAttribute('preserveAspectRatio','none');
    cap.setAttribute('aria-hidden','true');
    cap.setAttribute('focusable','false');
    cap.style.setProperty('--cap-height',heightFor(host,rand)+'px');

    // Thin edges, two to four organically spaced drifts. Cap the maximum
    // depth and fade small ripples away towards each rounded corner.
    const drifts=Array.from({length:2+Math.floor(rand()*3)},()=>({
      center:.13+rand()*.74,
      spread:.07+rand()*.14,
      amount:3+rand()*6
    }));
    const phase=rand()*Math.PI*2;
    const points=[];
    const count=28;
    for(let i=0;i<=count;i++){
      const t=i/count;
      const fade=Math.sin(Math.PI*t);
      const uneven=drifts.reduce((sum,d)=>{
        const x=(t-d.center)/d.spread;
        return sum+d.amount*Math.exp(-.5*x*x);
      },0);
      const texture=(Math.sin(t*16+phase)*.55+Math.sin(t*31-phase)*.25)*fade;
      const depth=Math.min(15,2.5+uneven+texture);
      points.push({x:1000*t,y:26-depth});
    }
    const curve='M '+points[0].x+' '+points[0].y.toFixed(2);
    let outline=curve;
    for(let i=0;i<count;i++){
      const a=points[i],b=points[i+1];
      const prev=points[Math.max(0,i-1)],next=points[Math.min(count,i+2)];
      const c1x=a.x+(b.x-prev.x)/6,c1y=a.y+(b.y-prev.y)/6;
      const c2x=b.x-(next.x-a.x)/6,c2y=b.y-(next.y-a.y)/6;
      outline+=' C '+c1x.toFixed(2)+' '+c1y.toFixed(2)+
        ' '+c2x.toFixed(2)+' '+c2y.toFixed(2)+
        ' '+b.x.toFixed(2)+' '+b.y.toFixed(2);
    }
    const snow=document.createElementNS(SVG_NS,'path');
    snow.setAttribute('d',outline+' L 1000 26 L 0 26 Z');
    snow.setAttribute('fill','#f8fcff');
    cap.appendChild(snow);
    return cap;
  }
  const wantsCap=host=>root.dataset.holiday==='on'||host.matches(SNOWY_SELECTORS);
  function ensureCap(host){
    if(caps.has(host))return;
    const cap=createCap(host);
    host.classList.add('holiday-cap-host');
    // Dialog caps are siblings of the clipped dialog inside its frame.
    (host.matches('.project-dialog')?host.parentElement:host).appendChild(cap);
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

  const projectModal=document.getElementById('project-modal');
  const dialog=projectModal?.querySelector('.project-dialog');
  function syncCaps(scope=document){
    if(root.dataset.holiday==='on')select(CAP_SELECTORS,scope).forEach(ensureCap);
    select(SNOWY_SELECTORS,scope).forEach(ensureCap);
    pruneCaps();
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
  if(dialog)observer.observe(dialog,{attributes:true,attributeFilter:['class']});
  decorate();
})();