#!/usr/bin/env python3
"""Check the packaged site's asset references using only the Python standard library.

Run from any directory: python3 scripts/check_assets.py
This verifies files and metadata, not video decoding or browser rendering.
"""

import argparse
from collections import Counter
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET


CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.I | re.S)
JS_ASSET = re.compile(r"(['\"])(assets/[^'\"\r\n]+)\1")
NEW_URL = re.compile(r"new\s+URL\(\s*(['\"])([^'\"\r\n]+)\1\s*,")
LOCAL_ABSOLUTE = re.compile(
    r"file:" + r"//|(?<![\w:])/(?:Users|home|Volumes|private|tmp|mnt|opt)/"
    r"|(?<![\w])[A-Za-z]:[\\/]", re.I
)


class PageParser(HTMLParser):
    def __init__(self, audit, path):
        super().__init__(convert_charrefs=True)
        self.audit, self.path = audit, path
        self.videos, self.folding, self.stack = [], {}, []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for name in ("src", "data-src", "poster", "href"):
            if attrs.get(name):
                self.audit.reference(attrs[name], self.path, f"HTML {tag}[{name}]")
        if tag == "meta" and attrs.get("property") == "og:image":
            self.audit.reference(attrs.get("content", ""), self.path, "og:image")
        if attrs.get("style"):
            self.audit.css_references(attrs["style"], self.path)
        if tag == "div":
            self.stack.append(attrs.get("id", ""))
        if tag == "video":
            src = attrs.get("data-src") or attrs.get("src", "")
            self.videos.append(src)
            for group in self.stack:
                if re.fullmatch(r"folding-[123]", group):
                    self.folding.setdefault(group, []).append(src)

    def handle_endtag(self, tag):
        if tag == "div" and self.stack:
            self.stack.pop()


