"""Build the five Guided Setup screens (static Superdesign drafts) from the shared kit.

The wizard suppresses main nav (no hamburger), so the kit's app bar is
rewritten to logo-only. Each step body is a function returning HTML.
"""
import pathlib
import re

HERE = pathlib.Path(__file__).parent
TOP = (HERE / "_kit_top.html").read_text()
FORM_CSS = (HERE / "_kit_form.css").read_text()
BOTTOM = (HERE / "_kit_bottom.html").read_text()

WIZ_CSS = """
  .stepdot { width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
  .step-done .stepdot { background: #5EE6B8; color: #062A1F; }
  .step-current .stepdot { background: #0F3B2E; color: #5EE6B8; box-shadow: 0 0 0 2px #5EE6B8; }
  .step-next .stepdot { border: 1px solid #232C28; color: #5F6B65; }
  .wcard { border-radius: 24px; background: #131917; border: 1px solid #232C28; padding: 28px; display: flex; flex-direction: column; gap: 20px; }
  .typetile { flex: 1; border-radius: 16px; border: 1px solid #232C28; padding: 14px; display: flex; flex-direction: column; gap: 6px; text-align: left; }
  .typetile[aria-pressed="true"] { border-color: rgba(94,230,184,.6); background: #0F3B2E55; }
  .pick { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px; border: 1px solid #232C28; font-size: 14px; }
  .pick[aria-pressed="true"] { border-color: rgba(94,230,184,.6); background: #0F3B2E; }
  .box { width: 18px; height: 18px; border-radius: 6px; border: 1.5px solid #5F6B65; display: grid; place-items: center; flex-shrink: 0; }
  .pick[aria-pressed="true"] .box { background: #5EE6B8; border-color: #5EE6B8; color: #062A1F; }
  .sub { display: inline-flex; align-items: center; gap: 2px; height: 26px; padding: 0 4px 0 10px; border-radius: 999px; background: #1A211E; font-size: 12px; }
"""

STEPS = [("Add an account", "Where your money lives"),
         ("Review categories", "What spending gets tagged with"),
         ("Set a budget", "Optional monthly target")]


def page(title: str, body: str) -> str:
    """Wrap a wizard body in the kit shell with a logo-only app bar."""
    top = TOP.replace("{{TITLE}}", title).replace("</style>", FORM_CSS + WIZ_CSS + "</style>", 1)
    top = re.sub(r'\s*<button class="w-10 h-10 rounded-full grid place-items-center hover:bg-white/5" aria-label="Open navigation menu">.*?</button>', "", top, flags=re.S)
    return top + body + BOTTOM


def stepper(current: int) -> str:
    """Vertical stepper; steps before `current` are done."""
    items = []
    for i, (label, hint) in enumerate(STEPS):
        state = "done" if i < current else "current" if i == current else "next"
        dot = '<iconify-icon icon="material-symbols:check" width="18"></iconify-icon>' if state == "done" else str(i + 1)
        line = '' if i == len(STEPS) - 1 else f'<div class="ml-[15px] w-px h-8 {"bg-mint" if i < current else "bg-line"}"></div>'
        color = "text-ink" if state == "current" else "text-muted" if state == "done" else "text-faint"
        items.append(f'''<div class="step-{state}"><div class="flex items-center gap-3"><span class="stepdot">{dot}</span><div><div class="text-sm font-semibold {color}">{label}</div><div class="text-xs text-faint">{hint}</div></div></div>{line}</div>''')
    return f'''<aside class="flex flex-col pt-2">
        <span class="cap mb-4">Getting started · step {current + 1} of 3</span>
        {"".join(items)}
        <div class="mt-8 rounded-2xl border border-dashed border-line p-4 text-xs text-faint flex gap-2"><iconify-icon icon="material-symbols:lightbulb-outline" width="16" class="shrink-0"></iconify-icon>Everything here can be changed later from Account Setup.</div>
      </aside>'''


def wizard(current: int, content: str) -> str:
    """Two-column wizard layout: stepper + step card."""
    return f'''
  <main class="max-w-[1080px] mx-auto px-12 pt-12 pb-16 grid grid-cols-[260px_minmax(0,1fr)] gap-12">
      {stepper(current)}
      <section class="wcard">{content}</section>
  </main>'''


