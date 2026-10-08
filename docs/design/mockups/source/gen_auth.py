"""Build the nine auth screens (static Superdesign drafts) from the shared kit.

Pre-auth screens have no app bar: a brand panel on the left (with a small
live-looking product preview) and the form column on the right.
"""
import pathlib
import re

HERE = pathlib.Path(__file__).parent
TOP = (HERE / "_kit_top.html").read_text()
FORM_CSS = (HERE / "_kit_form.css").read_text()
BOTTOM = (HERE / "_kit_bottom.html").read_text()

AUTH_CSS = """
  .digit { width: 52px; height: 60px; border-radius: 14px; background: #0C100F; border: 1px solid #232C28; text-align: center; font-family: Manrope, sans-serif; font-size: 26px; font-weight: 800; color: #E7ECE9; }
  .digit.on { border-color: #5EE6B8; box-shadow: 0 0 0 3px rgba(94,230,184,.15); }
  .primary { height: 46px; border-radius: 999px; background: #5EE6B8; color: #062A1F; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-shadow: 0 6px 20px -6px rgba(94,230,184,.55); }
  .back { width: 40px; height: 40px; border-radius: 999px; display: grid; place-items: center; color: #97A39D; border: 1px solid #232C28; }
"""

BRAND = '''
    <aside class="relative w-[520px] shrink-0 overflow-hidden border-r border-line bg-[#0A0E0D] p-12 flex flex-col justify-between">
      <div class="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full bg-mint/20 blur-[110px]"></div>
      <div class="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-sky/10 blur-[100px]"></div>
      <div class="relative flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-mint grid place-items-center text-[#00382B]"><iconify-icon icon="material-symbols:savings-outline" width="22"></iconify-icon></div>
        <span class="font-display text-lg font-bold">New Finance App</span>
      </div>
      <div class="relative flex flex-col gap-8">
        <h2 class="font-display text-[40px] leading-[46px] font-extrabold tracking-tight max-w-[380px]">Household money, <span class="text-mint">shared clearly.</span></h2>
        <!-- product preview -->
        <div class="relative h-[200px]">
          <div class="absolute left-0 top-0 w-[220px] rounded-[20px] bg-card/90 border border-line p-4 flex flex-col gap-2 shadow-[0_20px_40px_-20px_rgba(0,0,0,.9)] -rotate-2">
            <div class="flex items-center gap-2 text-[12px] text-muted"><span class="w-6 h-6 rounded-full bg-mint/15 text-mint grid place-items-center"><iconify-icon icon="material-symbols:account-balance-outline" width="13"></iconify-icon></span>Main Checking</div>
            <div class="font-display text-[22px] font-extrabold num">$3,240.50</div>
            <div class="text-[11px] text-mint num">+$2,368.61 this month</div>
          </div>
          <div class="absolute left-[170px] top-[78px] w-[240px] rounded-[20px] bg-card/95 border border-line p-3.5 flex items-center gap-3 shadow-[0_20px_40px_-20px_rgba(0,0,0,.9)] rotate-1">
            <div class="ring !w-[52px] !h-[52px]" style="background: radial-gradient(closest-side, #131917 78%, transparent 79%), conic-gradient(#7CB9FF 57%, #232C28 0);"><span class="num text-[12px] font-bold">57%</span></div>
            <div><div class="text-[13px] font-semibold">House Down Payment</div><div class="text-[11px] text-muted num">R$85,000 / R$150,000</div></div>
          </div>
        </div>
        <div class="flex flex-col gap-3 text-[15px] text-muted">
          <div class="flex items-center gap-3"><iconify-icon icon="material-symbols:group-outline" width="20" class="text-mint"></iconify-icon>Track spending together, with clear ownership</div>
          <div class="flex items-center gap-3"><iconify-icon icon="material-symbols:flag-outline" width="20" class="text-mint"></iconify-icon>Grow shared savings and investment goals</div>
          <div class="flex items-center gap-3"><iconify-icon icon="material-symbols:query-stats" width="20" class="text-mint"></iconify-icon>See your net worth at a glance — in R$ and $</div>
        </div>
      </div>
      <p class="relative text-xs text-faint">© 2026 New Finance App</p>
    </aside>'''


