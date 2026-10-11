/**
 * Returns the <style> contents for the widget's Shadow DOM. Shadow DOM
 * means these rules can never leak onto the partner site (and the
 * partner site's own CSS can never leak in) — the whole reason the
 * widget is a custom element with a shadow root rather than a plain
 * <div> injected into the page (see docs/architecture/api-architecture.md).
 *
 * Theming is one CSS custom property, set from the tenant's branding
 * (see ui/widget-element.ts) — every color in this stylesheet derives
 * from `--zello-primary` rather than hard-coding a brand color.
 */
export function buildStyles(primaryColor: string): string {
  return `
    :host {
      --zello-primary: ${primaryColor};
      --zello-primary-ink: #ffffff;
      --zello-surface: #ffffff;
      --zello-surface-alt: #f1f0ee;
      --zello-ink: #1e2130;
      --zello-ink-soft: #6b6f7d;
      --zello-radius: 16px;
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    .zello-launcher {
      position: fixed;
      bottom: 20px;
      z-index: 2147483000;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--zello-primary);
      color: var(--zello-primary-ink);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
      transition: transform 0.15s ease;
    }
    .zello-launcher:hover {
      transform: scale(1.06);
    }
    .zello-launcher.zello-position-bottom-right { right: 20px; }
    .zello-launcher.zello-position-bottom-left { left: 20px; }
    .zello-launcher svg { width: 28px; height: 28px; }

    .zello-panel {
      position: fixed;
      bottom: 92px;
      z-index: 2147483000;
      width: 368px;
      max-width: calc(100vw - 32px);
      height: 520px;
      max-height: calc(100vh - 140px);
      background: var(--zello-surface);
      border-radius: var(--zello-radius);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .zello-panel.zello-position-bottom-right { right: 20px; }
    .zello-panel.zello-position-bottom-left { left: 20px; }
    .zello-panel.zello-open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    @media (max-width: 480px) {
      .zello-panel {
        top: 0;
        right: 0;
        left: 0;
        bottom: 0;
        width: 100%;
        max-width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
      }
    }

    .zello-header {
      background: var(--zello-primary);
      color: var(--zello-primary-ink);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex: 0 0 auto;
    }
    .zello-header-title {
      font-size: 15px;
      font-weight: 600;
    }
    .zello-close-button {
      background: transparent;
      border: none;
      color: var(--zello-primary-ink);
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      padding: 4px;
      opacity: 0.85;
    }
    .zello-close-button:hover { opacity: 1; }

    .zello-messages {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: var(--zello-surface);
    }

    .zello-bubble {
      max-width: 82%;
      padding: 10px 13px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .zello-bubble-customer {
      align-self: flex-end;
      background: var(--zello-primary);
      color: var(--zello-primary-ink);
      border-bottom-right-radius: 4px;
    }
    .zello-bubble-assistant {
      align-self: flex-start;
      background: var(--zello-surface-alt);
      color: var(--zello-ink);
      border-bottom-left-radius: 4px;
    }
    .zello-bubble-pending {
      opacity: 0.6;
    }

    .zello-typing {
      align-self: flex-start;
      display: flex;
      gap: 4px;
      padding: 12px 14px;
      background: var(--zello-surface-alt);
      border-radius: 14px;
      border-bottom-left-radius: 4px;
    }
    .zello-typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--zello-ink-soft);
      animation: zello-typing-bounce 1.2s infinite ease-in-out;
    }
    .zello-typing span:nth-child(2) { animation-delay: 0.15s; }
    .zello-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes zello-typing-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    .zello-input-row {
      flex: 0 0 auto;
      display: flex;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--zello-surface-alt);
      background: var(--zello-surface);
    }
    .zello-input {
      flex: 1 1 auto;
      border: 1px solid #d8d7d3;
      border-radius: 20px;
      padding: 10px 14px;
      font-size: 14px;
      color: var(--zello-ink);
      outline: none;
      font-family: inherit;
    }
    .zello-input:focus {
      border-color: var(--zello-primary);
    }
    .zello-send-button {
      flex: 0 0 auto;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: var(--zello-primary);
      color: var(--zello-primary-ink);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .zello-send-button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .zello-send-button svg { width: 18px; height: 18px; }

    .zello-hidden {
      display: none !important;
    }

    .zello-product-row {
      align-self: flex-start;
      max-width: 100%;
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .zello-product-card {
      flex: 0 0 auto;
      width: 108px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 6px;
      background: var(--zello-surface);
      border: 1px solid var(--zello-surface-alt);
      border-radius: 10px;
      position: relative;
    }
    .zello-product-image {
      width: 100%;
      height: 72px;
      border-radius: 6px;
      overflow: hidden;
      background: var(--zello-surface-alt);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .zello-product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .zello-product-image-placeholder::after {
      content: "";
      display: block;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: var(--zello-ink-soft);
      opacity: 0.25;
    }
    .zello-product-title {
      font-size: 11px;
      line-height: 1.3;
      color: var(--zello-ink);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .zello-product-price {
      font-size: 12px;
      font-weight: 600;
      color: var(--zello-primary);
    }
    .zello-product-badge {
      position: absolute;
      top: 4px;
      left: 4px;
      background: rgba(0, 0, 0, 0.65);
      color: #ffffff;
      font-size: 9px;
      padding: 2px 5px;
      border-radius: 4px;
    }
    .zello-action {
      border: 1px solid #dedbd4; border-radius: 10px; padding: 9px 12px;
      background: #faf8f5; color: var(--zello-ink); cursor: pointer;
      font: inherit; font-size: 12px; font-weight: 600;
    }
    .zello-action:hover { border-color: var(--zello-primary); }
    .zello-action:disabled { opacity: .45; cursor: not-allowed; }
    .zello-suggestions { display: flex; gap: 8px; flex-wrap: wrap; }
    .zello-cart-confirmation {
      align-self: flex-start; display: flex; gap: 10px; align-items: center;
      flex-wrap: wrap; margin: 2px 0 8px; padding: 10px 12px;
      border: 1px solid var(--zello-primary); border-radius: 12px;
      background: var(--zello-surface); color: var(--zello-ink); font-size: 13px;
    }
    .zello-shopping-links { display: flex; gap: 12px; padding: 10px 16px; border-top: 1px solid #eee; }
    .zello-shopping-links a { color: var(--zello-primary); font-size: 13px; font-weight: 600; }
    :host([data-inline]) { display: block; width: 100%; }
    :host([data-inline]) .zello-launcher,
    :host([data-inline]) .zello-close-button { display: none; }
    :host([data-inline]) .zello-panel {
      position: relative; inset: auto; z-index: auto; width: 100%; max-width: 100%;
      height: min(650px, 76dvh); min-height: 460px; max-height: none;
      opacity: 1; pointer-events: auto; transform: none; border-radius: 24px;
      border: 1px solid #e5dfd6; box-shadow: 0 12px 48px #3025180c;
    }
    :host([data-inline]) .zello-header { padding: 18px 22px; background: #26392f; }
    :host([data-inline]) .zello-header-title { flex: 1; font-size: 17px; }
    :host([data-inline]) .zello-messages { padding: 22px; min-height: 0; background: #fdfcf9; }
    :host([data-inline]) .zello-bubble { font-size: 15px; line-height: 1.6; max-width: 88%; }
    :host([data-inline]) .zello-bubble-assistant { background: #f0eee7; }
    :host([data-inline]) .zello-product-row { width: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); overflow: visible; gap: 12px; }
    :host([data-inline]) .zello-product-card { width: auto; padding: 12px; gap: 10px; border-color: #e4e0d8; border-radius: 16px; }
    :host([data-inline]) .zello-product-title { display: block; font-size: 14px; line-height: 1.4; }
    :host([data-inline]) .zello-product-price { font-size: 17px; }
    :host([data-inline]) .zello-product-image { height: 80px; }
    :host([data-inline]) .zello-input-row { align-items: center; padding: 16px; }
    :host([data-inline]) .zello-input { min-width: 0; padding: 14px; border-radius: 14px; }
    :host([data-inline]) .zello-shopping-links { justify-content: flex-end; padding: 12px 20px; }
    @media (max-width: 480px) {
      :host([data-inline]) .zello-panel { min-height: 420px; height: 70dvh; border-radius: 18px; }
      :host([data-inline]) .zello-messages { padding: 12px; }
      :host([data-inline]) .zello-product-row { grid-template-columns: 1fr; }
      :host([data-inline]) .zello-input-row { gap: 5px; padding: 10px; }
    }

    /* Premium sales-agent presentation. These rules deliberately come last
       so all existing embed modes retain their behaviour and only their
       visual surface changes. */
    :host {
      --zello-navy: #080e1b;
      --zello-panel-navy: #0d1728;
      --zello-panel-soft: #121f34;
      --zello-line: rgba(177, 194, 230, .14);
      --zello-accent: #6d54ff;
      --zello-accent-blue: #2178ff;
      --zello-glow: rgba(109, 84, 255, .38);
    }
    .zello-launcher {
      width: auto; min-width: 172px; height: 54px; padding: 0 19px 0 14px;
      gap: 10px; border-radius: 999px; color: #fff;
      background: linear-gradient(120deg, #171129, #0f1b35 58%, #122951);
      border: 1px solid rgba(151, 120, 255, .8);
      box-shadow: 0 10px 30px rgba(10, 9, 35, .42), 0 0 0 3px rgba(109,84,255,.11), 0 0 24px var(--zello-glow);
      font: 700 14px/1 inherit; letter-spacing: .01em;
    }
    .zello-launcher::before { content: ""; position: absolute; inset: 2px; border-radius: inherit; background: linear-gradient(110deg, rgba(255,255,255,.1), transparent 42%); pointer-events: none; }
    .zello-launcher:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 14px 34px rgba(10,9,35,.52), 0 0 30px var(--zello-glow); }
    .zello-launcher svg { width: 25px; height: 25px; color: #c6bbff; filter: drop-shadow(0 0 8px #7965ff); }
    .zello-launcher span { position: relative; }

    .zello-panel {
      width: min(456px, calc(100vw - 32px)); height: min(730px, calc(100vh - 116px));
      max-height: calc(100vh - 116px); bottom: 86px; border-radius: 25px;
      color: #f6f8ff; background: var(--zello-navy);
      border: 1px solid rgba(116, 96, 255, .75);
      box-shadow: 0 24px 70px rgba(3, 7, 18, .55), 0 0 34px rgba(90,70,255,.19);
      transform: translateY(18px) scale(.985); transition: opacity .22s ease, transform .22s cubic-bezier(.2,.8,.2,1);
    }
    .zello-panel.zello-open { transform: translateY(0) scale(1); }
    .zello-header {
      min-height: 82px; padding: 15px 17px; color: #f8f9ff;
      background: radial-gradient(circle at 5% 5%, rgba(113,81,255,.28), transparent 36%), linear-gradient(120deg, #0b1220, #101d31);
      border-bottom: 1px solid var(--zello-line);
    }
    .zello-header-title { display: flex; gap: 10px; align-items: center; min-width: 0; flex: 1; color: #fff; }
    .zello-header-title strong { display: block; font-size: 19px; letter-spacing: -.025em; }
    .zello-header-title small { display: block; margin-top: 3px; color: #aab6d0; font-size: 11px; font-weight: 500; white-space: nowrap; }
    .zello-header-title small i { display: inline-block; width: 6px; height: 6px; margin: 0 4px 1px 0; border-radius: 50%; background: #43e08c; box-shadow: 0 0 8px #43e08c; }
    .zello-orb { display: grid; place-items: center; width: 39px; height: 39px; border-radius: 50%; color: #dfdaff; font-size: 21px; background: radial-gradient(circle at 35% 30%, #a38eff, #5c36ed 52%, #21124b); box-shadow: 0 0 0 2px #816cff, 0 0 18px #6d54ff; }
    .zello-close-button, .zello-header-icon-button, .zello-expand-button { width: 35px; height: 35px; border-radius: 11px; display: inline-grid; place-items: center; color: #dce5ff; background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.05); }
    .zello-close-button:hover, .zello-header-icon-button:hover, .zello-expand-button:hover { background: rgba(255,255,255,.12); }
    .zello-panel.zello-expanded { width: min(620px, calc(100vw - 32px)); height: min(820px, calc(100vh - 32px)); }

    .zello-messages { padding: 18px; gap: 12px; background: linear-gradient(180deg, #0c1626, #0a121f 56%, #0b1422); scrollbar-color: #384968 transparent; }
    .zello-bubble { max-width: 84%; padding: 11px 13px; font-size: 13px; line-height: 1.48; border-radius: 16px; box-shadow: 0 5px 12px rgba(0,0,0,.11); }
    .zello-bubble-assistant { color: #f3f6ff; background: #172335; border: 1px solid rgba(201,216,255,.06); border-bottom-left-radius: 5px; }
    .zello-bubble-customer { background: linear-gradient(125deg, #3157e9, #1779ff); border-bottom-right-radius: 5px; }
    .zello-typing { background: #172335; border: 1px solid rgba(201,216,255,.06); }
    .zello-typing span { background: #a8b7d5; }

    .zello-product-row { width: 100%; gap: 10px; padding: 2px 1px 10px; scroll-snap-type: x mandatory; scrollbar-width: thin; scrollbar-color: #495a80 transparent; }
    .zello-product-card { width: 184px; min-height: 275px; padding: 9px; gap: 7px; border-radius: 16px; color: #111827; background: #fff; border: 1px solid rgba(255,255,255,.9); box-shadow: 0 8px 20px rgba(0,0,0,.23); scroll-snap-align: start; animation: zello-card-in .28s ease both; }
    .zello-product-card:nth-child(2) { animation-delay: .05s; } .zello-product-card:nth-child(3) { animation-delay: .1s; }
    @keyframes zello-card-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .zello-product-card-pending { outline: 2px solid #7061ff; box-shadow: 0 0 0 4px rgba(112,97,255,.22), 0 10px 24px rgba(0,0,0,.28); }
    .zello-product-card-added { outline: 2px solid #1dbb75; }
    .zello-product-image { height: 126px; border-radius: 11px; background: #f3f5f8; }
    .zello-product-image-placeholder::after { background: #d5dce9; }
    .zello-product-title { min-height: 32px; font-size: 12px; font-weight: 700; color: #131a29; }
    .zello-product-price { font-size: 15px; font-weight: 800; color: #101729; }
    .zello-product-stock { font-size: 10px; font-weight: 650; color: #248f5f; }
    .zello-product-recommendation { position: absolute; top: 14px; left: 14px; z-index: 1; padding: 4px 7px; border-radius: 7px; color: #fff; background: linear-gradient(100deg, #7543f4, #4267ff); box-shadow: 0 4px 10px rgba(75,62,231,.3); font-size: 9px; font-weight: 800; }
    .zello-product-badge { background: rgba(18,25,39,.78); }
    .zello-product-add { width: 100%; min-height: 35px; margin-top: auto; padding: 8px; border: 0; border-radius: 9px; color: #fff; background: #101827; cursor: pointer; font: 700 11px/1 inherit; transition: transform .15s ease, background .15s ease; }
    .zello-product-add:hover:not(:disabled) { background: #253858; transform: translateY(-1px); } .zello-product-add:disabled { opacity: .72; cursor: default; } .zello-product-card-added .zello-product-add { background: #168c57; }

    .zello-suggestions { gap: 7px; padding: 0 0 2px; }
    .zello-action { color: #dce7ff; background: rgba(21,34,55,.78); border: 1px solid #334765; border-radius: 999px; padding: 8px 11px; font-size: 11px; transition: border-color .15s ease, transform .15s ease, background .15s ease; }
    .zello-action:hover { color: #fff; border-color: #7c6cff; background: rgba(79,67,177,.3); transform: translateY(-1px); }
    .zello-quick-chips { margin: 3px 0 6px; }
    .zello-cart-confirmation { color: #d8ffe8; background: rgba(21,118,75,.18); border-color: rgba(56,217,135,.45); border-radius: 14px; }
    .zello-cart-confirmation .zello-action { background: #168c57; border-color: #168c57; color: #fff; }
    .zello-cart-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
    .zello-cart-actions .zello-action { flex: 1 1 auto; justify-content: center; }
    .zello-shopping-links { padding: 11px 17px; justify-content: flex-end; border-top-color: var(--zello-line); background: #0b1422; }
    .zello-shopping-links a { color: #a9c6ff; font-size: 11px; }
    .zello-input-row { gap: 7px; padding: 12px 14px 14px; border-top-color: var(--zello-line); background: #0b1422; }
    .zello-input { min-width: 0; color: #f3f6ff; background: #162337; border-color: #31435f; border-radius: 15px; padding: 12px 14px; font-size: 13px; }
    .zello-input::placeholder { color: #8696b2; } .zello-input:focus { border-color: #7464ff; box-shadow: 0 0 0 3px rgba(112,97,255,.15); }
    .zello-send-button { width: 44px; height: 44px; background: linear-gradient(135deg, #7460ff, #2678ff); box-shadow: 0 5px 14px rgba(51,91,255,.28); transition: transform .15s ease; }
    .zello-send-button:hover:not(:disabled) { transform: translateY(-1px) scale(1.03); }

    @media (max-width: 480px) {
      .zello-launcher { min-width: 156px; height: 50px; bottom: 14px; }
      .zello-panel { inset: 8px !important; width: auto; height: auto; max-width: none; max-height: none; border-radius: 22px; }
      .zello-panel.zello-expanded { width: auto; height: auto; }
      .zello-header { min-height: 74px; padding: 12px 14px; } .zello-header-title strong { font-size: 17px; }
      .zello-header-title small { font-size: 10px; } .zello-messages { padding: 14px; }
      .zello-product-card { width: 168px; min-height: 258px; } .zello-product-image { height: 114px; }
      :host([data-inline]) .zello-panel { inset: auto !important; height: min(720px, 82dvh); border-radius: 20px; }
      :host([data-inline]) .zello-product-row { display: flex; overflow-x: auto; grid-template-columns: none; }
      :host([data-inline]) .zello-product-card { width: 168px; }
    }
  `;
}
