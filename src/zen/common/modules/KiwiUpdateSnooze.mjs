// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the License, v. 2.0 was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  nsZenDOMOperatedFeature,
} from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const kDndUntilPref = "kiwi.dnd.until";

function kiwiDndActive() {
  try {
    const until = Services.prefs.getIntPref(kDndUntilPref, 0);
    return until === -1 || until * 1000 > Date.now();
  } catch (e) {
    return false;
  }
}

window.gKiwiUpdateSnooze = new (class KiwiUpdateSnooze extends nsZenDOMOperatedFeature {
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
  }

  _onDndChange() {
    if (kiwiDndActive()) {
      this._removeUpdateNotifications();
    }
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
