// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the License, v. 2.0 was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  nsZenDOMOperatedFeature,
} from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const kDndUntilPref = "kiwi.dnd.until";
const kDndButtonId = "kiwi-dnd-button";
const kDndPopupId = "kiwi-dnd-popup";

function kiwiDndActive() {
  try {
    const until = Services.prefs.getIntPref(kDndUntilPref, 0);
    return until === -1 || until * 1000 > Date.now();
  } catch (e) {
    return false;
  }
}

function kiwiDndUntilValue() {
  try {
    return Services.prefs.getIntPref(kDndUntilPref, 0);
  } catch (e) {
    return 0;
  }
}

function kiwiFormatUntil(until) {
  try {
    return new Services.intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(until * 1000));
  } catch (e) {
    return new Date(until * 1000).toLocaleString();
  }
}

window.gKiwiUpdateSnooze = new (class KiwiUpdateSnooze extends nsZenDOMOperatedFeature {
  #popup = null;
  #expireTimeout = null;

  init() {
    window.MozXULElement.insertFTLIfNeeded("browser/kiwi-updates.ftl");
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_dndUntil",
      kDndUntilPref,
      0,
      () => this._onDndChange()
    );
    if (kiwiDndActive()) {
      this._removeUpdateNotifications();
    }
    this._updateIndicator();
  }

  _onDndChange() {
    if (kiwiDndActive()) {
      this._removeUpdateNotifications();
    }
    this._updateIndicator();
  }

  _updateIndicator() {
    const btn = document.getElementById(kDndButtonId);
    if (!btn) {
      return;
    }
    if (this.#expireTimeout) {
      clearTimeout(this.#expireTimeout);
      this.#expireTimeout = null;
    }
    const until = kiwiDndUntilValue();
    const active = until === -1 || until * 1000 > Date.now();
    btn.toggleAttribute("hidden", !active);
    if (!active) {
      return;
    }
    if (until === -1) {
      document.l10n.setAttributes(btn, "kiwi-dnd-indicator-forever");
      return;
    }
    document.l10n.setAttributes(btn, "kiwi-dnd-indicator", {
      time: kiwiFormatUntil(until),
    });
    this.#expireTimeout = setTimeout(
      () => this._updateIndicator(),
      until * 1000 - Date.now() + 1000
    );
  }

  toggleMenu() {
    const btn = document.getElementById(kDndButtonId);
    if (!btn) {
      return;
    }
    if (!this.#popup) {
      this.#popup = document.createXULElement("menupopup");
      this.#popup.id = kDndPopupId;
      document.getElementById("mainPopupSet")?.appendChild(this.#popup);
    }
    this.#buildPopup();
    this.#popup.openPopup(btn, "after_start", 0, 0);
  }

  #buildPopup() {
    const popup = this.#popup;
    popup.replaceChildren();
    const addItem = (l10nId, handler) => {
      const item = document.createXULElement("menuitem");
      document.l10n.setAttributes(item, l10nId);
      item.addEventListener("command", handler);
      popup.appendChild(item);
    };
    if (kiwiDndActive()) {
      addItem("kiwi-dnd-turn-off", () => this.disable());
      popup.appendChild(document.createXULElement("menuseparator"));
    }
    addItem("kiwi-update-dnd-1d", () => this.snooze(1));
    addItem("kiwi-update-dnd-3d", () => this.snooze(3));
    addItem("kiwi-update-dnd-7d", () => this.snooze(7));
    addItem("kiwi-update-dnd-forever", () => this.snooze(-1));
  }

  disable() {
    Services.prefs.setIntPref(kDndUntilPref, 0);
  }

  _removeUpdateNotifications() {
    try {
      const { AppMenuNotifications } = ChromeUtils.importESModule(
        "resource://gre/modules/AppMenuNotifications.sys.mjs"
      );
      AppMenuNotifications.removeNotification(/^update-/);
    } catch (e) {}
  }

  snooze(days) {
    const d = Number.isFinite(days) ? days : 7;
    const until = d < 0 ? -1 : Math.floor(Date.now() / 1000) + d * 86400;
    Services.prefs.setIntPref(kDndUntilPref, until);
    this._removeUpdateNotifications();
    try {
      window.PanelUI.notificationPanel.hidePopup();
    } catch (e) {}
  }
})();
