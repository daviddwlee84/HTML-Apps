#!/usr/bin/env python3
"""
Scaffold a new single-HTML app under apps/<app-name>/.

Features:
- Enforces kebab-case-ish naming recommendation.
- Creates:
  apps/<name>/
    index.html
    style.css
    main.js
    assets/
- Optionally updates root index.html by calling tools/gen_index.py.

No external dependencies.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
import subprocess


REPO_ROOT = Path(__file__).resolve().parents[1]
APPS_DIR = REPO_ROOT / "apps"
GEN_INDEX = REPO_ROOT / "tools" / "gen_index.py"


INDEX_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <main class="wrap">
    <header class="hero">
      <h1>{title}</h1>
      <p class="muted">A single-page HTML mini app.</p>
      <p class="muted">
        Served safely under GitHub Pages subpaths using relative URLs.
      </p>
    </header>

    <section class="card">
      <h2>It works 🎉</h2>
      <p>
        Edit <code>index.html</code>, <code>style.css</code>, and <code>main.js</code>
        to build your app.
      </p>
    </section>
  </main>

  <script type="module" src="./main.js"></script>
</body>
</html>
"""


STYLE_TEMPLATE = """\
:root {
  --bg: #ffffff;
  --fg: #111111;
  --muted: #6b7280;
  --border: #e5e7eb;
  --card: #ffffff;
  --shadow: 0 6px 20px rgba(0,0,0,0.06);
  --radius: 14px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
}

.wrap {
  max-width: 900px;
  margin: 48px auto 80px;
  padding: 0 20px;
}

.hero h1 {
  font-size: 28px;
  margin: 0 0 8px 0;
  letter-spacing: -0.02em;
}

.muted {
  color: var(--muted);
  font-size: 14px;
  margin: 6px 0;
}

.card {
  margin-top: 18px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px;
  box-shadow: var(--shadow);
}

code {
  background: #f8fafc;
  border: 1px solid var(--border);
  padding: 1px 6px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.95em;
}
"""


MAIN_TEMPLATE = """\
// {title} - main script
// Keep things simple and relative-path safe for GitHub Pages.

console.log("Hello from {title}!");

export function init() {{
  // Your app boot code here.
}}

init();
"""


def to_title(name: str) -> str:
    return " ".join(p.capitalize() for p in name.split("-") if p)


def validate_name(name: str) -> None:
    # Soft validation: allow alnum + dash
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
        print(
            "[new_app] Warning: app name should be kebab-case like 'my-cool-app'.",
            file=sys.stderr,
        )


def scaffold(name: str, with_css: bool, with_js: bool) -> Path:
    APPS_DIR.mkdir(parents=True, exist_ok=True)

    app_dir = APPS_DIR / name
    if app_dir.exists():
        raise FileExistsError(f"App folder already exists: {app_dir}")

    app_dir.mkdir(parents=True, exist_ok=False)
    (app_dir / "assets").mkdir(parents=True, exist_ok=True)

    title = to_title(name)
    (app_dir / "index.html").write_text(
        INDEX_TEMPLATE.format(title=title), encoding="utf-8"
    )

    if with_css:
        (app_dir / "style.css").write_text(STYLE_TEMPLATE, encoding="utf-8")

    if with_js:
        (app_dir / "main.js").write_text(
            MAIN_TEMPLATE.format(title=title), encoding="utf-8"
        )

    return app_dir


def update_index() -> None:
    if not GEN_INDEX.exists():
        print(
            "[new_app] gen_index.py not found. Skipping index update.", file=sys.stderr
        )
        return

    subprocess.run([sys.executable, str(GEN_INDEX)], check=False)


def main() -> int:
    parser = argparse.ArgumentParser(description="Scaffold a new single-HTML app.")
    parser.add_argument("name", help="App folder name (prefer kebab-case).")
    parser.add_argument("--no-css", action="store_true", help="Do not create style.css")
    parser.add_argument("--no-js", action="store_true", help="Do not create main.js")
    parser.add_argument(
        "--update-index",
        action="store_true",
        help="Run tools/gen_index.py after scaffolding",
    )

    args = parser.parse_args()

    name = args.name.strip()
    validate_name(name)

    try:
        app_dir = scaffold(name, with_css=not args.no_css, with_js=not args.no_js)
    except FileExistsError as e:
        print(f"[new_app] {e}", file=sys.stderr)
        return 1

    print(f"[new_app] Created: {app_dir.relative_to(REPO_ROOT)}")

    if args.update_index:
        update_index()
        print("[new_app] Updated root index.html")

    print("[new_app] Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
