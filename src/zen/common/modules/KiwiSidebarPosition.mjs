// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const kPositionPref = 'kiwi.sidebar.position'
const kVerticalPref = 'zen.tabs.vertical'
const kRightSidePref = 'zen.tabs.vertical.right-side'

window.gKiwiSidebarPosition = {
  get position() {
    return Services.prefs.getStringPref(kPositionPref, 'left')
  },

  init() {
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      '_position',
      kPositionPref,
      'left',
      () => this._apply()
    )
    this._apply()
  },

  _apply() {
    const position = this.position
    document.documentElement.setAttribute('kiwi-sidebar-position', position)

    const vertical = position === 'left' || position === 'right'
    if (Services.prefs.getBoolPref(kVerticalPref, true) !== vertical) {
      Services.prefs.setBoolPref(kVerticalPref, vertical)
    }
    if (vertical) {
      const right = position === 'right'
      if (Services.prefs.getBoolPref(kRightSidePref, false) !== right) {
        Services.prefs.setBoolPref(kRightSidePref, right)
      }
    }
  },
}