def household() -> str:
    """Name-your-household screen, shown before the 3-step wizard."""
    return '''
  <main class="max-w-[560px] mx-auto px-6 pt-20 pb-16 flex flex-col items-center gap-8 text-center">
    <div class="w-20 h-20 rounded-3xl bg-mint/15 text-mint grid place-items-center"><iconify-icon icon="material-symbols:home-outline" width="40"></iconify-icon></div>
    <div>
      <h1 class="font-display text-[34px] leading-10 font-extrabold tracking-tight">Name your household</h1>
      <p class="text-muted mt-2">This is what everyone you invite will see. You can change it later.</p>
    </div>
    <section class="wcard w-full text-left">
      <div class="field"><label for="hh-name">Household name</label><input id="hh-name" value="The Doe Family"></div>
      <div class="flex flex-wrap gap-2 -mt-2"><span class="text-xs text-faint mr-1 self-center">Ideas:</span><button class="opt !h-7 !text-xs">The Doe Family</button><button class="opt !h-7 !text-xs">Apt 4B</button><button class="opt !h-7 !text-xs">Casa da Praia</button></div>
      <button class="h-11 rounded-full bg-mint text-[#062A1F] font-semibold flex items-center justify-center gap-2">Continue<iconify-icon icon="material-symbols:arrow-forward" width="18"></iconify-icon></button>
    </section>
  </main>'''


