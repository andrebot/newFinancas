"""Build the Investments → Rates tab (manual index rates: Selic, CDI, IPCA, IGP-M).

Each rate card shows the current value, a history chart, which holdings use it,
and Update / History actions. Selic is shown in its inline-update state.
"""
import pathlib
import re

HERE = pathlib.Path(__file__).parent
TOP = (HERE / "_kit_top.html").read_text()
FORM_CSS = (HERE / "_kit_form.css").read_text()
BOTTOM = (HERE / "_kit_bottom.html").read_text()
MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"]

CSS = """
  .seg { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; background: #131917; border: 1px solid #232C28; }
  .seg > button { height: 36px; padding: 0 16px; border-radius: 999px; font-size: 14px; font-weight: 500; color: #97A39D; display: inline-flex; align-items: center; gap: 6px; }
  .seg > button[aria-selected="true"] { background: #0F3B2E; color: #5EE6B8; font-weight: 600; }
  .rcard2 { border-radius: 20px; background: #131917; border: 1px solid #232C28; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
"""

# name, subtitle, color hex, unit, history (Apr..Sep), used-by list
RATES = [
    ("Selic", "Brazil's policy rate", "#7CB9FF", "% a.a.", [10.75, 10.75, 10.50, 10.50, 10.50, 10.50], ["Tesouro Selic 2029"]),
    ("CDI", "Interbank deposit rate", "#5EE6B8", "% a.a.", [10.65, 10.65, 10.40, 10.40, 10.40, 10.40], []),
    ("IPCA", "Inflation, last 12 months", "#FFD166", "% 12m", [3.93, 4.12, 4.23, 4.50, 4.24, 4.42], ["Tesouro IPCA+ 2035"]),
    ("IGP-M", "General market prices, last 12 months", "#C792EA", "% 12m", [3.15, 3.46, 3.70, 3.82, 3.60, 3.80], []),
]


def chart(values: list[float], color: str, gid: str) -> str:
    """Small line+area chart with min/max labels; one point per saved value."""
    lo, hi = min(values), max(values)
    span = (hi - lo) or 1
    w, h, pad = 400, 110, 14
    xs = [round(i * w / (len(values) - 1)) for i in range(len(values))]
    ys = [round(pad + (hi - v) / span * (h - 2 * pad)) for v in values]
    pts = " ".join(f"L{x},{y}" for x, y in zip(xs, ys))[1:]
    dots = "".join(f'<circle cx="{x}" cy="{y}" r="3.5" fill="{color}" stroke="#131917" stroke-width="2"/>' for x, y in zip(xs, ys))
    return f'''<div class="flex flex-col gap-1">
            <div class="relative">
              <svg viewBox="0 0 {w} {h}" preserveAspectRatio="none" class="w-full h-[110px]">
                <defs><linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{color}" stop-opacity=".28"/><stop offset="1" stop-color="{color}" stop-opacity="0"/></linearGradient></defs>
                <line x1="0" y1="{pad}" x2="{w}" y2="{pad}" stroke="#232C28" stroke-dasharray="3 5"/><line x1="0" y1="{h - pad}" x2="{w}" y2="{h - pad}" stroke="#232C28" stroke-dasharray="3 5"/>
                <path d="M{pts} L{w},{h} L0,{h} Z" fill="url(#{gid})"/>
                <path d="M{pts}" fill="none" stroke="{color}" stroke-width="2.5" stroke-linejoin="round"/>
                {dots}
              </svg>
              <span class="absolute top-0 left-0 text-[10px] text-faint num">{hi:.2f}%</span><span class="absolute bottom-0 left-0 text-[10px] text-faint num">{lo:.2f}%</span>
            </div>
            <div class="flex justify-between text-[10.5px] uppercase tracking-wider text-faint font-semibold">{"".join(f"<span>{m}</span>" for m in MONTHS)}</div>
          </div>'''


