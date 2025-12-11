#!/usr/bin/env python3
"""
Interactive scaffold for a new single-HTML app under apps/<app-name>/.

Features:
- Interactive prompts with sensible defaults.
- Configurable options:
  - folder name
  - title
  - description (for SEO tags)
  - include style.css
  - include main.js
  - include assets folder
  - run gen_index.py after creation

No external dependencies.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
import subprocess


REPO_ROOT = Path(__file__).resolve().parents[1]
APPS_DIR = REPO_ROOT / "apps"
GEN_INDEX = REPO_ROOT / "tools" / "gen_index.py"


def to_title(name: str) -> str:
    """Convert kebab-case or snake_case to Title Case."""
    # Replace both - and _ with spaces, then title case
    return " ".join(p.capitalize() for p in re.split(r"[-_]", name) if p)


def prompt(message: str, default: str = "") -> str:
    """Prompt user for input with optional default value."""
    if default:
        user_input = input(f"{message} [{default}]: ").strip()
        return user_input if user_input else default
    else:
        while True:
            user_input = input(f"{message}: ").strip()
            if user_input:
                return user_input
            print("  ⚠ This field is required.")


def prompt_yes_no(message: str, default: bool = True) -> bool:
    """Prompt user for yes/no with default value."""
    default_hint = "Y/n" if default else "y/N"
    user_input = input(f"{message} [{default_hint}]: ").strip().lower()

    if not user_input:
        return default
    return user_input in ("y", "yes", "1", "true")


def validate_name(name: str) -> bool:
    """Validate app name format. Returns True if valid, False otherwise."""
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
        print(
            "  ⚠ Warning: app name should be kebab-case like 'my-cool-app'.",
            file=sys.stderr,
        )
        return False
    return True


def check_app_exists(name: str) -> bool:
    """Check if app folder already exists."""
    app_dir = APPS_DIR / name
    return app_dir.exists()


def get_index_template(
    title: str, folder: str, description: str, with_css: bool, with_js: bool
) -> str:
    """Generate index.html content based on options."""
    css_link = '  <link rel="stylesheet" href="./style.css" />\n' if with_css else ""
    js_script = '\n  <script type="module" src="./main.js"></script>' if with_js else ""

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="{description}" />

  <!-- Open Graph / Facebook / Discord -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://daviddwlee84.github.io/HTML-Apps/apps/{folder}/" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:site_name" content="Mini Apps" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{description}" />

{css_link}</head>
<body>
  <main class="wrap">
    <header class="hero">
      <h1>{title}</h1>
      <p class="muted">{description}</p>
      <p class="muted">
        Served safely under GitHub Pages subpaths using relative URLs.
      </p>
    </header>

    <section class="card">
      <h2>It works 🎉</h2>
      <p>
        Edit <code>index.html</code>{", <code>style.css</code>" if with_css else ""}{", and <code>main.js</code>" if with_js else ""}
        to build your app.
      </p>
    </section>
  </main>
{js_script}
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


def get_main_template(title: str) -> str:
    """Generate main.js content."""
    return f"""\
// {title} - main script
// Keep things simple and relative-path safe for GitHub Pages.

console.log("Hello from {title}!");

export function init() {{
  // Your app boot code here.
}}

