/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL, v. 2.0 was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class KiwiVolumeChild extends JSWindowActorChild {
  #volume = null;
  #listening = false;

  receiveMessage({ name, data }) {
    if (name !== "kiwi:volume") {
      return;
    }
    const value = Math.min(1, Math.max(0, Number(data?.value)));
    if (Number.isNaN(value)) {
      return;
    }
    this.#volume = value;
    if (!this.#listening) {
      this.#listening = true;
      this.contentWindow?.addEventListener("play", this, true);
    }
    this.#apply();
  }

  handleEvent() {
    if (this.#volume !== null) {
      this.#apply();
    }
  }

  #apply() {
    const doc = this.contentDocument;
    if (!doc || this.#volume === null) {
      return;
    }
    for (const el of doc.querySelectorAll("video, audio")) {
      try {
        el.volume = this.#volume;
      } catch (e) {}
    }
  }
}