def card(i: int, rate: tuple, editing: bool) -> str:
    """One index-rate card; `editing` shows the inline update form."""
    name, sub, color, unit, hist, used = rate
    cur, prev = hist[-1], hist[-2]
    delta = cur - prev
    dtxt = "unchanged" if abs(delta) < 1e-9 else f'{"+" if delta > 0 else "−"}{abs(delta):.2f} pp vs Aug'
    used_html = ("".join(f'<span class="tag">{u}</span>' for u in used)) if used else '<span class="text-xs text-faint">Not used by any holding yet</span>'
    if editing:
        action = f'''<div class="rounded-2xl bg-bg border border-mint/40 p-3 flex flex-col gap-3">
            <div class="grid grid-cols-[1fr_140px] gap-3">
              <div class="field"><label for="r-{i}">New value ({unit})</label><input id="r-{i}" value="10,25" class="num"></div>
              <div class="field"><label for="r-{i}-d">As of</label><input id="r-{i}-d" value="01/10/2026" class="num"></div>
            </div>
            <div class="flex items-center justify-between"><span class="text-xs text-faint">Re-projects payouts for {len(used)} holding{"s" if len(used) != 1 else ""}.</span><div class="flex gap-2"><button class="h-8 px-3 rounded-full text-sm text-muted hover:bg-white/5">Cancel</button><button class="h-8 px-4 rounded-full bg-mint text-[#062A1F] text-sm font-semibold">Save</button></div></div>
          </div>'''
    else:
        action = '''<div class="flex gap-2"><button class="h-9 px-4 rounded-full bg-mint/10 text-mint text-sm font-semibold flex items-center gap-1.5"><iconify-icon icon="material-symbols:edit-outline" width="16"></iconify-icon>Update</button><button class="h-9 px-4 rounded-full border border-line text-sm text-muted flex items-center gap-1.5"><iconify-icon icon="material-symbols:history" width="16"></iconify-icon>History</button></div>'''
    ring = " ring-1 ring-mint/40" if editing else ""
    return f'''<article class="rcard2{ring}">
          <div class="flex items-start justify-between gap-3">
            <div><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full" style="background:{color}"></span><span class="font-display text-lg font-bold">{name}</span></div><div class="text-xs text-muted mt-0.5">{sub}</div></div>
            <div class="text-right"><div class="font-display text-[28px] leading-8 font-extrabold num">{cur:.2f}<span class="text-sm text-muted font-semibold ml-1">{unit}</span></div><div class="text-xs text-faint num">as of 30/09/2026 · {dtxt}</div></div>
          </div>
          {chart(hist, color, f"rg{i}")}
          <div class="flex items-center gap-2 flex-wrap"><span class="cap mr-1">Used by</span>{used_html}</div>
          {action}
        </article>'''


def body() -> str:
    cards = "".join(card(i, r, editing=(i == 0)) for i, r in enumerate(RATES))
    return f'''
  <main class="max-w-[1400px] mx-auto px-12 pt-8 pb-16 flex flex-col gap-6">
    <div class="flex flex-col gap-5">
      <div class="flex items-end justify-between gap-6">
        <div>
          <h1 class="font-display text-[34px] leading-10 font-extrabold tracking-tight">Investments</h1>
          <p class="text-muted mt-1">Every fixed and variable income holding, sliced a few ways.</p>
        </div>
        <div class="flex gap-3">
          <button class="h-10 px-4 rounded-full border border-dashed border-line text-faint flex items-center gap-2 cursor-not-allowed" disabled title="Coming in v2"><iconify-icon icon="material-symbols:apartment" width="18"></iconify-icon>FII Portfolio Builder<span class="text-[10px] font-bold uppercase tracking-wider bg-white/5 rounded-full px-1.5 py-0.5">v2</span></button>
          <button class="h-10 px-4 rounded-full border border-dashed border-line text-faint flex items-center gap-2 cursor-not-allowed" disabled title="Coming in v2"><iconify-icon icon="material-symbols:candlestick-chart-outline" width="18"></iconify-icon>Stock Portfolio Builder<span class="text-[10px] font-bold uppercase tracking-wider bg-white/5 rounded-full px-1.5 py-0.5">v2</span></button>
        </div>
      </div>
      <div class="seg" role="tablist" aria-label="Investments sections">
        <button role="tab" aria-selected="false"><iconify-icon icon="material-symbols:space-dashboard-outline" width="18"></iconify-icon>Overview</button>
        <button role="tab" aria-selected="false"><iconify-icon icon="material-symbols:table-rows-outline" width="18"></iconify-icon>Holdings by account</button>
        <button role="tab" aria-selected="true"><iconify-icon icon="material-symbols:percent" width="18"></iconify-icon>Rates</button>
      </div>
    </div>

    <div class="rounded-2xl border border-line bg-card/60 px-5 py-4 flex items-start gap-3">
      <iconify-icon icon="material-symbols:info-outline" width="20" class="text-sky shrink-0 mt-0.5"></iconify-icon>
      <div class="text-sm"><span class="font-semibold">Reference rates for fixed income projections.</span> <span class="text-muted">Entered manually for now. Expected payouts and taxes on holdings that track an index (e.g. "110% of CDI", "IPCA + 5.50%") are projected from the latest value here. Fixed-rate contracts don't need them.</span></div>
    </div>

    <div class="grid grid-cols-2 gap-6">{cards}</div>
  </main>'''


if __name__ == "__main__":
    top = TOP.replace("{{TITLE}}", "Rates").replace("</style>", FORM_CSS + CSS + "</style>", 1)
    (HERE / "rates.html").write_text(top + body() + BOTTOM)
    print("rates.html")