init();
"""


def scaffold(
    name: str,
    title: str,
    description: str,
    with_css: bool,
    with_js: bool,
    with_assets: bool,
) -> Path:
    """Create the app directory structure and files."""
    APPS_DIR.mkdir(parents=True, exist_ok=True)

    app_dir = APPS_DIR / name
    if app_dir.exists():
        raise FileExistsError(f"App folder already exists: {app_dir}")

    app_dir.mkdir(parents=True, exist_ok=False)

    if with_assets:
        (app_dir / "assets").mkdir(parents=True, exist_ok=True)

    (app_dir / "index.html").write_text(
        get_index_template(title, name, description, with_css, with_js),
        encoding="utf-8",
    )

    if with_css:
        (app_dir / "style.css").write_text(STYLE_TEMPLATE, encoding="utf-8")

    if with_js:
        (app_dir / "main.js").write_text(get_main_template(title), encoding="utf-8")

    return app_dir


def update_index() -> None:
    """Run gen_index.py to update the root index.html."""
    if not GEN_INDEX.exists():
        print("  ⚠ gen_index.py not found. Skipping index update.", file=sys.stderr)
        return

    subprocess.run([sys.executable, str(GEN_INDEX)], check=False)


def print_header() -> None:
    """Print the interactive wizard header."""
    print()
    print("╔════════════════════════════════════════════════════════════╗")
    print("║           🚀 New App Interactive Wizard                    ║")
    print("║                                                            ║")
    print("║  Create a new single-HTML app with customizable options.   ║")
    print("║  Press Enter to accept default values shown in [brackets]. ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print()


def print_summary(config: dict) -> None:
    """Print configuration summary before creating."""
    print()
    print("┌────────────────────────────────────────────────────────────┐")
    print("│  📋 Configuration Summary                                  │")
    print("├────────────────────────────────────────────────────────────┤")
    print(f"│  Folder:      {config['name']:<44} │")
    print(f"│  Title:       {config['title']:<44} │")
    desc_display = (
        config["description"][:42] + "..."
        if len(config["description"]) > 44
        else config["description"]
    )
    print(f"│  Description: {desc_display:<44} │")
    print(f"│  CSS:         {'Yes ✓' if config['with_css'] else 'No  ✗':<44} │")
    print(f"│  JavaScript:  {'Yes ✓' if config['with_js'] else 'No  ✗':<44} │")
    print(f"│  Assets:      {'Yes ✓' if config['with_assets'] else 'No  ✗':<44} │")
    print(f"│  Update index:{'Yes ✓' if config['update_index'] else 'No  ✗':<44} │")
    print("└────────────────────────────────────────────────────────────┘")
    print()


def main() -> int:
    print_header()

    # Step 1: Folder name (required)
    print("📁 Step 1/7: Folder Name")
    print("   Use kebab-case like 'my-cool-app'")
    while True:
        name = prompt("   Folder name")
        name = name.lower().strip()

        # Validate format
        if not validate_name(name):
            if not prompt_yes_no("   Continue anyway?", default=False):
                continue

        # Check if exists
        if check_app_exists(name):
            print(f"  ⚠ App folder already exists: apps/{name}")
            continue

        break
    print()

    # Step 2: Title
    print("📝 Step 2/7: App Title")
    print("   Human-readable title for your app")
    default_title = to_title(name)
    title = prompt("   Title", default=default_title)
    print()

    # Step 3: Description (for SEO)
    print("📄 Step 3/7: Description (for SEO)")
    print("   A short description for meta tags")
    default_description = f"{title} - A lightweight single-page HTML app."
    description = prompt("   Description", default=default_description)
    print()

    # Step 4: CSS
    print("🎨 Step 4/7: Include CSS")
    print("   Create a style.css file with starter styles")
    with_css = prompt_yes_no("   Include style.css?", default=True)
    print()

    # Step 5: JavaScript
    print("⚡ Step 5/7: Include JavaScript")
    print("   Create a main.js file with ES module setup")
    with_js = prompt_yes_no("   Include main.js?", default=True)
    print()

    # Step 6: Assets folder
    print("📦 Step 6/7: Include Assets Folder")
    print("   Create an empty assets/ folder for images, etc.")
    with_assets = prompt_yes_no("   Include assets folder?", default=True)
    print()

    # Step 7: Update index
    print("🔄 Step 7/7: Update Landing Page")
    print("   Run gen_index.py to add link to root index.html")
    run_gen_index = prompt_yes_no("   Update root index.html?", default=True)
    print()

    # Configuration summary
    config = {
        "name": name,
        "title": title,
        "description": description,
        "with_css": with_css,
        "with_js": with_js,
        "with_assets": with_assets,
        "update_index": run_gen_index,
    }

    print_summary(config)

    # Confirm
    if not prompt_yes_no("🚀 Create this app?", default=True):
        print("\n❌ Cancelled.")
        return 1

    # Create the app
    print()
    try:
        app_dir = scaffold(
            name=name,
            title=title,
            description=description,
            with_css=with_css,
            with_js=with_js,
            with_assets=with_assets,
        )
    except FileExistsError as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        return 1

    print(f"✅ Created: {app_dir.relative_to(REPO_ROOT)}")

    # List created files
    print("\n📂 Files created:")
    for item in sorted(app_dir.rglob("*")):
        if item.is_file():
            print(f"   • {item.relative_to(app_dir)}")
        elif item.is_dir():
            print(f"   📁 {item.relative_to(app_dir)}/")

    if run_gen_index:
        print("\n🔄 Updating root index.html...")
        update_index()
        print("✅ Updated root index.html")

    print("\n🎉 Done! Your new app is ready at:")
    print(f"   Local:  http://localhost:8000/apps/{name}/")
    print(f"   GitHub: https://daviddwlee84.github.io/HTML-Apps/apps/{name}/")
    print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
