/* Transient storm renderer. Runs only for the theme transition.
   Three depth layers, turbulent wind, airborne powder and diffuse fog.
   No external images or permanent animation loops. */
(() => {
  'use strict';
  const TAU=Math.PI*2;
  const clamp=(x,min=0,max=1)=>Math.max(min,Math.min(max,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
  const rand=(a,b)=>a+Math.random()*(b-a);
  let current=null;

  function softSprite(colour){
    const c=document.createElement('canvas');
    c.width=c.height=96;
    const g=c.getContext('2d');
    if(!g)return null;
    const gradient=g.createRadialGradient(48,48,0,48,48,48);
    gradient.addColorStop(0,colour==='warm'?'rgba(255,248,220,.76)':'rgba(255,255,255,.83)');
    gradient.addColorStop(.14,colour==='warm'?'rgba(255,225,164,.38)':'rgba(244,252,255,.40)');
    gradient.addColorStop(.44,colour==='warm'?'rgba(255,185,112,.12)':'rgba(215,240,250,.12)');
    gradient.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gradient;
    g.fillRect(0,0,96,96);
    return c;
  }
  function mistSprite(colour){
    const c=document.createElement('canvas');
    c.width=420;c.height=200;
    const g=c.getContext('2d');
    if(!g)return null;
    for(let i=0;i<15;i++){
      const x=rand(90,330),y=rand(58,142);
      const r=rand(48,130);
      const gradient=g.createRadialGradient(x,y,0,x,y,r);
      const light=colour==='warm'?'255,227,188':'234,248,255';
      gradient.addColorStop(0,'rgba('+light+','+rand(.08,.2).toFixed(3)+')');
      gradient.addColorStop(.43,'rgba('+light+',.06)');
      gradient.addColorStop(1,'rgba('+light+',0)');
      g.fillStyle=gradient;
      g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
    }
    return c;
  }
  function createParticle(width,height,depth){
    return {
      x:rand(-50,width+120),y:rand(-60,height+80),
      depth,offset:rand(-1,1),phase:rand(0,TAU),
      size:depth===0?rand(.45,.95):depth===1?rand(.8,1.8):rand(1.5,3.3),
      speed:depth===0?rand(120,260):depth===1?rand(350,630):rand(750,1130),
      opacity:depth===0?rand(.17,.36):depth===1?rand(.32,.7):rand(.38,.83),
      softness:depth===2&&Math.random()<.29
    };
  }

  function start({kind='cold',x,y,onDone}={}){
    current?.remove();
    const cold=kind!=='warm';
    const canvas=document.createElement('canvas');
    canvas.id='holiday-transition';
    canvas.setAttribute('aria-hidden','true');
    canvas.setAttribute('role','presentation');
    document.body.appendChild(canvas);
    const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
    if(!ctx){canvas.remove();return null;}

    const duration=cold?2120:1550;
    const sprite=softSprite(cold?'cold':'warm');
    const cloud=mistSprite(cold?'cold':'warm');
    const state={
      canvas,ctx,kind,live:true,frame:0,
      startAt:0,lastAt:0,duration,
      width:0,height:0,dpr:1,x:0,y:0,maxRadius:0,
      originX:x,originY:y,particles:[],
      remove(){
        if(!state.live)return;
        state.live=false;
        if(state.frame)cancelAnimationFrame(state.frame);
        window.removeEventListener('resize',resize);
        canvas.remove();
        if(current===state)current=null;
      }
    };
    current=state;

    function resize(){
      const oldW=state.width,oldH=state.height;
      state.width=Math.max(1,window.innerWidth);
      state.height=Math.max(1,window.innerHeight);
      state.dpr=Math.min(1.65,window.devicePixelRatio||1);
      canvas.width=Math.round(state.width*state.dpr);
      canvas.height=Math.round(state.height*state.dpr);
      canvas.style.width=state.width+'px';
      canvas.style.height=state.height+'px';
      ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
      state.x=clamp(state.originX??state.width-40,0,state.width);
      state.y=clamp(state.originY??85,0,state.height);
      state.maxRadius=Math.max(
        Math.hypot(state.x,state.y),Math.hypot(state.width-state.x,state.y),
        Math.hypot(state.x,state.height-state.y),
        Math.hypot(state.width-state.x,state.height-state.y)
      )+120;
      const area=clamp(state.width*state.height/(1400*850),.32,1.25);
      const quality=state.width<600?.78:1;
      const counts=cold?[330,360,115]:[95,140,38];
      if(!state.particles.length){
        counts.forEach((n,d)=>{
          for(let i=0;i<Math.round(n*area*quality);i++){
            state.particles.push(createParticle(state.width,state.height,d));
          }
        });
      }else if(oldW&&oldH){
        for(const p of state.particles){
          p.x*=state.width/oldW;p.y*=state.height/oldH;
        }
      }
    }

    function drawFog(progress,front,volume,elapsed){
      const w=state.width,h=state.height;
      // Luminous cloud front rolls outward from the toggle's exact position.
      const cloudX=state.x-front*.30;
      const cloudY=state.y+front*.16;
      const radius=Math.max(80,front*.68);
      const gradient=ctx.createRadialGradient(cloudX,cloudY,0,cloudX,cloudY,radius);
      if(cold){
        gradient.addColorStop(0,'rgba(245,252,255,'+(.26*volume).toFixed(3)+')');
        gradient.addColorStop(.5,'rgba(194,226,241,'+(.20*volume).toFixed(3)+')');
        gradient.addColorStop(1,'rgba(185,223,245,0)');
      }else{
        gradient.addColorStop(0,'rgba(255,241,204,'+(.31*volume).toFixed(3)+')');
        gradient.addColorStop(.52,'rgba(240,180,107,'+(.18*volume).toFixed(3)+')');
        gradient.addColorStop(1,'rgba(239,190,121,0)');
      }
      ctx.fillStyle=gradient;
      ctx.fillRect(0,0,w,h);

      if(cloud){
        ctx.save();
        ctx.globalAlpha=(cold?.42:.35)*volume;
        const stride=Math.max(245,w*.23);
        for(let i=0;i<6;i++){
          const dx=state.x-front*.28+(i-2.4)*stride+elapsed*(-155-i*37);
          const dy=state.y+front*.28+Math.sin(elapsed*3+i*2.4)*36+(i-2)*65;
          ctx.drawImage(cloud,dx-stride,dy-95,stride*2.5,220+i%3*42);
        }
        ctx.restore();
      }
      // Cold whiteout peaks briefly, rather than covering text for 2s.
      if(cold){
        ctx.fillStyle='rgba(216,240,249,'+(.12*volume).toFixed(3)+')';
        ctx.fillRect(0,0,w,h);
      }
    }

    function drawParticles(progress,front,volume,delta,elapsed){
      const w=state.width,h=state.height;
      const gust=1+.27*Math.sin(elapsed*9)+.13*Math.sin(elapsed*17);
      const swirl=Math.sin(elapsed*6.6)*30;
      const coldFactor=cold?1:.78;
      ctx.lineCap='round';
      for(const p of state.particles){
        const depth=p.depth;
        const vel=p.speed*coldFactor*gust;
        p.x-=vel*delta;
        p.y+=(vel*(depth===0?.31:depth===1?.25:.19)
            +Math.sin(elapsed*9+p.phase)*48+swirl*p.offset)*delta;
        p.x+=Math.sin(elapsed*7+p.phase)*9*delta;
        if(p.x< -110){
          p.x=w+rand(10,140);
          p.y=rand(-30,h+50);
        }else if(p.y>h+110){
          p.y=rand(-90,-10);
          p.x=rand(0,w+95);
        }else if(p.y< -115){
          p.y=h+rand(5,70);
        }
        const distance=Math.hypot(p.x-state.x,p.y-state.y);
        const edge=smooth((front-distance+95)/155);
        const opacity=p.opacity*volume*edge;
        if(opacity<.015)continue;
        const size=p.size;
        if(depth===0){
          ctx.fillStyle=cold
            ?'rgba(241,250,255,'+opacity.toFixed(3)+')'
            :'rgba(255,223,173,'+(opacity*.65).toFixed(3)+')';
          ctx.fillRect(p.x,p.y,size,size);
        }else if(depth===1){
          ctx.strokeStyle=cold
            ?'rgba(247,252,255,'+opacity.toFixed(3)+')'
            :'rgba(255,235,197,'+(opacity*.75).toFixed(3)+')';
          ctx.lineWidth=size*.66;
          const len=(cold?8:6)+vel*.032;
          ctx.beginPath();
          ctx.moveTo(p.x+len,p.y-len*.22);
          ctx.lineTo(p.x,p.y);ctx.stroke();
        }else{
          const len=(cold?13:9)+vel*.048;
          ctx.strokeStyle=cold
            ?'rgba(255,255,255,'+opacity.toFixed(3)+')'
            :'rgba(255,239,204,'+(opacity*.69).toFixed(3)+')';
          ctx.lineWidth=size*.75;
          ctx.beginPath();
          ctx.moveTo(p.x+len,p.y-len*.22);
          ctx.lineTo(p.x,p.y);
          ctx.stroke();
          if(p.softness&&sprite){
            ctx.globalAlpha=opacity*.55;
            ctx.drawImage(sprite,p.x-size*6,p.y-size*6,size*12,size*12);
            ctx.globalAlpha=1;
          }
        }
      }
    }

    function frame(now){
      if(!state.live)return;
      if(!state.startAt){state.startAt=now;state.lastAt=now;}
      const elapsed=(now-state.startAt)/1000;
      const progress=clamp((now-state.startAt)/duration);
      const delta=Math.min(.047,Math.max(.001,(now-state.lastAt)/1000));
      state.lastAt=now;
      const volume=smooth(progress/.13)*(1-smooth((progress-.76)/.24));
      const front=(1-Math.pow(1-clamp(progress/.68),3))*state.maxRadius;

      ctx.clearRect(0,0,state.width,state.height);
      if(volume>.001){
        drawFog(progress,front,volume,elapsed);
        drawParticles(progress,front,volume,delta,elapsed);
        if(cold&&progress>.24&&progress<.86){
          // Veils of blown powder in front of the camera: brief,
          // fluctuating density instead of flat straight CSS lines.
          const density=Math.max(0,.045+Math.sin(elapsed*11)*.018)*volume;
          const veil=ctx.createLinearGradient(state.width,0,0,state.height);
          veil.addColorStop(0,'rgba(255,255,255,'+(density*1.5).toFixed(3)+')');
          veil.addColorStop(.48,'rgba(235,247,255,'+density.toFixed(3)+')');
          veil.addColorStop(1,'rgba(241,251,255,0)');
          ctx.fillStyle=veil;ctx.fillRect(0,0,state.width,state.height);
        }
      }
      if(progress>=1){
        state.remove();
        onDone?.();
      }else{
        state.frame=requestAnimationFrame(frame);
      }
    }
    resize();
    window.addEventListener('resize',resize,{passive:true});
    state.frame=requestAnimationFrame(frame);
    return state;
  }
  window.PortfolioWeatherFront={start};
})();