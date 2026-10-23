// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const kPref = "kiwi.tabs.double-click-newtab";

window.gKiwiNewTabDoubleClick = {
  _lastOpenTime: 0,

  init() {
    XPCOMUtils.defineLazyPreferenceGetter(this, "_enabled", kPref, true);
    const tabs = document.getElementById("tabbrowser-tabs");
    if (!tabs) {
      return;
    }
    tabs.addEventListener("dblclick", event => {
      if (!this._enabled || event.button !== 0) {
        return;
      }
      if (event.target.closest("tab, toolbarbutton, panel, menupopup")) {
        return;
      }
      if (Date.now() - this._lastOpenTime < 400) {
        return;
      }
      this._lastOpenTime = Date.now();
      window.BrowserOpenTab();
    });
  },
};
