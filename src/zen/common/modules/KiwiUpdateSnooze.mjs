// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the License, v. 2.0 was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  nsZenDOMOperatedFeature,
} from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const kDndPref = "kiwi.updates.dnd";
const kSnoozePref = "kiwi.updates.dnd-version";
const kOfferedPref = "kiwi.updates.offered-version";

window.gKiwiUpdateSnooze = new (class KiwiUpdateSnooze extends nsZenDOMOperatedFeature {
  init() {
    window.MozXULElement.insertFTLIfNeeded("browser/kiwi-updates.ftl");
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_dnd",
      kDndPref,
      false,
      () => this._onDndChange()
    );
    if (this._dnd) {
      this._removeUpdateNotifications();
    }
  }

  _onDndChange() {
    if (this._dnd) {
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

  snooze() {
    let version = Services.prefs.getStringPref(kOfferedPref, "");
    if (!version) {
      version = Services.appinfo.version;
    }
    Services.prefs.setStringPref(kSnoozePref, version);
    this._removeUpdateNotifications();
    try {
      window.PanelUI.notificationPanel.hidePopup();
    } catch (e) {}
  }
})();
