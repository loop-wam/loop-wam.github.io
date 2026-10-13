(() => {
  'use strict';
  const host = document.getElementById('loop-visual');
  if (!host || !window.LoopWAMFigure || !window.LoopWAMAnimation || !window.LoopWAMVideos) return;
  const base = new URL('../', document.currentScript.src);
  const resolveMedia = value => {
    if (typeof value === 'string') return value.startsWith('assets/') ? new URL(value, base).href : value;
    if (Array.isArray(value)) return value.map(resolveMedia);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveMedia(item)]));
    return value;
  };
  window.LoopWAMFigure = resolveMedia(window.LoopWAMFigure);
  window.LoopWAMFigure.background = new URL('assets/images/teaser-background.png', base).href;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let userPlaying = !reduced.matches;
  let visible = false;
  let dialogOpen = false;
  const fallback = host.querySelector('.teaser-fallback');
  const animation = new window.LoopWAMAnimation(host);
  animation.setPlaying(false);
  const videos = new window.LoopWAMVideos(animation.svg, window.LoopWAMFigure.videos, {
    onOpen: () => { dialogOpen = true; applyPlayback(); },
    onClose: () => { dialogOpen = false; applyPlayback(); }
  });
  if (fallback) fallback.remove();
  const controls = document.querySelector('.teaser-playback');
  const toggle = controls?.querySelector('[data-teaser-toggle]');
  const replay = controls?.querySelector('[data-teaser-replay]');
  if (controls) controls.hidden = false;

  function applyPlayback() {
    const playing = userPlaying && !document.hidden;
    animation.setPlaying(playing && visible && !dialogOpen);
    videos.setPlaying(playing && (visible || dialogOpen));
    host.dataset.playing = String(playing && visible && !dialogOpen);
    if (toggle) {
      toggle.textContent = userPlaying ? 'Pause' : 'Play';
      toggle.setAttribute('aria-label', userPlaying ? 'Pause animated teaser' : 'Play animated teaser');
    }
  }
  function togglePlayback() { userPlaying = !userPlaying; applyPlayback(); }
  toggle?.addEventListener('click', togglePlayback);
  replay?.addEventListener('click', () => {
    animation.setPlaying(false);
    videos.setPlaying(false);
    animation.reset();
    videos.reset();
    userPlaying = true;
    applyPlayback();
  });
  host.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.target.closest('button, a, input, textarea, select') || dialogOpen) return;
    event.preventDefault();
    togglePlayback();
  });
  new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .15);
    applyPlayback();
  }, {threshold: [0, .15]}).observe(host);
  document.addEventListener('visibilitychange', applyPlayback);
  reduced.addEventListener('change', event => {
    if (event.matches) userPlaying = false;
    applyPlayback();
  });
  window.LoopWAMFigure.videos.items.forEach(item => {
    const button = host.querySelector(`[data-video-id="${item.id}"] button`);
    button?.setAttribute('aria-label', `Play ${item.label} teaser video`);
    button?.setAttribute('aria-description', 'Open a larger video player.');
  });
  document.querySelector('.teaser-video-dialog-close')?.setAttribute('aria-label', 'Close teaser video');
  applyPlayback();
})();
