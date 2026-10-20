var P=Object.defineProperty;var R=(m,g,x)=>g in m?P(m,g,{enumerable:!0,configurable:!0,writable:!0,value:x}):m[g]=x;var h=(m,g,x)=>R(m,typeof g!="symbol"?g+"":g,x);(function(){"use strict";const m="https://api.zello.ai/api/v1";function g(){if(document.currentScript instanceof HTMLScriptElement)return document.currentScript;const a=Array.from(document.querySelectorAll("script[data-tenant-slug]"));return a.length>0?a[a.length-1]:null}function x(a){var e;if(a==="urdu"||a==="english"||a==="roman_urdu")return a;const o=(((e=navigator.languages)==null?void 0:e[0])||navigator.language||"").toLowerCase();return o.startsWith("ur")?"urdu":o.startsWith("hi")?"roman_urdu":"english"}function S(){var n;const a=g(),o=a==null?void 0:a.dataset.tenantSlug;if(!o)throw new Error("Zello widget: missing required data-tenant-slug attribute on the embed <script> tag.");const e=a==null?void 0:a.dataset.position;return{tenantSlug:o,apiBaseUrl:(a==null?void 0:a.dataset.apiBaseUrl)||m,language:x(a==null?void 0:a.dataset.language),position:e==="bottom-left"?"bottom-left":"bottom-right",voiceMode:(a==null?void 0:a.dataset.voiceMode)==="browser"?"browser":"auto",autoOpen:(a==null?void 0:a.dataset.autoOpen)==="true",mountTarget:a==null?void 0:a.dataset.mountTarget,storefrontPath:(n=a==null?void 0:a.dataset.storefrontPath)!=null&&n.startsWith("/store/")?a.dataset.storefrontPath:void 0}}function C(a,o){const e=o.mountTarget?document.getElementById(o.mountTarget):null;if(!e){document.body.appendChild(a);return}const n=()=>{a.toggleAttribute("data-inline",e.dataset.agentInline==="true"),a.dispatchEvent(new Event("zello:presentation"))},s=()=>{n(),e.appendChild(a)};e.dataset.agentReady==="true"?s():window.addEventListener("zello:stage-ready",s,{once:!0});const t=new MutationObserver(n);t.observe(e,{attributes:!0,attributeFilter:["data-agent-inline"]}),window.addEventListener("pagehide",()=>t.disconnect(),{once:!0})}function b(a,o){return`zello:${a}:${o}`}class E{constructor(o){this.tenantSlug=o}getSession(){const o=window.localStorage.getItem(b(this.tenantSlug,"session"));try{const e=o?JSON.parse(o):null,n=`zello.storefront.session.${this.tenantSlug}`,s=window.localStorage.getItem(n),t=s?JSON.parse(s):null;if(t!=null&&t.accessToken&&t.customerId){if((e==null?void 0:e.customerId)!==t.customerId){this.clearMessages();const i={...t,conversationId:null,branding:null};return window.localStorage.setItem(b(this.tenantSlug,"session"),JSON.stringify(i)),i}return{...e,...t,conversationId:(e==null?void 0:e.conversationId)??null,branding:(e==null?void 0:e.branding)??null}}return e&&window.localStorage.setItem(n,JSON.stringify(e)),e}catch{return null}}setSession(o){window.localStorage.setItem(b(this.tenantSlug,"session"),JSON.stringify(o));const{accessToken:e,refreshToken:n,customerId:s,tenantId:t}=o;window.localStorage.setItem(`zello.storefront.session.${this.tenantSlug}`,JSON.stringify({accessToken:e,refreshToken:n,customerId:s,tenantId:t}))}clearSession(){window.localStorage.removeItem(b(this.tenantSlug,"session")),window.localStorage.removeItem(`zello.storefront.session.${this.tenantSlug}`),window.localStorage.removeItem(`zello.storefront.cart.${this.tenantSlug}`)}setConversationId(o){const e=this.getSession();e&&this.setSession({...e,conversationId:o})}setBranding(o){const e=this.getSession();e&&this.setSession({...e,branding:o})}getMessages(){const o=window.localStorage.getItem(b(this.tenantSlug,"messages"));if(!o)return[];try{return JSON.parse(o)}catch{return[]}}setMessages(o){const e=o.slice(-100);window.localStorage.setItem(b(this.tenantSlug,"messages"),JSON.stringify(e))}clearMessages(){window.localStorage.removeItem(b(this.tenantSlug,"messages"))}}class I extends Error{constructor(o,e){super(`API request failed with status ${o}`),this.status=o,this.body=e}}class T{constructor(o,e){h(this,"storage");this.baseUrl=o,this.tenantSlug=e,this.storage=new E(e)}async ensureSession(){const o=this.storage.getSession();if(o)return{accessToken:o.accessToken,refreshToken:o.refreshToken,customerId:o.customerId,tenantId:o.tenantId};const e=await this.request("/auth/guest-session",{method:"POST",body:JSON.stringify({tenantSlug:this.tenantSlug}),skipAuth:!0}),n=this.storage.getSession();return n||(this.storage.setSession({...e,conversationId:null,branding:null}),e)}getStoredConversationId(){var o;return((o=this.storage.getSession())==null?void 0:o.conversationId)??null}getCachedBranding(){var o;return((o=this.storage.getSession())==null?void 0:o.branding)??null}async startConversation(o){const e=await this.request(`/conversations?language=${encodeURIComponent(o)}`,{method:"POST"});return this.storage.setConversationId(e.conversation.id),this.storage.setBranding(e.branding),e}async postMessage(o,e){var l,p;const n=crypto.randomUUID(),s=JSON.stringify({content:e,requestId:n,cartId:window.localStorage.getItem(`zello.storefront.cart.${this.tenantSlug}`)});let t;try{t=await this.readMessageStream(o,s)}catch{t=await this.request(`/conversations/${o}/messages`,{method:"POST",body:s})}const i=t.assistantMessage.intent;if((((l=t.action)==null?void 0:l.type)==="ADD_TO_CART"||i.action==="add_to_cart")&&typeof i.cart_id=="string"){const d=((p=t.action)==null?void 0:p.type)==="ADD_TO_CART"?t.action.payload:void 0;window.localStorage.setItem(`zello.storefront.cart.${this.tenantSlug}`,i.cart_id),window.dispatchEvent(new CustomEvent("zello:cart-changed",{detail:{count:i.cart_count,slug:this.tenantSlug,productId:d==null?void 0:d.productId,quantity:d==null?void 0:d.quantity,title:d==null?void 0:d.title}}))}return t}async readMessageStream(o,e){const n=await this.requestResponse(`/conversations/${o}/messages/stream`,{method:"POST",body:e});if(!n.body)throw new Error("Streaming response body is unavailable");const s=n.body.getReader(),t=new TextDecoder;let i="",r=null;const l=p=>{if(!p.trim())return;const d=JSON.parse(p);d.type==="complete"&&d.data&&(r=d.data)};for(;;){const{done:p,value:d}=await s.read();i+=t.decode(d,{stream:!p});const f=i.split(`
`);i=f.pop()??"";for(const u of f)l(u);if(p)break}if(l(i),!r)throw new Error("Stream ended before the assistant reply completed");return r}async getProduct(o){return this.request(`/catalog/storefront/products/${o}`)}async transcribeAudio(o){return(await this.request("/voice/transcriptions",{method:"POST",headers:{"Content-Type":o.type||"audio/webm"},body:o})).text}async synthesizeSpeech(o,e){return(await this.requestResponse("/voice/tts",{method:"POST",body:JSON.stringify({text:o,language:e})})).blob()}clearSession(){this.storage.clearSession(),this.storage.clearMessages()}getCachedMessages(){return this.storage.getMessages()}setCachedMessages(o){this.storage.setMessages(o)}async request(o,e={}){return await(await this.requestResponse(o,e)).json()}async requestResponse(o,e={},n=!1){const{skipAuth:s,...t}=e,i=s?null:this.storage.getSession(),r=new Headers(t.headers);r.has("Content-Type")||r.set("Content-Type","application/json"),i&&r.set("Authorization",`Bearer ${i.accessToken}`);const l=await fetch(`${this.baseUrl}${o}`,{...t,headers:r});if(l.status===401&&i&&!n&&await this.tryRefresh(i.refreshToken))return this.requestResponse(o,e,!0);if(!l.ok){const p=await l.json().catch(()=>{});throw new I(l.status,p)}return l}async tryRefresh(o){try{const e=await fetch(`${this.baseUrl}/auth/refresh`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refreshToken:o})});if(!e.ok)return this.clearSession(),!1;const n=await e.json(),s=this.storage.getSession();return this.storage.setSession({...n,conversationId:(s==null?void 0:s.conversationId)??null,branding:(s==null?void 0:s.branding)??null}),!0}catch{return this.clearSession(),!1}}}function A(a,o={}){const e=document.createElement("div");e.className="zello-product-row",e.setAttribute("aria-label","Recommended products");for(const[n,s]of a.entries())e.appendChild(M(s,n,o));return e}function M(a,o,{onAdd:e,pendingProductId:n,addedProductId:s}){const t=document.createElement("div");if(t.className="zello-product-card",a.id===n&&t.classList.add("zello-product-card-pending"),a.id===s&&t.classList.add("zello-product-card-added"),o===0){const c=document.createElement("span");c.className="zello-product-recommendation",c.textContent="✦ Top match",t.appendChild(c)}const i=document.createElement("div");i.className="zello-product-image";const r=a.images[0];if(r){const c=document.createElement("img");c.src=r,c.alt=a.title,c.loading="lazy",i.appendChild(c)}else i.classList.add("zello-product-image-placeholder");t.appendChild(i);const l=document.createElement("div");l.className="zello-product-title",l.textContent=a.title,t.appendChild(l);const p=document.createElement("div");p.className="zello-product-price",p.textContent=B(a.price,a.currency),t.appendChild(p);const d=a.status==="active"&&a.stockQty>0,f=document.createElement("div");f.className="zello-product-stock",f.textContent=d?"● In stock":"Out of stock",t.appendChild(f);const u=a.id===n,z=a.id===s;if(e||u||z){const c=document.createElement("button");c.type="button",c.className="zello-product-add",c.setAttribute("aria-label",`Add ${a.title} to cart`),c.disabled=!d||u||z||!e,c.textContent=z?"✓ Added":u?"Adding…":"🛒 Add to cart",e&&!u&&!z&&c.addEventListener("click",()=>e(a)),t.appendChild(c)}if(!d){const c=document.createElement("div");c.className="zello-product-badge",c.textContent="Out of stock",t.appendChild(c)}return t}function B(a,o){const e=typeof a=="string"?Number(a):a;return Number.isNaN(e)?`${o} ${a}`:`${o} ${e.toLocaleString("en-US",{maximumFractionDigits:0})}`}function w(a){return`
    :host {
      --zello-primary: ${a};
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
    .zello-send-loading {
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: zello-send-spin .7s linear infinite;
    }
    @keyframes zello-send-spin { to { transform: rotate(360deg); } }

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
  `}const N=5,O="#B6602A",L=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.8l1.45 5.75L19 10l-5.55 1.45L12 17.2l-1.45-5.75L5 10l5.55-1.45L12 2.8z" fill="currentColor"/>
    <path d="M19 15.5l.6 2.1 2.1.6-2.1.6-.6 2.1-.6-2.1-2.1-.6 2.1-.6.6-2.1z" fill="currentColor"/>
  </svg>