def step_account() -> str:
    """Step 1: first account, optional card."""
    return wizard(0, '''
        <div><h1 class="font-display text-2xl font-extrabold">Add your first account</h1><p class="text-muted mt-1">Checking, savings, credit card, or investment — you can add more anytime.</p></div>
        <div class="field"><label for="a-name">Account name</label><input id="a-name" value="Main Checking"></div>
        <div>
          <span class="flabel">Account type</span>
          <div class="flex gap-3">
            <button class="typetile" aria-pressed="true"><iconify-icon icon="material-symbols:account-balance-outline" width="22" class="text-mint"></iconify-icon><span class="text-sm font-semibold">Checking</span><span class="text-xs text-faint">Everyday account</span></button>
            <button class="typetile" aria-pressed="false"><iconify-icon icon="material-symbols:savings-outline" width="22" class="text-muted"></iconify-icon><span class="text-sm font-semibold">Savings</span><span class="text-xs text-faint">Money set aside</span></button>
            <button class="typetile" aria-pressed="false"><iconify-icon icon="material-symbols:credit-card-outline" width="22" class="text-muted"></iconify-icon><span class="text-sm font-semibold">Credit card only</span><span class="text-xs text-faint">No bank account behind it</span></button>
            <button class="typetile" aria-pressed="false"><iconify-icon icon="material-symbols:trending-up" width="22" class="text-muted"></iconify-icon><span class="text-sm font-semibold">Investment</span><span class="text-xs text-faint">Brokerage account</span></button>
          </div>
        </div>
        <div class="grid grid-cols-[1fr_1.4fr] gap-4">
          <div><span class="flabel">Currency</span><div class="flex gap-2"><button class="opt" aria-pressed="false">BRL</button><button class="opt" aria-pressed="true">USD</button></div></div>
          <div class="rounded-2xl bg-bg border border-line px-4 py-3"><span class="flabel !mb-0">Starting balance</span><div class="flex items-baseline gap-2"><span class="font-display text-xl font-bold text-muted">$</span><input class="bg-transparent font-display text-[28px] leading-9 font-extrabold num w-full outline-none" value="3,240.50" aria-label="Starting balance"></div></div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="flabel !mb-0">Cards on this account <span class="font-normal text-faint">· optional</span></span>
          <div class="flex items-center gap-3 rounded-[14px] bg-gradient-to-br from-[#1E3A5F] to-[#14202E] px-3 py-3"><iconify-icon icon="logos:visa" width="34"></iconify-icon><div class="flex flex-col"><span class="num font-medium text-sm">•••• 1111</span><span class="text-[12px] text-muted">Closes 15 · Due 22 · Exp 09/2030</span></div><button class="ghost ml-auto" aria-label="Remove card"><iconify-icon icon="material-symbols:close" width="18"></iconify-icon></button></div>
          <!-- Add-card form, open: live preview + fields (network detected from the number) -->
          <div class="rounded-2xl border border-mint/40 bg-bg p-4 grid grid-cols-[250px_1fr] gap-5">
            <div class="flex flex-col gap-2">
              <div class="aspect-[1.586] rounded-2xl bg-gradient-to-br from-[#3A2A12] via-[#2A1E10] to-[#14100A] border border-white/10 p-4 flex flex-col justify-between shadow-[0_12px_30px_-12px_rgba(0,0,0,.8)]">
                <div class="flex items-center justify-between"><div class="w-9 h-7 rounded-md bg-gradient-to-br from-[#E9C46A] to-[#B88A2E] opacity-90"></div><iconify-icon icon="logos:mastercard" width="40"></iconify-icon></div>
                <div class="font-mono text-[17px] tracking-[.12em] num text-ink">5502 0942 4242 <span class="text-faint">••••</span></div>
                <div class="flex justify-between text-[10px] uppercase tracking-wider text-muted"><span>Closes 05 · Due 12</span><span class="num">03/28</span></div>
              </div>
              <span class="text-xs text-faint text-center">Mastercard detected from the number</span>
            </div>
            <div class="flex flex-col gap-3">
              <div class="text-sm font-semibold">New credit card</div>
              <div class="field"><label for="cc-num">Card number</label><input id="cc-num" value="5502 0942 4242" class="num font-mono tracking-wider"></div>
              <div class="grid grid-cols-3 gap-3">
                <div class="field"><label for="cc-close">Closing day</label><input id="cc-close" value="5" class="num"></div>
                <div class="field"><label for="cc-due">Due day</label><input id="cc-due" value="12" class="num"></div>
                <div class="field"><label for="cc-exp">Expires</label><input id="cc-exp" value="03/2028" class="num"></div>
              </div>
              <p class="text-xs text-faint">Only the last 4 digits are stored. Closing and due days drive which bill each charge lands on.</p>
              <div class="flex justify-end gap-2 mt-auto"><button class="h-9 px-4 rounded-full text-sm text-muted hover:bg-white/5">Cancel</button><button class="h-9 px-5 rounded-full bg-mint text-[#062A1F] text-sm font-semibold">Save card</button></div>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-line">
          <span class="text-xs text-faint">An account is required to get started.</span>
          <button class="h-11 px-6 rounded-full bg-mint text-[#062A1F] font-semibold flex items-center gap-2">Add account &amp; continue<iconify-icon icon="material-symbols:arrow-forward" width="18"></iconify-icon></button>
        </div>''')


CATS = [("Housing", "home-outline", "peach", ["Rent / Mortgage", "Utilities"]),
        ("Groceries", "shopping-cart-outline", "mint", []),
        ("Transportation", "directions-car-outline", "sky", ["Fuel", "Public Transit"]),
        ("Dining & Entertainment", "restaurant", "sun", ["Restaurants", "Streaming Services"]),
        ("Healthcare", "medical-services-outline", "coral", []),
        ("Shopping", "shopping-bag-outline", "lilac", [])]


