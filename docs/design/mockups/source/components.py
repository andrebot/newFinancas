"""Shared design components added after the requirements review:
payout-over-time chart (FR-5.9), notification bell + inbox (FR-6.5/6.10),
audit-log export dialog (FR-7.2).
"""

MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]

# BRL payouts per month (from dividend/interest transactions), per holding.
# (group, colour, 12 months Oct..Sep)
PAYOUTS_BRL = {
    "XPML11": ("FIIs", "#C792EA", [0, 0, 0, 0, 0, 0, 845, 860, 870, 880, 885, 890]),
    "KNRI11": ("FIIs", "#7CB9FF", [195, 198, 200, 201, 203, 205, 205, 206, 207, 208, 209, 210]),
    "HGLG11": ("FIIs", "#5EE6B8", [310, 312, 315, 318, 320, 322, 325, 326, 328, 330, 332, 335]),
    "MXRF11": ("FIIs", "#FFD166", [150, 152, 151, 153, 155, 154, 156, 158, 157, 159, 160, 162]),
    "VISC11": ("FIIs", "#FF8C69", [120, 121, 122, 122, 123, 124, 125, 125, 126, 127, 128, 128]),
    "BTLG11": ("FIIs", "#97A39D", [80, 82, 83, 84, 85, 86, 87, 88, 88, 89, 90, 91]),
    "VALE3": ("Stocks", "#97A39D", [0, 0, 68, 0, 0, 72, 0, 0, 74, 0, 0, 25]),
    "ITSA4": ("Stocks", "#97A39D", [12, 0, 0, 12, 0, 0, 12, 0, 0, 12, 0, 0]),
    "BBAS3": ("Stocks", "#97A39D", [0, 0, 45, 0, 0, 48, 0, 0, 50, 0, 0, 0]),
    "Tesouro IPCA+ 2035": ("Fixed income", "#97A39D", [0, 0, 0, 0, 0, 0, 1650, 0, 0, 0, 0, 0]),
}
OTHERS = "#4A5550"


def _selection(selected):
    """Top 5 selected by 12-month total keep their colour; the rest become Others."""
    ranked = sorted(selected, key=lambda k: -sum(PAYOUTS_BRL[k][2]))
    return ranked[:5], ranked[5:]


def payout_select(selected, open_=False) -> str:
    """Full-width multi-select dropdown for the payout chart."""
    total = len(PAYOUTS_BRL)
    names = sorted(selected, key=lambda k: -sum(PAYOUTS_BRL[k][2]))
    summary = ", ".join(names[:3]) + (f" +{len(names) - 3}" if len(names) > 3 else "")
    trigger = f"""<button class="w-full h-11 rounded-[14px] border {'border-mint/60 shadow-[0_0_0_3px_rgba(94,230,184,.12)]' if open_ else 'border-line'} bg-bg px-3 flex items-center gap-2 text-left" aria-haspopup="listbox" aria-expanded="{'true' if open_ else 'false'}">
            <iconify-icon icon="material-symbols:filter-list" width="18" class="text-muted"></iconify-icon>
            <span class="text-sm font-semibold num">{len(selected)} of {total} holdings</span>
            <span class="text-sm text-muted truncate">· {summary}</span>
            <iconify-icon icon="material-symbols:{'expand-less' if open_ else 'expand-more'}" width="20" class="ml-auto text-muted"></iconify-icon>
          </button>"""
    if not open_:
        return f'<div class="relative">{trigger}</div>'
    top, _ = _selection(selected)
    groups = {}
    for k, (g, col, vals) in PAYOUTS_BRL.items():
        groups.setdefault(g, []).append((k, col, vals[-1]))
    lists = []
    for g, items in groups.items():
        nsel = sum(1 for k, _, _ in items if k in selected)
        rows = []
        for k, col, cur in items:
            on = k in selected
            sw = col if k in top else OTHERS
            rows.append(f"""<label class="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 text-sm"><span class="w-[18px] h-[18px] rounded-md grid place-items-center shrink-0 {'bg-mint text-[#062A1F]' if on else 'border-[1.5px] border-faint'}">{'<iconify-icon icon="material-symbols:check" width="14"></iconify-icon>' if on else ''}</span><span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:{sw if on else '#232C28'}"></span><span class="flex-1 truncate {'' if on else 'text-muted'}">{k}</span><span class="num text-xs {'text-mint' if cur else 'text-faint'}">{f'R${cur:,.2f}' if cur else '—'}</span></label>""")
        lists.append(f"""<div><div class="flex items-center justify-between px-2 pb-1"><span class="cap">{g}</span><span class="text-[11px] text-faint num">{nsel}/{len(items)}</span></div>{''.join(rows)}</div>""")
    panel = f"""<div class="absolute left-0 right-0 top-[50px] z-30 rounded-2xl bg-raised border border-line shadow-[0_24px_60px_-20px_rgba(0,0,0,.85)] p-3 flex flex-col gap-3" role="listbox" aria-multiselectable="true">
            <div class="flex items-center gap-2 h-10 rounded-xl bg-bg border border-line px-3"><iconify-icon icon="material-symbols:search" width="18" class="text-faint"></iconify-icon><input class="bg-transparent outline-none text-sm flex-1" placeholder="Search ticker or name" aria-label="Search holdings"></div>
            <div class="flex flex-wrap gap-1.5"><button class="opt !h-7 !text-xs" aria-pressed="false">All</button><button class="opt !h-7 !text-xs" aria-pressed="false">FIIs</button><button class="opt !h-7 !text-xs" aria-pressed="false">Stocks</button><button class="opt !h-7 !text-xs" aria-pressed="false">Fixed income</button><button class="opt !h-7 !text-xs text-muted" aria-pressed="false">Clear</button></div>
            <div class="grid grid-cols-3 gap-3 max-h-[230px] overflow-y-auto">{''.join(lists)}</div>
            <div class="flex items-center justify-between border-t border-line pt-2.5 text-xs text-faint"><span>The 5 largest selected keep their colour; the rest are grouped as <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm" style="background:{OTHERS}"></span>Others</span>.</span><button class="h-8 px-4 rounded-full bg-mint text-[#062A1F] text-sm font-semibold">Done</button></div>
          </div>"""
    return f'<div class="relative">{trigger}{panel}</div>'


