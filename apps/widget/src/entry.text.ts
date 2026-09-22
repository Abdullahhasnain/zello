// Phase 1 entry point: text-conversation widget only. No voice/ASR/TTS
// imports are permitted in this file's dependency graph — see
// vite.config.ts and the SRS's IP-protection requirement. A Phase-1
// tenant's shipped JS must contain nothing to reverse-engineer about
// voice or autonomous checkout.

import { loadWidgetConfig } from "./config";
import { ZelloWidgetElement } from "./ui/widget-element";

customElements.define("zello-widget", ZelloWidgetElement);

function mount(): void {
  if (document.querySelector("zello-widget")) {
    return; // Already mounted — guards against the script tag loading twice.
  }

  const config = loadWidgetConfig();
  // Constructed directly with `new` (not document.createElement, which
  // would call the zero-argument path) so the config reaches the element
  // before connectedCallback runs — see ui/widget-element.ts.
  const widget = new ZelloWidgetElement(config);
  document.body.appendChild(widget);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