def page(title: str, form: str, back: bool = False) -> str:
    """Brand panel + centred 400px form column; no app bar."""
    top = TOP.replace("{{TITLE}}", title).replace("</style>", FORM_CSS + AUTH_CSS + "</style>", 1)
    top = re.sub(r'\s*<!-- App bar -->\s*<header.*?</header>', "", top, flags=re.S)
    back_btn = '<button class="back absolute top-8 left-8" aria-label="Back"><iconify-icon icon="material-symbols:arrow-back" width="20"></iconify-icon></button>' if back else ""
    body = f'''
  <div class="flex min-h-screen">{BRAND}
    <main class="relative flex-1 grid place-items-center p-12">
      {back_btn}
      <div class="w-[400px] flex flex-col gap-6">{form}</div>
    </main>
  </div>'''
    return top + body + BOTTOM


def head(icon: str | None, title: str, sub: str) -> str:
    """Screen heading with optional icon badge."""
    badge = f'<div class="w-14 h-14 rounded-2xl bg-mint/15 text-mint grid place-items-center"><iconify-icon icon="material-symbols:{icon}" width="28"></iconify-icon></div>' if icon else ""
    return f'{badge}<div><h1 class="font-display text-[30px] leading-9 font-extrabold tracking-tight">{title}</h1><p class="text-muted mt-1.5">{sub}</p></div>'


def digits(filled: str) -> str:
    """Six code boxes; `filled` digits shown, next box focused."""
    boxes = [f'<input class="digit num" value="{c}" aria-label="Digit {i+1}">' for i, c in enumerate(filled)]
    boxes += [f'<input class="digit{" on" if i == 0 else ""}" value="" aria-label="Digit {len(filled)+i+1}">' for i in range(6 - len(filled))]
    return f'<div class="flex justify-between">{"".join(boxes)}</div>'


def sign_in() -> str:
    return head(None, "Welcome back", "Sign in to your household's finances.") + '''
      <div class="flex flex-col gap-4">
        <div class="field"><label for="si-email">Email</label><input id="si-email" value="jane.doe@example.com"></div>
        <div class="field"><div class="flex justify-between"><label for="si-pw">Password</label><a id="forgot-link" href="#forgot" class="text-xs text-mint font-medium">Forgot password?</a></div><input id="si-pw" type="password" value="••••••••••••"></div>
      </div>
      <button class="primary">Sign in<iconify-icon icon="material-symbols:arrow-forward" width="18"></iconify-icon></button>
      <p class="text-sm text-muted text-center">New here? <a id="signup-link" href="#register" class="text-mint font-semibold">Create an account</a></p>'''


def register() -> str:
    return head(None, "Create your account", "Start budgeting together in minutes.") + '''
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3"><div class="field"><label for="r-first">First name</label><input id="r-first" value="Jane"></div><div class="field"><label for="r-last">Last name</label><input id="r-last" value="Doe"></div></div>
        <div class="field"><label for="r-email">Email</label><input id="r-email" value="jane.doe@example.com"></div>
        <div class="field"><label for="r-pw">Password</label><input id="r-pw" type="password" value="••••••••••••••"></div>
        <div class="flex flex-col gap-1.5 -mt-1"><div class="flex gap-1"><div class="flex-1 h-1.5 rounded-full bg-mint"></div><div class="flex-1 h-1.5 rounded-full bg-mint"></div><div class="flex-1 h-1.5 rounded-full bg-mint"></div><div class="flex-1 h-1.5 rounded-full bg-line"></div></div><span class="text-xs text-muted">Strong · at least 12 characters</span></div>
        <div class="field"><label for="r-pw2">Confirm password</label><input id="r-pw2" type="password" value="••••••••••••••"></div>
        <label class="flex items-start gap-2 text-sm text-muted"><span class="w-[18px] h-[18px] mt-px rounded-md bg-mint text-[#062A1F] grid place-items-center shrink-0"><iconify-icon icon="material-symbols:check" width="14"></iconify-icon></span><span>I agree to the <a id="terms-link" href="#terms" class="text-mint">Terms</a> and <a id="privacy-link" href="#privacy" class="text-mint">Privacy Policy</a></span></label>
      </div>
      <button class="primary">Create account</button>
      <p class="text-sm text-muted text-center">Already have an account? <a id="signin-link" href="#sign-in" class="text-mint font-semibold">Sign in</a></p>'''