`,y=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor"/>
  </svg>
`;function $(){return`local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}class v extends HTMLElement{constructor(e){super();h(this,"shadow");h(this,"apiClient");h(this,"conversationId",null);h(this,"messages",[]);h(this,"isOpen",!1);h(this,"isExpanded",!1);h(this,"isSending",!1);h(this,"pendingCartProductId",null);h(this,"lastAssistantIntent",null);h(this,"styleEl");h(this,"launcherButton");h(this,"panel");h(this,"headerEl");h(this,"headerTitleEl");h(this,"messagesEl");h(this,"inputEl");h(this,"sendButton");this.config=e,this.apiClient=new T(e.apiBaseUrl,e.tenantSlug),this.shadow=this.attachShadow({mode:"open"})}connectedCallback(){this.buildDom(),this.addEventListener("zello:presentation",()=>{const n=this.hasAttribute("data-inline");this.panel.setAttribute("role",n?"region":"dialog"),this.setOpen(n,!1)});const e=this.apiClient.getCachedBranding();e&&this.applyBranding(e),this.bootstrap()}buildDom(){if(this.styleEl=document.createElement("style"),this.styleEl.textContent=w(O),this.shadow.appendChild(this.styleEl),this.launcherButton=document.createElement("button"),this.launcherButton.className=`zello-launcher zello-position-${this.config.position}`,this.launcherButton.setAttribute("aria-label","Ask Zello AI"),this.launcherButton.innerHTML=`${L}<span>Ask Zello AI</span>`,this.launcherButton.addEventListener("click",()=>this.setOpen(!this.isOpen)),this.shadow.appendChild(this.launcherButton),this.panel=document.createElement("div"),this.panel.className=`zello-panel zello-position-${this.config.position}`,this.panel.setAttribute("role",this.hasAttribute("data-inline")?"region":"dialog"),this.panel.setAttribute("aria-label","Zello AI sales agent"),this.headerEl=this.buildHeader(),this.panel.appendChild(this.headerEl),this.messagesEl=document.createElement("div"),this.messagesEl.className="zello-messages",this.panel.appendChild(this.messagesEl),this.panel.appendChild(this.buildInputRow()),this.config.storefrontPath){const e=document.createElement("nav");e.className="zello-shopping-links";for(const[n,s]of[["Review cart","/cart"],["Checkout","/checkout"]]){const t=document.createElement("a");t.textContent=n,t.href=`${this.config.storefrontPath}${s}`,e.appendChild(t)}this.panel.appendChild(e)}this.shadow.appendChild(this.panel)}buildHeader(){const e=document.createElement("div");e.className="zello-header",this.headerTitleEl=document.createElement("div"),this.headerTitleEl.className="zello-header-title",this.headerTitleEl.innerHTML='<span class="zello-orb">✦</span><span><strong>Zello AI</strong><small><i></i> Online · Your AI shopping assistant</small></span>';const n=document.createElement("button");n.className="zello-expand-button",n.setAttribute("aria-label","Expand assistant"),n.textContent="↗",n.addEventListener("click",()=>{this.isExpanded=!this.isExpanded,this.panel.classList.toggle("zello-expanded",this.isExpanded),n.textContent=this.isExpanded?"↙":"↗",n.setAttribute("aria-label",this.isExpanded?"Reduce assistant":"Expand assistant")});const s=document.createElement("button");return s.className="zello-close-button",s.setAttribute("aria-label","Close chat"),s.textContent="✕",s.addEventListener("click",()=>this.setOpen(!1)),e.appendChild(this.headerTitleEl),e.appendChild(n),e.appendChild(s),e}buildInputRow(){const e=document.createElement("form");return e.className="zello-input-row",e.addEventListener("submit",n=>{n.preventDefault(),this.handleSend()}),this.inputEl=document.createElement("input"),this.inputEl.className="zello-input",this.inputEl.type="text",this.inputEl.placeholder="Kya chahiye? Budget, colour aur size batayein…",this.inputEl.setAttribute("aria-label","Message Zello"),this.sendButton=document.createElement("button"),this.sendButton.type="submit",this.sendButton.className="zello-send-button",this.sendButton.setAttribute("aria-label","Send message"),this.sendButton.innerHTML=y,this.sendButton.addEventListener("click",n=>{n.preventDefault(),e.requestSubmit()}),e.appendChild(this.inputEl),e.appendChild(this.sendButton),e}async bootstrap(){try{await this.apiClient.ensureSession();const e=this.apiClient.getCachedMessages(),n=this.apiClient.getStoredConversationId();if(e.length>0&&n){this.conversationId=n,this.messages=e,this.renderMessages(),this.onBootstrapped(),window.dispatchEvent(new CustomEvent("zello:agent-ready",{detail:{tenantSlug:this.config.tenantSlug}}));return}const s=await this.apiClient.startConversation(this.config.language);this.conversationId=s.conversation.id,this.applyBranding(s.branding),this.messages=[this.toBubble(s.greeting)],this.apiClient.setCachedMessages(this.messages),this.renderMessages(),this.onBootstrapped(),window.dispatchEvent(new CustomEvent("zello:agent-ready",{detail:{tenantSlug:this.config.tenantSlug}}))}catch(e){this.renderError("Sorry, we couldn't connect right now. Please refresh the page and try again."),console.error("[zello-widget] bootstrap failed",e)}}onBootstrapped(){}applyBranding(e){e.primaryColor&&(this.styleEl.textContent=w(e.primaryColor)),(e.logoUrl||e.greetingPersona)&&(this.headerTitleEl.textContent=e.greetingPersona?"Zello AI":this.headerTitleEl.textContent)}async handleSend(){var s;this.lastAssistantIntent=null;const e=this.inputEl.value.trim();if(!e||this.isSending||!this.conversationId)return;this.isSending=!0,this.inputEl.value="",this.setSendingState(!0);const n=$();this.messages.push({id:n,role:"customer",content:e,createdAt:new Date().toISOString(),pending:!0}),this.renderMessages(),this.renderTypingIndicator(!0);try{const t=await this.apiClient.postMessage(this.conversationId,e),i=this.messages.findIndex(p=>p.id===n),r=this.toBubble(t.customerMessage);i>=0?this.messages[i]=r:this.messages.push(r);const l=this.toBubble(t.assistantMessage);((s=t.action)==null?void 0:s.type)==="ADD_TO_CART"&&(l.action=t.action),this.pendingCartProductId=null,this.messages.push(l),this.lastAssistantIntent=t.assistantMessage.intent??{},this.apiClient.setCachedMessages(this.messages),this.attachProductResults(l)}catch(t){this.pendingCartProductId=null,this.messages=this.messages.filter(i=>i.id!==n),this.renderError("That message couldn't be sent. Please try again."),console.error("[zello-widget] send message failed",t)}finally{this.isSending=!1,this.setSendingState(!1),this.renderTypingIndicator(!1),this.renderMessages()}}setSendingState(e){this.sendButton.disabled=e,this.sendButton.setAttribute("aria-busy",String(e)),this.sendButton.setAttribute("aria-label",e?"Sending message":"Send message"),this.sendButton.innerHTML=e?'<span class="zello-send-loading" aria-hidden="true"></span>':y}async attachProductResults(e){var t;const n=(t=this.lastAssistantIntent)==null?void 0:t.matched_product_ids;if(!Array.isArray(n)||n.length===0)return;const s=(await Promise.all(n.slice(0,N).map(i=>this.apiClient.getProduct(String(i)).catch(()=>null)))).filter(i=>i!==null);s.length!==0&&(e.products=s,this.apiClient.setCachedMessages(this.messages),this.renderMessages())}setOpen(e,n=!0){this.isOpen=e,this.panel.classList.toggle("zello-open",e),e&&(n&&this.inputEl.focus(),this.scrollToBottom())}toBubble(e){return{id:e.id,role:e.role,content:e.content,createdAt:e.createdAt}}renderMessages(){var n,s;this.messagesEl.innerHTML="";const e=[...this.messages].reverse().find(t=>t.role==="assistant");for(const t of this.messages){const i=document.createElement("div");if(i.className=`zello-bubble zello-bubble-${t.role==="customer"?"customer":"assistant"}`,t.pending&&i.classList.add("zello-bubble-pending"),i.textContent=t.content,this.messagesEl.appendChild(i),((n=t.action)==null?void 0:n.type)==="ADD_TO_CART"&&this.messagesEl.appendChild(this.buildCartConfirmationCard(t.action)),t.products&&t.products.length>0&&t===e){const r=!this.isSending;if(this.messagesEl.appendChild(A(t.products,{onAdd:r?l=>this.beginCartAction(l):void 0,pendingProductId:this.pendingCartProductId,addedProductId:(s=t.action)==null?void 0:s.payload.productId})),r){const l=document.createElement("div");l.className="zello-suggestions";const p=[["✦ Recommend for me","In options mein meri zaroorat aur budget ke liye kaunsa behtar hai? Wajah bhi batao."],...t.products.length>1?[["Compare options","In options ko price aur available features ke hisaab se compare karo."],["Cheaper options","Koi sasta option hai?"]]:[],["Different colour","Kya ye kisi aur colour mein available hai?"]];for(const[d,f]of p){const u=document.createElement("button");u.type="button",u.className="zello-action",u.textContent=d,u.addEventListener("click",()=>this.sendSuggestedMessage(f)),l.appendChild(u)}this.messagesEl.appendChild(l)}}}this.messages.length===1&&!this.isSending&&this.messagesEl.appendChild(this.buildQuickChips()),this.scrollToBottom()}sendSuggestedMessage(e){this.isSending||(this.inputEl.value=e,this.handleSend())}beginCartAction(e){this.isSending||e.status!=="active"||e.stockQty<=0||(this.pendingCartProductId=e.id,this.renderMessages(),this.sendSuggestedMessage(`${e.title} ka ek piece cart mein add karo.`))}buildQuickChips(){const e=document.createElement("div");e.className="zello-suggestions zello-quick-chips";for(const[n,s]of[["👟 Sneakers","Mujhe sneakers dikhayein"],["👕 T-Shirts","Mujhe t-shirts dikhayein"],["Hoodies","Mujhe hoodies dikhayein"],["Jeans","Mujhe jeans dikhayein"]]){const t=document.createElement("button");t.type="button",t.className="zello-action",t.textContent=n,t.addEventListener("click",()=>this.sendSuggestedMessage(s)),e.appendChild(t)}return e}buildCartConfirmationCard(e){const n=document.createElement("div");n.className="zello-cart-confirmation";const s=document.createElement("strong");s.textContent=`${e.payload.title} added to cart`,n.appendChild(s);const t=document.createElement("div");t.className="zello-cart-actions";const i=document.createElement("button");i.type="button",i.className="zello-action",i.textContent="View cart",i.addEventListener("click",()=>{if(this.config.storefrontPath){window.location.assign(`${this.config.storefrontPath}/cart`);return}window.dispatchEvent(new CustomEvent("zello:view-cart",{detail:{tenantSlug:this.config.tenantSlug}}))}),t.appendChild(i);const r=document.createElement("button");r.type="button",r.className="zello-action",r.textContent="Show similar",r.addEventListener("click",()=>{this.sendSuggestedMessage(`Show me similar products to ${e.payload.title}.`)}),t.appendChild(r);const l=document.createElement("button");return l.type="button",l.className="zello-action",l.textContent="Continue shopping",l.addEventListener("click",()=>this.inputEl.focus()),t.appendChild(l),n.appendChild(t),n}renderTypingIndicator(e){const n=this.messagesEl.querySelector(".zello-typing");if(n&&n.remove(),e){const s=document.createElement("div");s.className="zello-typing",s.innerHTML="<span></span><span></span><span></span><em>Options check kar raha hoon…</em>",this.messagesEl.appendChild(s),this.scrollToBottom()}}renderError(e){const n=document.createElement("div");n.className="zello-bubble zello-bubble-assistant",n.textContent=e,this.messagesEl.appendChild(n),this.scrollToBottom()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}}customElements.define("zello-widget",v);function k(){if(document.querySelector("zello-widget"))return;const a=S(),o=new v(a);C(o,a)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",k):k()})();
