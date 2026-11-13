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
      size:depth===0?rand(.45,.95):depth===1?rand(.8,1.7):
        depth===2?rand(1.4,3.1):rand(3,7.5),
      speed:depth===0?rand(120,245):depth===1?rand(350,610):
        depth===2?rand(720,1100):rand(1020,1450),
      opacity:depth===0?rand(.15,.37):depth===1?rand(.34,.69):
        depth===2?rand(.4,.84):rand(.16,.42),
      softness:depth===3||depth===2&&Math.random()<.34,
      crystal:depth===2&&Math.random()<.09,
      wobble:rand(.5,2)
    };
  }

  function start({kind='cold',x,y,onDone,duration:requestedDuration,premiere=false,variant=0}={}){
    current?.remove();
    const cold=kind!=='warm';
    const firstStorm=Boolean(cold&&premiere);
    const style=((Number(variant)||0)%3+3)%3;
    const canvas=document.createElement('canvas');
    canvas.id='holiday-transition';
    canvas.setAttribute('aria-hidden','true');
    canvas.setAttribute('role','presentation');
    document.body.appendChild(canvas);
    const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
    if(!ctx){canvas.remove();return null;}

    const duration=Number.isFinite(requestedDuration)
      ?clamp(requestedDuration,1000,3500):(cold?2260:1750);
    const sprite=softSprite(cold?'cold':'warm');
    const cloud=mistSprite(cold?'cold':'warm');
    const state={
      canvas,ctx,kind,live:true,frame:0,
      startAt:0,lastAt:0,duration,
      width:0,height:0,dpr:1,x:0,y:0,maxRadius:0,
      originX:x,originY:y,particles:[],frostSeeds:[],firstStorm,style,
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
      const area=clamp(state.width*state.height/(1400*850),.3,1.23);
      const quality=state.width<600?.64:state.width<920?.84:1;
      // The first storm has deeper whiteout; later storms alternate gust
      // directions and density, without repeating Santa or adding loops.
      const counts=!cold?[100,135,37,7]:
        firstStorm?[370,440,137,25]:
        style===0?[315,390,112,20]:
        style===1?[250,390,130,17]:[370,315,112,25];
      state.frostSeeds=Array.from({length:Math.round(20*quality)},()=>({
        x:rand(0,state.width),y:rand(0,state.height),
        size:rand(3,17),twinkle:rand(0,TAU),corner:Math.random()<.5
      }));
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
        // A brief dense whiteout only at the height of the gust.
        const whiteout=.07+(firstStorm?.085:.025);
        ctx.fillStyle='rgba(216,240,249,'+(whiteout*volume).toFixed(3)+')';
        ctx.fillRect(0,0,w,h);
      }
    }


    function drawWindBands(front,volume,elapsed){
      if(!cold||volume<.02)return;
      const w=state.width,h=state.height;
      ctx.save();
      ctx.lineCap='round';
      // Several curved strands of blowing snow rather than parallel
      // straight streaks. Bands cross the screen at different heights.
      const bands=firstStorm?9:style===1?8:6;
      for(let i=0;i<bands;i++){
        const drift=(elapsed*(220+i*42)+i*131)%(w+600);
        const x=w+270-drift;
        const y=h*(.13+i/(bands+1)*.78)+Math.sin(elapsed*3.2+i*1.7)*24;
        const edge=smooth((front-Math.hypot(x-state.x,y-state.y)+550)/600);
        const alpha=(.065+i%3*.022)*volume*edge;
        if(alpha<.005)continue;
        ctx.strokeStyle='rgba(229,247,255,'+alpha.toFixed(3)+')';
        ctx.lineWidth=i%3===0?1.65+(i%4)*.26:.85;
        ctx.beginPath();
        ctx.moveTo(x+330,y-30);
        ctx.bezierCurveTo(x+200,y+35,x-40,y-9,x-260,y+40);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFrost(progress,volume,elapsed){
      if(!cold||volume<.02)return;
      const w=state.width,h=state.height;
      // A thin, transient crystalline rim. It never remains on the site
      // once the weather-front canvas is removed.
      const frost=volume*(firstStorm?.7:.46)*
        (1-.22*Math.sin(elapsed*4.1));
      ctx.save();
      const corners=[
        [0,0,w*.18,h*.25],
        [w,0,-w*.18,h*.25],
        [0,h,w*.16,-h*.22],
        [w,h,-w*.16,-h*.22]
      ];
      for(const [x,y,dx,dy] of corners){
        const r=Math.max(100,Math.hypot(dx,dy));
        const g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,'rgba(235,250,255,'+(.15*frost).toFixed(3)+')');
        g.addColorStop(.37,'rgba(197,233,247,'+(.055*frost).toFixed(3)+')');
        g.addColorStop(1,'rgba(201,235,249,0)');
        ctx.fillStyle=g;ctx.fillRect(Math.min(x,x+dx),Math.min(y,y+dy),
          Math.abs(dx),Math.abs(dy));
      }
      ctx.lineCap='round';
      for(const seed of state.frostSeeds){
        const edgeX=seed.x<w*.5?0:w;
        const edgeY=seed.y<h*.5?0:h;
        const horizontal=seed.corner;
        const x=horizontal?seed.x:edgeX;
        const y=horizontal?edgeY:seed.y;
        const len=seed.size*(.55+.45*Math.sin(elapsed*4+seed.twinkle)**2);
        ctx.strokeStyle='rgba(231,250,255,'+(.22*frost).toFixed(3)+')';
        ctx.lineWidth=.8;
        ctx.beginPath();
        if(horizontal){
          const sign=y===0?1:-1;
          ctx.moveTo(x,y);ctx.lineTo(x+len*.25,y+len*sign);
          ctx.moveTo(x+len*.25,y+len*sign);
          ctx.lineTo(x-len*.15,y+len*sign*.75);
        }else{
          const sign=x===0?1:-1;
          ctx.moveTo(x,y);ctx.lineTo(x+len*sign,y-len*.2);
          ctx.moveTo(x+len*sign,y-len*.2);
          ctx.lineTo(x+len*sign*.72,y+len*.25);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawParticles(progress,front,volume,delta,elapsed){
      const w=state.width,h=state.height;
      // Broad gust cycles + small turbulent pulses: every repeat differs.
      const pulse=.48+.52*Math.sin(elapsed*(style===1?12.2:8.2)+style*1.7);
      const squall=Math.max(0,Math.sin(elapsed*4.7+style*2.1))**3;
      const gust=(1+.25*Math.sin(elapsed*9)+.12*Math.sin(elapsed*17)
        +.32*squall)*(firstStorm?1.12:1);
      const swirl=Math.sin(elapsed*6.6+style)*42;
      const coldFactor=cold?1:.76;
      // A moving eddy twists selected snow around a shifting air pocket.
      const eddyX=w*(.83-.58*progress);
      const eddyY=h*(.27+.17*Math.sin(elapsed*2.7+style));
      const eddyStrength=(style===2||firstStorm?240:120)*(cold?1:.28)*pulse;
      ctx.lineCap='round';
      for(const p of state.particles){
        const depth=p.depth;
        const vel=p.speed*coldFactor*gust;
        p.x-=vel*delta;
        p.y+=(vel*(depth===0?.31:depth===1?.25:depth===2?.19:.15)
          +Math.sin(elapsed*9+p.phase)*48*p.wobble+swirl*p.offset)*delta;
        p.x+=Math.sin(elapsed*7+p.phase)*12*delta;
        if(depth<3&&eddyStrength>0){
          const dx=p.x-eddyX,dy=p.y-eddyY;
          const dist2=dx*dx+dy*dy;
          const field=Math.exp(-dist2/(w<600?36000:95000))*eddyStrength;
          const norm=Math.sqrt(dist2)+35;
          p.x+=-dy/norm*field*delta;
          p.y+= dx/norm*field*delta;
        }
        if(p.x< -130){
          p.x=w+rand(10,165);
          p.y=rand(-50,h+70);
        }else if(p.y>h+130){
          p.y=rand(-110,-15);
          p.x=rand(0,w+110);
        }else if(p.y< -125){
          p.y=h+rand(5,95);
        }
        const distance=Math.hypot(p.x-state.x,p.y-state.y);
        const edge=smooth((front-distance+115)/165);
        const opacity=p.opacity*volume*edge;
        if(opacity<.013)continue;
        const size=p.size;
        if(depth===0){
          ctx.fillStyle=cold
            ?'rgba(241,250,255,'+opacity.toFixed(3)+')'
            :'rgba(255,223,173,'+(opacity*.67).toFixed(3)+')';
          ctx.fillRect(p.x,p.y,size,size);
        }else if(depth===1){
          ctx.strokeStyle=cold
            ?'rgba(247,252,255,'+opacity.toFixed(3)+')'
            :'rgba(255,235,197,'+(opacity*.75).toFixed(3)+')';
          ctx.lineWidth=size*.67;
          const len=(cold?9:6)+vel*.029;
          ctx.beginPath();
          ctx.moveTo(p.x+len,p.y-len*.23);
          ctx.lineTo(p.x,p.y);ctx.stroke();
        }else if(depth===2){
          const len=(cold?14:9)+vel*.045;
          ctx.strokeStyle=cold
            ?'rgba(255,255,255,'+opacity.toFixed(3)+')'
            :'rgba(255,239,204,'+(opacity*.69).toFixed(3)+')';
          ctx.lineWidth=size*.78;
          ctx.beginPath();
          ctx.moveTo(p.x+len,p.y-len*.22);
          ctx.lineTo(p.x,p.y);
          ctx.stroke();
          if(p.softness&&sprite){
            ctx.globalAlpha=opacity*.44;
            ctx.drawImage(sprite,p.x-size*5,p.y-size*5,size*10,size*10);
            ctx.globalAlpha=1;
          }
          if(p.crystal&&cold&&opacity>.17){
            ctx.strokeStyle='rgba(251,254,255,'+(opacity*.7).toFixed(3)+')';
            ctx.lineWidth=.7;
            ctx.beginPath();
            ctx.moveTo(p.x-size*1.25,p.y);
            ctx.lineTo(p.x+size*1.25,p.y);
            ctx.moveTo(p.x,p.y-size*1.25);
            ctx.lineTo(p.x,p.y+size*1.25);
            ctx.stroke();
          }
        }else if(sprite){
          // Foreground bokeh makes the lens feel immersed in blown snow.
          ctx.globalAlpha=opacity*.62;
          ctx.drawImage(sprite,p.x-size*5,p.y-size*5,size*10,size*10);
          ctx.globalAlpha=1;
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
      const volume=smooth(progress/.12)*(1-smooth((progress-.79)/.21));
      const front=(1-Math.pow(1-clamp(progress/.68),3))*state.maxRadius;

      ctx.clearRect(0,0,state.width,state.height);
      if(volume>.001){
        drawFog(progress,front,volume,elapsed);
        drawWindBands(front,volume,elapsed);
        drawParticles(progress,front,volume,delta,elapsed);
        drawFrost(progress,volume,elapsed);
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