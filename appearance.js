/* Independent colour and winter themes. Snow rests on each host (no scroll lag). */
(() => {
  'use strict';
  const root=document.documentElement;
  const themeButton=document.getElementById('theme-toggle');
  const holidayButton=document.getElementById('holiday-toggle');
  const flyout=document.getElementById('holiday-settings');
  const snowfallButton=document.getElementById('snowfall-toggle');
  const snowcapsButton=document.getElementById('snowcaps-toggle');
  if(!themeButton||!holidayButton||!flyout||!snowfallButton||!snowcapsButton)return;

  const THEME_KEY='portfolio-theme-v1';
  const HOLIDAY_KEY='portfolio-holiday-v1';
  const SNOW_KEY='portfolio-holiday-snow-v1';
  const CAPS_KEY='portfolio-holiday-caps-v1';
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  let desiredHoliday=root.dataset.holiday==='on';
  let transitionCounter=0;
  let transitionTimer=0;
  let burst=null;
  const CAP_SELECTORS=[
    '.nav','.terminal-card','.stats','.featured-card','.project',
    '.modworks-entry-card','.cta','.support-card','.project-dialog',
    '.about-content'
  ].join(',');
  // Only real framed sections, not the "All projects" heading or CTA.
  const GARLAND_SELECTORS=[
    '.nav','.stats','.modworks-entry-card','.support-card'
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
  const wantsCap=host=>root.dataset.holiday==='on'
    ?root.dataset.holidayCaps!=='off'
    :host.matches(SNOWY_SELECTORS);
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


  // Generate one wire for the exact host width. Every arch starts AND ends
  // at the block's bottom edge; no repeated bitmap can land mid-wave.
  const GARLAND_HEIGHT=52;
  const GARLAND_COLORS=['red','gold','blue','green'];
  const garlands=new Map();
  const garlandWidths=new WeakMap();
  const garlandObserver=typeof ResizeObserver==='function'
    ?new ResizeObserver(entries=>{
      for(const entry of entries){
        const host=entry.target,lights=garlands.get(host);
        if(lights)renderGarland(host,lights);
      }
    }):null;

  function renderGarland(host,lights){
    const width=Math.max(0,Math.round(host.clientWidth||host.getBoundingClientRect().width));
    if(width<20||garlandWidths.get(lights)===width)return;
    garlandWidths.set(lights,width);
    const waves=Math.max(1,Math.round(width/230));
    const segment=width/waves;
    const rope=['M 0 2'];
    for(let i=0;i<waves;i++){
      const start=i*segment,mid=start+segment/2,end=(i+1)*segment;
      // Two cubic halves: horizontal tangent at every attachment point,
      // never a sharp peak at the ends of neighbouring waves.
      rope.push('C '+(start+segment/6).toFixed(2)+' 2 '+
        (start+segment/3).toFixed(2)+' 31 '+mid.toFixed(2)+' 31');
      rope.push('C '+(mid+segment/6).toFixed(2)+' 31 '+
        (mid+segment/3).toFixed(2)+' 2 '+end.toFixed(2)+' 2');
    }
    const bulbCount=Math.max(4,Math.round(width/43));
    const bulbs=[];
    for(let i=0;i<bulbCount;i++){
      const x=(i+.5)*width/bulbCount;
      const wave=Math.min(waves-1,Math.floor(x/segment));
      const t=(x-wave*segment)/segment;
      const phase=t<=.5?2*t:2*(1-t);
      const ease=phase*phase*(3-2*phase);
      const y=2+29*ease;
      const color=GARLAND_COLORS[i%GARLAND_COLORS.length];
      bulbs.push('<g class="garland-bulb garland-'+color+'" transform="translate('+
        x.toFixed(2)+' '+y.toFixed(2)+')">'+
        '<path d="M0 0v4" stroke="#36553c" stroke-width="1.8"/>'+
        '<rect x="-3.5" y="3" width="7" height="3.5" rx="1.1" fill="#36533b"/>'+
        '<ellipse class="garland-halo" cx="0" cy="11" rx="10" ry="10"/>'+
        '<ellipse class="garland-glass" cx="0" cy="10.3" rx="3.5" ry="4.8"/>'+
        '<ellipse cx="-1.2" cy="8.7" rx=".75" ry="1.3" fill="#fff" opacity=".78"/>'+
        '</g>');
    }
    lights.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" '+
      'viewBox="0 0 '+width+' '+GARLAND_HEIGHT+'" preserveAspectRatio="none" '+
      'aria-hidden="true" focusable="false">'+
      '<path d="'+rope.join(' ')+'" fill="none" stroke="#21392a" stroke-width="3" />'+
      '<path d="'+rope.join(' ')+'" fill="none" stroke="#517b56" stroke-width="1.1"/>'+
      bulbs.join('')+'</svg>';
  }
  function ensureGarland(host){
    if(garlands.has(host))return;
    host.classList.add('holiday-host');
    const lights=document.createElement('span');
    lights.className='holiday-garland';
    lights.setAttribute('aria-hidden','true');
    host.appendChild(lights);
    garlands.set(host,lights);
    renderGarland(host,lights);
    garlandObserver?.observe(host);
  }
  function clearGarlands(){
    for(const [host,lights] of garlands){
      garlandObserver?.unobserve(host);
      lights.remove();
      host.classList.remove('holiday-host');
    }
    garlands.clear();
  }
  function pruneGarlands(){
    for(const [host,lights] of garlands){
      if(root.dataset.holiday==='on' && host.isConnected && host.matches(GARLAND_SELECTORS))continue;
      garlandObserver?.unobserve(host);
      lights.remove();
      host.classList.remove('holiday-host');
      garlands.delete(host);
    }
  }

  const projectModal=document.getElementById('project-modal');
  const dialog=projectModal?.querySelector('.project-dialog');
  function syncCaps(scope=document){
    if(root.dataset.holiday==='on'&&root.dataset.holidayCaps!=='off')
      select(CAP_SELECTORS,scope).forEach(ensureCap);
    if(root.dataset.holiday==='off')
      select(SNOWY_SELECTORS,scope).forEach(ensureCap);
    pruneCaps();
  }
  function decorate(scope=document){
    if(root.dataset.holiday==='on')
      select(GARLAND_SELECTORS,scope).forEach(ensureGarland);
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
  function syncSubcontrols(){
    const on=desiredHoliday;
    holidayButton.setAttribute('aria-pressed',String(on));
    holidayButton.setAttribute('aria-expanded',String(on));
    holidayButton.setAttribute('aria-label',on?'Выключить новогоднюю тему':'Включить новогоднюю тему');
    holidayButton.title=on?'Выключить новогоднюю тему':'Включить новогоднюю тему';
    flyout.hidden=!on;
    const snowOn=root.dataset.holidaySnow!=='off';
    const capsOn=root.dataset.holidayCaps!=='off';
    snowfallButton.setAttribute('aria-pressed',String(snowOn));
    snowfallButton.setAttribute('aria-label',snowOn?'Выключить снегопад':'Включить снегопад');
    document.getElementById('snowfall-state').textContent=snowOn?'Вкл.':'Выкл.';
    snowcapsButton.setAttribute('aria-pressed',String(capsOn));
    snowcapsButton.setAttribute('aria-label',capsOn?'Выключить снежные шапки':'Включить снежные шапки');
    document.getElementById('snowcaps-state').textContent=capsOn?'Вкл.':'Выкл.';
  }
  function syncSnowfall(){
    snowOverlay.hidden=root.dataset.holiday!=='on'||root.dataset.holidaySnow==='off';
  }
  function setSnowfall(enabled){
    root.dataset.holidaySnow=enabled?'on':'off';
    persist(SNOW_KEY,root.dataset.holidaySnow);
    syncSnowfall();
    syncSubcontrols();
  }
  function setCaps(enabled){
    root.dataset.holidayCaps=enabled?'on':'off';
    persist(CAPS_KEY,root.dataset.holidayCaps);
    syncCaps();
    syncSubcontrols();
  }
  function setDecorDelay(host){
    const rect=host.getBoundingClientRect();
    const width=Math.max(1,window.innerWidth),height=Math.max(1,window.innerHeight);
    const fromX=width-42,fromY=85;
    const x=Math.max(0,Math.min(width,rect.left+rect.width/2));
    const y=Math.max(0,Math.min(height,rect.top+Math.min(rect.height,80)/2));
    const progress=Math.hypot(x-fromX,y-fromY)/Math.hypot(width,height);
    host.style.setProperty('--winter-delay',Math.round(progress*600)+'ms');
  }
  function stageDecorDelays(){
    document.querySelectorAll('.holiday-cap,.holiday-garland').forEach(el=>{
      setDecorDelay(el.classList.contains('holiday-cap')&&el.parentElement?.classList.contains('project-dialog-frame')
        ?el.parentElement:el.parentElement||el);
      const delay=(el.parentElement?.style.getPropertyValue('--winter-delay')||'0ms');
      el.style.setProperty('--winter-delay',delay);
    });
  }
  function endBurst(token){
    if(token!==transitionCounter)return;
    if(transitionTimer){clearTimeout(transitionTimer);transitionTimer=0;}
    burst?.remove();
    burst=null;
    root.classList.remove('holiday-entering','holiday-exiting');
    if(!desiredHoliday){
      root.dataset.holiday='off';
      clearGarlands();
      syncCaps();
    }else{
      root.dataset.holiday='on';
      decorate();
    }
    syncSnowfall();
  }
  function runBurst(kind){
    const token=++transitionCounter;
    if(transitionTimer)clearTimeout(transitionTimer);
    burst?.remove();
    root.classList.remove('holiday-entering','holiday-exiting');
    if(reducedMotion){
      endBurst(token);
      return;
    }
    const rect=holidayButton.getBoundingClientRect();
    burst=document.createElement('div');
    burst.id='holiday-transition';
    burst.className='holiday-transition-'+kind;
    burst.setAttribute('aria-hidden','true');
    burst.style.setProperty('--burst-x',(rect.left+rect.width/2)+'px');
    burst.style.setProperty('--burst-y',(rect.top+rect.height/2)+'px');
    document.body.appendChild(burst);
    root.classList.add(kind==='cold'?'holiday-entering':'holiday-exiting');
    stageDecorDelays();
    burst.addEventListener('animationend',event=>{
      // Pseudo-element animationend events may arrive before the layer's own.
      if(event.target===burst&&!event.pseudoElement)endBurst(token);
    });
    transitionTimer=setTimeout(()=>endBurst(token),1400);
  }
  function applyHoliday(enabled,animated=false){
    desiredHoliday=enabled;
    if(enabled){
      root.dataset.holiday='on';
      decorate();
      syncSnowfall();
      if(animated)runBurst('cold');
      else endBurst(++transitionCounter);
    }else if(animated){
      // Keep ornaments long enough for the warm front to sweep them away.
      runBurst('warm');
    }else{
      endBurst(++transitionCounter);
    }
    persist(HOLIDAY_KEY,enabled?'on':'off');
    syncSubcontrols();
  }
  themeButton.addEventListener('click',()=>applyTheme(root.dataset.theme==='light'?'dark':'light'));
  holidayButton.addEventListener('click',()=>applyHoliday(!desiredHoliday,true));
  snowfallButton.addEventListener('click',()=>setSnowfall(root.dataset.holidaySnow==='off'));
  snowcapsButton.addEventListener('click',()=>setCaps(root.dataset.holidayCaps==='off'));
  applyTheme(root.dataset.theme);
  applyHoliday(desiredHoliday,false);

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
    pruneGarlands();
  });
  ['projects-grid','featured-grid'].forEach(id=>{
    const grid=document.getElementById(id);
    if(grid)observer.observe(grid,{childList:true});
  });
  if(projectModal)observer.observe(projectModal,{attributes:true,attributeFilter:['hidden','class']});
  if(dialog)observer.observe(dialog,{attributes:true,attributeFilter:['class']});
  if(!garlandObserver)window.addEventListener('resize',()=>{
    for(const [host,lights] of garlands)renderGarland(host,lights);
  },{passive:true});
  decorate();
})();