def payout_chart(selected=("XPML11", "KNRI11", "HGLG11", "MXRF11", "VISC11", "BTLG11", "VALE3"), height=170, title="Payout over time", open_=False) -> str:
    """Stacked monthly bars: top 5 selected holdings + Others (BRL view)."""
    w, h, top_pad = 600, height, 18
    top, rest = _selection(selected)
    series = [(k, PAYOUTS_BRL[k][1], PAYOUTS_BRL[k][2]) for k in top]
    if rest:
        series.append(("Others", OTHERS, [sum(PAYOUTS_BRL[k][2][i] for k in rest) for i in range(12)]))
    totals = [sum(v[i] for _, _, v in series) for i in range(12)]
    peak = max(totals) or 1
    bw, gap = 34, (w - 12 * 34) / 11
    bars = []
    for i in range(12):
        x = round(i * (bw + gap), 1)
        y = h
        for _, col, vals in series:
            if not vals[i]:
                continue
            bh = round(vals[i] / peak * (h - top_pad - 4), 1)
            y -= bh
            bars.append(f'<rect x="{x}" y="{round(y, 1)}" width="{bw}" height="{bh}" rx="4" fill="{col}" fill-opacity="{1 if i == 11 else .55}"/>')
    labels = "".join(f'<span class="{"text-mint" if i == 11 else ""}">{m}</span>' for i, m in enumerate(MONTHS))
    legend = "".join(f'<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background:{col}"></span>{k}{f" ({len(rest)})" if k == "Others" else ""}</span>' for k, col, _ in series)
    return f"""<section class="rounded-xl2 bg-card border border-line p-5 flex flex-col gap-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="font-display text-lg font-bold">{title}</h2>
            <p class="text-xs text-muted mt-0.5">Dividends and interest received, from your transactions · last 12 months</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right"><div class="cap">September/2026</div><div class="font-display text-[22px] font-extrabold num text-mint">R${totals[-1]:,.2f}</div></div>
            <div class="flex rounded-full bg-raised p-0.5 text-xs font-semibold" role="tablist" aria-label="Payout currency"><button class="px-2.5 py-1 rounded-full text-muted" aria-selected="false">$</button><button class="px-2.5 py-1 rounded-full bg-mint text-[#062A1F]" aria-selected="true">R$</button></div>
          </div>
        </div>
        {payout_select(selected, open_)}
        <div class="flex flex-col gap-1.5">
          <svg viewBox="0 0 {w} {h}" preserveAspectRatio="none" class="w-full" style="height:{h}px" aria-label="Payout per month">
            <line x1="0" y1="{h}" x2="{w}" y2="{h}" stroke="#232C28"/>
            {''.join(bars)}
          </svg>
          <div class="flex justify-between text-[10.5px] uppercase tracking-wider text-faint font-semibold px-1">{labels}</div>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{legend}</div>
      </section>"""


BELL_CLOSED = '''<div class="ml-auto relative">
      <button class="w-10 h-10 rounded-full grid place-items-center hover:bg-white/5 relative" aria-label="Notifications, 2 unseen">
        <iconify-icon icon="material-symbols:notifications-outline" width="22"></iconify-icon>
        <span class="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-coral text-[10px] font-bold text-[#2A0A0A] grid place-items-center">2</span>
      </button>
    </div>'''

