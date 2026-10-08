"""Assemble the app from src/. Run: python3 build.py

index.html     standalone page for GitHub Pages / an app web view
artifact.html  the same app without the document wrapper, for the claude.ai preview
"""
from pathlib import Path
root = Path(__file__).parent
src = root / "src"
body = (
    (src / "top.html").read_text()
    + '\n<script id="course-data" type="application/json">\n' + (src / "course.json").read_text().strip() + "\n</script>\n"
    + "<script>\n" + (src / "app.js").read_text() + "</script>\n"
)
head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<style>:root{padding-top:env(safe-area-inset-top,0px)}</style>\n</head>\n<body>\n')
(root / "index.html").write_text(head + body + "</body>\n</html>\n")
(root / "artifact.html").write_text(body)
print("built index.html and artifact.html")
