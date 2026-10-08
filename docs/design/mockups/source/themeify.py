"""Turn a kit-built page into a themable one: every palette hex becomes a CSS
color variable, with a dark set on :root and a light set on [data-theme=light].

Usage: themeify(html, theme="dark"|"light") -> html
Proves the light theme is a token swap, not a per-page redesign.
"""
import re

# token -> (dark, light). Light values chosen for >=4.5:1 text contrast on white.
TOKENS = {
    "bg":        ("#0C100F", "#F4F7F5"),
    "card":      ("#131917", "#FFFFFF"),
    "raised":    ("#1A211E", "#EEF3F0"),
    "line":      ("#232C28", "#DCE4DF"),
    "track":     ("#222B27", "#E3EAE6"),
    "ink":       ("#E7ECE9", "#13201A"),
    "muted":     ("#97A39D", "#56655E"),
    "faint":     ("#5F6B65", "#8A9791"),
    "mint":      ("#5EE6B8", "#0E9467"),
    "mintdeep":  ("#0F3B2E", "#DDF4EA"),
    "onmint":    ("#062A1F", "#FFFFFF"),
    "onmint2":   ("#00382B", "#FFFFFF"),
    "coral":     ("#FF6B6B", "#D2383B"),
    "coraldeep": ("#3A1717", "#FBE5E5"),
    "oncoral":   ("#2A0A0A", "#FFFFFF"),
    "sky":       ("#7CB9FF", "#2368C9"),
    "onsky":     ("#0A1E33", "#FFFFFF"),
    "sun":       ("#FFD166", "#B07800"),
    "lilac":     ("#C792EA", "#8A4CC6"),
    "peach":     ("#FF8C69", "#D2602B"),
    "deep":      ("#0A0E0D", "#E9F1ED"),
}
HEX2TOK = {d.lower(): k for k, (d, _) in TOKENS.items()}


def _rgb(hexv: str) -> str:
    """'#RRGGBB' -> 'R G B' for rgb(var(--x) / a) usage."""
    h = hexv.lstrip("#")
    return " ".join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def _vars_css() -> str:
    """:root (dark) and light token blocks."""
    dark = "\n".join(f"    --c-{k}: {_rgb(d)};" for k, (d, _) in TOKENS.items())
    light = "\n".join(f"    --c-{k}: {_rgb(l)};" for k, (_, l) in TOKENS.items())
    return f"\n  :root {{\n{dark}\n  }}\n  [data-theme=\"light\"] {{\n{light}\n  }}\n"


def _var(hexv: str) -> str | None:
    tok = HEX2TOK.get(hexv.lower())
    return f"rgb(var(--c-{tok}))" if tok else None


def _svg_attrs(html: str) -> str:
    """Move fill/stroke/stop-color hex attributes into style (attributes can't take var())."""
    def fix_tag(m):
        tag = m.group(0)
        styles = []
        for attr in ("fill", "stroke", "stop-color"):
            am = re.search(rf'\s{attr}="(#[0-9A-Fa-f]{{6}})"', tag)
            if am and _var(am.group(1)):
                styles.append(f"{attr}: {_var(am.group(1))}")
                tag = tag.replace(am.group(0), "")
        if not styles:
            return tag
        sm = re.search(r'\sstyle="([^"]*)"', tag)
        if sm:
            return tag.replace(sm.group(0), f' style="{sm.group(1).rstrip("; ")}; {"; ".join(styles)}"')
        return re.sub(r"(/?>)$", f' style="{"; ".join(styles)}"\\1', tag)
    return re.sub(r"<(?:path|circle|line|stop|rect|text|g)\b[^>]*>", fix_tag, html)


def themeify(html: str, theme: str = "dark") -> str:
    """Return the page with palette hexes swapped for theme variables."""
    # Tailwind config colors -> channel vars so /15-style opacity still works
    def cfg(m):
        tok = HEX2TOK.get(m.group(2).lower())
        return f"{m.group(1)}'rgb(var(--c-{tok}) / <alpha-value>)'" if tok else m.group(0)
    html = re.sub(r"(\b\w+:\s*)'(#[0-9A-Fa-f]{6})'", cfg, html)
    html = _svg_attrs(html)
    # remaining hexes in CSS, inline styles, arbitrary Tailwind values
    html = re.sub(r"#[0-9A-Fa-f]{6}\b", lambda m: _var(m.group(0)) or m.group(0), html)
    html = html.replace("[rgb(var(", "[rgb(var(")  # Tailwind arbitrary values keep working
    html = re.sub(r"\[rgb\(var\(--c-([a-z0-9]+)\)\)\]", r"[rgb(var(--c-\1))]", html)
    html = html.replace("</style>", _vars_css() + "</style>", 1)
    if theme == "light":
        html = html.replace("<html lang=\"en\">", "<html lang=\"en\" data-theme=\"light\">", 1)
    return html
