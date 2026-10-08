#!/usr/bin/env python3
"""
Shared page template for this project's backend sequence-diagram sweep
(docs/design/diagrams/sequences/<area>/uc-NN-*.html).

Usage from a per-area generator script:

    from seq_diagram_lib import page, check_mermaid_source

    page(
        out_dir="/path/to/diagrams/sequences/<area>",
        filename="uc-01-....html",
        title="...",
        subtitle="...",   # HTML, may include <span class="route">...</span>
        mermaid="...",    # raw mermaid sequenceDiagram source, no ``` fences
        notes="...",      # HTML <ul><li>...</li></ul> content
    )

IMPORTANT — a real mermaid gotcha this library guards against:
Mermaid's sequenceDiagram grammar treats a bare `;` as a statement
terminator, even *inside* message/note text (e.g. "do X; do Y" silently
breaks parsing with "Syntax error in text", no line number given). This
bit us for real building the Identity & Household sweep — see
docs findings recorded in the harmonic-diagrams skill.

HTML entities that happen to *contain* a semicolon as part of their own
syntax (&mdash;, &#39;, &sect;, &ne;, &harr;, ...) are perfectly safe:
the browser's HTML parser decodes them to a single real character before
mermaid ever reads the element's text content, so no literal `;` reaches
mermaid's parser. Only a standalone `;` typed directly into message/note
text is dangerous. `check_mermaid_source()` below flags exactly that
distinction — run it on every mermaid string before calling `page()`.
"""

import os
import re

PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Sequence — {title} — New Finance App</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
  :root {{
    --bg: #0f1420;
    --panel: #1a2236;
    --panel-border: #2f3b56;
    --text: #eef1f8;
    --muted: #9aa4bb;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    padding: 32px;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }}
  h1 {{ font-size: 20px; margin: 0 0 4px 0; }}
  p.subtitle {{ margin: 0 0 16px 0; color: var(--muted); font-size: 14px; max-width: 980px; line-height: 1.6; }}
  .diagram-card {{
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 10px;
    padding: 20px;
    overflow-x: auto;
    max-width: 100%;
  }}
  .notes {{
    max-width: 980px;
    margin: 16px 0 0 0;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.65;
  }}
  .notes code {{ color: var(--text); }}
  .notes ul {{ padding-left: 20px; }}
  .notes li {{ margin-bottom: 6px; }}
  a {{ color: #7db4f0; }}
  .route {{
    display: inline-block;
    background: #1f2b45;
    border: 1px solid #3a4a70;
    border-radius: 6px;
    padding: 2px 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: #a9c6f5;
  }}
</style>
</head>
<body>
  <h1>{title}</h1>
  <p class="subtitle">{subtitle}</p>
  <div class="diagram-card">
    <pre class="mermaid">
{mermaid}
    </pre>
  </div>
  <div class="notes">
{notes}
  </div>
  <script>
    mermaid.initialize({{
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose'
    }});
  </script>
</body>
</html>
"""

# Matches a numeric (&#39;) or named (&mdash;, &sect;, ...) HTML entity —
# these are safe: the browser decodes them before mermaid reads the text.
_ENTITY_RE = re.compile(r'&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);')


def check_mermaid_source(mermaid: str, label: str = "") -> list:
    """
    Returns a list of (line_no, line_text) for every line containing a
    literal, non-entity semicolon — the one construct that reliably
    breaks mermaid's sequenceDiagram parser. Call this on every mermaid
    string before generating a page; treat any hit as a bug to fix, not
    a warning to ignore.
    """
    problems = []
    for i, line in enumerate(mermaid.splitlines(), 1):
        stripped = _ENTITY_RE.sub("", line)
        if ";" in stripped:
            problems.append((i, line))
    if problems and label:
        print(f"[check_mermaid_source] {label}: {len(problems)} literal semicolon(s) found:")
        for i, line in problems:
            print(f"    line {i}: {line.strip()}")
    return problems


def page(out_dir: str, filename: str, title: str, subtitle: str, mermaid: str, notes: str) -> None:
    """Render and write one sequence-diagram HTML file. Validates the
    mermaid source for the semicolon gotcha first and raises if found —
    fix the source string rather than suppressing this check."""
    os.makedirs(out_dir, exist_ok=True)
    problems = check_mermaid_source(mermaid, label=f"{out_dir}/{filename}")
    if problems:
        raise ValueError(
            f"{filename}: literal semicolon(s) in mermaid source at line(s) "
            f"{[p[0] for p in problems]} — replace with ',' or an em-dash "
            f"before generating (see module docstring)."
        )
    with open(os.path.join(out_dir, filename), "w") as f:
        f.write(PAGE_TEMPLATE.format(
            title=title, subtitle=subtitle,
            mermaid=mermaid.strip("\n"), notes=notes.strip("\n"),
        ))
