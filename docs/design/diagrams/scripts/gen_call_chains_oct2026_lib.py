"""Helpers shared by the call-chain generators: rewrite a chain page's title, subtitle, edges and notes."""
import json
import pathlib
import re

CC = pathlib.Path(__file__).parent.parent / "call-chains"
TEMPLATE = CC / "track-investments" / "uc-02-edit-holding.html"


def edges_of(html: str) -> list:
    return json.loads(re.search(r"var edges = (\[.*?\]);", html).group(1))


def set_chain(html: str, title=None, subtitle=None, edges=None, notes=None) -> str:
    """Replace title / subtitle / edges / notes in a call-chain page."""
    if title:
        html = re.sub(r"<title>.*?</title>", f"<title>{title} — New Finance App</title>", html, count=1)
        html = re.sub(r"<h1>.*?</h1>", f"<h1>{title}</h1>", html, count=1)
    if subtitle:
        html = re.sub(r'<p class="subtitle">.*?</p>', f'<p class="subtitle">{subtitle}</p>', html, count=1, flags=re.S)
    if edges is not None:
        html = re.sub(r"var edges = \[.*?\];", "var edges = " + json.dumps(edges) + ";", html, count=1)
    if notes is not None:
        body = "\n".join(f"    <p>{n}</p>" for n in notes)
        html = re.sub(r'<div class="notes">.*?</div>', f'<div class="notes">\n{body}\n  </div>', html, count=1, flags=re.S)
    return html


def E(*spec):
    """Edges from compact tuples: (order, from, to[, 'a'])."""
    out = []
    for t in spec:
        order, frm, to = t[:3]
        out.append({"from": frm, "to": to, "type": "async" if len(t) > 3 else "sync", "order": order})
    return out


def write(path: pathlib.Path, title, subtitle, edges, notes):
    path.parent.mkdir(parents=True, exist_ok=True)
    base = path.read_text() if path.exists() else TEMPLATE.read_text()
    path.write_text(set_chain(base, title, subtitle, edges, notes))
