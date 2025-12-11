
# Multi Single-HTML Apps on GitHub Pages

This repo hosts multiple small single-page HTML apps under one GitHub Pages site.

## Structure

```text
/
  index.html
  apps/
    <app-name>/
      index.html
      assets/...
      style.css (optional)
      main.js   (optional)
  shared/ (optional)
    css/
    js/
  tools/
    gen_index.py
````

### Rules

* Each app MUST live in `apps/<app-name>/`.
* Each app MUST include `apps/<app-name>/index.html`.
* App folder names use **kebab-case**.
* **Do not use absolute-root paths** like `/main.js`, `/assets/...`.
* Always use **relative paths**:

  * `./main.js`
  * `./style.css`
  * `./assets/logo.png`
  * `../../shared/js/utils.js` when needed

This is required because GitHub Pages serves this repo under a subpath:
`https://<username>.github.io/<repo>/`.

## GitHub Pages

Recommended setup:

* Settings → Pages
* Source: Deploy from a branch
* Branch: `main` / root

Then your apps will be available at:

* Landing page:

  * `https://<username>.github.io/<repo>/`
* Individual apps:

  * `https://<username>.github.io/<repo>/apps/<app-name>/`

## Local development

Use a simple static server from repo root:

```bash
python -m http.server 8000
```

Open:

* `http://localhost:8000/`
* `http://localhost:8000/apps/<app-name>/`

## Adding a new app

1. Create folder:

   ```bash
   mkdir -p apps/my-new-app
   ```
2. Add:

   ```text
   apps/my-new-app/index.html
   ```
3. (Optional) add assets/js/css.
4. Regenerate landing page:

   ```bash
   python tools/gen_index.py
   ```
5. Commit & push.

## Auto-generate landing page

This repo includes:

```bash
python tools/gen_index.py
```

It scans `apps/*/index.html` and generates root `index.html` with safe relative links.