class Audit:
    def __init__(self, root):
        self.root = root.resolve()
        self.dist = self.root / "dist"
        self.errors, self.referenced = [], set()
        self.files = []

    def error(self, message):
        self.errors.append(message)

    def label(self, path):
        try:
            return str(path.relative_to(self.root))
        except ValueError:
            return str(path)

    def read(self, path):
        try:
            return path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            self.error(f"Cannot read {self.label(path)}: {exc}")
            return ""

    def reference(self, value, owner, context):
        value = unescape(str(value)).strip()
        if not value or value.startswith("#"):
            return
        try:
            parsed = urlsplit(value)
        except ValueError as exc:
            self.error(f"{self.label(owner)} ({context}): invalid URL: {exc}")
            return
        if parsed.scheme.lower() == "file" or re.match(r"^[A-Za-z]:[\\/]", value):
            self.error(f"{self.label(owner)} ({context}): absolute local path {value}")
            return
        if parsed.scheme or parsed.netloc:
            return  # Data URIs and website links do not name packaged files.
        raw_path = unquote(parsed.path)
        if not raw_path:
            return
        target = ((self.dist / raw_path.lstrip("/")) if raw_path.startswith("/")
                  else (owner.parent / raw_path)).resolve()
        try:
            target.relative_to(self.dist)
        except ValueError:
            self.error(f"{self.label(owner)} ({context}): reference leaves dist: {value}")
            return
        if not target.is_file():
            self.error(f"{self.label(owner)} ({context}): missing asset {value}")
        else:
            self.referenced.add(target)

    def css_references(self, text, owner):
        for match in CSS_URL.finditer(text):
            self.reference(match.group(2), owner, "CSS url()")
        for match in re.finditer(r"@import\s+(['\"])(.*?)\1", text, re.I):
            self.reference(match.group(2), owner, "CSS @import")

    def package_files(self):
        if not self.dist.is_dir():
            self.error("Missing dist directory.")
        for path in self.root.rglob("*"):
            if path.is_symlink():
                self.error(f"Symbolic link is not portable: {self.label(path)}")
            elif path.is_file():
                self.files.append(path)
        for path in self.files:
            if path.suffix.lower() not in {".html", ".css", ".js", ".json", ".svg", ".py"}:
                continue
            if path.resolve() == Path(__file__).resolve():
                continue
            text = self.read(path)
            match = LOCAL_ABSOLUTE.search(text)
            if match:
                self.error(f"Absolute local path in {self.label(path)} near {match.group(0)!r}")
            if path.suffix.lower() == ".css":
                self.css_references(text, path)
            elif path.suffix.lower() == ".svg":
                try:
                    svg = ET.fromstring(text)
                    for node in svg.iter():
                        for name, value in node.attrib.items():
                            if name.rsplit("}", 1)[-1] == "href":
                                self.reference(value, path, "SVG href")
                            elif name == "style":
                                self.css_references(value, path)
                        if node.tag.rsplit("}", 1)[-1] == "style" and node.text:
                            self.css_references(node.text, path)
                except ET.ParseError as exc:
                    self.error(f"Invalid SVG {self.label(path)}: {exc}")

    def dynamic_assets(self):
        teaser = self.dist / "assets/teaser"
        config = self.read(teaser / "js/config.js")
        paths = {m.group(2) for m in JS_ASSET.finditer(config)}
        if not paths:
            self.error("Teaser config has no discoverable assets/ paths.")
        for value in paths:
            # embedded.js resolves assets/ against the teaser root, not the page root.
            self.reference(value, teaser / "index.html", "teaser config")
        embedded = self.read(teaser / "js/embedded.js")
        dynamic = {m.group(2) for m in NEW_URL.finditer(embedded)
                   if m.group(2).startswith("assets/")}
        if "assets/images/teaser-background.png" not in dynamic:
            self.error("Missing expected dynamic teaser background URL in embedded.js.")
        for value in dynamic:
            self.reference(value, teaser / "index.html", "teaser embedded URL")
        method = self.dist / "assets/method/js/method.js"
        urls = {m.group(2) for m in NEW_URL.finditer(self.read(method))}
        if "../images/method.svg" not in urls:
            self.error("Missing method.js fallback new URL('../images/method.svg', ...).")
        for value in urls:
            self.reference(value, method, "method new URL")

    def manifest(self, page):
        source = self.root / "data/media-manifest.json"
        try:
            data = json.loads(self.read(source))
            task_groups = data["task_groups"]
            stages = data["folding_stages"]
            generation_groups = data["generation_tasks"]
            tasks = [clip for group in task_groups for clip in group["clips"]]
            folding = [clip for group in stages for clip in group["clips"]]
            generation = [clip for group in generation_groups for clip in group["clips"]]
            sets = [("tasks", tasks, 25), ("folding", folding, 27), ("generation", generation, 8)]
            for name, entries, expected in sets:
                if len(entries) != expected or len({c["id"] for c in entries}) != expected:
                    self.error(f"Manifest {name}: expected {expected} unique clips, got {len(entries)}.")
                wanted = [c["src"] for c in entries]
                actual = [s for s in page.videos if s.startswith(f"assets/videos/{name}/")]
                if Counter(wanted) != Counter(actual):
                    self.error(f"HTML {name} videos differ from the manifest.")
            if len(task_groups) != 4:
                self.error("Expected four robot task groups.")
            if len(generation_groups) != 4 or any(len(g["clips"]) != 2 for g in generation_groups):
                self.error("Expected four generation tasks with two clips each.")
            if len(stages) != 3 or sorted(g["stage"] for g in stages) != [1, 2, 3]:
                self.error("Expected folding stages 1, 2 and 3 exactly once.")
            for group in stages:
                number, entries = group["stage"], group["clips"]
                if len(entries) != 9 or group.get("total") != 9:
                    self.error(f"Folding stage {number}: expected nine clips.")
                if group.get("playback_speed") != 4:
                    self.error(f"Folding stage {number}: playback_speed must be 4.")
                if any(c.get("playback_speed") != 4 or c.get("stage") != number for c in entries):
                    self.error(f"Folding stage {number}: incorrect clip speed or stage metadata.")
                if any(type(c.get("success")) is not bool for c in entries):
                    self.error(f"Folding stage {number}: success labels must be boolean.")
                if group.get("success_count") != sum(c.get("success") is True for c in entries):
                    self.error(f"Folding stage {number}: success_count differs from clip labels.")
                if page.folding.get(f"folding-{number}") != [c["src"] for c in entries]:
                    self.error(f"Folding stage {number}: HTML order differs from the manifest.")
            entries = [data["overview"]] + tasks + folding + generation
            for clip in entries:
                for field in ("src", "poster"):
                    self.reference(clip[field], self.dist / "index.html", f"manifest {clip['id']} {field}")
            wanted = [c["src"] for c in entries] + ["assets/videos/rollout-30-tasks.mp4"]
            if Counter(wanted) != Counter(page.videos):
                self.error("Expected exactly 62 HTML videos: overview, montage, 25 tasks, 27 folding, 8 generation.")
        except (ValueError, KeyError, TypeError, AttributeError) as exc:
            self.error(f"Invalid media manifest structure: {exc}")

    def run(self):
        self.package_files()
        page = PageParser(self, self.dist / "index.html")
        page.feed(self.read(page.path))
        self.dynamic_assets()
        self.manifest(page)
        if self.errors:
            print(f"FAIL: {len(self.errors)} asset/metadata error(s)", file=sys.stderr)
            for error in self.errors:
                print(f"- {error}", file=sys.stderr)
            return 1
        count = sum(p.is_relative_to(self.dist) for p in self.files)
        print(f"PASS: {count} dist files; {len(self.referenced)} referenced local assets; no missing files or symlinks.")
        print("PASS: 25 task, 27 folding (3 × 9 at baked 4× speed), 8 generation clips; HTML order matches manifest.")
        print("PASS: teaser/method runtime URLs, SVG resources, CSS URLs and portable paths checked.")
        print("Video speed is checked from metadata; this script does not decode media.")
        return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1],
                        help="Source package root (default: parent of scripts).")
    return Audit(parser.parse_args().root).run()


if __name__ == "__main__":
    raise SystemExit(main())
