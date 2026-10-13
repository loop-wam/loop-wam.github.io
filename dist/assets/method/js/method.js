/* LoopWAM method figure: original layout, coordinated drawing.
 * The source artwork is immutable. An SVG image mask removes only static
 * arrows/markers/fills, and animated SVG primitives replace them in place.
 * Compare original exposes the same artwork with a transparent outer canvas.
 */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const scriptURL=document.currentScript.src;
  const defaults=window.LoopWAMMethodConfig;
  if(!defaults)return;
  let serial=0;
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const phase=(s,period,delay=0)=>((s-delay)%period+period)%period/period;
  const make=(name,attrs={},parent)=>{
    const el=document.createElementNS(NS,name);
    Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));
    if(parent)parent.appendChild(el);return el;
  };
  function starPoints(x,y,r){
    return Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,l=i%2?r*.43:r;return `${x+Math.cos(a)*l},${y+Math.sin(a)*l}`;}).join(' ');
  }
  function envelope(s,duration,delay=0){
    if(s<delay)return {growth:0,alpha:0};
    const p=(s-delay)%duration/duration;
    return {growth:ease(p/.63),alpha:1-ease((p-.9)/.1)};
  }

  class LoopWAMMethod {
    constructor(host,options={}){
      this.host=host;this.config={...defaults,...options};this.id=`loopwam-method-${++serial}`;
      if(!host.id)host.id=this.id;
      this.time=0;this.last=null;this.frame=null;this.speed=this.config.speed;
      this.visible=false;this.ready=false;this.static=false;this.playing=false;
      this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
      this.userPlaying=!this.reduced.matches;this.tick=this.tick.bind(this);
      this.controls=[...document.querySelectorAll('[data-method-controls]')].find(el=>el.dataset.methodControls===host.id);
      this.toggle=this.controls?.querySelector('[data-method-toggle]');
      this.speedButton=this.controls?.querySelector('[data-method-speed]');
      this.staticButton=this.controls?.querySelector('[data-method-static]');
      this.replayButton=this.controls?.querySelector('[data-method-replay]');
      this.base=host.querySelector('.loopwam-method-base');
      if(!this.base){
        this.base=document.createElement('img');this.base.className='loopwam-method-base';
        this.base.src=new URL('../images/method.svg',scriptURL).href;
        this.base.alt='LoopWAM method: mixed-quality data, joint video–action modeling, quality steering, noise sampling, quality-weighted supervision, and rollout annotation.';
        this.base.width=this.config.width;this.base.height=this.config.height;host.prepend(this.base);
      }
      this.build();
      this.onLoad=()=>{this.ready=true;this.applyPlayback();};
      this.base.addEventListener('load',this.onLoad);
      if(this.base.complete&&this.base.naturalWidth)this.ready=true;
      this.onToggle=()=>{this.userPlaying=!this.userPlaying;this.applyPlayback();};
      this.onSpeed=()=>{const speeds=[.6,1,1.5];this.speed=speeds[(speeds.indexOf(this.speed)+1)%speeds.length];this.updateControls();};
      this.onStatic=()=>{this.static=!this.static;this.applyPlayback();};
      this.onReplay=()=>{this.time=0;this.last=null;this.static=false;this.userPlaying=true;this.render();this.applyPlayback();};
      this.onKey=e=>{if(e.code==='Space'&&!e.target.closest('button,a,input,textarea,select')){e.preventDefault();if(this.static)this.static=false;this.onToggle();}};
      this.onVisibility=()=>this.applyPlayback();
      this.onReduced=e=>{if(e.matches){this.userPlaying=false;this.time=0;this.render();}this.applyPlayback();};
      this.toggle?.addEventListener('click',this.onToggle);this.speedButton?.addEventListener('click',this.onSpeed);
      this.staticButton?.addEventListener('click',this.onStatic);this.replayButton?.addEventListener('click',this.onReplay);
      host.addEventListener('keydown',this.onKey);document.addEventListener('visibilitychange',this.onVisibility);
      this.reduced.addEventListener('change',this.onReduced);
      if('IntersectionObserver' in window){
        this.observer=new IntersectionObserver(entries=>{this.visible=entries.some(e=>e.isIntersecting&&e.intersectionRatio>=.1);this.applyPlayback();},{threshold:[0,.1]});this.observer.observe(host);
      }else this.visible=true;
      if(this.controls)this.controls.hidden=false;
      this.render();this.applyPlayback();
    }

    build(){
      const c=this.config;
      this.color=key=>c.colors[key]||key;
      this.svg=make('svg',{class:'loopwam-method-overlay',viewBox:`0 0 ${c.width} ${c.height}`,preserveAspectRatio:'xMidYMid meet','aria-hidden':'true',focusable:'false'},this.host);
      const defs=make('defs',{},this.svg);
      const glow=make('filter',{id:this.id+'-glow',x:'-100%',y:'-100%',width:'300%',height:'300%'},defs);
      make('feGaussianBlur',{stdDeviation:2.1,result:'blur'},glow);
      const merge=make('feMerge',{},glow);make('feMergeNode',{in:'blur'},merge);make('feMergeNode',{in:'SourceGraphic'},merge);
      const shimmer=make('linearGradient',{id:this.id+'-shimmer'},defs);
      [[0,0],[.45,.1],[.55,.85],[.65,.1],[1,0]].forEach(([offset,opacity])=>make('stop',{offset,'stop-color':'#fff','stop-opacity':opacity},shimmer));
      const gradient=make('linearGradient',{id:this.id+'-quality'},defs);
      [[0,'#ff7472'],[.27,'#ffc899'],[.5,'#f6e998'],[.76,'#70d5ab'],[1,'#00ba9a']].forEach(([offset,color])=>make('stop',{offset,'stop-color':color},gradient));
      ['video','action'].forEach(color=>{
        const g=make('linearGradient',{id:this.id+'-fill-'+color,x1:'0%',x2:'100%'},defs);
        make('stop',{offset:0,'stop-color':this.color(color),'stop-opacity':.24},g);
        make('stop',{offset:1,'stop-color':this.color(color),'stop-opacity':.95},g);
      });
      // Geometry uses the previously calibrated 2048-wide coordinate space.
      const layer=make('g',{transform:`scale(${c.width/c.overlayWidth})`},this.svg);
      const height=c.height/c.width*c.overlayWidth;
      // Fill erasure holes only inside the original cards, never across the canvas.
      const surfaces=make('clipPath',{id:this.id+'-surfaces',clipPathUnits:'userSpaceOnUse'},defs);
      c.artworkPanels.forEach(([x,y,width,height,rx])=>make('rect',{x,y,width,height,rx},surfaces));
      const backgrounds=make('g',{'clip-path':`url(#${this.id}-surfaces)`},layer);
      c.backgrounds.forEach(([x,y,width,h,fill])=>make('rect',{x,y,width,height:h,fill},backgrounds));
      const mask=make('mask',{id:this.id+'-artwork-mask',maskUnits:'userSpaceOnUse',x:0,y:0,width:c.overlayWidth,height,'mask-type':'luminance'},defs);
      make('rect',{width:c.overlayWidth,height,fill:'#fff'},mask);
      const erasePath=(d,width=8)=>make('path',{d,fill:'none',stroke:'#000','stroke-width':width,'stroke-linecap':'butt','stroke-linejoin':'round'},mask);
      c.flows.forEach(([name,d])=>{
        erasePath(d,name.includes('fork')?6:8);
        if(c.arrowheads[name])make('polygon',{points:c.arrowheads[name],fill:'#000',stroke:'#000','stroke-width':1.8,'stroke-linejoin':'round'},mask);
      });
      c.curves.forEach(([,d])=>erasePath(d,7));
      c.nodes.forEach(([cx,cy,r])=>{if(cy!==286)make('circle',{cx,cy,r:r+2.5,fill:'#000'},mask);});
      // The whole quality strip is reconstructed, including its ticks and original stops.
      make('rect',{x:1470,y:263,width:543,height:46,fill:'#000'},mask);
      c.tokens.forEach(([x,y,width,h])=>make('rect',{x:x-1.5,y:y-2.5,width:width+3,height:h+4,rx:3,fill:'#000'},mask));
      c.bars.forEach(([x,y,width,h])=>make('rect',{x:x-2,y:y-1,width:width+3,height:h+2,rx:2,fill:'#000'},mask));
      c.stars.forEach(([x,y,r])=>make('polygon',{points:starPoints(x,y,r+3),fill:'#000',stroke:'#000','stroke-width':3,'stroke-linejoin':'round'},mask));
      // Keep the original inline ↔ symbol; do not replace it with two floating arrows.
      make('image',{href:this.base.currentSrc||this.base.src,x:0,y:0,width:c.overlayWidth,height,mask:`url(#${this.id}-artwork-mask)`,'data-method-artwork':'masked'},layer);
      c.repairs.forEach(([d,stroke,width])=>make('path',{d,fill:'none',stroke,'stroke-width':width},layer));
      // Branch highlights pass behind the original Joint Attention card.
      const branchLayer=make('g',{'data-method-layer':'branch-accents'},layer);
      this.branchAccents=c.branchAccents.map(([x,y,w,h,color,delay])=>({
        rect:make('rect',{x:x+2,y:y+2,width:w-4,height:h-4,rx:4,fill:this.color(color),'fill-opacity':.06,stroke:this.color(color),'stroke-width':2.5,'stroke-dasharray':'52 900',filter:`url(#${this.id}-glow)`},branchLayer),delay
      }));
      const jointClip=make('clipPath',{id:this.id+'-joint-foreground',clipPathUnits:'userSpaceOnUse'},defs);
      make('rect',c.jointForeground,jointClip);
      make('image',{
        href:this.base.currentSrc||this.base.src,x:0,y:0,width:c.overlayWidth,height,
        'clip-path':`url(#${this.id}-joint-foreground)`,'data-method-layer':'joint-foreground'
      },layer);
      const q=c.qualityBar;
      make('rect',{x:q.x,y:q.y,width:q.width,height:q.height,fill:`url(#${this.id}-quality)`},layer);
      [1473,1600,1743,1893,2010].forEach(x=>make('path',{d:`M${x} 265 V307`,stroke:'#35303d','stroke-width':1.4},layer));
      // Heads stay at their terminal positions. Only the shaft is progressively drawn.
      this.trails=c.flows.map(row=>this.makeGrowingPath(layer,row,false));
      this.curves=c.curves.map(row=>this.makeGrowingPath(layer,row,true));
      // A single horizontal bidirectional symbol, in the exact original text gap.
      this.joint=make('path',{
        d:'M1103 365 H1126 M1108 361.5 L1103 365 L1108 368.5 M1121 361.5 L1126 365 L1121 368.5',
        fill:'none',stroke:'#596775','stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round'
      },layer);
      this.nodes=c.nodes.map(([x,y,r,color,delay])=>{
        const isQuality=y===286;
        const styles=isQuality?['#bd93f4','#fff']:color==='green'?['#43b999','#119673']:color==='coral'?['#f6a290','#ea816f']:color==='video'?['#d7e4f3','#17344f']:['#f6cf7c','#e0ac48'];
        const group=make('g',{'data-method-node':`${x},${y}`},layer);
        const ripple=make('circle',{cx:x,cy:y,r,fill:'none',stroke:this.color(color),'stroke-width':2.2},group);
        const body=make('circle',{cx:x,cy:y,r,fill:styles[0],stroke:styles[1],'stroke-width':isQuality?1.7:1.5,filter:`url(#${this.id}-glow)`},group);
        return {ripple,body,r,delay};
      });
      this.tokens=c.tokens.map(([x,y,w,h,color,delay])=>{
        const group=make('g',{'data-method-token':'true'},layer);
        const face=make('rect',{x,y,width:w,height:h,rx:3,fill:this.color(color),stroke:this.color(color),'stroke-width':1.4},group);
        const shine=make('rect',{x:x+3,y:y+3,width:w-6,height:h-6,rx:2,fill:'#fff'},group);
        return {group,face,shine,delay};
      });
      // Formula text in annotation boxes stays raster-sharp and stationary.
      this.annotationTokens=c.annotationTokens.map(([x,y,w,h,color,delay])=>({
        rect:make('rect',{x,y,width:w,height:h,rx:4,fill:this.color(color),'fill-opacity':.15,stroke:this.color(color),'stroke-width':2.2},layer),delay
      }));
      this.bars=c.bars.map(([x,y,w,h,color,delay],i)=>{
        const clip=make('clipPath',{id:`${this.id}-bar-${i}`},defs);make('rect',{x:x-1,y:y-1,width:w+2,height:h+2,rx:2},clip);
        const group=make('g',{'clip-path':`url(#${this.id}-bar-${i})`,'data-method-bar':'true'},layer);
        // Keep the full encoded weight visible throughout; only illumination advances.
        make('rect',{x:x-1,y:y-1,width:w+1,height:h+1,rx:2,fill:`url(#${this.id}-fill-${color})`,opacity:.72,stroke:this.color(color),'stroke-opacity':.35},group);
        const fill=make('rect',{x:x-1,y:y-1,width:0,height:h+1,rx:2,fill:`url(#${this.id}-fill-${color})`},group);
        const shine=make('rect',{x:x-60,y:y-1,width:60,height:h+1,fill:`url(#${this.id}-shimmer)`},group);
        return {fill,shine,x,w,delay};
      });
      this.stars=c.stars.map(([x,y,r,color,delay])=>{
        const group=make('g',{'data-method-star':'true'},layer);
        const ripple=make('circle',{cx:x,cy:y,r:r+5,fill:'none',stroke:this.color(color),'stroke-width':2},group);
        const star=make('polygon',{points:starPoints(x,y,r+1.5),fill:this.color(color),filter:`url(#${this.id}-glow)`},group);
        return {star,ripple,x,y,r,delay};
      });
      this.frameAccents=c.frameAccents.map(([x,y,w,h],i)=>({rect:make('rect',{x,y,width:w,height:h,rx:1,fill:'#04ba92','fill-opacity':.04,stroke:'#04ba92','stroke-width':3.5,filter:`url(#${this.id}-glow)`},layer),i}));
      this.orbitRing=make('circle',{cx:1993,cy:286,r:22,fill:'none',stroke:this.color('purple'),'stroke-width':2.4,'stroke-dasharray':'20 48',filter:`url(#${this.id}-glow)`},layer);
      this.orbitSpark=make('circle',{r:3.8,fill:'#fff',stroke:this.color('purple'),'stroke-width':2.2,filter:`url(#${this.id}-glow)`},layer);
    }

    makeGrowingPath(parent,[name,d,color,duration,delay],isCurve){
      const stroke=this.color(color);
      const isConnector=name.includes('cross-attention');
      const width=isConnector?2.4:isCurve?3.1:3.2;
      const group=make('g',{'data-method-flow':name,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'},parent);
      // A quiet, complete guide preserves the diagram's topology between drawing cycles.
      const track=make('path',{d,stroke,'stroke-width':width,opacity:isConnector ? .42 : .22},group);
      const length=track.getTotalLength();
      const headSize=this.config.arrowSizes[name];
      const shaftLength=headSize?Math.max(0,length-headSize[0]+1):length;
      track.setAttribute('stroke-dasharray',`${shaftLength} ${length+1}`);
      const body=make('path',{
        d,stroke,'stroke-width':width,
        'stroke-dasharray':`${shaftLength} ${length+1}`,
        'stroke-dashoffset':shaftLength
      },group);
      let tip=null;
      if(headSize){
        const [headLength,halfWidth]=headSize;
        const end=track.getPointAtLength(length);
        const before=track.getPointAtLength(Math.max(0,length-.5));
        const angle=Math.atan2(end.y-before.y,end.x-before.x)*180/Math.PI;
        const shape={
          d:`M0 0 L${-headLength} ${-halfWidth} L${-headLength} ${halfWidth} Z`,
          transform:`translate(${end.x} ${end.y}) rotate(${angle})`,
          fill:stroke,stroke:'none'
        };
        make('path',{...shape,opacity:.22,'data-arrow-guide':'true'},group);
        tip=make('path',{...shape,opacity:0,'data-arrow-head':'true'},group);
      }
      return {group,body,tip,shaftLength,duration,delay};
    }

    renderPath(item,s){
      const timing=this.config.flowCycle;
      const local=(s/(timing.durationScale??1))%timing.seconds;
      const progress=clamp((local-item.delay)/item.duration);
      // Draw up to the arrowhead's base, then fill the fixed head at the endpoint.
      // No moving triangles, white cursor, tangent jumps, or mid-path phase resets.
      const growth=ease(item.tip?progress/.9:progress);
      const fade=1-ease((local-timing.fadeAt)/timing.fadeDuration);
      item.body.setAttribute('stroke-dashoffset',item.shaftLength*(1-growth));
      item.body.setAttribute('opacity',progress>0?fade:0);
      const headOpacity=ease((progress-.9)/.1)*fade;
      if(item.tip)item.tip.setAttribute('opacity',headOpacity);
      item.group.setAttribute('data-growth',growth.toFixed(3));
      item.group.setAttribute('data-head-opacity',headOpacity.toFixed(3));
    }

    render(){
      const s=this.time/1000;
      [...this.trails,...this.curves].forEach(item=>this.renderPath(item,s));
      this.joint.setAttribute('opacity',.28+.55*Math.pow(Math.sin(s*Math.PI/2.8),2));
      this.nodes.forEach(({ripple,body,r,delay})=>{
        const p=phase(s,4.6,delay),pulse=Math.pow(Math.max(0,Math.sin(p*Math.PI*2)),3);
        const scale=.78+.45*pulse;
        // Keep the original center: nodes remain attached to their paths.
        body.setAttribute('r',r*scale);
        ripple.setAttribute('r',r+3+13*p);
        ripple.setAttribute('opacity',.65*(1-p)*(1-p));
      });
      this.tokens.forEach(({group,face,shine,delay})=>{
        const p=phase(s,4.6,delay),pulse=Math.pow(Math.max(0,Math.sin(p*Math.PI*2)),3);
        group.setAttribute('transform',`translate(0 ${-5*pulse})`);
        face.setAttribute('fill-opacity',.17+.42*pulse);
        face.setAttribute('stroke-opacity',.55+.45*pulse);
        shine.setAttribute('opacity',.18+.32*(1-pulse));
      });
      this.annotationTokens.forEach(({rect,delay})=>{
        const pulse=Math.pow(Math.max(0,Math.sin(phase(s,4.6,delay)*Math.PI*2)),3);
        rect.setAttribute('opacity',.12+.83*pulse);
      });
      this.bars.forEach(({fill,shine,x,w,delay})=>{
        const {growth,alpha}=envelope(s,6.5,delay+.5);
        fill.setAttribute('width',(w+1)*growth);fill.setAttribute('opacity',alpha);
        shine.setAttribute('x',x-60+(w+120)*phase(s,3.2,delay));
        shine.setAttribute('opacity',growth>.97?alpha:0);
      });
      this.stars.forEach(({star,ripple,x,y,r,delay})=>{
        const p=phase(s,4.6,delay),pulse=Math.pow(Math.max(0,Math.sin(p*Math.PI*2)),3);
        const scale=.82+.34*pulse;
        star.setAttribute('transform',`translate(${x} ${y}) scale(${scale}) rotate(${pulse*9}) translate(${-x} ${-y})`);
        ripple.setAttribute('r',r+4+14*p);ripple.setAttribute('opacity',.45*(1-p));
      });
      this.frameAccents.forEach(({rect,i})=>{const p=phase(s,6.4,i*1.6);rect.setAttribute('opacity',p<.23?Math.sin(p/.23*Math.PI)*.9:0);});
      this.branchAccents.forEach(({rect,delay})=>{rect.setAttribute('stroke-dashoffset',-(s-delay)*100);rect.setAttribute('opacity',.5+.3*Math.sin((s-delay)*2));});
      const angle=s*Math.PI/2;
      this.orbitRing.setAttribute('stroke-dashoffset',-s*24);
      this.orbitSpark.setAttribute('cx',1993+Math.cos(angle)*22);this.orbitSpark.setAttribute('cy',286+Math.sin(angle)*22);
    }

    tick(now){
      if(!this.playing){this.frame=null;return;}
      if(this.last!==null)this.time+=Math.min(now-this.last,100)*this.speed;
      this.last=now;this.render();this.frame=requestAnimationFrame(this.tick);
    }
    updateControls(){
      if(this.toggle){this.toggle.textContent=this.userPlaying?'Pause':'Play';this.toggle.setAttribute('aria-label',this.userPlaying?'Pause animated method figure':'Play animated method figure');this.toggle.disabled=this.static;}
      if(this.speedButton){this.speedButton.textContent=`${this.speed}×`;this.speedButton.setAttribute('aria-label',`Animation speed ${this.speed} times`);this.speedButton.disabled=this.static;}
      if(this.staticButton){this.staticButton.textContent=this.static?'Return to animation':'Compare original';this.staticButton.setAttribute('aria-pressed',String(this.static));}
    }
    applyPlayback(){
      const next=this.userPlaying&&this.visible&&this.ready&&!this.static&&!document.hidden;
      const reducedOriginal=this.reduced.matches&&!this.userPlaying&&this.time===0;
      const showOverlay=this.ready&&!this.static&&!reducedOriginal;
      this.svg.toggleAttribute('hidden',!showOverlay);
      // The transparent overlay must not reveal the fallback's complete static arrows.
      this.host.dataset.overlayVisible=String(showOverlay);
      this.host.dataset.animating=String(next);this.host.dataset.original=String(this.static||reducedOriginal);
      if(next!==this.playing){
        this.playing=next;this.last=null;
        if(next&&this.frame===null)this.frame=requestAnimationFrame(this.tick);
        if(!next&&this.frame!==null){cancelAnimationFrame(this.frame);this.frame=null;}
      }
      this.updateControls();
    }
    setPlaying(value){this.userPlaying=Boolean(value);this.applyPlayback();}
    setSpeed(value){if(Number.isFinite(value)&&value>0){this.speed=value;this.updateControls();}}
    destroy(){
      this.userPlaying=false;this.applyPlayback();this.observer?.disconnect();this.base.removeEventListener('load',this.onLoad);
      this.toggle?.removeEventListener('click',this.onToggle);this.speedButton?.removeEventListener('click',this.onSpeed);
      this.staticButton?.removeEventListener('click',this.onStatic);this.replayButton?.removeEventListener('click',this.onReplay);
      this.host.removeEventListener('keydown',this.onKey);document.removeEventListener('visibilitychange',this.onVisibility);
      this.reduced.removeEventListener('change',this.onReduced);this.svg.remove();
      delete this.host.dataset.overlayVisible;delete this.host.loopwamMethod;
    }
  }
  window.LoopWAMMethod=LoopWAMMethod;
  document.querySelectorAll('[data-loopwam-method]').forEach(host=>{if(!host.loopwamMethod)host.loopwamMethod=new LoopWAMMethod(host);});
})();
