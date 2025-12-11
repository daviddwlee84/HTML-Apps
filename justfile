python-serve:
    python -m http.server 8000 --bind 0.0.0.0 --directory .

new-app name:
    # BUG: seems --update-index is not working
    python tools/new_app.py {{name}} --update-index

gen-index:
    python tools/gen_index.py

nodejs-serve:
    npx serve .

nodejs-http-server:
    npx http-server .
