#!/usr/bin/env python3
import os
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

AUS_URLS = {
    "win32": f"{REPO}/releases/latest/download/update.xml",
    "linux": f"{REPO}/releases/latest/download/update-linux.xml",
}
AUS_URL = AUS_URLS.get(os.environ.get("SURFER_PLATFORM", "linux"), AUS_URLS["linux"])

prefs_path = BRANDING / "pref" / "firefox-branding.js"
nsis_path = BRANDING / "branding.nsi"
app_ini_path = Path("engine/build/application.ini.in")

for path in (prefs_path, nsis_path, app_ini_path):
    if not path.exists():
        raise SystemExit(f"branding file missing: {path}")

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

text = app_ini_path.read_text()
text, n = re.subn(r"(?m)^URL=.*update\.xml$", f"URL={AUS_URL}", text)
if n != 1:
    raise SystemExit(f"app update URL replaced {n} times")
app_ini_path.write_text(text)

print("branding URLs rewritten to Kiwi")
