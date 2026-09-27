import type { WidgetConfig } from "../config";

/** Keep one conversation instance while Next.js switches storefront routes. */
export function mountWidget(widget: HTMLElement, config: WidgetConfig): void {
  const target = config.mountTarget ? document.getElementById(config.mountTarget) : null;
  if (!target) {
    document.body.appendChild(widget);
    return;
  }
  const sync = () => {
    widget.toggleAttribute("data-inline", target.dataset.agentInline === "true");
    widget.dispatchEvent(new Event("zello:presentation"));
  };
  const attach = () => {
    sync();
    target.appendChild(widget);
  };
  // Let React hydrate its empty mount before adding unmanaged Shadow DOM.
  if (target.dataset.agentReady === "true") attach();
  else window.addEventListener("zello:stage-ready", attach, { once: true });
  const observer = new MutationObserver(sync);
  observer.observe(target, { attributes: true, attributeFilter: ["data-agent-inline"] });
  window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
}
