(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData === true;
  let autoplay = !reduced && !saveData;
  const videos = $$('video').filter(video => !video.closest('#loop-visual, .teaser-video-dialog'));
  const visible = new Set();
  const manuallyPaused = new WeakSet();
  const automaticPause = new WeakSet();
  const positions = new WeakMap();
  const pending = new Map();
  videos.forEach(v => { if (v.getAttribute('src')) v.dataset.src = v.getAttribute('src'); });
  const loadVideo = v => { if (!v.getAttribute('src') && v.dataset.src) { v.src = v.dataset.src; v.load(); } };
  const play = v => { if (autoplay && !document.hidden && !manuallyPaused.has(v)) { loadVideo(v); v.play().catch(() => {}); } };
  const pause = v => { if (!v.paused) { automaticPause.add(v); v.pause(); } };
  const releaseVideo = v => {
    pause(v);
    if (v.getAttribute('src')) { positions.set(v, v.currentTime); v.removeAttribute('src'); v.load(); }
  };
  const toggle = $('[data-autoplay-toggle]');
  const syncToggle = () => { toggle.setAttribute('aria-pressed', String(autoplay)); toggle.lastElementChild.textContent = `Autoplay ${autoplay ? 'on' : 'off'}`; };
  syncToggle();
  toggle.addEventListener('click', () => { autoplay = !autoplay; syncToggle(); if (autoplay) visible.forEach(v => { manuallyPaused.delete(v); play(v); }); else videos.forEach(pause); });

  // Only videos that are visible in both their horizontal row and the viewport play.
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({target: v, isIntersecting, intersectionRatio}) => {
      clearTimeout(pending.get(v));
      if (isIntersecting && intersectionRatio >= .5) {
        visible.add(v);
        pending.set(v,setTimeout(() => { if (!saveData) loadVideo(v); play(v); },250));
      }
      else { visible.delete(v); releaseVideo(v); }
    });
  }, {threshold: [0, .5]});
  videos.forEach(v => {
    observer.observe(v);
    v.addEventListener('pointerdown', () => loadVideo(v), {once:true});
    v.addEventListener('keydown', () => loadVideo(v), {once:true});
    v.addEventListener('pause', () => { if (automaticPause.has(v)) automaticPause.delete(v); else if (visible.has(v)) manuallyPaused.add(v); });
    v.addEventListener('play', () => manuallyPaused.delete(v));
    v.addEventListener('loadedmetadata', () => { const t=positions.get(v); if(t && t < v.duration) v.currentTime=t; });
    v.addEventListener('error', () => {
      if (!v.getAttribute('src')) return;
      if (v.nextElementSibling?.classList.contains('media-error')) return;
      const p = document.createElement('p'); p.className = 'media-error';
      p.innerHTML = `Video could not load. <a href="${escape(v.getAttribute('src') || v.dataset.src)}" target="_blank" rel="noopener">Open the video directly ↗</a>`;
      v.insertAdjacentElement('afterend', p);
    });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) videos.forEach(pause); else visible.forEach(play); });

  $$('.carousel').forEach(row => {
    const prev = $(`[data-prev="${row.id}"]`), next = $(`[data-next="${row.id}"]`);
    const amount = () => row.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(row).gap);
    const move = direction => row.scrollBy({left:direction * amount(), behavior:reduced ? 'auto':'smooth'});
    const update = () => {
      prev.disabled = row.scrollLeft <= 3;
      next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 3;
    };
    prev.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
    row.addEventListener('keydown', e => { if (e.target !== row) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1);} });
    row.addEventListener('scroll', update, {passive:true}); new ResizeObserver(update).observe(row); update();
  });

  const benchmarks = JSON.parse($('#benchmark-data').textContent);
  const panel = $('#benchmark-panel');
  const columns = {
    method:'Method', embodied_pretraining:'Embodied pretraining', aloha_score:'ALOHA score', aloha_success:'ALOHA success (%)',
    dos_w1_score:'DOS-W1 score', dos_w1_success:'DOS-W1 success (%)', arx5_score:'ARX5 score', arx5_success:'ARX5 success (%)',
    ur5_score:'UR5 score', ur5_success:'UR5 success (%)', score:'Overall score', success:'Overall success (%)', clean:'Clean (%)',
    randomized:'Randomized (%)', average:'Average (%)', atomic_seen:'Atomic-Seen (%)', composite_seen:'Composite-Seen (%)',
    composite_unseen:'Composite-Unseen (%)', overall:'Overall (%)'
  };
  function benchmark(id) {
    const data = benchmarks.find(d => d.id === id);
    const field = {robochallenge:'success',robotwin:'average',robocasa:'overall'}[id];
    const digits = id === 'robochallenge' ? 2 : 1;
    const sorted = [...data.rows].sort((a,b) => b[field] - a[field]);
    const shown = sorted.slice(0,6);
    if (id === 'robochallenge' && !shown.some(r=>r.method.includes('expert-trained'))) shown.push(data.rows.find(r=>r.method.includes('expert-trained')));
    const bars = shown.map(r => `<div class="bar-row ${r.method==='LoopWAM'?'ours':''}"><span>${escape(r.method)}</span><div class="bar-track"><div class="bar-fill" style="--value:${r[field]}%"></div></div><span class="bar-score">${r[field].toFixed(digits)}%</span></div>`).join('');
    const headers = data.columns.map(c => `<th scope="col">${columns[c]}</th>`).join('');
    const rows = sorted.map(r => `<tr class="${r.method==='LoopWAM'?'ours':''}">${data.columns.map(c=>c==='method'?`<th scope="row">${escape(r[c])}</th>`:`<td>${typeof r[c]==='boolean'?(r[c]?'Yes':'No'):Number(r[c]).toFixed(digits)}</td>`).join('')}</tr>`).join('');
    const detail = id==='robotwin'?'Averages over clean and domain-randomized settings.':id==='robocasa'?'The 16 unseen composite tasks are excluded from expert and rollout training.':'Final results after three deployment-and-training rounds.';
    panel.innerHTML = `<div class="bench-title">${escape(data.metric_name)}</div><div class="bar-chart" role="img" aria-label="${escape(data.name)} success comparison">${bars}</div><details class="bench-detail"><summary>Full results & evaluation details</summary><p class="detail-note">${escape(data.description)} ${detail} Results are from the comparisons reported in our paper. LoopWAM initializes its video backbone from Wan2.2.</p><div class="table-scroll" tabindex="0" role="region" aria-label="Full ${escape(data.name)} results"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div></details>`;
    panel.setAttribute('aria-labelledby',`tab-${id}`);
    $$('[data-benchmark]').forEach(b=>{const selected=b.dataset.benchmark===id;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
  }
  const tabs = $$('[data-benchmark]');
  tabs.forEach((b,i)=>{
    b.addEventListener('click',()=>benchmark(b.dataset.benchmark));
    b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();let j=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[j].focus();benchmark(tabs[j].dataset.benchmark);}});
  });
  benchmark('robochallenge');

  const copyBibtexButton = $('#copy-bibtex');
  const bibtexCode = $('#bibtex-code');
  if (copyBibtexButton && bibtexCode) {
    const citationStatus = $('#citation-status');
    let copying = false;
    let copyLabelTimer = 0;
    const fallbackCopy = text => {
      const focused = document.activeElement;
      const scrollX = window.scrollX, scrollY = window.scrollY;
      const selection = window.getSelection();
      const ranges = selection ? Array.from({length: selection.rangeCount}, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.readOnly = true;
      textarea.tabIndex = -1;
      textarea.setAttribute('aria-hidden', 'true');
      textarea.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;pointer-events:none';
      document.body.appendChild(textarea);
      try {
        textarea.focus({preventScroll: true});
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        return document.execCommand('copy');
      } catch (_) {
        return false;
      } finally {
        textarea.remove();
        if (focused?.isConnected) focused.focus({preventScroll: true});
        if (selection) {
          selection.removeAllRanges();
          ranges.forEach(range => selection.addRange(range));
        }
        if (window.scrollX !== scrollX || window.scrollY !== scrollY) window.scrollTo({left: scrollX, top: scrollY, behavior: 'instant'});
      }
    };
    copyBibtexButton.addEventListener('click', async () => {
      if (copying) return;
      copying = true;
      clearTimeout(copyLabelTimer);
      if (citationStatus) citationStatus.textContent = '';
      let copied = false;
      try {
        const text = bibtexCode.textContent;
        if (window.location.protocol !== 'file:' && navigator.clipboard?.writeText) {
          try { await navigator.clipboard.writeText(text); copied = true; } catch (_) { /* Try the local-file-compatible fallback. */ }
        }
        if (!copied) copied = fallbackCopy(text);
      } catch (_) {
        copied = false;
      } finally {
        copying = false;
      }
      copyBibtexButton.textContent = copied ? 'Copied' : 'Copy BibTeX';
      if (citationStatus) citationStatus.textContent = copied ? 'BibTeX copied to clipboard.' : 'Copy unavailable. Select the BibTeX and press Control+C or Command+C to copy.';
      if (copied) {
        copyLabelTimer = setTimeout(() => { copyBibtexButton.textContent = 'Copy BibTeX'; }, 2000);
      } else {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(bibtexCode);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    });
  }

  // These links follow the document's scroll position; every chapter stays visible.
  const chapterEntries = $$('.chapter-link').map(link => ({
    link,
    section: document.getElementById(link.hash.slice(1))
  })).filter(entry => entry.section);
  if (chapterEntries.length) {
    let chapterFrame = 0;
    const setActiveChapter = active => {
      chapterEntries.forEach(({link, section}) => {
        const selected = section === active;
        link.classList.toggle('is-active', selected);
        if (selected) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    const updateActiveChapter = () => {
      chapterFrame = 0;
      let active = chapterEntries[0].section;
      chapterEntries.forEach(({section}) => {
        if (section.getBoundingClientRect().top <= 160) active = section;
      });
      const scrollingElement = document.scrollingElement || document.documentElement;
      const atPageEnd = scrollingElement.scrollHeight - window.innerHeight - window.scrollY <= 2;
      if (atPageEnd) active = chapterEntries[chapterEntries.length - 1].section;
      setActiveChapter(active);
    };
    const scheduleChapterUpdate = () => {
      if (!chapterFrame) chapterFrame = requestAnimationFrame(updateActiveChapter);
    };
    const reflectChapterHash = () => {
      const entry = chapterEntries.find(({link}) => link.hash === window.location.hash);
      if (entry) setActiveChapter(entry.section);
      scheduleChapterUpdate();
    };
    window.addEventListener('scroll', scheduleChapterUpdate, {passive: true});
    window.addEventListener('resize', scheduleChapterUpdate);
    window.addEventListener('hashchange', reflectChapterHash);
    window.addEventListener('load', scheduleChapterUpdate);
    window.addEventListener('pageshow', scheduleChapterUpdate);
    new ResizeObserver(scheduleChapterUpdate).observe($('.chapter-content'));
    reflectChapterHash();
  }
})();
