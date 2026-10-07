"""Assemble index.html from src/. Run: python3 build.py"""
from pathlib import Path
src = Path(__file__).parent / "src"
data = (src / "course.json").read_text().strip()
html = (
    (src / "top.html").read_text()
    + '\n<script id="course-data" type="application/json">\n' + data + "\n</script>\n"
    + "<script>\n" + (src / "app.js").read_text() + "</script>\n"
)
(Path(__file__).parent / "index.html").write_text(html)
print("index.html", len(html), "bytes")
