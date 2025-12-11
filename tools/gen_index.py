#!/usr/bin/env python3
"""
Generate root index.html for a multi single-HTML apps repo.

- Scans: apps/*/index.html
- Generates: ./index.html
- Uses relative links safe for GitHub Pages subpath hosting.

No external dependencies.
"""

from __future__ import annotations

import html
import os
from pathlib import Path
from datetime import datetime


REPO_ROOT = Path(__file__).resolve().parents[1]
APPS_DIR = REPO_ROOT / "apps"
OUTPUT = REPO_ROOT / "index.html"


def title_case_from_kebab(name: str) -> str:
    # "my-cool-app" -> "My Cool App"
    return " ".join(p.capitalize() for p in name.split("-") if p)


def detect_apps() -> list[dict]:
    apps = []
    if not APPS_DIR.exists():
        return apps

    for child in sorted(APPS_DIR.iterdir(), key=lambda p: p.name.lower()):
        if not child.is_dir():
            continue

        index_file = child / "index.html"
        if not index_file.exists():
            continue

        folder = child.name
        title = title_case_from_kebab(folder)

        apps.append(
            {
                "folder": folder,
                "title": title,
                "href": f"./apps/{folder}/",
            }
        )
    return apps


def render_index(apps: list[dict]) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cards_html = []
    if apps:
        for app in apps:
            title = html.escape(app["title"])
            href = html.escape(app["href"])
            folder = html.escape(app["folder"])

            cards_html.append(
                f"""
                <a class="card" href="{href}">
                  <div class="card-title">{title}</div>
                  <div class="card-sub">apps/{folder}/</div>
                </a>
                """.strip()
            )
    else:
        cards_html.append(
            """
            <div class="empty">
              <div class="empty-title">No apps found</div>
              <div class="empty-sub">Create <code>apps/&lt;app-name&gt;/index.html</code> then re-run the generator.</div>
            </div>
            """.strip()
        )

    cards = "\n".join(cards_html)

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mini Apps</title>
  <style>
    :root {{
      --bg: #ffffff;
      --fg: #111111;
      --muted: #6b7280;
      --border: #e5e7eb;
      --hover: #f8fafc;
      --accent: #111827;
      --shadow: 0 6px 20px rgba(0,0,0,0.06);
      --radius: 14px;
    }}

    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    }}

    .wrap {{
      max-width: 920px;
      margin: 48px auto 80px;
      padding: 0 20px;
    }}

    header {{
      display: flex;
      gap: 14px;
      align-items: baseline;
      justify-content: space-between;
      flex-wrap: wrap;
      margin-bottom: 22px;
    }}

    .title {{
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0;
    }}

    .subtitle {{
      color: var(--muted);
      font-size: 14px;
      margin-top: 6px;
    }}

    .meta {{
      color: var(--muted);
      font-size: 12px;
    }}

    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 14px;
    }}

    .card {{
      display: block;
      text-decoration: none;
      color: inherit;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 16px 14px;
      background: #fff;
      transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease, border-color 120ms ease;
    }}

    .card:hover {{
      background: var(--hover);
      border-color: #d1d5db;
      box-shadow: var(--shadow);
      transform: translateY(-1px);
    }}

    .card-title {{
      font-size: 16px;
      font-weight: 650;
      color: var(--accent);
      margin-bottom: 6px;
    }}

    .card-sub {{
      font-size: 12px;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }}

    .empty {{
      border: 1px dashed var(--border);
      border-radius: var(--radius);
      padding: 22px;
      color: var(--muted);
      background: #fafafa;
    }}
    .empty-title {{
      font-size: 16px;
      font-weight: 600;
      color: var(--fg);
      margin-bottom: 6px;
    }}
    .empty-sub code {{
      background: #fff;
      border: 1px solid var(--border);
      padding: 1px 6px;
      border-radius: 6px;
    }}

    footer {{
      margin-top: 28px;
      color: var(--muted);
      font-size: 12px;
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1 class="title">Mini Apps</h1>
        <div class="subtitle">Multiple single-page HTML apps hosted under one GitHub Pages site.</div>
      </div>
      <div class="meta">Generated: {html.escape(now)}</div>
    </header>

    <main class="grid">
      {cards}
    </main>

    <footer>
      <div>Rules: apps live in <code>apps/&lt;app-name&gt;/index.html</code>, use relative asset paths only.</div>
      <div>Local dev: <code>python -m http.server 8000</code></div>
    </footer>
  </div>
</body>
</html>
"""


def main() -> int:
    apps = detect_apps()
    content = render_index(apps)

    # Ensure folder exists
    APPS_DIR.mkdir(parents=True, exist_ok=True)

    OUTPUT.write_text(content, encoding="utf-8")

    print(f"[gen_index] Found {len(apps)} app(s).")
    print(f"[gen_index] Wrote: {OUTPUT.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