INBOX = '''<div class="ml-auto relative">
      <button class="w-10 h-10 rounded-full grid place-items-center bg-white/5 relative" aria-label="Notifications" aria-expanded="true">
        <iconify-icon icon="material-symbols:notifications-outline" width="22"></iconify-icon>
      </button>
      <div class="absolute right-0 top-12 w-[400px] rounded-2xl bg-raised border border-line shadow-[0_24px_60px_-20px_rgba(0,0,0,.85)] z-40 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-line"><span class="font-display font-bold">Notifications</span><span class="text-xs text-muted">2 new · marked seen</span></div>
        <div class="flex flex-col">
          <div class="px-4 py-3 border-b border-line/70 flex gap-3">
            <span class="w-9 h-9 rounded-full bg-sky/15 text-sky grid place-items-center shrink-0"><iconify-icon icon="material-symbols:mail-outline" width="18"></iconify-icon></span>
            <div class="flex-1 min-w-0">
              <div class="text-sm"><b>Alex Rivera</b> invited you to <b>The Rivera Household</b> as Member</div>
              <div class="text-[11.5px] text-faint mt-0.5">2 hours ago</div>
              <div class="flex gap-2 mt-2"><button class="h-8 px-4 rounded-full bg-mint text-[#062A1F] text-sm font-semibold">Accept</button><button class="h-8 px-3 rounded-full text-sm text-muted hover:bg-white/5">Decline</button></div>
            </div>
            <button class="ghost !w-7 !h-7 shrink-0" aria-label="Delete notification"><iconify-icon icon="material-symbols:close" width="16"></iconify-icon></button>
          </div>
          <div class="px-4 py-3 border-b border-line/70 flex gap-3">
            <span class="w-9 h-9 rounded-full bg-sun/15 text-sun grid place-items-center shrink-0"><iconify-icon icon="material-symbols:event-available-outline" width="18"></iconify-icon></span>
            <div class="flex-1 min-w-0">
              <div class="text-sm"><b>CDB Banco Inter 2026</b> reached its due date on 30/09/2026 but still has a position. Archive it?</div>
              <div class="text-[11.5px] text-faint mt-0.5">Today · XP Investimentos</div>
              <div class="flex gap-2 mt-2"><button class="h-8 px-4 rounded-full border border-line text-sm font-semibold">Archive holding</button><button class="h-8 px-3 rounded-full text-sm text-muted hover:bg-white/5">View holding</button></div>
            </div>
            <button class="ghost !w-7 !h-7 shrink-0" aria-label="Delete notification"><iconify-icon icon="material-symbols:close" width="16"></iconify-icon></button>
          </div>
          <div class="px-4 py-3 flex gap-3 opacity-60">
            <span class="w-9 h-9 rounded-full bg-white/5 text-muted grid place-items-center shrink-0"><iconify-icon icon="material-symbols:group-add-outline" width="18"></iconify-icon></span>
            <div class="flex-1 min-w-0"><div class="text-sm">Priya Shah accepted your invitation</div><div class="text-[11.5px] text-faint mt-0.5">Seen · 3 days ago</div></div>
            <button class="ghost !w-7 !h-7 shrink-0" aria-label="Delete notification"><iconify-icon icon="material-symbols:close" width="16"></iconify-icon></button>
          </div>
        </div>
      </div>
    </div>'''

AUDIT_DIALOG = '''
  <div class="fixed inset-0 bg-black/60 z-40 grid place-items-center">
    <div class="w-[440px] rounded-[24px] bg-card border border-line p-6 flex flex-col gap-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)]" role="dialog" aria-label="Export audit log">
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3"><span class="w-10 h-10 rounded-xl bg-mint/15 text-mint grid place-items-center"><iconify-icon icon="material-symbols:download" width="20"></iconify-icon></span><div><div class="font-display text-lg font-bold">Export audit log</div><div class="text-xs text-muted">The Doe Household · CSV</div></div></div>
        <button class="ghost !w-9 !h-9" aria-label="Close"><iconify-icon icon="material-symbols:close" width="20"></iconify-icon></button>
      </div>
      <div class="flex flex-wrap gap-2"><button class="opt !h-8 !text-[13px]" aria-pressed="false">Last 30 days</button><button class="opt !h-8 !text-[13px]" aria-pressed="true">Last 90 days</button><button class="opt !h-8 !text-[13px]" aria-pressed="false">This year</button><button class="opt !h-8 !text-[13px]" aria-pressed="false">Custom</button></div>
      <div class="grid grid-cols-2 gap-3">
        <div class="field"><label for="al-from">From</label><input id="al-from" value="03/07/2026" class="num"></div>
        <div class="field"><label for="al-to">To</label><input id="al-to" value="01/10/2026" class="num"></div>
      </div>
      <p class="text-xs text-faint">Who did what and when — actor, action, entity type and ID. No amounts or personal details.</p>
      <div class="flex justify-end gap-2"><button class="h-10 px-5 rounded-full text-muted hover:bg-white/5">Cancel</button><button class="h-10 px-6 rounded-full bg-mint text-[#062A1F] font-semibold flex items-center gap-2"><iconify-icon icon="material-symbols:download" width="18"></iconify-icon>Download CSV</button></div>
    </div>
  </div>'''


def with_bell(html: str, inbox_open: bool = False) -> str:
    """Insert the notification bell at the right end of the app header."""
    return html.replace("</header>", ("    " + (INBOX if inbox_open else BELL_CLOSED) + "\n  </header>"), 1)