def forgot() -> str:
    return head("lock-reset", "Reset your password", "Enter your email and we'll send you a reset link.") + '''
      <div class="field"><label for="f-email">Email</label><input id="f-email" value="jane.doe@example.com"></div>
      <button class="primary">Send reset link</button>
      <div class="rounded-2xl bg-mint/10 border border-mint/30 p-4 flex gap-3 text-sm"><iconify-icon icon="material-symbols:mark-email-read-outline" width="22" class="text-mint shrink-0"></iconify-icon><div><div class="font-semibold">Check your inbox</div><div class="text-muted mt-0.5">If an account exists for that email, a reset link is on its way.</div></div></div>
      <p class="text-sm text-muted text-center">Remembered it? <a id="back-signin" href="#sign-in" class="text-mint font-semibold">Back to sign in</a></p>'''


def reset() -> str:
    return head("password", "Choose a new password", "Make it something you haven't used before.") + '''
      <div class="field"><label for="n-pw">New password</label><input id="n-pw" type="password" value="••••••••••••••"></div>
      <div class="flex flex-col gap-1.5 -mt-3"><div class="flex gap-1"><div class="flex-1 h-1.5 rounded-full bg-sun"></div><div class="flex-1 h-1.5 rounded-full bg-sun"></div><div class="flex-1 h-1.5 rounded-full bg-line"></div><div class="flex-1 h-1.5 rounded-full bg-line"></div></div><span class="text-xs text-muted">Fair · add a symbol or more length</span></div>
      <div class="field"><label for="n-pw2">Confirm new password</label><input id="n-pw2" type="password" value="••••••••••••••"></div>
      <button class="primary">Reset password</button>
      <p class="text-xs text-faint text-center">You'll be signed out of every other device.</p>'''


def mfa_method() -> str:
    return head("shield-lock-outline", "Secure your account", "Two-factor authentication is required to keep shared household finances safe.") + '''
      <div class="flex flex-col gap-3">
        <button class="rounded-2xl border border-mint/60 bg-mint/[.06] p-4 flex items-start gap-3 text-left shadow-[0_0_0_3px_rgba(94,230,184,.12)]">
          <span class="w-10 h-10 rounded-xl bg-mint/15 text-mint grid place-items-center shrink-0"><iconify-icon icon="material-symbols:phone-iphone-outline" width="22"></iconify-icon></span>
          <div class="flex-1"><div class="font-semibold">Authenticator app</div><div class="text-sm text-muted mt-0.5">Google Authenticator, Authy, 1Password, or similar generate a new code every 30 seconds.</div></div>
          <span class="w-5 h-5 rounded-full border-[6px] border-mint shrink-0 mt-1"></span>
        </button>
      </div>
      <button class="primary">Continue<iconify-icon icon="material-symbols:arrow-forward" width="18"></iconify-icon></button>'''


def mfa_setup() -> str:
    qr = "".join(f'<div class="{"bg-ink" if (r * 7 + c * 3 + r * c) % 3 == 0 or (r < 3 and c < 3) or (r < 3 and c > 8) or (r > 8 and c < 3) else ""}"></div>' for r in range(12) for c in range(12))
    return head(None, "Scan this QR code", "Open your authenticator app and scan — or enter the key manually.") + f'''
      <div class="flex items-center gap-5">
        <div class="w-[150px] h-[150px] rounded-2xl bg-white p-3 shrink-0"><div class="grid grid-cols-12 grid-rows-12 w-full h-full gap-[1px]" style="filter: invert(1)">{qr}</div></div>
        <div class="flex flex-col gap-2 min-w-0">
          <span class="cap">Setup key</span>
          <div class="rounded-xl bg-raised px-3 py-2 font-mono text-sm tracking-wider flex items-center gap-2">JBSW Y3DP EHPK 3PXP<button class="ghost !w-7 !h-7 ml-auto" aria-label="Copy key"><iconify-icon icon="material-symbols:content-copy-outline" width="16"></iconify-icon></button></div>
          <span class="text-xs text-faint">Account: jane.doe@example.com</span>
        </div>
      </div>
      <div class="flex flex-col gap-2"><span class="flabel !mb-0">Enter the 6-digit code from the app</span>{digits("482")}</div>
      <button class="primary">Verify &amp; continue</button>'''


