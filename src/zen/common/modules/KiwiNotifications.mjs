// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the License, v. 2.0 was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  nsZenDOMOperatedFeature,
} from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const { AppConstants } = ChromeUtils.importESModule(
  "resource://gre/modules/AppConstants.sys.mjs"
);

const kFlashPref = "kiwi.notifications.flash";
const kDndUntilPref = "kiwi.dnd.until";

window.gKiwiNotifications = new (class KiwiNotifications extends
  nsZenDOMOperatedFeature {
  init() {
    if (AppConstants.platform !== "win") {
      return;
    }
    Services.obs.addObserver(this, "web-notification-shown");
    window.addEventListener(
      "unload",
      () => {
        Services.obs.removeObserver(this, "web-notification-shown");
      },
      { once: true }
    );
  }

  observe(subject, topic) {
    if (topic !== "web-notification-shown") {
      return;
    }
    try {
      if (!Services.prefs.getBoolPref(kFlashPref, true)) {
        return;
      }
      const until = Services.prefs.getIntPref(kDndUntilPref, 0);
      if (until === -1 || until * 1000 > Date.now()) {
        return;
      }
      const origin = subject?.QueryInterface(Ci.nsIAlertNotification)?.origin;
      if (!origin) {
        return;
      }
      for (const browser of window.gBrowser.browsers) {
        if (browser.contentPrincipal?.origin === origin) {
          if (Services.focus.activeWindow === window) {
            return;
          }
          window.getAttention();
          return;
        }
      }
    } catch (e) {}
  }
})();
