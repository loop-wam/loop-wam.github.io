(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const TAU = Math.PI * 2;
  let instanceCount = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fract = v => v - Math.floor(v);
  const smooth = v => v * v * (3 - 2 * v);
  const num = v => Number(v).toFixed(3);
  function node(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(key => n.setAttribute(key, String(attrs[key])));
    if (parent) parent.appendChild(n);
    return n;
  }
  function seeded(seed) {
    let state = seed >>> 0;
    return function () {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }
  function cubicPath(points) {
    return 'M ' + points[0].join(' ') + ' C ' + points.slice(1).map(p => p.join(' ')).join(', ');
  }
  // SVG metrics are measured only at construction. Per-frame positions use this
  // small, cached arc-length table, keeping every animation on the parent clock.
  function samplePath(path) {
    const length = path.getTotalLength();
    const steps = Math.max(80, Math.ceil(length));
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const p = path.getPointAtLength(length * i / steps);
      points.push([p.x, p.y]);
    }
    return { length, points, steps };
  }
  function at(route, value) {
    const scaled = clamp(value, 0, 1) * route.steps;
    const index = Math.min(route.steps - 1, Math.floor(scaled));
    const fraction = scaled - index;
    const a = route.points[index], b = route.points[index + 1];
    return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
  }
  function ellipsePath(cx, cy, rx, ry) {
    return `M ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy}`;
  }
  function ellipsePerimeter(rx, ry) {
    const h = Math.pow(rx - ry, 2) / Math.pow(rx + ry, 2);
    return Math.PI * (rx + ry) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h)));
  }

  /**
   * Animates the collection panel without owning a requestAnimationFrame loop.
   *
   * config.routes: [{ color, points: [[x0,y0],[x1,y1],[x2,y2],[x3,y3]],
   *   d?: exact SVG path, headD?: exact native arrowhead path,
   *   strokeWidth?: 3.06444, headLength?: 10,
   *   headWidth?: 10, headTip?: [x,y], duration?: milliseconds }]
   * When headTip is supplied the source path ends at the arrowhead base, and
   * the head runs from that endpoint to headTip. Otherwise its tip is path end.
   * config.coverage: { cx, cy, rx, ry, scatterRx, scatterRy,
   *   coreRx, coreRy, particleCount, seed }
   * rx/ry describe the original outer colored band, and scatterRx/scatterRy
   * describe the larger dotted envelope. Coordinates are in the parent SVG.
   */
  class LoopWAMCollection {
    constructor(svgRoot, idPrefix, config) {
      this.config = config || {};
      this.id = (String(idPrefix || 'loopwam').replace(/[^a-zA-Z0-9_-]/g, '-') || 'loopwam') + '-collection-' + (++instanceCount);
      this.group = node('g', { 'data-collection': 'true', 'aria-hidden': 'true', 'pointer-events': 'none' }, svgRoot);
      this.defs = node('defs', {}, this.group);
      this.routes = [];
      this.rings = [];
      this.particles = [];
      this.buildRoutes();
      this.buildCoverage();
      this.render(0);
    }

    buildRoutes() {
      const defaults = [
        { color: '#02AD51', points: [[1450.8823, 330.3779], [1490, 301], [1535, 299], [1570.278, 314.04]] },
        { color: '#FF8700', points: [[1450.4825, 347.123], [1495, 355], [1537, 346], [1574.1392, 328.3355]] },
        { color: '#F3132C', points: [[1454.9089, 359.3302], [1485, 386], [1532, 397], [1565.3281, 396.8189]] }
      ];
      const glow = node('filter', { id: this.id + '-packet-glow', x: '-140%', y: '-140%', width: '380%', height: '380%', 'color-interpolation-filters': 'sRGB' }, this.defs);
      node('feGaussianBlur', { stdDeviation: 1.6 }, glow);
      const group = node('g', { 'data-flow-routes': 'true' }, this.group);
      const specs = this.config.routes || defaults;
      specs.forEach((input, index) => {
        const spec = Object.assign({}, defaults[index % defaults.length], input);
        const color = spec.color;
        const routeGroup = node('g', { 'data-flow-route': index }, group);
        const path = node('path', {
          d: spec.d || cubicPath(spec.points), fill: 'none', stroke: color,
          'stroke-width': spec.strokeWidth || 3.06444,
          'stroke-dasharray': '8.2 7.2', 'stroke-linecap': 'butt',
          'stroke-linejoin': 'round', 'data-flow-dashes': index
        }, routeGroup);
        const table = samplePath(path);
        const end = at(table, 1), before = at(table, .985);
        let tip = spec.headTip || end;
        const vx = spec.headTip ? tip[0] - end[0] : end[0] - before[0];
        const vy = spec.headTip ? tip[1] - end[1] : end[1] - before[1];
        const norm = Math.hypot(vx, vy) || 1;
        const ux = vx / norm, uy = vy / norm;
        const headLength = spec.headLength || (spec.headTip ? norm : 10.8);
        const halfWidth = (spec.headWidth || 10.2) / 2;
        const base = [tip[0] - ux * headLength, tip[1] - uy * headLength];
        node('path', {
          d: spec.headD || `M ${tip[0]} ${tip[1]} L ${base[0] - uy * halfWidth} ${base[1] + ux * halfWidth} L ${base[0] + uy * halfWidth} ${base[1] - ux * halfWidth} Z`,
          fill: color, 'data-flow-arrowhead': index
        }, routeGroup);
        const start = at(table, 0);
        const origin = node('circle', { cx: start[0], cy: start[1], r: 4.5, fill: color, opacity: .1 }, routeGroup);
        const packets = [];
        // A pair of small packets traces each recorded outcome toward its icon.
        // The arrowhead stays still, so the original direction remains clear.
        for (let j = 0; j < 2; j++) {
          const packet = node('g', { 'data-flow-packet': `${index}-${j}` }, routeGroup);
          node('circle', { r: 4.2, fill: color, opacity: .3, filter: `url(#${this.id}-packet-glow)` }, packet);
          const trail = node('circle', { r: 1.15, fill: color, opacity: .45 }, routeGroup);
          node('circle', { r: 2.55, fill: color, stroke: '#ffffff', 'stroke-width': .75 }, packet);
          packets.push({ group: packet, trail, phase: j * .5 + index * .11 });
        }
        this.routes.push(Object.assign(table, { path, color, origin, packets, duration: spec.duration || 3100 + index * 170, headTip: !!spec.headTip }));
      });
    }

    buildCoverage() {
      const c = this.coverage = Object.assign({
        cx: 1536.98565, cy: 496.10065, rx: 108.75865, ry: 44.93315,
        scatterRx: 147.4, scatterRy: 61.3, coreRx: 32.5, coreRy: 14.1,
        particleCount: 112, seed: 5927
      }, this.config.coverage || {});
      const id = this.id;
      const clip = node('clipPath', { id: id + '-coverage-clip' }, this.defs);
      node('ellipse', { cx: c.cx, cy: c.cy, rx: c.scatterRx + 1, ry: c.scatterRy + 1 }, clip);
      const gradient = node('radialGradient', { id: id + '-coverage-core' }, this.defs);
      node('stop', { offset: '0', 'stop-color': '#15B876', 'stop-opacity': .45 }, gradient);
      node('stop', { offset: '.7', 'stop-color': '#45C687', 'stop-opacity': .27 }, gradient);
      node('stop', { offset: '1', 'stop-color': '#64D296', 'stop-opacity': .1 }, gradient);
      const group = node('g', { 'data-coverage': 'true', 'clip-path': `url(#${id}-coverage-clip)` }, this.group);
      const fields = node('g', { 'data-coverage-bands': 'true' }, group);
      [
        { scale: 1, color: '#FFE9B0', opacity: .25, line: '#FFD485' },
        { scale: .79, color: '#FFE7A0', opacity: .22, line: '#F6CA76' },
        { scale: .59, color: '#DDEBA7', opacity: .29, line: '#CBDE8D' },
        { scale: .42, color: '#A2DCA0', opacity: .4, line: '#72CE93' }
      ].forEach(band => {
        node('ellipse', {
          cx: c.cx, cy: c.cy, rx: c.rx * band.scale, ry: c.ry * band.scale,
          fill: band.color, 'fill-opacity': band.opacity,
          stroke: band.line, 'stroke-opacity': .55, 'stroke-width': .9
        }, fields);
      });
      this.core = node('ellipse', {
        cx: c.cx, cy: c.cy, rx: c.coreRx, ry: c.coreRy,
        fill: `url(#${id}-coverage-core)`, stroke: '#3EC28C', 'stroke-opacity': .5, 'stroke-width': 1
      }, fields);

      // Continuous waves are phase-offset, so the cloud never clears or snaps.
      for (let i = 0; i < 3; i++) {
        this.rings.push(node('ellipse', {
          cx: c.cx, cy: c.cy, rx: c.coreRx, ry: c.coreRy,
          fill: 'none', stroke: i === 0 ? '#6CC994' : '#FFB949',
          'stroke-width': 1.35, 'data-coverage-wave': i
        }, group));
      }
      this.sweeps = [
        { scale: .98, color: '#F7B74D', length: 38, duration: 8500, opacity: .85 },
        { scale: .43, color: '#52BF8B', length: 22, duration: 6200, opacity: .8 }
      ].map((s, index) => {
        const rx = c.rx * s.scale, ry = c.ry * s.scale;
        const perimeter = ellipsePerimeter(rx, ry);
        const path = node('path', {
          d: ellipsePath(c.cx, c.cy, rx, ry), fill: 'none', stroke: s.color,
          'stroke-width': 1.8, 'stroke-linecap': 'round', opacity: s.opacity,
          'stroke-dasharray': `${s.length} ${perimeter - s.length}`,
          'data-coverage-sweep': index
        }, group);
        return Object.assign(s, { path, perimeter });
      });
      const random = seeded(c.seed);
      const count = clamp(Math.round(c.particleCount), 40, 180);
      const coreCount = Math.round(count * .28);
      const particleGroup = node('g', { 'data-coverage-particles': 'true' }, group);
      for (let i = 0; i < count; i++) {
        const core = i < coreCount;
        const angle = random() * TAU;
        const phase = random();
        const radius = core ? .9 + random() * .72 : .8 + random() * .65;
        const dot = node('circle', {
          r: radius, fill: core ? '#12A86C' : '#FF920F',
          'data-coverage-particle': i
        }, particleGroup);
        this.particles.push({ dot, core, angle, phase, radius,
          wobble: random() * TAU, duration: 8000 + random() * 4000,
          distance: Math.sqrt(random()) });
      }
    }

    render(elapsedMs) {
      const time = Math.max(0, Number(elapsedMs) || 0);
      this.routes.forEach((route, index) => {
        route.path.setAttribute('stroke-dashoffset', num(-time * .019));
        const pulse = .5 + .5 * Math.sin(time / 630 + index * 1.9);
        route.origin.setAttribute('r', num(3.6 + pulse * 1.4));
        route.origin.setAttribute('opacity', num(.07 + pulse * .1));
        route.packets.forEach(packet => {
          const progress = fract(time / route.duration + packet.phase);
          // Packets fade before the fixed head, rather than overshooting it.
          const fade = smooth(clamp(progress / .1, 0, 1)) * smooth(clamp((.96 - progress) / .13, 0, 1));
          const p = at(route, progress * .96);
          const trail = at(route, Math.max(0, progress * .96 - .035));
          packet.group.setAttribute('transform', `translate(${num(p[0])} ${num(p[1])})`);
          packet.group.setAttribute('opacity', num(fade));
          packet.trail.setAttribute('cx', num(trail[0]));
          packet.trail.setAttribute('cy', num(trail[1]));
          packet.trail.setAttribute('opacity', num(fade * .42));
        });
      });
      const c = this.coverage;
      this.core.setAttribute('opacity', num(.9 + .1 * Math.sin(time / 1850)));
      this.rings.forEach((ring, index) => {
        const progress = fract(time / 4800 + index / 3);
        const expanded = smooth(progress);
        ring.setAttribute('rx', num(c.coreRx + (c.scatterRx - c.coreRx) * expanded));
        ring.setAttribute('ry', num(c.coreRy + (c.scatterRy - c.coreRy) * expanded));
        ring.setAttribute('opacity', num(Math.sin(progress * Math.PI) * .44));
      });
      this.sweeps.forEach((sweep, index) => {
        sweep.path.setAttribute('stroke-dashoffset', num(-fract(time / sweep.duration + index * .37) * sweep.perimeter));
      });
      this.particles.forEach(p => {
        let x, y, opacity;
        if (p.core) {
          const angle = p.angle + Math.sin(time / 2800 + p.wobble) * .075;
          const radius = p.distance * (.93 + Math.sin(time / 2100 + p.phase * TAU) * .04);
          x = c.cx + Math.cos(angle) * c.coreRx * radius * .86;
          y = c.cy + Math.sin(angle) * c.coreRy * radius * .82;
          opacity = .48 + .28 * (.5 + .5 * Math.sin(time / 1600 + p.wobble));
        } else {
          const progress = fract(time / p.duration + p.phase);
          const radius = .19 + .8 * Math.sqrt(progress);
          const angle = p.angle + Math.sin(time / 6500 + p.wobble) * .028;
          x = c.cx + Math.cos(angle) * c.scatterRx * radius;
          y = c.cy + Math.sin(angle) * c.scatterRy * radius;
          opacity = (.54 + .24 * p.distance) * smooth(clamp(progress / .07, 0, 1)) * smooth(clamp((1 - progress) / .1, 0, 1));
        }
        p.dot.setAttribute('cx', num(x));
        p.dot.setAttribute('cy', num(y));
        p.dot.setAttribute('opacity', num(opacity));
      });
    }

    destroy() {
      this.group.remove();
      this.routes.length = 0;
      this.rings.length = 0;
      this.particles.length = 0;
      this.sweeps.length = 0;
    }
  }
  window.LoopWAMCollection = LoopWAMCollection;
})();
