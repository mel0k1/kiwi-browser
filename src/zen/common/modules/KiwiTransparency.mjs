const kDisablePref = 'kiwi.ui.disable-transparency'
const kMicaPref = 'widget.windows.mica'
const kLinuxTransparencyPref = 'zen.widget.linux.transparency'

window.gKiwiTransparency = {
  init() {
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      '_disabled',
      kDisablePref,
      false,
      () => this._apply()
    )
    this._apply()
  },

  _apply() {
    const disabled = Services.prefs.getBoolPref(kDisablePref, false)
    document.documentElement.toggleAttribute('kiwi-opaque', disabled)
    if (disabled) {
      document.documentElement.setAttribute('zen-no-acrylic', 'true')
      this._ownsAcrylicFlag = true
    } else if (this._ownsAcrylicFlag) {
      this._ownsAcrylicFlag = false
      let acrylicSupported = !Services.appinfo.inSafeMode
      try {
        acrylicSupported &&= !window.windowUtils.layerManagerType.includes(
          'Software'
        )
      } catch (e) {}
      if (acrylicSupported) {
        document.documentElement.removeAttribute('zen-no-acrylic')
      }
    }
    if (Services.appinfo.OS === 'WINNT') {
      Services.prefs.setBoolPref(kMicaPref, !disabled)
    } else if (Services.appinfo.OS === 'Linux') {
      if (disabled) {
        Services.prefs.setBoolPref(kLinuxTransparencyPref, false)
      } else {
        Services.prefs.clearUserPref(kLinuxTransparencyPref)
      }
    }
  },
}