def step_categories() -> str:
    """Step 2: review the seeded starter categories."""
    cards = []
    for name, icon, col, subs in CATS:
        pills = "".join(f'<span class="sub">{s}<button class="ghost !w-5 !h-5" aria-label="Archive {s}"><iconify-icon icon="material-symbols:close" width="12"></iconify-icon></button></span>' for s in subs)
        cards.append(f'''<div class="rounded-2xl bg-raised/60 border border-line p-3 flex flex-col gap-2.5">
            <div class="flex items-center gap-2.5"><span class="w-8 h-8 rounded-full bg-{col}/15 text-{col} grid place-items-center"><iconify-icon icon="material-symbols:{icon}" width="16"></iconify-icon></span><span class="text-sm font-semibold flex-1 truncate">{name}</span><button class="ghost !w-7 !h-7" aria-label="Edit {name}"><iconify-icon icon="material-symbols:edit-outline" width="16"></iconify-icon></button><button class="ghost !w-7 !h-7" aria-label="Archive {name}"><iconify-icon icon="material-symbols:archive-outline" width="16"></iconify-icon></button></div>
            <div class="flex flex-wrap gap-1.5">{pills}<button class="h-[26px] px-2.5 rounded-full border border-dashed border-line text-xs text-muted">+ Sub</button></div>
          </div>''')
    return wizard(1, f'''
        <div><h1 class="font-display text-2xl font-extrabold">Review your categories</h1><p class="text-muted mt-1">We've set up a starter set for your household. Edit, archive, or add anything before moving on.</p></div>
        <div class="grid grid-cols-2 gap-3">{"".join(cards)}</div>
        <button class="h-10 rounded-[14px] border border-dashed border-line text-muted flex items-center justify-center gap-2 text-sm"><iconify-icon icon="material-symbols:add" width="16"></iconify-icon>Add a category</button>
        <div class="flex items-center justify-between pt-2 border-t border-line">
          <button class="h-10 px-4 rounded-full text-muted hover:bg-white/5 flex items-center gap-1"><iconify-icon icon="material-symbols:arrow-back" width="18"></iconify-icon>Back</button>
          <button class="h-11 px-6 rounded-full bg-mint text-[#062A1F] font-semibold flex items-center gap-2">Looks good, continue<iconify-icon icon="material-symbols:arrow-forward" width="18"></iconify-icon></button>
        </div>''')


def step_budget() -> str:
    """Step 3: optional first budget, with one already created."""
    def pick(name, icon, col, state, note=""):
        attr = 'aria-pressed="true"' if state == "on" else 'aria-pressed="false"' if state == "off" else 'aria-disabled="true" style="opacity:.45;border-style:dashed"'
        chk = '<iconify-icon icon="material-symbols:check" width="14"></iconify-icon>' if state == "on" else ""
        return f'<button class="pick" {attr}><span class="box">{chk}</span><span class="w-6 h-6 rounded-full bg-{col}/15 text-{col} grid place-items-center"><iconify-icon icon="material-symbols:{icon}" width="14"></iconify-icon></span>{name}<span class="ml-auto text-xs text-faint">{note}</span></button>'
    return wizard(2, f'''
        <div><h1 class="font-display text-2xl font-extrabold">Set a budget</h1><p class="text-muted mt-1">Group categories under one monthly target. Entirely optional — you can add budgets later.</p></div>
        <div class="flex items-center gap-3 rounded-2xl bg-mint/10 border border-mint/30 px-4 py-3">
          <iconify-icon icon="material-symbols:check-circle" width="22" class="text-mint"></iconify-icon>
          <div class="flex-1"><div class="text-sm font-semibold">Fun Money · $300.00 / month</div><div class="text-xs text-muted">Dining & Entertainment, Shopping</div></div>
          <button class="ghost" aria-label="Edit Fun Money"><iconify-icon icon="material-symbols:edit-outline" width="16"></iconify-icon></button>
        </div>
        <div class="flex items-center gap-3"><div class="flex-1 h-px bg-line"></div><span class="text-xs text-faint">Add another</span><div class="flex-1 h-px bg-line"></div></div>
        <div class="grid grid-cols-[1fr_1fr] gap-4">
          <div class="field"><label for="b-name">Budget name</label><input id="b-name" value="Household Essentials"></div>
          <div class="rounded-2xl bg-bg border border-line px-4 py-2"><span class="flabel !mb-0">Monthly target</span><div class="flex items-baseline gap-2"><span class="font-display text-lg font-bold text-muted">$</span><input class="bg-transparent font-display text-2xl font-extrabold num w-full outline-none" value="800.00" aria-label="Monthly target"></div></div>
        </div>
        <div class="flex flex-col gap-1.5">
          <span class="flabel !mb-0">Covers</span>
          {pick("Housing", "home-outline", "peach", "on")}
          {pick("Groceries", "shopping-cart-outline", "mint", "on")}
          {pick("Transportation", "directions-car-outline", "sky", "off")}
          {pick("Healthcare", "medical-services-outline", "coral", "off")}
          {pick("Dining & Entertainment", "restaurant", "sun", "taken", "in Fun Money")}
          {pick("Shopping", "shopping-bag-outline", "lilac", "taken", "in Fun Money")}
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-line">
          <button class="h-10 px-4 rounded-full text-muted hover:bg-white/5 flex items-center gap-1"><iconify-icon icon="material-symbols:arrow-back" width="18"></iconify-icon>Back</button>
          <div class="flex gap-2"><button class="h-11 px-5 rounded-full border border-line hover:bg-white/5">Create budget</button><button class="h-11 px-6 rounded-full bg-mint text-[#062A1F] font-semibold flex items-center gap-2">Finish setup<iconify-icon icon="material-symbols:check" width="18"></iconify-icon></button></div>
        </div>''')


