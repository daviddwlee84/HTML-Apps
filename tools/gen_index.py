#!/usr/bin/env python3
"""
Generate root index.html for a multi single-HTML apps repo.

- Scans: apps/*/index.html
- Generates: ./index.html
- Uses relative links safe for GitHub Pages subpath hosting.
- Includes a client-side search filter.

No external dependencies.
"""

from __future__ import annotations

import html
from pathlib import Path
from datetime import datetime


REPO_ROOT = Path(__file__).resolve().parents[1]
APPS_DIR = REPO_ROOT / "apps"
OUTPUT = REPO_ROOT / "index.html"


def title_case_from_name(name: str) -> str:
    """Convert kebab-case or snake_case folder name to Title Case."""
    # Replace both - and _ with space, then title case each word
    normalized = name.replace("-", " ").replace("_", " ")
    return " ".join(p.capitalize() for p in normalized.split() if p)


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
        title = title_case_from_name(folder)

        apps.append(
            {
                "folder": folder,
                "title": title,
                "href": f"./apps/{folder}/",
                "path_label": f"apps/{folder}/",
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
            path_label = html.escape(app["path_label"])

            # data-search used by client-side filter
            data_search = html.escape(f"{app['title']} {path_label} {folder}".lower())

            cards_html.append(
                f"""
                <a class="card" href="{href}" data-search="{data_search}">
                  <div class="card-title">{title}</div>
                  <div class="card-sub">{path_label}</div>
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

  <!-- SEO Meta Tags -->
  <meta name="description" content="A collection of lightweight single-page HTML apps hosted on GitHub Pages. Explore tools for housing calculations, financial planning, and more." />
  <meta name="author" content="daviddwlee84" />

  <!-- Open Graph / Facebook / Discord -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://daviddwlee84.github.io/HTML-Apps/" />
  <meta property="og:title" content="Mini Apps" />
  <meta property="og:description" content="A collection of lightweight single-page HTML apps hosted on GitHub Pages. Explore tools for housing calculations, financial planning, and more." />
  <meta property="og:site_name" content="Mini Apps" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:url" content="https://daviddwlee84.github.io/HTML-Apps/" />
  <meta name="twitter:title" content="Mini Apps" />
  <meta name="twitter:description" content="A collection of lightweight single-page HTML apps hosted on GitHub Pages. Explore tools for housing calculations, financial planning, and more." />

  <!-- Theme Color for browser UI -->
  <meta name="theme-color" content="#111827" />

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
      --input-bg: #ffffff;
    }}

    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    }}

    .wrap {{
      max-width: 980px;
      margin: 48px auto 80px;
      padding: 0 20px;
    }}

    header {{
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      margin-bottom: 18px;
    }}

    .head-row {{
      display: flex;
      gap: 14px;
      align-items: baseline;
      justify-content: space-between;
      flex-wrap: wrap;
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

    .search {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}

    .search input {{
      width: min(520px, 100%);
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      outline: none;
      background: var(--input-bg);
      font-size: 14px;
    }}

    .search input:focus {{
      border-color: #cbd5e1;
      box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
    }}

    .search .count {{
      color: var(--muted);
      font-size: 12px;
    }}

    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 14px;
      margin-top: 12px;
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
      overflow: hidden;
      min-width: 0;
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
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }}

    .card-sub {{
      font-size: 12px;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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

    .no-match {{
      display: none;
      border: 1px dashed var(--border);
      border-radius: var(--radius);
      padding: 18px;
      background: #fafafa;
      color: var(--muted);
      margin-top: 14px;
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
      <div class="head-row">
        <div>
          <h1 class="title">Mini Apps</h1>
          <div class="subtitle">Multiple single-page HTML apps hosted under one GitHub Pages site.</div>
        </div>
        <div class="meta">Generated: {html.escape(now)}</div>
      </div>

      <div class="search">
        <input id="q" type="search" placeholder="Search apps by name/path..." autocomplete="off" />
        <span class="count" id="count"></span>
      </div>
    </header>

    <main>
      <div class="grid" id="grid">
        {cards}
      </div>
      <div class="no-match" id="nomatch">
        No matching apps. Try a different keyword.
      </div>
    </main>

    <footer>
      <div>Rules: apps live in <code>apps/&lt;app-name&gt;/index.html</code>, use relative asset paths only.</div>
      <div>Local dev: <code>python -m http.server 8000</code></div>
      <div>Generator: <code>python tools/gen_index.py</code> | Scaffold: <code>python tools/new_app.py &lt;name&gt; --update-index</code></div>
    </footer>
  </div>

  <script>
    (function () {{
      const input = document.getElementById("q");
      const grid = document.getElementById("grid");
      const cards = Array.from(grid.querySelectorAll(".card"));
      const count = document.getElementById("count");
      const nomatch = document.getElementById("nomatch");

      function update() {{
        const q = (input.value || "").trim().toLowerCase();
        let visible = 0;

        for (const c of cards) {{
          const hay = c.getAttribute("data-search") || "";
          const ok = !q || hay.includes(q);
          c.style.display = ok ? "" : "none";
          if (ok) visible++;
        }}

        if (cards.length > 0) {{
          count.textContent = visible + " / " + cards.length;
          nomatch.style.display = visible === 0 ? "block" : "none";
        }} else {{
          count.textContent = "";
          nomatch.style.display = "none";
        }}
      }}

      input.addEventListener("input", update);
      update();
    }})();
  </script>
</body>
</html>
"""


def main() -> int:
    apps = detect_apps()
    content = render_index(apps)

    APPS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(content, encoding="utf-8")

    print(f"[gen_index] Found {len(apps)} app(s).")
    print(f"[gen_index] Wrote: {OUTPUT.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
