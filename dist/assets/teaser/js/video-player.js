(function () {
  'use strict';

  window.LoopWAMVideos = function (svgRoot, config, callbacks) {
    const SVG = 'http://www.w3.org/2000/svg';
    const XHTML = 'http://www.w3.org/1999/xhtml';
    const hooks = callbacks || {};
    const group = document.createElementNS(SVG, 'g');
    group.setAttribute('data-video-panels', '');
    const stackLayer = document.createElementNS(SVG, 'g');
    group.appendChild(stackLayer);
    const stackPrefix = 'task-stack-' + Math.random().toString(36).slice(2, 9);
    const pendingTimes = new WeakMap();
    let desiredPlaying = false;
    let activeEntry = null;
    let modalFinished = false;
    let previousFocus = null;
    let destroyed = false;

    function element(tag, className) {
      const node = document.createElementNS(XHTML, tag);
      if (className) node.className = className;
      return node;
    }

    function flushSeek(video) {
      if (!pendingTimes.has(video) || video.readyState < 1) return;
      const requested = pendingTimes.get(video);
      const time = Number.isFinite(video.duration)
        ? Math.min(requested, Math.max(0, video.duration)) : requested;
      try {
        video.currentTime = time;
        pendingTimes.delete(video);
      } catch (_) { /* Metadata may still be settling in a local-file player. */ }
    }

    function seek(video, time) {
      pendingTimes.set(video, Math.max(0, Number(time) || 0));
      flushSeek(video);
    }

    function play(video) {
      try {
        const result = video.play();
        if (result && typeof result.catch === 'function') result.catch(function () {});
      } catch (_) { /* A poster remains visible if browser autoplay is restricted. */ }
    }

    function makeVideo(className) {
      const video = element('video', className);
      video.muted = true;
      video.defaultMuted = true;
      video.loop = false;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.style.objectFit = 'contain';
      video.addEventListener('loadedmetadata', function () { flushSeek(video); });
      video.addEventListener('canplay', function () { flushSeek(video); });
      return video;
    }

    function makeBadges(items) {
      const badges = element('span', 'teaser-video-badges');
      (items || []).forEach(function (item) {
        const image = element('img', 'teaser-video-badge');
        image.src = item.src;
        image.alt = item.alt || '';
        image.draggable = false;
        badges.appendChild(image);
      });
      return badges;
    }

    function makeTaskStack(item) {
      const [x, y, width, height] = item.box;
      const stack = document.createElementNS(SVG, 'g');
      stack.setAttribute('class', 'teaser-video-task-stack');
      stack.setAttribute('aria-hidden', 'true');
      const photos = item.stackImages || [];
      const stepX = item.id === 'expert' ? 18 : 8;
      const stepY = item.id === 'expert' ? 0 : 15;
      function svgElement(tag, attrs) {
        const node = document.createElementNS(SVG, tag);
        Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
        return node;
      }
      for (let layer = photos.length; layer >= 1; layer--) {
        const box = { x: x - layer * stepX, y: y + layer * stepY, width, height };
        const clipId = stackPrefix + '-' + item.id + '-' + layer;
        const clip = svgElement('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
        clip.appendChild(svgElement('rect', { ...box, rx: 8 }));
        stack.appendChild(clip);
        stack.appendChild(svgElement('image', {
          ...box, href: photos[layer - 1], preserveAspectRatio: 'xMidYMid slice',
          'clip-path': 'url(#' + clipId + ')'
        }));
        stack.appendChild(svgElement('rect', {
          ...box, rx: 8, fill: 'none', stroke: '#fff', 'stroke-width': 2.6
        }));
      }
      return stack;
    }

    const dialog = element('dialog', 'teaser-video-dialog');
    const header = element('div', 'teaser-video-dialog-heading');
    const heading = element('h2', 'teaser-video-dialog-title');
    heading.id = 'loopwam-video-heading-' + Math.random().toString(36).slice(2, 9);
    dialog.setAttribute('aria-labelledby', heading.id);
    const closeButton = element('button', 'teaser-video-dialog-close');
    closeButton.type = 'button';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', '关闭视频');
    const media = element('div', 'teaser-video-dialog-media');
    const player = makeVideo('teaser-video-dialog-player');
    player.controls = true;
    media.appendChild(player);
    header.append(heading, closeButton);
    dialog.append(header, media);
    document.body.appendChild(dialog);

    const entries = (config.items || []).map(function (item) {
      stackLayer.appendChild(makeTaskStack(item));
      const frame = document.createElementNS(SVG, 'foreignObject');
      ['x', 'y', 'width', 'height'].forEach(function (name, index) {
        frame.setAttribute(name, item.box[index]);
      });
      frame.setAttribute('data-video-id', item.id);
      const button = element('button', 'teaser-video-card');
      button.type = 'button';
      button.style.width = '100%';
      button.style.height = '100%';
      button.setAttribute('aria-label', '放大播放 ' + item.label);
      button.setAttribute('aria-description', '多任务集合中的一个示例视频');
      button.setAttribute('aria-haspopup', 'dialog');
      const video = makeVideo('teaser-video-preview');
      const isRollout = item.id !== 'expert';
      const baseSpeed = isRollout ? 2 : 1;
      video.loop = !isRollout;
      video.defaultPlaybackRate = baseSpeed;
      video.playbackRate = baseSpeed;
      video.src = item.src;
      video.poster = item.poster || '';
      video.tabIndex = -1;
      video.setAttribute('aria-hidden', 'true');
      video.style.width = '100%';
      video.style.height = '100%';
      button.append(video, makeBadges(item.badges));
      frame.appendChild(button);
      group.appendChild(frame);
      const entry = { item: item, video: video, isRollout, baseSpeed, finished: false };
      button.addEventListener('click', function () { open(entry); });
      return entry;
    });
    svgRoot.appendChild(group);
    const rollouts = entries.filter(entry => entry.isRollout);

    // Both Rollouts cross this barrier before the next round starts.
    function resetRollouts() {
      rollouts.forEach(entry => { entry.finished = false; });
      rollouts.forEach(entry => { entry.video.pause(); seek(entry.video, 0); });
    }

    function ready(entry) {
      return entry.finished || (entry.video.readyState >= 3 && !entry.video.seeking && !pendingTimes.has(entry.video));
    }

    function sync() {
      if (destroyed) return;
      const inlinePlaying = desiredPlaying && !dialog.open;
      if (inlinePlaying && rollouts.length && rollouts.every(entry => entry.finished)) resetRollouts();
      const rolloutsReady = rollouts.every(ready);
      entries.forEach(function (entry) {
        if (inlinePlaying && (!entry.isRollout || (!entry.finished && rolloutsReady))) play(entry.video);
        else entry.video.pause();
      });
      if (dialog.open && desiredPlaying && !modalFinished && !player.ended) play(player);
      else player.pause();
    }

    entries.forEach(function (entry) {
      entry.video.addEventListener('ended', function () {
        if (!entry.isRollout || destroyed || !entry.video.ended) return;
        entry.finished = true;
        sync();
      });
      ['canplay', 'seeked', 'waiting'].forEach(name => entry.video.addEventListener(name, sync));
    });
    player.addEventListener('ended', function () { modalFinished = true; });
    player.addEventListener('play', function () { modalFinished = false; });
    player.addEventListener('seeking', function () {
      if (Number.isFinite(player.duration) && player.currentTime < player.duration - 0.01) modalFinished = false;
    });

    function open(entry) {
      if (destroyed || dialog.open) return;
      previousFocus = document.activeElement;
      activeEntry = entry;
      modalFinished = entry.finished;
      entries.forEach(function (other) { other.video.pause(); });
      heading.textContent = entry.item.label;
      const oldBadges = media.querySelector('.teaser-video-badges');
      if (oldBadges) oldBadges.remove();
      media.appendChild(makeBadges(entry.item.badges));
      player.src = entry.item.src;
      player.poster = entry.item.poster || '';
      player.loop = !entry.isRollout;
      player.defaultPlaybackRate = entry.baseSpeed;
      player.load();
      player.playbackRate = entry.baseSpeed;
      seek(player, entry.video.currentTime);
      dialog.showModal();
      closeButton.focus();
      if (hooks.onOpen) hooks.onOpen();
      sync();
    }

    function closed() {
      player.pause();
      if (activeEntry) {
        if (activeEntry.isRollout) activeEntry.finished = modalFinished || player.ended;
        seek(activeEntry.video, pendingTimes.has(player) ? pendingTimes.get(player) : player.currentTime);
      }
      activeEntry = null;
      modalFinished = false;
      pendingTimes.delete(player);
      player.removeAttribute('src');
      player.load();
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
      previousFocus = null;
      if (hooks.onClose) hooks.onClose();
      sync();
    }

    closeButton.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    // Native <dialog> handles Escape and keeps keyboard focus inside the modal.
    dialog.addEventListener('close', closed);

    return {
      setPlaying: function (value) {
        desiredPlaying = Boolean(value);
        sync();
      },
      reset: function () {
        if (destroyed) return;
        entries.forEach(function (entry) {
          entry.finished = false;
          entry.video.pause();
          seek(entry.video, 0);
        });
        modalFinished = false;
        if (dialog.open) {
          player.pause();
          seek(player, 0);
        }
        sync();
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        dialog.removeEventListener('close', closed);
        entries.forEach(function (entry) {
          entry.video.pause();
          entry.video.removeAttribute('src');
          entry.video.load();
        });
        player.pause();
        player.removeAttribute('src');
        player.load();
        if (dialog.open) dialog.close();
        dialog.remove();
        group.remove();
      }
    };
  };
}());
