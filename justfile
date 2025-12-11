python-serve:
    python -m http.server 8000 --bind 0.0.0.0 --directory .

nodejs-serve:
    npx serve .

nodejs-http-server:
    npx http-server .
