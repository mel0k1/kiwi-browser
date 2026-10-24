// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the License, v. 2.0 was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  nsZenDOMOperatedFeature,
} from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const { AppConstants } = ChromeUtils.importESModule(
  "resource://gre/modules/AppConstants.sys.mjs"
);

const kEnabledPref = "kiwi.player.enabled";
const kCornerPref = "kiwi.player.corner";
const kFlashPref = "kiwi.attention.flash-track-change";
const kZenMediaBarPref = "zen.mediacontrols.enabled";

const ICONS = {
  play: "M8 5v14l11-7z",
  pause: "M6 5h4v14H6zm8 0h4v14h-4z",
  prev: "M6 6h2v12H6zm3.5 6l8.5 6V6z",
  next: "M16 6h2v12h-2zM6 18l8.5-6L6 6z",
  muted: "M3.63 3.63L2.22 5.04 7.29 10H4v4h3l5 5v-6.59l4.18 4.18c-.65.49-1.38.88-2.18 1.11v2.06a8.9 8.9 0 0 0 3.61-1.75l2.05 2.05 1.41-1.41L3.63 3.63zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53A8.9 8.9 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-5-5.88v3.05l4.48 4.48A5 5 0 0 0 14 6.12z",
  unmuted: "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
  tab: "M17 7h-4v1.5h4V7zm0 3h-4v1.5h4V10zm0 3h-4v1.5h4V13zM3 5.5A1.5 1.5 0 0 1 4.5 4H9l2 2h8.5A1.5 1.5 0 0 1 21 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-13z",
  close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  note: "M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z",
};

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) {
    return "0:00";
  }
  const total = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString();
  const s = (total % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.padStart(2, "0")}:${s}` : `${m}:${s}`;
}

window.gKiwiMediaPlayer = new (class KiwiMediaPlayer extends nsZenDOMOperatedFeature {
  #widget = null;
  #lastMeta = undefined;
  #current = null;
  #listeners = null;
  #interval = null;
  #showTimeout = null;
  #userClosedId = null;
  #emptyMode = false;

  constructor() {
    super();
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_enabled",
      kEnabledPref,
      true,
      () => this.#onEnabledChange()
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_corner",
      kCornerPref,
      "right",
      () => this.#applyCorner()
    );
    Services.prefs.addObserver(kEnabledPref, {
      observe: () => {
        const playerOn = Services.prefs.getBoolPref(kEnabledPref, true);
        if (Services.prefs.getBoolPref(kZenMediaBarPref, true) === playerOn) {
          Services.prefs.setBoolPref(kZenMediaBarPref, !playerOn);
        }
      },
    });
    if (Services.prefs.getBoolPref(kEnabledPref, true)) {
      Services.prefs.setBoolPref(kZenMediaBarPref, false);
    }
  }

  init() {
    this.#syncSidebarButton();
    window.addEventListener("TabAttrModified", event => {
      const { changed } = event.detail;
      if (changed.includes("soundplaying")) {
        this.#evaluate(event.target.hasAttribute("soundplaying")
          ? event.target.linkedBrowser
          : null);
      } else if (changed.includes("muted")) {
        this.#updateMuteIcon();
      }
    });
    window.addEventListener("TabClose", this.#onTabGone.bind(this));
    window.addEventListener("TabBrowserDiscarded", this.#onTabGone.bind(this));
    if (!Services.prefs.getBoolPref(kEnabledPref, true)) {
      return;
    }
    for (const tab of window.gBrowser.tabs) {
      if (tab.hasAttribute("soundplaying")) {
        this.#evaluate(tab.linkedBrowser);
        break;
      }
    }
  }

  #onEnabledChange() {
    if (this._enabled) {
      this.#ensureWidget();
      for (const tab of window.gBrowser.tabs) {
        if (tab.hasAttribute("soundplaying")) {
          this.#evaluate(tab.linkedBrowser);
          break;
        }
      }
    } else {
      this.#detach();
      this.#userClosedId = null;
      this.#widget?.setAttribute("hidden", "true");
    }
    this.#syncSidebarButton();
  }

  #syncSidebarButton() {
    const btn = document.getElementById("kiwi-player-toggle-button");
    btn?.toggleAttribute("hidden", !this._enabled);
  }

  toggle() {
    if (!Services.prefs.getBoolPref(kEnabledPref, true)) {
      Services.prefs.setBoolPref(kEnabledPref, true);
    }
    this.#ensureWidget();
    if (!this.#widget) {
      return;
    }
    if (!this.#widget.hidden) {
      this.#userClosedId = this.#current?.controller?.id || null;
      this.#widget.setAttribute("hidden", "true");
      return;
    }
    this.#userClosedId = null;
    if (this.#current?.controller) {
      this.#widget.removeAttribute("hidden");
      return;
    }
    let found = null;
    for (const tab of window.gBrowser.tabs) {
      const controller = tab.linkedBrowser.browsingContext?.mediaController;
      if (controller?.isActive) {
        found = { browser: tab.linkedBrowser, controller };
        if (controller.isPlaying) {
          break;
        }
      }
    }
    if (found) {
      this.#attach(found.browser, found.controller);
      this.#widget.removeAttribute("hidden");
      return;
    }
    this.#showEmpty();
  }

  #maybeShow(controller) {
    if (!controller?.isPlaying) {
      return;
    }
    if (this.#userClosedId === controller.id) {
      return;
    }
    this.#widget?.removeAttribute("hidden");
  }

  #showEmpty() {
    this.#ensureWidget();
    if (!this.#widget) {
      return;
    }
    this.#emptyMode = true;
    this.#setControlsEnabled(false);
    this._artistEl.hidden = true;
    this._titleEl.textContent = "";
    document.l10n.setAttributes(this._titleEl, "kiwi-player-empty");
    this.#widget.classList.remove("playing");
    this._playBtnEl.querySelector("path").setAttribute("d", ICONS.play);
    this._curEl.textContent = "0:00";
    this._durEl.textContent = "0:00";
    this._seekEl.value = 0;
    this._artEl.removeAttribute("src");
    this.#widget.removeAttribute("hidden");
  }

  #exitEmptyMode() {
    if (!this.#emptyMode) {
      return;
    }
    this.#emptyMode = false;
    this._titleEl.removeAttribute("data-l10n-id");
    this.#setControlsEnabled(true);
  }

  #setControlsEnabled(enabled) {
    for (const el of [
      this._prevBtnEl,
      this._playBtnEl,
      this._nextBtnEl,
      this._muteBtnEl,
      this._tabBtnEl,
      this._seekEl,
    ]) {
      el.disabled = !enabled;
    }
  }

  #maybeFlash() {
    if (!Services.prefs.getBoolPref(kFlashPref, true)) {
      return;
    }
    if (AppConstants.platform !== "win") {
      return;
    }
    try {
      if (Services.focus.activeWindow === window) {
        return;
      }
      window.getAttention();
    } catch (e) {}
  }

  #applyCorner() {
    if (!this.#widget) {
      return;
    }
    document.documentElement.setAttribute(
      "kiwi-player-corner",
      this._corner === "left" ? "left" : "right"
    );
  }

  #onTabGone(event) {
    const browser = event.target.linkedBrowser;
    if (this.#current?.browser === browser) {
      this.#detach();
    }
  }

  #evaluate(triggerBrowser) {
    if (!this._enabled) {
      return;
    }
    if (triggerBrowser) {
      this.#activate(triggerBrowser);
      return;
    }
    if (this.#current?.controller?.isPlaying) {
      return;
    }
    let found = null;
    for (const tab of window.gBrowser.tabs) {
      const controller = tab.linkedBrowser.browsingContext?.mediaController;
      if (tab.hasAttribute("soundplaying") && controller?.isActive) {
        found = tab.linkedBrowser;
        if (controller.isPlaying) {
          break;
        }
      }
    }
    if (found) {
      this.#activate(found);
    } else if (this.#current && !this.#current.controller?.isPlaying) {
      this.#detach();
      this.#widget?.setAttribute("hidden", "true");
    }
  }

  #activate(browser) {
    const controller = browser.browsingContext?.mediaController;
    if (!controller?.isActive) {
      return;
    }
    if (this.#current?.controller?.id === controller.id) {
      this.#maybeShow(controller);
      return;
    }
    if (this.#showTimeout) {
      clearTimeout(this.#showTimeout);
    }
    this.#showTimeout = setTimeout(() => {
      this.#showTimeout = null;
      if (!controller.isActive) {
        return;
      }
      this.#attach(browser, controller);
      this.#maybeShow(controller);
    }, 500);
  }

  #attach(browser, controller) {
    this.#detach();
    this.#current = { browser, controller };
    if (this.#userClosedId && this.#userClosedId !== controller.id) {
      this.#userClosedId = null;
    }
    this.#exitEmptyMode();
    this.#ensureWidget();
    this.#setControlsEnabled(true);
    this.#listeners = {
      positionstatechange: () => this.#updatePosition(),
      playbackstatechange: () => this.#updatePlayback(),
      metadatachange: () => this.#updateMetadata(),
      supportedkeyschange: () => this.#updateButtons(),
      deactivated: () => {
        this.#detach();
        this.#userClosedId = null;
        this.#widget?.setAttribute("hidden", "true");
      },
    };
    for (const [type, listener] of Object.entries(this.#listeners)) {
      controller.addEventListener(type, listener);
    }
    this.#updateMetadata();
    this.#updatePlayback();
    this.#updatePosition();
    this.#updateButtons();
    this.#updateMuteIcon();
  }

  #detach() {
    if (this.#showTimeout) {
      clearTimeout(this.#showTimeout);
      this.#showTimeout = null;
    }
    this.#lastMeta = undefined;
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
    if (this.#current && this.#listeners) {
      for (const [type, listener] of Object.entries(this.#listeners)) {
        this.#current.controller.removeEventListener(type, listener);
      }
    }
    this.#listeners = null;
    this.#current = null;
  }

  #ensureWidget() {
    if (this.#widget) {
      return;
    }
    window.MozXULElement.insertFTLIfNeeded("browser/kiwi-player.ftl");
    const host = document.getElementById("appcontent");
    if (!host) {
      return;
    }
    const mk = (tag, cls) => {
      const el = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        tag
      );
      if (cls) {
        el.className = cls;
      }
      return el;
    };
    const button = (name, icon) => {
      const btn = mk("button", `kiwi-player-btn kiwi-player-${name}`);
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="${ICONS[icon]}"/></svg>`;
      return btn;
    };

    const widget = mk("div", "kiwi-player");
    widget.setAttribute("hidden", "true");

    const art = mk("img", "kiwi-player-art");
    art.addEventListener("error", () => {
      art.classList.add("kiwi-player-art-fallback");
      art.removeAttribute("src");
    });

    const texts = mk("div", "kiwi-player-texts");
    const title = mk("div", "kiwi-player-title");
    const artist = mk("div", "kiwi-player-artist");
    texts.append(title, artist);

    const header = mk("div", "kiwi-player-header");
    const tabBtn = button("tab", "tab");
    const closeBtn = button("close", "close");
    header.append(art, texts, tabBtn, closeBtn);

    const seekRow = mk("div", "kiwi-player-seekrow");
    const cur = mk("span", "kiwi-player-time kiwi-player-cur");
    const seek = mk("input", "kiwi-player-seek");
    seek.type = "range";
    seek.min = 0;
    seek.max = 1000;
    seek.value = 0;
    const dur = mk("span", "kiwi-player-time kiwi-player-dur");
    seekRow.append(cur, seek, dur);

    const controls = mk("div", "kiwi-player-controls");
    const prevBtn = button("prev", "prev");
    const playBtn = button("playpause", "play");
    const nextBtn = button("next", "next");
    const muteBtn = button("mute", "unmuted");
    controls.append(prevBtn, playBtn, nextBtn, muteBtn);

    widget.append(header, seekRow, controls);
    host.appendChild(widget);
    this.#widget = widget;
    this.#applyCorner();

    const els = { art, title, artist, cur, seek, dur, prevBtn, playBtn, nextBtn, muteBtn, tabBtn, closeBtn };
    for (const [key, el] of Object.entries(els)) {
      this[`_${key}El`] = el;
    }

    for (const [name, el, label] of [
      ["prev", this._prevBtnEl, "kiwi-player-previous"],
      ["playpause", this._playBtnEl, "kiwi-player-playpause"],
      ["next", this._nextBtnEl, "kiwi-player-next"],
      ["mute", this._muteBtnEl, "kiwi-player-mute"],
      ["tab", this._tabBtnEl, "kiwi-player-focus-tab"],
      ["close", this._closeBtnEl, "kiwi-player-close"],
    ]) {
      document.l10n.setAttributes(el, label);
    }

    seek.addEventListener("input", () => {
      const { controller } = this.#current ?? {};
      if (!controller) {
        return;
      }
      const pos = (seek.value / 1000) * (this._duration || 0);
      cur.textContent = formatTime(pos);
    });
    seek.addEventListener("change", () => {
      const { controller } = this.#current ?? {};
      if (!controller || !this._duration) {
        return;
      }
      controller.seekTo((seek.value / 1000) * this._duration);
      controller.play();
    });

    playBtn.addEventListener("click", () => {
      const { controller } = this.#current ?? {};
      if (!controller) {
        return;
      }
      if (controller.isPlaying) {
        controller.pause("user");
      } else {
        controller.play();
      }
    });
    prevBtn.addEventListener("click", () => {
      const { controller } = this.#current ?? {};
      if (controller?.supportedKeys.includes("previoustrack")) {
        controller.prevTrack();
      }
    });
    nextBtn.addEventListener("click", () => {
      const { controller } = this.#current ?? {};
      if (controller?.supportedKeys.includes("nexttrack")) {
        controller.nextTrack();
      }
    });
    muteBtn.addEventListener("click", () => {
      const tab = this.#current && window.gBrowser.getTabForBrowser(this.#current.browser);
      if (tab) {
        tab.toggleMuteAudio();
        this.#updateMuteIcon();
      }
    });
    tabBtn.addEventListener("click", () => {
      const { browser, controller } = this.#current ?? {};
      const tab = browser && window.gBrowser.getTabForBrowser(browser);
      if (tab) {
        window.gBrowser.selectedTab = tab;
      }
      controller?.focus();
    });
    closeBtn.addEventListener("click", () => {
      this.#userClosedId = this.#current?.controller?.id || null;
      widget.setAttribute("hidden", "true");
    });
  }

  #updateMetadata() {
    const { browser, controller } = this.#current ?? {};
    if (!this.#widget || !controller) {
      return;
    }
    let title = "";
    let artist = "";
    let artwork = "";
    try {
      const meta = controller.getMetadata();
      title = meta?.title || "";
      artist = meta?.artist || "";
      artwork = meta?.artwork?.length ? meta.artwork[meta.artwork.length - 1].src : "";
    } catch (e) {}
    if (!title) {
      const tab = window.gBrowser.getTabForBrowser(browser);
      title = tab?.label || "Kiwi";
    }
    this._titleEl.textContent = title;
    this._artistEl.textContent = artist;
    this._artistEl.hidden = !artist;
    if (!artwork) {
      artwork = browser?.mIconURL || `page-icon:${browser?.currentURI?.spec}`;
    }
    this._artEl.classList.remove("kiwi-player-art-fallback");
    this._artEl.src = artwork;
    const meta = `${title}\n${artist}`;
    if (this.#lastMeta !== undefined && meta !== this.#lastMeta) {
      this.#maybeFlash();
    }
    this.#lastMeta = meta;
  }

  #updatePlayback() {
    const { controller } = this.#current ?? {};
    if (!this.#widget || !controller) {
      return;
    }
    this.#widget.classList.toggle("playing", controller.isPlaying);
    this._playBtnEl.querySelector("path").setAttribute(
      "d",
      controller.isPlaying ? ICONS.pause : ICONS.play
    );
    this.#updatePosition();
  }

  #updatePosition() {
    const { controller } = this.#current ?? {};
    if (!this.#widget || !controller) {
      return;
    }
    let position = 0;
    try {
      const state = controller.getPositionState();
      position = state.position;
      this._duration = state.duration;
      this._rate = state.playbackRate || 1;
    } catch (e) {
      this._duration = 0;
    }
    const live = (this._duration || 0) >= 900_000;
    this._seekEl.parentElement.toggleAttribute("kiwi-live", live);
    if (live || !this._duration) {
      this._curEl.textContent = formatTime(position);
      this._durEl.textContent = live ? "LIVE" : "0:00";
      if (this.#interval) {
        clearInterval(this.#interval);
        this.#interval = null;
      }
      return;
    }
    this._seekEl.disabled = !controller.supportedKeys.includes("seekto");
    this._curEl.textContent = formatTime(position);
    this._durEl.textContent = formatTime(this._duration);
    this._seekEl.value = (position / this._duration) * 1000;
    if (controller.isPlaying && !this.#interval) {
      this.#interval = setInterval(() => this.#tick(), 1000);
    } else if (!controller.isPlaying && this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
  }

  #tick() {
    const { controller } = this.#current ?? {};
    if (!controller?.isPlaying || !this._duration) {
      return;
    }
    const next = Math.min(
      (parseFloat(this._seekEl.value) / 1000) * this._duration + this._rate,
      this._duration
    );
    this._curEl.textContent = formatTime(next);
    this._seekEl.value = (next / this._duration) * 1000;
  }

  #updateButtons() {
    const { controller } = this.#current ?? {};
    if (!this.#widget || !controller) {
      return;
    }
    const keys = controller.supportedKeys;
    this._prevBtnEl.disabled = !keys.includes("previoustrack");
    this._nextBtnEl.disabled = !keys.includes("nexttrack");
  }

  #updateMuteIcon() {
    const { browser } = this.#current ?? {};
    if (!this.#widget) {
      return;
    }
    const muted = browser?.audioMuted;
    this.#widget.classList.toggle("muted", !!muted);
    this._muteBtnEl.querySelector("path").setAttribute(
      "d",
      muted ? ICONS.muted : ICONS.unmuted
    );
  }
})();
