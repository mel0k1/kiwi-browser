#!/usr/bin/env python3
import re
from pathlib import Path

REPO = "https://github.com/mel0k1/kiwi-browser"
BRANDING = Path("engine/browser/branding/release")

PREFS = {
    "startup.homepage_override_url": "",
    "startup.homepage_welcome_url": "",
    "startup.homepage_welcome_url.additional": "",
    "app.update.url.manual": f"{REPO}/releases/latest",
    "app.update.url.details": f"{REPO}/releases",
    "app.releaseNotesURL": f"{REPO}/releases",
    "app.releaseNotesURL.aboutDialog": f"{REPO}/releases",
    "app.releaseNotesURL.prompt": f"{REPO}/releases",
}

NSIS = {
    "URLInfoAbout": REPO,
    "URLUpdateInfo": f"{REPO}/releases",
    "HelpLink": f"{REPO}/issues",
    "URLManualDownload": f"{REPO}/releases/latest",
}

prefs_path = BRANDING / "pref" / "firefox-branding.js"
nsis_path = BRANDING / "branding.nsi"

if not prefs_path.exists() or not nsis_path.exists():
    raise SystemExit(f"branding files missing: {prefs_path}, {nsis_path}")

text = prefs_path.read_text()
for key, value in PREFS.items():
    text, n = re.subn(
        rf'pref\("{re.escape(key)}", *"[^"]*"\);', f'pref("{key}", "{value}");', text
    )
    if n != 1:
        raise SystemExit(f"prefs: {key} replaced {n} times")
prefs_path.write_text(text)

text = nsis_path.read_text()
for key, value in NSIS.items():
    text, n = re.subn(rf'!define {key} *"[^"]*"', f'!define {key} "{value}"', text)
    if n != 1:
        raise SystemExit(f"nsis: {key} replaced {n} times")
nsis_path.write_text(text)

print("branding URLs rewritten to Kiwi")