def complete() -> str:
    """Setup complete: summary plus suggested next steps."""
    def tile(icon, col, n, label):
        return f'<div class="rounded-2xl bg-card border border-line p-4 flex items-center gap-3"><span class="w-10 h-10 rounded-full bg-{col}/15 text-{col} grid place-items-center"><iconify-icon icon="material-symbols:{icon}" width="20"></iconify-icon></span><div><div class="font-display text-xl font-extrabold num">{n}</div><div class="text-xs text-muted">{label}</div></div></div>'
    def nxt(icon, title, desc):
        return f'<button class="rounded-2xl bg-card border border-line p-4 flex items-start gap-3 text-left hover:border-mint/50"><iconify-icon icon="material-symbols:{icon}" width="22" class="text-mint mt-0.5"></iconify-icon><div class="flex-1"><div class="text-sm font-semibold">{title}</div><div class="text-xs text-muted mt-0.5">{desc}</div></div><iconify-icon icon="material-symbols:arrow-forward" width="18" class="text-faint"></iconify-icon></button>'
    return f'''
  <main class="max-w-[760px] mx-auto px-6 pt-16 pb-16 flex flex-col items-center gap-8 text-center">
    <div class="w-20 h-20 rounded-full bg-mint text-[#062A1F] grid place-items-center shadow-[0_0_0_10px_rgba(94,230,184,.12),0_0_0_22px_rgba(94,230,184,.06)]"><iconify-icon icon="material-symbols:check" width="44"></iconify-icon></div>
    <div><h1 class="font-display text-[34px] leading-10 font-extrabold tracking-tight">The Doe Family is ready</h1><p class="text-muted mt-2">Here's what you set up. Everything can be changed later.</p></div>
    <div class="grid grid-cols-3 gap-3 w-full text-left">
      {tile("account-balance-wallet-outline", "mint", "1", "account · 1 card")}
      {tile("category-outline", "sun", "6", "categories")}
      {tile("donut-large", "sky", "2", "budgets")}
    </div>
    <div class="w-full text-left flex flex-col gap-2">
      <span class="cap">Next steps</span>
      <div class="grid grid-cols-3 gap-3">
        {nxt("add-circle-outline", "Record a transaction", "Start tracking where money goes")}
        {nxt("person-add-outline", "Invite your household", "Share accounts, budgets, and goals")}
        {nxt("flag-outline", "Create a goal", "Save toward something specific")}
      </div>
    </div>
    <button class="h-12 px-8 rounded-full bg-mint text-[#062A1F] font-semibold flex items-center gap-2 shadow-[0_6px_20px_-6px_rgba(94,230,184,.55)]">Go to Dashboard<iconify-icon icon="material-symbols:arrow-forward" width="18"></iconify-icon></button>
  </main>'''


SCREENS = [("wiz-0-household.html", "Name your household", household),
           ("wiz-1-account.html", "Add an account", step_account),
           ("wiz-2-categories.html", "Review categories", step_categories),
           ("wiz-3-budget.html", "Set a budget", step_budget),
           ("wiz-4-complete.html", "Setup complete", complete)]

if __name__ == "__main__":
    for fname, title, fn in SCREENS:
        (HERE / fname).write_text(page(title, fn()))
        print(fname)
