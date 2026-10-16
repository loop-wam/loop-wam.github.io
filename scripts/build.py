from pathlib import Path
import json
import html

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT
DIST = SITE / 'dist'
paper = json.loads((ROOT / 'data/paper-content.json').read_text())
media = json.loads((ROOT / 'data/media-manifest.json').read_text())
esc = lambda s: html.escape(str(s), quote=True)
mark = '<img src="assets/branding/loopwam-mark.png" alt="" width="204" height="102">'


def icon(name):
    paths = {
        'paper': '<path d="M5 3h9l5 5v13H5z"/><path d="M14 3v6h5M9 13h6M9 17h6"/>',
        'code': '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-12-2 14"/>',
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>'


def video(clip, title, hero=False):
    source = f'src="{esc(clip["src"])}"' if hero else f'data-src="{esc(clip["src"])}"'
    preload = 'metadata' if hero else 'none'
    return f'<video {source} poster="{esc(clip["poster"])}" muted loop playsinline controls preload="{preload}" aria-label="{esc(title)}" data-autoplay>Your browser does not support embedded video. <a href="{esc(clip["src"])}">Open video</a></video>'


def card(clip, folding=False, trajectory_number=None):
    title = clip.get('title', 'Shirt folding')
    if folding:
        title = f'Shirt folding · Stage {clip["stage"]} · Trajectory {trajectory_number}'
        verdict = 'Success' if clip['success'] else 'Failure'
        kind = 'success' if clip['success'] else 'failure'
        caption = f'<figcaption><span class="result-label {kind}">{verdict}</span></figcaption>'
    elif trajectory_number is not None:
        label = f'Trajectory {trajectory_number}'
        title = title + ' · ' + label
        caption = f'<figcaption>{label}</figcaption>'
    else:
        caption = f'<figcaption>{esc(title)}</figcaption>'
    return '<figure class="video-card"><div class="video-frame">' + video(clip, title) + '</div>' + caption + '</figure>'


def controls(row_id, label):
    return f'<div class="carousel-controls"><button type="button" data-prev="{row_id}" aria-label="Previous {label} videos" aria-controls="{row_id}">←</button><button type="button" data-next="{row_id}" aria-label="Next {label} videos" aria-controls="{row_id}">→</button></div>'


task_rows = []
for group in media['task_groups']:
    row_id = 'gallery-' + group['robot']
    name = 'DOS-W1' if group['robot'] == 'w1' else group['label']
    task_rows.append(f'<div class="gallery-group"><div class="gallery-row-head"><h4>{name}</h4>{controls(row_id, name)}</div><div class="carousel" id="{row_id}" tabindex="0" role="region" aria-label="{name} task videos">' + ''.join(card(c) for c in group['clips']) + '</div></div>')

stage_rows = []
for group in media['folding_stages']:
    number = group['stage']
    stage = paper['folding']['stages'][number - 1]
    row_id = f'folding-{number}'
    trajectory_caption = '9 deployment trajectories' if number == 3 else '9 random trajectories'
    stage_rows.append(f'<div class="stage"><div class="stage-header"><div class="stage-title"><h3>{stage["label"]}</h3><p>{esc(stage["description"])}</p></div><div class="stage-navigation"><span>{trajectory_caption}</span>{controls(row_id, stage["label"])}</div></div><div class="carousel" id="{row_id}" tabindex="0" role="region" aria-label="{stage["label"]} trajectory demos">' + ''.join(card(c, folding=True, trajectory_number=i) for i, c in enumerate(group['clips'], start=1)) + '</div></div>')

generation_rows = []
for group in media['generation_tasks']:
    generation_rows.append(f'<div class="generation-task"><h3>{esc(group["title"])}</h3><div class="generation-pair">' + ''.join(card(c, trajectory_number=i) for i, c in enumerate(group['clips'], start=1)) + '</div></div>')

co_first_authors = {'Wenxuan Guo', 'Yingping Liang', 'Zhaoguo Wang'}
co_corresponding_authors = {'Xiuwei Xu', 'Meng Zhang', 'Jiwen Lu'}


def author_label(name):
    if name in co_first_authors:
        marker = '<sup class="author-marker" title="Core Contributor">*</sup>'
    elif name in co_corresponding_authors:
        marker = '<sup class="author-marker corresponding-marker" title="Corresponding Author">†</sup>'
    else:
        marker = ''
    return f'<span>{esc(name)}{marker}</span>'


authors = ''.join(author_label(name) for name in paper['authors'])
affiliation_links = {'Dexmal': 'https://www.dexmal.com/', 'Loopeva': 'https://www.loopeva.com/'}
affiliations = ''.join(
    f'<a href="{esc(affiliation_links[name])}" target="_blank" rel="noopener noreferrer">{esc(name)}</a>'
    if name in affiliation_links else f'<span>{esc(name)}</span>'
    for name in paper['affiliations']
)
def evolution(key, title, values, labels, variant='line'):
    points = [(64 + i * 592 / (len(values) - 1), 218 - value * 3) for i, value in enumerate(values)]
    path = 'M ' + ' L '.join(f'{x:.3f} {y:.3f}' for x, y in points)
    area = f'M {points[0][0]:.3f} 218 L ' + ' L '.join(f'{x:.3f} {y:.3f}' for x, y in points) + f' L {points[-1][0]:.3f} 218 Z'
    bars = ''
    if variant == 'steps':
        bars = ''.join(f'<rect class="evolution-bar-ghost" x="{x-30:.3f}" y="{y:.3f}" width="60" height="{218-y:.3f}" rx="8"/><rect class="evolution-bar" data-evolution-bar data-index="{i}" x="{x-30:.3f}" y="{y:.3f}" width="60" height="{218-y:.3f}" rx="8"/>' for i, (x, y) in enumerate(points))
    nodes = ''.join(f'<g data-evolution-node data-index="{i}" class="evolution-node is-reached{ " is-current" if i == len(values)-1 else "" }" transform="translate({x:.3f} {y:.3f})"><circle r="5"/></g>' for i, (x,y) in enumerate(points))
    buttons = ''.join(f'<button class="evolution-stage{ " is-current" if i == len(values)-1 else "" } is-reached" type="button" data-stage="{i}" aria-pressed="{str(i == len(values)-1).lower()}" aria-label="View {esc(label)}: {value:.2f}% success"><span class="evolution-stage-name">{esc(label)}</span><span class="evolution-stage-value">{value:.2f}<small>%</small></span></button>' for i, (value, label) in enumerate(zip(values, labels)))
    return f'''<section class="evolution evolution--{variant}" id="{key}-evolution" aria-labelledby="{key}-evolution-title" data-values="{esc(json.dumps(values))}" data-labels="{esc(json.dumps(labels))}" data-variant="{variant}">
      <div class="evolution-heading"><h3 id="{key}-evolution-title">{esc(title)}</h3><button class="evolution-toggle" type="button" aria-label="Replay {esc(title)} animation">Replay</button></div>
      <div class="evolution-display">
        <div class="evolution-readout"><div class="evolution-score"><span class="evolution-value">{values[-1]:.2f}</span><small>%</small></div><span class="evolution-current">{esc(labels[-1])}</span><span class="evolution-gain" title="Percentage-point improvement from the first stage">+{values[-1]-values[0]:.2f} pp</span></div>
        <div class="evolution-chart">
          <div class="evolution-plot"><span class="evolution-axis axis-high" aria-hidden="true">60%</span><span class="evolution-axis axis-mid" aria-hidden="true">30%</span><span class="evolution-axis axis-low" aria-hidden="true">0</span>
            <svg viewBox="0 0 720 250" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="{key}-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".2"/><stop offset="100%" stop-color="currentColor" stop-opacity=".01"/></linearGradient><linearGradient id="{key}-bars" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".9"/><stop offset="100%" stop-color="currentColor" stop-opacity=".2"/></linearGradient><clipPath id="{key}-clip"><rect class="evolution-reveal" x="0" y="0" width="720" height="250"/></clipPath></defs>
              <path class="evolution-grid" d="M 44 38 H 690 M 44 128 H 690 M 44 218 H 690"/>
              <path class="evolution-area" d="{area}" fill="url(#{key}-area)" clip-path="url(#{key}-clip)"/>
              <g fill="url(#{key}-bars)">{bars}</g>
              <path class="evolution-line-ghost" d="{path}"/>
              <path class="evolution-line" d="{path}" pathLength="1" clip-path="url(#{key}-clip)"/>
              {nodes}
              <g class="evolution-cursor" transform="translate({points[-1][0]:.3f} {points[-1][1]:.3f})"><circle class="evolution-halo" r="16"/><circle class="evolution-dot" r="6"/></g>
            </svg>
          </div>
          <div class="evolution-stages" role="group" aria-label="{esc(title)} stages" style="--stage-count:{len(values)}">{buttons}</div>
        </div>
      </div>
      <p class="evolution-status visually-hidden" role="status"></p>
    </section>'''


steps = evolution('multitask', 'RoboChallenge success rate', paper['multitask']['success_rates'], paper['multitask']['rounds'])
folding_steps = evolution('folding', 'Shirt-folding success rate', paper['folding']['success_rates'], [f'Stage {i + 1}' for i in range(3)], 'steps')
montage = {'src': 'assets/videos/rollout-30-tasks.mp4', 'poster': 'assets/posters/rollout-30-tasks.jpg'}
benchmark_json = json.dumps(paper['benchmarks'], ensure_ascii=False).replace('</', '<\\/')

citation_authors = '\n              and '.join(
    ' and '.join(paper['authors'][i:i + 3]) for i in range(0, len(paper['authors']), 3)
)
citation_title = paper['title'].replace('LoopWAM', '{LoopWAM}', 1)
bibtex = (
    '@misc{guo2026loopwam,\n'
    f'  title = {{{citation_title}}},\n'
    f'  author = {{{citation_authors}}},\n'
    '  year = {2026},\n'
    '  eprint = {2610.18873},\n'
    '  archivePrefix = {arXiv},\n'
    '  primaryClass = {cs.RO},\n'
    '  url = {https://arxiv.org/abs/2610.18873}\n'
    '}'
)

page = f'''<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(paper['title'])}</title>
  <meta name="description" content="LoopWAM: Closed-Loop Generalist Policy Improvement from Deployment Rollouts. Learning from real-world experience across tasks and embodiments.">
  <meta name="theme-color" content="#f6f7f9">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{esc(paper['title'])}">
  <meta property="og:description" content="Self-improvement from deployment.">
  <meta property="og:image" content="assets/branding/teaser.webp">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" href="assets/branding/loopwam-mark.png">
  <link rel="stylesheet" href="styles.css?v=20261016-bibtex">
  <link rel="stylesheet" href="assets/teaser/css/embedded.css?v=20261012-replay">
  <link rel="stylesheet" href="assets/method/css/method.css?v=20261012-transparent">
  <script src="assets/method/js/config.js?v=20261012-transparent" defer></script>
  <script src="assets/method/js/method.js?v=20261012-transparent" defer></script>
  <script src="app.js?v=20261016-bibtex-2" defer></script>
  <script src="evolution.js?v=20261008-2" defer></script>
  <script src="assets/teaser/js/config.js?v=20261010-2" defer></script>
  <script src="assets/teaser/js/collection-animation.js?v=20261010-2" defer></script>
  <script src="assets/teaser/js/loop-animation.js?v=20261012-replay" defer></script>
  <script src="assets/teaser/js/video-player.js?v=20261012-replay" defer></script>
  <script src="assets/teaser/js/embedded.js?v=20261012-replay" defer></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="topbar">
  <div class="wrap topbar-inner">
    <a class="brand" href="#main" aria-label="LoopWAM home">{mark}<span>LoopWAM</span></a>
    <nav class="topnav" aria-label="Main navigation">
      <a href="#approach">Overview</a><a href="#method">Method</a><a href="#results">Results</a><a href="#multitask">Demos</a><a href="#generation">Video generation</a>
    </nav>
  </div>
</header>
<main id="main">
  <section class="hero wrap" aria-labelledby="hero-title">
    <h1 id="hero-title">{mark}<span><span class="loop-word">Loop</span><span class="wam-word">WAM</span></span></h1>
    <p class="subtitle">Closed-Loop Generalist Policy Improvement<br class="desktop-break"> from Deployment Rollouts</p>
    <div class="authors">{authors}</div>
    <p class="author-notes"><span>* Core Contributors</span><span><sup class="author-marker corresponding-marker">†</sup> Corresponding Authors</span></p>
    <div class="affiliations">{affiliations}</div>
    <div class="actions">
      <a class="resource-button" href="https://arxiv.org/abs/2610.18873" target="_blank" rel="noopener noreferrer">{icon('paper')}<span>Paper</span></a>
      <a class="resource-button" href="https://github.com/loop-wam/LoopWAM" target="_blank" rel="noopener noreferrer">{icon('code')}<span>Code</span></a>
    </div>
    <div class="hero-film">{video(media['overview'], 'LoopWAM overview: multi-task improvement and shirt folding', True)}</div>
  </section>

  <section class="section wrap" id="approach">
    <div class="section-heading">
      <span class="section-symbol section-symbol--loop" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8C13 16 11 8 6 8a4 4 0 1 0 0 8Z"/></svg></span>
      <h2>Closed-loop self-improvement</h2>
      <p>LoopWAM turns real-world experience into better robot policies. By learning from successful, suboptimal, and failed rollouts alongside expert demonstrations, it closes the loop between deployment and improvement.</p>
    </div>
    <figure class="teaser-figure">
      <div class="teaser-live" id="loop-visual" role="group" tabindex="0" aria-label="LoopWAM animated teaser" aria-description="Press Space to pause or resume. Select a video to open a larger player." aria-keyshortcuts="Space"><img class="teaser-fallback" src="assets/branding/teaser.webp" alt="LoopWAM: deploy, collect, and improve through real-world experience." width="3000" height="1233" loading="lazy"></div>
    </figure>
    <div class="teaser-playback" hidden><button type="button" data-teaser-toggle aria-controls="loop-visual" aria-label="Pause animated teaser">Pause</button><button type="button" data-teaser-replay aria-controls="loop-visual" aria-label="Replay animated teaser">Replay</button></div>
  </section>

  <section class="section method-section wrap" id="method">
    <div class="section-heading">
      <span class="section-symbol section-symbol--method" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg></span>
      <h2>Method and key techniques</h2>
    </div>
    <div class="method-panel">
      <figure class="method-figure">
        <div class="loopwam-method" id="method-visual" data-loopwam-method role="group" tabindex="0" aria-label="LoopWAM animated method figure" aria-description="Original paper layout with animated arrows and nodes. Press Space to pause or resume." aria-keyshortcuts="Space"><img class="loopwam-method-base" src="assets/method/images/method.svg" alt="LoopWAM method: mixed-quality expert and rollout data train video and action branches through joint attention, source-dependent noise, quality-weighted supervision and quality steering." width="2400" height="1118" loading="lazy"></div>
      </figure>
      <div class="loopwam-method-controls" data-method-controls="method-visual" hidden>
        <button type="button" data-method-toggle aria-controls="method-visual">Pause</button>
        <button type="button" data-method-replay aria-controls="method-visual">Replay</button>
      </div>
      <div class="techniques">
        <article class="technique"><h3>Joint video–action modeling</h3><p>Video and action tokens interact through bidirectional attention throughout joint denoising.</p></article>
        <article class="technique"><h3>Source-dependent noise</h3><p>Lower-noise rollout actions guide video prediction to learn their observed physical consequences.</p></article>
        <article class="technique"><h3>Quality-aware learning</h3><p>Quality conditions and weights guide action learning. Every rollout teaches video prediction, without imitating failed actions.</p></article>
      </div>
    </div>
  </section>

  <div class="research-layout">
    <aside class="chapter-sidebar">
      <nav class="chapter-nav" aria-label="Research chapters">
        <a class="chapter-link is-active" href="#results" aria-current="location"><span class="chapter-index">01</span><span class="chapter-label">Leaderboards</span></a>
        <a class="chapter-link" href="#multitask"><span class="chapter-index">02</span><span class="chapter-label">Multi-task</span></a>
        <a class="chapter-link" href="#folding"><span class="chapter-index">03</span><span class="chapter-label">Post-training</span></a>
        <a class="chapter-link" href="#generation"><span class="chapter-index">04</span><span class="chapter-label">Video generation</span></a>
      </nav>
    </aside>
    <div class="chapter-content">
  <section class="section results-section chapter-card" id="results">
    <div class="chapter-inner">
      <div class="section-heading">
        <span class="section-number" aria-hidden="true">01</span>
        <h2>Real-world and simulation leaderboards</h2>
        <p>Best overall performance among the methods compared in our paper on three benchmarks.</p>
      </div>
      <div class="metrics">
        <div class="metric"><b>43.33<small>%</small></b><h3>RoboChallenge Table30-V2</h3><p>Real-world success</p></div>
        <div class="metric"><b>94.5<small>%</small></b><h3>RoboTwin 2.0</h3><p>Average success</p></div>
        <div class="metric"><b>49.5<small>%</small></b><h3>RoboCasa365</h3><p>Overall success</p></div>
      </div>
      <div class="benchmark-box">
        <div class="tabs" role="tablist" aria-label="Benchmark comparisons">
          <button role="tab" id="tab-robochallenge" aria-selected="true" aria-controls="benchmark-panel" data-benchmark="robochallenge">RoboChallenge</button>
          <button role="tab" id="tab-robotwin" aria-selected="false" aria-controls="benchmark-panel" data-benchmark="robotwin" tabindex="-1">RoboTwin 2.0</button>
          <button role="tab" id="tab-robocasa" aria-selected="false" aria-controls="benchmark-panel" data-benchmark="robocasa" tabindex="-1">RoboCasa365</button>
        </div>
        <div class="bench-content" id="benchmark-panel" role="tabpanel" aria-labelledby="tab-robochallenge"></div>
      </div>
    </div>
  </section>

  <section class="section chapter-card" id="multitask">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true">02</span>
      <h2>Multi-task self-improvement</h2>
      <p>30 tasks. Four embodiments. One multi-task model per embodiment, improving through three rounds of real-world deployment.</p>
    </div>
    <div class="overview-video">{video(montage, 'All 30 RoboChallenge task rollouts in a 5 by 6 grid')}</div>
    <p class="media-caption">Multi-task deployment and rollout data feedback.</p>
    {steps}
    <p class="metric-caption">Performance across multiple deployment rounds</p>
    <div class="gallery-toolbar"><div class="gallery-heading"><h3>Multi-embodiment results after self-improvement</h3><p class="gallery-speed-note">Videos play at 1× speed.</p></div><button class="autoplay-toggle" type="button" data-autoplay-toggle aria-pressed="true"><span class="autoplay-dot"></span><span>Autoplay on</span></button></div>
    {''.join(task_rows)}
  </section>

  <section class="section folding-section chapter-card" id="folding">
    <div class="chapter-inner">
      <div class="section-heading">
        <span class="section-number" aria-hidden="true">03</span>
        <h2>Post-training self-improvement<br class="desktop-break"> on a challenging task</h2>
        <p>After expert post-training, two rounds of deployment-driven learning improve the DOS-W1 model on challenging shirt folding.</p>
      </div>
      {folding_steps}
      <p class="metric-caption">Evaluation success rates. Trajectory demos play at up to 4× speed.</p>
      {''.join(stage_rows)}
    </div>
  </section>

  <section class="section chapter-card" id="generation">
    <div class="section-heading">
      <span class="section-number" aria-hidden="true">04</span>
      <h2>Consistent action and video generation</h2>
      <p>Video and action generation, learned together. Each example pairs observed video on the left with LoopWAM’s prediction on the right.</p>
    </div>
    {''.join(generation_rows)}
  </section>
    </div>
  </div>
  <section class="section citation-section wrap" id="citation" aria-labelledby="citation-title">
    <div class="section-heading"><h2 id="citation-title">BibTeX</h2></div>
    <div class="citation-box">
      <div class="citation-toolbar"><button type="button" id="copy-bibtex" aria-controls="bibtex-code">Copy BibTeX</button></div>
      <pre tabindex="0" aria-label="BibTeX citation"><code id="bibtex-code">{esc(bibtex)}</code></pre>
    </div>
    <p id="citation-status" class="visually-hidden" role="status" aria-live="polite"></p>
  </section>
</main>
<footer class="footer"><div class="wrap footer-inner"><a class="brand" href="#main" aria-label="LoopWAM home">{mark}<span>LoopWAM</span></a></div></footer>
<script id="benchmark-data" type="application/json">{benchmark_json}</script>
<noscript><p class="no-js-note">Enable JavaScript to play the video galleries and switch benchmark comparisons.</p></noscript>
</body>
</html>'''

(DIST / 'index.html').write_text(page)
print('Generated local index.html with', len(task_rows), 'robot rows,', len(stage_rows), 'folding stages and', len(generation_rows), 'generation rows.')
