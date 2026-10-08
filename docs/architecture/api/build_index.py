#!/usr/bin/env python3
"""
Regenerates index.html from openapi.yaml.

Why this exists: Swagger UI's default setup passes SwaggerUIBundle a
`url` and lets it `fetch()` the spec. That fetch is blocked by the
browser when the page is opened directly (file:// origin) — this is
what "Fetch error failed to fetch ./openapi.yaml" is. Every other
artifact in this project opens with a plain double-click, no local
server; this page should too.

Fix: embed the already-parsed spec directly in the page (SwaggerUIBundle
accepts a `spec` object in place of `url`) so no fetch ever happens.
openapi.yaml stays the single source of truth — this script is how that
source reaches the page, the same "generate, don't hand-edit the output"
principle as docs/design/diagrams/scripts/gen_*.py. Re-run this after every edit to
openapi.yaml; index.html itself should never be hand-edited.
"""
import json
import os

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC_PATH = os.path.join(HERE, "openapi.yaml")
OUT_PATH = os.path.join(HERE, "index.html")

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>New Finance App API</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>&#128268;</text></svg>" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
<style>
  body {{ margin: 0; }}
  .topbar {{ display: none; }} /* hides Swagger's default topbar/logo — this page's own <title> is enough */
</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script type="application/json" id="openapi-spec">{spec_json}</script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {{
      const spec = JSON.parse(document.getElementById("openapi-spec").textContent);
      window.ui = SwaggerUIBundle({{
        spec: spec,
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
        deepLinking: true,
        docExpansion: "list",
        defaultModelsExpandDepth: 1,
        tagsSorter: "alpha"
      }});
    }};
  </script>
</body>
</html>
"""


def main():
    with open(SPEC_PATH) as f:
        spec = yaml.safe_load(f)

    spec_json = json.dumps(spec)
    # JSON's `/` can always be safely written as the equivalent escape
    # `\/` inside a string (permitted by the JSON spec, and `/` never
    # appears outside a string in json.dumps output) — replacing every
    # `</` this way guarantees the literal sequence `</script` can never
    # appear in the page, which would otherwise truncate this <script>
    # block regardless of its `type` attribute.
    spec_json_safe = spec_json.replace("</", "<\\/")

    html = TEMPLATE.format(spec_json=spec_json_safe)
    with open(OUT_PATH, "w") as f:
        f.write(html)

    print(f"Wrote {OUT_PATH} ({len(html)} bytes, spec has {len(spec.get('paths', {}))} paths)")


if __name__ == "__main__":
    main()
