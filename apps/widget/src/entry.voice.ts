// Phase 2+ entry point: adds voice input/output on top of the text-
// conversation core. ui/widget-element.ts (the Phase 1 base class) is
// unchanged in behavior — ZelloVoiceWidgetElement only subclasses it (see
// ui/voice-widget-element.ts) and layers a mic button + speech output onto
// the same session/conversation/AI-assistant flow. Only served to tenants
// entitled to voice (StorePhase.PHASE_2_VOICE+, or the voice_enabled
// feature flag) — Widget Studio's embed snippet picks this bundle vs.
// zello-widget.text.js based on that entitlement.

import { loadWidgetConfig } from "./config";
import { ZelloVoiceWidgetElement } from "./ui/voice-widget-element";

customElements.define("zello-widget", ZelloVoiceWidgetElement);

function mount(): void {
  if (document.querySelector("zello-widget")) {
    return; // Already mounted — guards against the script tag loading twice.
  }

  const config = loadWidgetConfig();
  const widget = new ZelloVoiceWidgetElement(config);
  document.body.appendChild(widget);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
