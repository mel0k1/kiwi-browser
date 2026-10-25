// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the License, v. 2.0 was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  nsZenDOMOperatedFeature,
} from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const kListPref = "kiwi.webpanels.list";
const kCurrentPref = "kiwi.webpanels.current";
const kOpenPref = "kiwi.webpanels.open";
const kTabsRightPref = "zen.tabs.vertical.right-side";

const ICONS = {
  reload:
    "M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-8 8s3.57 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  external:
    "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z",
  close:
    "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  menu:
    "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
};

const HTML_NS = "http://www.w3.org/1999/xhtml";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

function kiwiNormalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return "";
  }
  return "https://" + raw;
}

window.gKiwiWebPanels = new (class KiwiWebPanels extends nsZenDOMOperatedFeature {
  #list = [];
  #current = -1;
  #panel = null;
  #browser = null;
  #urlEl = null;
  #titleEl = null;
  #iconEl = null;
  #emptyEl = null;
  #popup = null;
  #progress = null;

  init() {
    window.MozXULElement.insertFTLIfNeeded("browser/kiwi-webpanels.ftl");
    try {
      this.#list = JSON.parse(
        Services.prefs.getStringPref(kListPref, "[]")
      );
    } catch (e) {
      this.#list = [];
    }
    if (!Array.isArray(this.#list)) {
      this.#list = [];
    }
    this.#current = Services.prefs.getIntPref(kCurrentPref, -1);
    this.#addContextMenuItem();
    if (
      Services.prefs.getBoolPref(kOpenPref, false) &&
      this.#list.length
    ) {
      this.open();
    }
  }

  get #isOpen() {
    return !!this.#panel && !this.#panel.hidden;
  }

  toggle() {
    if (this.#isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.#ensurePanel();
    if (!this.#panel) {
      return;
    }
    if (this.#current < 0 || this.#current >= this.#list.length) {
      this.#current = this.#list.length ? 0 : -1;
    }
    this.#dock();
    this.#panel.removeAttribute("hidden");
    if (this.#list.length) {
      this.#loadCurrent();
    } else {
      this.#showEmptyState();
      this.#urlEl.focus();
    }
    this.#save();
  }

  close() {
    this.#panel?.setAttribute("hidden", "true");
    this.#save();
  }

  openPanelFromURL(url, title) {
    const clean = kiwiNormalizeUrl(url);
    if (!clean) {
      return;
    }
    const existing = this.#list.findIndex(entry => entry.url === clean);
    if (existing >= 0) {
      this.#current = existing;
    } else {
      this.#list.push({ url: clean, title: title || "" });
      this.#current = this.#list.length - 1;
    }
    this.open();
  }

  #save() {
    try {
      Services.prefs.setStringPref(kListPref, JSON.stringify(this.#list));
      Services.prefs.setIntPref(kCurrentPref, this.#current);
      Services.prefs.setBoolPref(kOpenPref, this.#isOpen);
    } catch (e) {}
  }

  #dock() {
    const host = document.getElementById("zen-tabbox-wrapper");
    const tabbox = document.getElementById("tabbrowser-tabbox");
    if (!host || !tabbox || !this.#panel) {
      return;
    }
    const tabsRight = Services.prefs.getBoolPref(kTabsRightPref, false);
    if (tabsRight) {
      host.insertBefore(this.#panel, tabbox);
      document.documentElement.setAttribute("kiwi-webpanels-side", "left");
    } else {
      host.appendChild(this.#panel);
      document.documentElement.setAttribute("kiwi-webpanels-side", "right");
    }
  }

  #ensurePanel() {
    if (this.#panel) {
      return;
    }
    const host = document.getElementById("zen-tabbox-wrapper");
    if (!host) {
      return;
    }
    const mk = (tag, cls) => {
      const el = document.createElementNS(
        tag === "browser" ? XUL_NS : HTML_NS,
        tag
      );
      if (cls) {
        el.className = cls;
      }
      return el;
    };
    const button = (name, icon) => {
      const btn = mk("button", `kiwi-player-btn kiwi-webpanels-btn kiwi-webpanels-${name}`);
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="${ICONS[icon]}"/></svg>`;
      return btn;
    };

    const panel = document.createXULElement("vbox");
    panel.className = "kiwi-webpanels";
    panel.setAttribute("hidden", "true");

    const header = document.createXULElement("hbox");
    header.className = "kiwi-webpanels-header";
    header.setAttribute("align", "center");

    const icon = mk("img", "kiwi-webpanels-icon");
    const title = mk("span", "kiwi-webpanels-title");
    title.setAttribute("flex", "1");
    const menuBtn = button("menu", "menu");
    const openTabBtn = button("opentab", "external");
    const reloadBtn = button("reload", "reload");
    const closeBtn = button("closepanel", "close");
    header.append(icon, title, menuBtn, openTabBtn, reloadBtn, closeBtn);

    const urlRow = document.createXULElement("hbox");
    urlRow.className = "kiwi-webpanels-urlrow";
    urlRow.setAttribute("align", "center");
    const urlEl = mk("input", "kiwi-webpanels-url");
    urlEl.spellcheck = false;
    urlRow.append(urlEl);

    const browser = document.createXULElement("browser");
    browser.className = "kiwi-webpanels-browser";
    browser.setAttribute("type", "content");
    browser.setAttribute("remote", "true");
    browser.setAttribute("maychangeremoteness", "true");
    browser.setAttribute("disableglobalhistory", "true");
    browser.setAttribute("autocompletepopup", "PopupAutoComplete");
    browser.setAttribute("messagemanagergroup", "browsers");
    browser.setAttribute("flex", "1");

    const emptyEl = mk("div", "kiwi-webpanels-empty");
    const emptyTitle = mk("div", "kiwi-webpanels-empty-title");
    const emptyHint = mk("div", "kiwi-webpanels-empty-hint");
    document.l10n.setAttributes(emptyTitle, "kiwi-webpanels-empty-title");
    document.l10n.setAttributes(emptyHint, "kiwi-webpanels-empty-hint");
    emptyEl.append(emptyTitle, emptyHint);

    panel.append(header, urlRow, browser, emptyEl);
    host.appendChild(panel);

    this.#panel = panel;
    this.#browser = browser;
    this.#urlEl = urlEl;
    this.#titleEl = title;
    this.#iconEl = icon;
    this.#emptyEl = emptyEl;

    document.l10n.setAttributes(reloadBtn, "kiwi-webpanels-reload");
    document.l10n.setAttributes(openTabBtn, "kiwi-webpanels-open-tab");
    document.l10n.setAttributes(closeBtn, "kiwi-webpanels-close");
    document.l10n.setAttributes(menuBtn, "kiwi-webpanels-menu");
    document.l10n.setAttributes(urlEl, "kiwi-webpanels-url");

    urlEl.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        this.#commitUrl();
      }
    });
    urlEl.addEventListener("focus", () => urlEl.select());
    reloadBtn.addEventListener("click", () => {
      try {
        this.#browser.reload();
      } catch (e) {}
    });
    openTabBtn.addEventListener("click", () => {
      const entry = this.#list[this.#current];
      if (entry) {
        window.openWebLinkIn(entry.url, "tab", {});
      }
    });
    closeBtn.addEventListener("click", () => this.close());
    menuBtn.addEventListener("click", () => this.#showMenu());

    this.#addProgressListener();
  }

  #commitUrl() {
    const url = kiwiNormalizeUrl(this.#urlEl.value);
    if (!url) {
      return;
    }
    if (this.#current >= 0 && this.#current < this.#list.length) {
      this.#list[this.#current] = { url, title: "" };
    } else {
      this.#list.push({ url, title: "" });
      this.#current = this.#list.length - 1;
    }
    this.#showEmptyState(false);
    this.#loadCurrent();
    this.#save();
  }

  #showEmptyState(empty = true) {
    if (empty) {
      this.#browser.setAttribute("hidden", "true");
      this.#emptyEl.removeAttribute("hidden");
    } else {
      this.#emptyEl.setAttribute("hidden", "true");
      this.#browser.removeAttribute("hidden");
    }
  }

  #loadCurrent() {
    const entry = this.#list[this.#current];
    if (!entry) {
      this.#showEmptyState();
      return;
    }
    this.#showEmptyState(false);
    this.#urlEl.value = entry.url;
    this.#titleEl.textContent = entry.title || entry.url;
    this.#iconEl.src = `page-icon:${entry.url}`;
    try {
      this.#browser.fixupAndLoadURIString(entry.url, {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
    } catch (e) {
      try {
        this.#browser.src = entry.url;
      } catch (e2) {}
    }
  }

  #addProgressListener() {
    this.#progress = {
      onLocationChange: (webProgress, request, location) => {
        if (this.#browser?.getAttribute("hidden") === "true") {
          return;
        }
        const spec = location?.spec;
        if (!spec || !/^https?:/i.test(spec)) {
          return;
        }
        this.#urlEl.value = spec;
        this.#iconEl.src = `page-icon:${spec}`;
      },
      onStateChange: (webProgress, request, flags) => {
        const {
          STATE_STOP,
          STATE_IS_WINDOW,
        } = Ci.nsIWebProgressListener;
        if (
          this.#browser?.getAttribute("hidden") !== "true" &&
          flags & STATE_STOP &&
          flags & STATE_IS_WINDOW
        ) {
          const title = this.#browser.contentTitle;
          if (title) {
            this.#titleEl.textContent = title;
            const entry = this.#list[this.#current];
            if (entry) {
              entry.title = title;
              this.#save();
            }
          }
        }
      },
      QueryInterface: ChromeUtils.generateQI([
        "nsIWebProgressListener",
        "nsISupportsWeakReference",
      ]),
    };
    try {
      this.#browser.addProgressListener(this.#progress);
    } catch (e) {}
  }

  #showMenu() {
    if (!this.#popup) {
      this.#popup = document.createXULElement("menupopup");
      this.#popup.id = "kiwi-webpanels-popup";
      document.getElementById("mainPopupSet")?.appendChild(this.#popup);
    }
    const popup = this.#popup;
    popup.replaceChildren();
    const addItem = (l10nId, handler) => {
      const item = document.createXULElement("menuitem");
      document.l10n.setAttributes(item, l10nId);
      item.addEventListener("command", handler);
      popup.appendChild(item);
      return item;
    };
    this.#list.forEach((entry, index) => {
      const item = document.createXULElement("menuitem");
      item.setAttribute("label", entry.title || entry.url);
      item.setAttribute("type", "checkbox");
      item.setAttribute("checked", index === this.#current ? "true" : "false");
      item.addEventListener("command", () => {
        this.#current = index;
        this.#loadCurrent();
        this.#save();
      });
      popup.appendChild(item);
    });
    if (this.#list.length) {
      popup.appendChild(document.createXULElement("menuseparator"));
    }
    addItem("kiwi-webpanels-add-current", () => this.#addCurrentPage());
    if (this.#current >= 0 && this.#current < this.#list.length) {
      addItem("kiwi-webpanels-remove", () => this.#removeCurrent());
    }
    popup.openPopup(
      this.#panel.querySelector(".kiwi-webpanels-menu") || this.#panel,
      "after_start",
      0,
      0
    );
  }

  #addCurrentPage() {
    const tab = window.gBrowser?.selectedTab;
    const uri = tab?.linkedBrowser?.currentURI;
    if (!uri || !/^https?:$/i.test(uri.scheme)) {
      return;
    }
    this.openPanelFromURL(
      uri.spec,
      tab.linkedBrowser.contentTitle || tab.label
    );
  }

  #removeCurrent() {
    if (this.#current < 0 || this.#current >= this.#list.length) {
      return;
    }
    this.#list.splice(this.#current, 1);
    if (!this.#list.length) {
      this.#current = -1;
      this.#showEmptyState();
      this.#urlEl.value = "";
      this.#titleEl.textContent = "";
      this.#iconEl.removeAttribute("src");
      this.#save();
      return;
    }
    this.#current = Math.min(this.#current, this.#list.length - 1);
    this.#loadCurrent();
    this.#save();
  }

  #addContextMenuItem() {
    const popup = document.getElementById("contentAreaContextMenu");
    if (!popup || document.getElementById("kiwi-context-open-panel")) {
      return;
    }
    const item = document.createXULElement("menuitem");
    item.id = "kiwi-context-open-panel";
    document.l10n.setAttributes(item, "kiwi-context-open-panel");
    item.addEventListener("command", () => {
      const ctx = window.gContextMenu;
      if (!ctx) {
        return;
      }
      const url = ctx.onLink && ctx.linkURI ? ctx.linkURI.spec : ctx.browser?.currentURI?.spec;
      const title = ctx.linkTextStr || ctx.browser?.contentTitle || "";
      this.openPanelFromURL(url, title);
    });
    const onShowing = () => {
      const ctx = window.gContextMenu;
      let visible = false;
      if (ctx) {
        const url = ctx.onLink && ctx.linkURI ? ctx.linkURI.spec : ctx.browser?.currentURI?.spec;
        visible = !!url && /^https?:/i.test(url) && !ctx.onTextInput;
      }
      item.toggleAttribute("hidden", !visible);
    };
    popup.addEventListener("popupshowing", onShowing);
    const anchor =
      document.getElementById("context-sep-open") ||
      document.getElementById("context-bookmarkpage") ||
      document.getElementById("context-savepage");
    if (anchor) {
      popup.insertBefore(item, anchor);
    } else {
      popup.appendChild(item);
    }
  }
})();
