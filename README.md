# LoopWAM project page

Source for the [LoopWAM project website](https://loop-wam.github.io/).
The research code is hosted separately at [loop-wam/LoopWAM](https://github.com/loop-wam/LoopWAM).

## Local preview

Python 3 is the only requirement. No third-party packages are needed.

```sh
python3 scripts/serve.py
```

Open <http://127.0.0.1:8765/>. Use `--port 8766` if port 8765 is already in use.
The preview server supports video seeking. You can also open `dist/index.html` directly.

## Source layout

- `dist/`: complete static website, including styles, scripts, images, and videos.
- `data/paper-content.json`: paper metadata and benchmark results.
- `data/media-manifest.json`: video metadata, grouping, ordering, and outcomes.
- `scripts/build.py`: generates `dist/index.html` from the template and data.
- `scripts/check_assets.py`: validates local resources, video ordering, and metadata.
- `scripts/serve.py`: local preview server.
- `.github/workflows/pages.yml`: builds, checks, and publishes `dist/` to GitHub Pages.

## Editing

Edit text and page structure in `scripts/build.py`; edit benchmark and video data in `data/`.
Styles and interactive behavior live in `dist/styles.css`, `dist/app.js`, and `dist/evolution.js`.
The animated teaser and method figure have their own scripts and styles under `dist/assets/`.

After changing the template or data, run:

```sh
python3 scripts/build.py
python3 scripts/check_assets.py
```

Direct edits to `dist/index.html` are overwritten by the build script.
The build does not re-encode media. All runtime assets are included in this repository.

## Video notes

The overview demo is the original 1920×1080, 30 fps video, lasting 3 minutes 34 seconds.
Its file size is approximately 93.31 MiB. Use Git to upload it; it exceeds GitHub's browser upload limit.

The 25 multi-embodiment task videos play at 1× relative to the supplied source clips.

Folding clips are encoded at 4×, except the first Stage 3 clip: its first 6 seconds remain at 1×, followed by 4× speed.
All folding files should play at the browser's normal 1× rate; their speed changes are baked into the videos.
Stage assignments and order are recorded in `data/media-manifest.json`.
The mixed-speed clip uses `speed_segments` with `start` and `end` in source-video seconds and `playback_speed: null`.

## GitHub Pages

Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
Each push to `main` runs the Pages workflow. It can also be started manually from the Actions tab.
Only `dist/` is published; the data and build scripts remain in the source repository.
