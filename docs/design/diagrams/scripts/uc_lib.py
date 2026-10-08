"""Shared template for use-case swim-lane diagrams (Frontend / Backend lanes).

Same visual format as the hand-written diagrams in docs/design/diagrams/use-cases/:
a mermaid `flowchart LR` with two subgraphs, a request/response bridge,
and a notes block. Lanes are linear chains unless extra mermaid lines are
passed for branches.
"""
import html
import pathlib

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>{title} — New Finance App</title>
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
  p.subtitle {{ margin: 0 0 12px 0; color: var(--muted); font-size: 14px; max-width: 900px; line-height: 1.6; }}
  .diagram-card {{
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 10px;
    padding: 20px;
    overflow-x: auto;
    max-width: 100%;
  }}
  .notes {{
    max-width: 900px;
    margin: 16px 0 0 0;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.6;
  }}
  .notes code {{ color: var(--text); }}
  .badge {{ display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 999px; background: #3a2f12; color: #ffd166; margin: 0 0 12px 0; }}
</style>
</head>
<body>
"""

TAIL = """
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
      flowchart: { htmlLabels: true, curve: 'basis' }
    });
  </script>
</body>
</html>
"""


def _lane(prefix: str, label: str, steps: list[str], split_after: int | None) -> tuple[str, str, str]:
    """Build one lane; returns (mermaid, first_node, last_node_before_split/after)."""
    lines = [f'    subgraph {prefix}["{label}"]', "        direction TB"]
    ids = []
    for i, step in enumerate(steps, 1):
        nid = f"{prefix}{i}"
        ids.append(nid)
        text = step.replace('"', "&quot;")
        if step in ("Start", "End"):
            lines.append(f'        {nid}(["{text}"])')
        elif step.startswith("?"):
            lines.append(f'        {nid}{{"{text[1:]}"}}')
        else:
            lines.append(f'        {nid}["{text}"]')
    if split_after is None:
        lines.append("        " + " --> ".join(ids))
    else:
        lines.append("        " + " --> ".join(ids[:split_after]))
        if len(ids) > split_after:
            lines.append("        " + " --> ".join(ids[split_after:]))
    lines.append("    end")
    return "\n".join(lines), ids


def use_case(path: pathlib.Path, title: str, subtitle: str, fe: list[str], be: list[str],
             notes: list[str], fe_split: int, badge: str | None = None, extra: str = "") -> None:
    """Write a two-lane use case. `fe_split` = number of FE steps before the request is sent."""
    fe_m, fe_ids = _lane("FE", "Frontend", fe, fe_split)
    be_m, be_ids = _lane("BE", "Backend", be, None)
    bridge = f"    {fe_ids[fe_split - 1]} -- request --> {be_ids[0]}\n    {be_ids[-1]} -- response --> {fe_ids[fe_split]}"
    body = f"""  <h1>{html.escape(title)}</h1>
  {f'<div class="badge">{badge}</div>' if badge else ''}
  <p class="subtitle">
    {subtitle}
  </p>

  <div class="diagram-card">
    <pre class="mermaid">
flowchart LR
{fe_m}

{be_m}

{bridge}
{extra}
    </pre>
  </div>

  <div class="notes">
{chr(10).join(f"    <p>{n}</p>" for n in notes)}
  </div>
"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(HEAD.format(title=html.escape(title)) + body + TAIL)


def system_use_case(path: pathlib.Path, title: str, subtitle: str, steps: list[str], notes: list[str], badge: str | None = None) -> None:
    """Single-lane (Backend only) system-triggered use case."""
    be_m, _ = _lane("BE", "Backend (system trigger)", steps, None)
    body = f"""  <h1>{html.escape(title)}</h1>
  {f'<div class="badge">{badge}</div>' if badge else ''}
  <p class="subtitle">
    {subtitle}
  </p>

  <div class="diagram-card">
    <pre class="mermaid">
flowchart LR
{be_m}
    </pre>
  </div>

  <div class="notes">
{chr(10).join(f"    <p>{n}</p>" for n in notes)}
  </div>
"""
    path.write_text(HEAD.format(title=html.escape(title)) + body + TAIL)
