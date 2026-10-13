(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const DATA = [23.7, 28.0, 37.7, 43.3];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = x => x * x * (3 - 2 * x);
  const xy = p => p.map(n => n.toFixed(3)).join(' ');
  const ARROW_COLORS = ['#039EA7', '#6050D1', '#FEA219'];
  const ARROW_WIDTH = 22.7;
  const HEAD_LENGTH = 36;
  const HEAD_WIDTH = 46;
  const ARROW_GAP = 23;
  const ARC_SAMPLES = 4096;
  const BODY_SAMPLES = 80;
  let count = 0;

  // Equal distance, rather than equal angle, keeps all three tails equally long.
  function makeEllipse(center) {
    const lengths = [0];
    const angleStep = Math.PI * 2 / ARC_SAMPLES;
    let previous = [center.x, center.y - center.ry];
    for (let i = 1; i <= ARC_SAMPLES; i++) {
      const a = -Math.PI / 2 + i * angleStep;
      const next = [center.x + center.rx * Math.cos(a), center.y + center.ry * Math.sin(a)];
      lengths.push(lengths[i-1] + Math.hypot(next[0]-previous[0], next[1]-previous[1]));
      previous = next;
    }
    const perimeter = lengths[ARC_SAMPLES];
    return { perimeter, at(distance) {
      const target = ((distance % perimeter) + perimeter) % perimeter;
      let low = 0, high = ARC_SAMPLES;
      while (high-low > 1) {
        const middle = (low+high) >>> 1;
        if (lengths[middle] <= target) low = middle;
        else high = middle;
      }
      const fraction = (target-lengths[low])/(lengths[high]-lengths[low]);
      const a = -Math.PI/2 + (low+fraction)*angleStep;
      const dx = -center.rx*Math.sin(a), dy = center.ry*Math.cos(a);
      const speed = Math.hypot(dx,dy);
      return { p:[center.x+center.rx*Math.cos(a),center.y+center.ry*Math.sin(a)],
        tangent:[dx/speed,dy/speed], normal:[dy/speed,-dx/speed] };
    }};
  }

  function arrowOutline(ellipse, baseDistance, bodyLength) {
    const outside = [], inside = [];
    for (let i=0; i<=BODY_SAMPLES; i++) {
      const q = ellipse.at(baseDistance-bodyLength + bodyLength*i/BODY_SAMPLES);
      outside.push([q.p[0]+q.normal[0]*ARROW_WIDTH/2,q.p[1]+q.normal[1]*ARROW_WIDTH/2]);
      inside.push([q.p[0]-q.normal[0]*ARROW_WIDTH/2,q.p[1]-q.normal[1]*ARROW_WIDTH/2]);
    }
    const base=ellipse.at(baseDistance);
    const outerCorner=[base.p[0]+base.normal[0]*HEAD_WIDTH/2,base.p[1]+base.normal[1]*HEAD_WIDTH/2];
    const innerCorner=[base.p[0]-base.normal[0]*HEAD_WIDTH/2,base.p[1]-base.normal[1]*HEAD_WIDTH/2];
    const tip=[base.p[0]+base.tangent[0]*HEAD_LENGTH,base.p[1]+base.tangent[1]*HEAD_LENGTH];
    const boundary=[...outside,outerCorner,tip,innerCorner,...inside.reverse()];
    return { d:boundary.map((p,i)=>(i?'L ':'M ')+xy(p)).join(' ')+' Z',
      start:ellipse.at(baseDistance-bodyLength).p, end:base.p };
  }
  class LoopWAMAnimation {
    constructor(element) {
      this.element = element;
      this.config = window.LoopWAMFigure;
      this.playing = true;
      this.elapsed = 0;
      this.last = null;
      this.frame = null;
      this.ellipse = makeEllipse(this.config.center);
      this.bodyLength = this.ellipse.perimeter/3 - HEAD_LENGTH - ARROW_GAP;
      this.id = 'ppt-loop-' + (++count);
      this.tick = this.tick.bind(this);
      this.build();
      this.render();
      this.frame = requestAnimationFrame(this.tick);
    }
    build() {
      const c = this.config;
      const id = this.id;
      this.points = DATA.map((value,i) => [c.plot.x+c.plot.width*(i+.5)/4, c.plot.y+c.plot.height*(1-value/60)]);
      this.base = c.plot.y + c.plot.height;
      this.svg = document.createElementNS(NS, 'svg');
      this.svg.setAttribute('viewBox', c.overview.join(' '));
      this.svg.setAttribute('role', 'img');
      this.svg.setAttribute('aria-labelledby', id+'-title '+id+'-desc');
      this.svg.setAttribute('preserveAspectRatio','xMidYMid meet');
      this.svg.innerHTML = `
        <title id="${id}-title">LoopWAM: Self-improvement from Deployment</title>
        <desc id="${id}-desc">The original PowerPoint artwork, with three matching teal, purple and orange arrows. Identical arrowheads and equal-length gradient tails rotate around the ellipse. The chart grows from Expert-trained 23.7 percent, through Round 1 at 28.0 and Round 2 at 37.7, to Round 3 at 43.3 percent. Surrounding panels show deployment, collection and improvement, with one Expert video and two side-by-side Rollout videos. Colored dashed trajectories flow outward from the robot, and animated particles and expanding elliptical waves illustrate broader state-action coverage.</desc>
        <defs>
          ${ARROW_COLORS.map((color,i)=>`<linearGradient id="${id}-tail-${i}" data-tail-gradient="${i}" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="${color}" stop-opacity=".04"/>
            <stop offset=".2" stop-color="${color}" stop-opacity=".16"/>
            <stop offset=".45" stop-color="${color}" stop-opacity=".36"/>
            <stop offset=".7" stop-color="${color}" stop-opacity=".65"/>
            <stop offset="1" stop-color="${color}" stop-opacity="1"/>
          </linearGradient>`).join('')}
        </defs>
        <image data-background="true" href="${c.background || 'assets/images/teaser-background.png'}" x="${c.overview[0]}" y="${c.overview[1]}" width="${c.overview[2]}" height="${c.overview[3]}"/>
        <g data-ring="true" data-body-width="${ARROW_WIDTH}" data-head-length="${HEAD_LENGTH}" data-head-width="${HEAD_WIDTH}">
          ${ARROW_COLORS.map((color,i)=>`<path data-arrow="${i}" data-color="${color}" data-body-length="${this.bodyLength}" fill="url(#${id}-tail-${i})"/>`).join('')}
        </g>
        <g data-chart="true">
          <path data-area="true" fill="#FEA219" fill-opacity=".13"/>
          <path data-line="true" fill="none" stroke="#000000" stroke-opacity=".5" stroke-width="4.54644" stroke-linecap="round" stroke-linejoin="round"/>
          ${this.points.map((p,i)=>`<path data-point="${i}" d="M ${p[0]} ${p[1]-6.82} L ${p[0]+6.82} ${p[1]} L ${p[0]} ${p[1]+6.82} L ${p[0]-6.82} ${p[1]} Z" fill="#000000"/>`).join('')}
        </g>`;
      this.element.appendChild(this.svg);
      this.arrows = [...this.svg.querySelectorAll('[data-arrow]')];
      this.gradients = [...this.svg.querySelectorAll('[data-tail-gradient]')];
      this.chart = this.svg.querySelector('[data-chart]');
      this.line = this.svg.querySelector('[data-line]');
      this.area = this.svg.querySelector('[data-area]');
      this.nodes = [...this.svg.querySelectorAll('[data-point]')];
      this.collection = new window.LoopWAMCollection(this.svg, this.id+'-collection', c.collection || {});
    }
    tick(now) {
      if(this.last!==null && this.playing && !document.hidden) this.elapsed += Math.min(now-this.last,100);
      this.last=now;
      this.render();
      this.frame=this.playing ? requestAnimationFrame(this.tick) : null;
    }
    render() {
      // Redraw on the fixed ellipse; no affine scaling can distort widths or heads.
      const orbit = this.elapsed/12000*this.ellipse.perimeter - HEAD_LENGTH;
      this.arrows.forEach((node,i)=>{
        const shape=arrowOutline(this.ellipse,orbit+i*this.ellipse.perimeter/3,this.bodyLength);
        node.setAttribute('d',shape.d);
        const gradient=this.gradients[i];
        gradient.setAttribute('x1',String(shape.start[0]));
        gradient.setAttribute('y1',String(shape.start[1]));
        gradient.setAttribute('x2',String(shape.end[0]));
        gradient.setAttribute('y2',String(shape.end[1]));
      });
      const t=this.elapsed%10000;
      const progress=clamp((t-600)/5500*3,0,3);
      const full=Math.floor(progress);
      const a=this.points[full], b=this.points[Math.min(full+1,3)], f=ease(progress-full);
      const tip=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
      const shown=this.points.slice(0,full+1);
      if(full<3) shown.push(tip);
      const d=shown.map((p,i)=>(i?'L ':'M ')+xy(p)).join(' ');
      this.line.setAttribute('d',d);
      this.area.setAttribute('d',`${d} L ${tip[0]} ${this.base} L ${this.points[0][0]} ${this.base} Z`);
      this.chart.setAttribute('opacity',t>9450 ? 1-ease((t-9450)/550) : t<250 ? ease(t/250):1);
      this.nodes.forEach((node,i)=>node.setAttribute('opacity',String(i===0?1:clamp((progress-i)*8+1,0,1))));
      this.collection.render(this.elapsed);
    }
    reset() {
      this.elapsed = 0;
      this.last = null;
      this.render();
    }
    setPlaying(value) {
      const next=Boolean(value);
      if(next===this.playing)return;
      this.playing=next;
      this.last=null;
      if(next && this.frame===null)this.frame=requestAnimationFrame(this.tick);
      if(!next && this.frame!==null){cancelAnimationFrame(this.frame);this.frame=null;}
      if(!next && this.elapsed===0){this.elapsed=7000;this.render();}
    }
    destroy(){cancelAnimationFrame(this.frame);this.playing=false;this.collection.destroy();this.svg.remove();}
  }
  window.LoopWAMAnimation=LoopWAMAnimation;
})();