def backup_codes() -> str:
    codes = ["4F9K-2QRT", "8LMN-73WX", "1PZC-5VBH", "6TGY-90KD", "3RQE-48FS", "7HJX-21NA", "5WVC-63LT", "9DBM-17PY"]
    cells = "".join(f'<div class="rounded-xl bg-raised px-3 py-2.5 font-mono text-[15px] tracking-wider text-center num">{c}</div>' for c in codes)
    return head("key-outline", "Save your backup codes", "Use one if you lose your phone. Each code works once — store them somewhere safe.") + f'''
      <div class="rounded-2xl border border-line bg-bg p-3 grid grid-cols-2 gap-2">{cells}</div>
      <div class="grid grid-cols-2 gap-3"><button class="h-10 rounded-full border border-line flex items-center justify-center gap-2 text-sm"><iconify-icon icon="material-symbols:download" width="18"></iconify-icon>Download</button><button class="h-10 rounded-full border border-line flex items-center justify-center gap-2 text-sm"><iconify-icon icon="material-symbols:content-copy-outline" width="18"></iconify-icon>Copy all</button></div>
      <label class="flex items-center gap-2 text-sm"><span class="w-[18px] h-[18px] rounded-md bg-mint text-[#062A1F] grid place-items-center"><iconify-icon icon="material-symbols:check" width="14"></iconify-icon></span>I've saved these codes somewhere safe</label>
      <button class="primary">Continue</button>'''


def mfa_code() -> str:
    return head("verified-user-outline", "Two-factor verification", "Enter the 6-digit code from your authenticator app.") + f'''
      {digits("4821")}
      <div class="flex items-center gap-2 text-xs text-muted"><div class="flex-1 h-1 rounded-full bg-raised overflow-hidden"><div class="h-full bg-mint" style="width:60%"></div></div><span class="num">new code in 18s</span></div>
      <button class="primary">Verify</button>
      <p class="text-sm text-muted text-center">Lost your phone? <a id="use-backup" href="#backup-code" class="text-mint font-semibold">Use a backup code</a></p>'''


def backup_code() -> str:
    return head("key-outline", "Enter a backup code", "Each code can only be used once. Use one if you've lost access to your authenticator app.") + '''
      <div class="field"><label for="bc">Backup code</label><input id="bc" value="7HJX-21NA" class="font-mono tracking-[.2em] text-center text-lg num"></div>
      <button class="primary">Verify</button>
      <p class="text-sm text-muted text-center"><a id="use-app" href="#mfa-code" class="text-mint font-semibold">Use authenticator app instead</a></p>'''


SCREENS = [("auth-sign-in.html", "Sign in", sign_in, False),
           ("auth-register.html", "Create account", register, False),
           ("auth-forgot.html", "Forgot password", forgot, True),
           ("auth-reset.html", "Reset password", reset, False),
           ("auth-mfa-method.html", "Secure your account", mfa_method, False),
           ("auth-mfa-setup.html", "Scan QR code", mfa_setup, True),
           ("auth-backup-codes.html", "Backup codes", backup_codes, False),
           ("auth-mfa-code.html", "Two-factor verification", mfa_code, True),
           ("auth-backup-code.html", "Enter backup code", backup_code, True)]

if __name__ == "__main__":
    for fname, title, fn, back in SCREENS:
        (HERE / fname).write_text(page(title, fn(), back))
        print(fname)
