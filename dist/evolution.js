(() => {
  'use strict';

  const BASELINE_HOLD = 500;
  const SEGMENT_DURATION = 1500;
  const STAGE_HOLD = 400;
  const BASE_Y = 218;
  const CHART_HEIGHT = 180;
  const MAX_VALUE = 60;
  const START_X = 64;
  const CHART_WIDTH = 592;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function initializeEvolution(root) {
    let values;
    let labels;
    try {
      values = JSON.parse(root.dataset.values);
      labels = JSON.parse(root.dataset.labels);
    } catch {
      return;
    }
    if (!Array.isArray(values) || values.length < 2 ||
        values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) ||
        !Array.isArray(labels) || labels.length !== values.length) return;

    const find = selector => root.querySelector(selector);
    const findAll = selector => [...root.querySelectorAll(selector)];
    const valueElement = find('.evolution-value');
    const currentElement = find('.evolution-current');
    const gainElement = find('.evolution-gain');
    const line = find('.evolution-line');
    const area = find('.evolution-area');
    const reveal = find('.evolution-reveal');
    const cursor = find('.evolution-cursor');
    const nodes = findAll('[data-evolution-node]');
    const bars = findAll('[data-evolution-bar]');
    const stages = findAll('.evolution-stage');
    const toggle = find('.evolution-toggle');
    const status = find('.evolution-status');
    const animationName = find('h3')?.textContent.trim() || 'progression';
    const points = values.map((value, index) => ({
      x: START_X + index * CHART_WIDTH / (values.length - 1),
      y: BASE_Y - value / MAX_VALUE * CHART_HEIGHT
    }));
    const duration = BASELINE_HOLD + (values.length - 1) * (SEGMENT_DURATION + STAGE_HOLD);
    const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
    if (line) {
      line.setAttribute('d', path);
      line.setAttribute('pathLength', '1');
      line.style.removeProperty('stroke-dasharray');
      line.style.removeProperty('stroke-dashoffset');
    }
    if (area) area.setAttribute('d', `${path} L ${points[points.length - 1].x} ${BASE_Y} L ${points[0].x} ${BASE_Y} Z`);

    let position = duration;
    let requested = false;
    let running = false;
    let visible = false;
    let autoplayConsumed = reducedMotion.matches;
    let frame = 0;
    let lastTime = null;
    let announcement = '';

    const stageTime = index => index === 0 ? 0 : BASELINE_HOLD + (index - 1) * (SEGMENT_DURATION + STAGE_HOLD) + SEGMENT_DURATION;
    const elementIndex = (element, fallback, attribute) => {
      const raw = element.dataset.index ?? element.getAttribute(attribute);
      const index = raw !== null && raw !== '' ? Number(raw) : fallback;
      return Number.isInteger(index) && index >= 0 && index < values.length ? index : fallback;
    };

    function sample(time) {
      if (time >= duration) return {
        value: values[values.length - 1], ...points[points.length - 1],
        current: values.length - 1, reached: values.length - 1, phase: 'complete'
      };
      if (time < BASELINE_HOLD) return {
        value: values[0], ...points[0], current: 0, reached: 0, phase: 'hold'
      };
      const elapsed = time - BASELINE_HOLD;
      const segment = Math.min(Math.floor(elapsed / (SEGMENT_DURATION + STAGE_HOLD)), values.length - 2);
      const localTime = elapsed - segment * (SEGMENT_DURATION + STAGE_HOLD);
      const progress = Math.min(1, localTime / SEGMENT_DURATION);
      const from = points[segment];
      const to = points[segment + 1];
      return {
        value: values[segment] + (values[segment + 1] - values[segment]) * progress,
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
        current: segment + 1,
        reached: progress === 1 ? segment + 1 : segment,
        phase: progress === 1 ? 'hold' : 'moving'
      };
    }

    function updateToggle() {
      if (!toggle) return;
      toggle.textContent = running ? 'Pause' : position >= duration ? 'Replay' : 'Resume';
      toggle.setAttribute('aria-label', `${toggle.textContent} ${animationName} animation`);
    }

    function render(announce = true) {
      const state = sample(position);
      if (valueElement) valueElement.textContent = state.value.toFixed(2);
      if (currentElement) currentElement.textContent = String(labels[state.current]);
      if (gainElement) {
        const gain = state.value - values[0];
        gainElement.textContent = `${gain >= 0 ? '+' : ''}${gain.toFixed(2)} pp`;
      }
      // A shared SVG clip keeps line, area, and cursor aligned under nonuniform scaling.
      if (reveal) reveal.setAttribute('width', String(state.x + 1));
      if (cursor) cursor.setAttribute('transform', `translate(${state.x}, ${state.y})`);
      nodes.forEach((node, order) => {
        const index = elementIndex(node, order, 'data-evolution-node');
        node.classList.toggle('is-current', index === state.current);
        node.classList.toggle('is-reached', index <= state.reached);
      });
      bars.forEach((bar, order) => {
        const index = elementIndex(bar, order, 'data-evolution-bar');
        // Future bars retain their target height as CSS-styled ghosts.
        const value = index === state.current && state.phase === 'moving' ? state.value : values[index];
        const height = value / MAX_VALUE * CHART_HEIGHT;
        bar.setAttribute('y', String(BASE_Y - height));
        bar.setAttribute('height', String(height));
        bar.classList.toggle('is-current', index === state.current);
        bar.classList.toggle('is-reached', index <= state.reached);
      });
      stages.forEach((button, order) => {
        const index = elementIndex(button, order, 'data-stage');
        const selected = index === state.current;
        button.classList.toggle('is-current', selected);
        button.classList.toggle('is-reached', index <= state.reached);
        button.setAttribute('aria-pressed', String(selected));
      });
      root.classList.toggle('is-complete', state.phase === 'complete');
      root.classList.toggle('is-playing', running);
      updateToggle();
      if (announce && status && state.phase !== 'moving') {
        const key = `${state.phase}:${state.current}`;
        if (key !== announcement) {
          announcement = key;
          status.textContent = `${state.phase === 'complete' ? 'Complete. ' : ''}${labels[state.current]}: ${state.value.toFixed(2)}% success, ${(state.value - values[0]).toFixed(2)} percentage points above baseline.`;
        }
      }
    }

    function stopFrames() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastTime = null;
      running = false;
      root.classList.remove('is-playing');
      updateToggle();
    }

    function tick(time) {
      frame = 0;
      if (!requested || !visible || document.hidden || reducedMotion.matches) {
        stopFrames();
        return;
      }
      if (lastTime !== null) position = Math.min(duration, position + Math.max(0, time - lastTime));
      lastTime = time;
      if (position >= duration) {
        requested = false;
        running = false;
        lastTime = null;
      }
      render();
      if (running) frame = requestAnimationFrame(tick);
    }

    function startFrames() {
      if (running || !requested || !visible || document.hidden || reducedMotion.matches) return;
      running = true;
      lastTime = null;
      render();
      frame = requestAnimationFrame(tick);
    }

    function finishImmediately() {
      requested = false;
      stopFrames();
      position = duration;
      render();
    }

    function replay() {
      autoplayConsumed = true;
      if (reducedMotion.matches) {
        finishImmediately();
        return;
      }
      stopFrames();
      position = 0;
      announcement = '';
      requested = true;
      render();
      startFrames();
    }

    stages.forEach((button, order) => {
      button.addEventListener('click', () => {
        const index = elementIndex(button, order, 'data-stage');
        autoplayConsumed = true;
        requested = false;
        stopFrames();
        position = index === values.length - 1 ? duration : stageTime(index);
        announcement = '';
        render();
      });
    });
    if (toggle) toggle.addEventListener('click', () => {
      autoplayConsumed = true;
      if (reducedMotion.matches) finishImmediately();
      else if (running) {
        requested = false;
        stopFrames();
      } else if (position >= duration) replay();
      else {
        requested = true;
        startFrames();
      }
    });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        visible = entry.isIntersecting && entry.intersectionRatio > 0;
        if (!visible) stopFrames();
        else if (entry.intersectionRatio >= 0.35 && !autoplayConsumed && !reducedMotion.matches) replay();
        else if (requested) startFrames();
      });
    }, {threshold: [0, 0.35]});
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopFrames();
      else if (requested) startFrames();
    });
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) {
        autoplayConsumed = true;
        finishImmediately();
      }
    });

    // Keep the complete chart visible until its first qualifying entrance.
    root.classList.add('is-ready');
    render(false);
    observer.observe(root);
  }

  function initialize() {
    document.querySelectorAll('.evolution').forEach(initializeEvolution);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
  else initialize();
})();
