var N=Object.defineProperty;var O=(h,d,p)=>d in h?N(h,d,{enumerable:!0,configurable:!0,writable:!0,value:p}):h[d]=p;var r=(h,d,p)=>O(h,typeof d!="symbol"?d+"":d,p);(function(){"use strict";const h="https://api.zello.ai/api/v1";function d(){if(document.currentScript instanceof HTMLScriptElement)return document.currentScript;const n=Array.from(document.querySelectorAll("script[data-tenant-slug]"));return n.length>0?n[n.length-1]:null}function p(n){var e;if(n==="urdu"||n==="english"||n==="roman_urdu")return n;const t=(((e=navigator.languages)==null?void 0:e[0])||navigator.language||"").toLowerCase();return t.startsWith("ur")?"urdu":t.startsWith("hi")?"roman_urdu":"english"}function z(){var s;const n=d(),t=n==null?void 0:n.dataset.tenantSlug;if(!t)throw new Error("Zello widget: missing required data-tenant-slug attribute on the embed <script> tag.");const e=n==null?void 0:n.dataset.position;return{tenantSlug:t,apiBaseUrl:(n==null?void 0:n.dataset.apiBaseUrl)||h,language:p(n==null?void 0:n.dataset.language),position:e==="bottom-left"?"bottom-left":"bottom-right",voiceMode:(n==null?void 0:n.dataset.voiceMode)==="browser"?"browser":"auto",autoOpen:(n==null?void 0:n.dataset.autoOpen)==="true",mountTarget:n==null?void 0:n.dataset.mountTarget,storefrontPath:(s=n==null?void 0:n.dataset.storefrontPath)!=null&&s.startsWith("/store/")?n.dataset.storefrontPath:void 0}}function y(n,t){const e=t.mountTarget?document.getElementById(t.mountTarget):null;if(!e){document.body.appendChild(n);return}const s=()=>{n.toggleAttribute("data-inline",e.dataset.agentInline==="true"),n.dispatchEvent(new Event("zello:presentation"))},o=()=>{s(),e.appendChild(n)};e.dataset.agentReady==="true"?o():window.addEventListener("zello:stage-ready",o,{once:!0});const i=new MutationObserver(s);i.observe(e,{attributes:!0,attributeFilter:["data-agent-inline"]}),window.addEventListener("pagehide",()=>i.disconnect(),{once:!0})}function u(n,t){return`zello:${n}:${t}`}class w{constructor(t){this.tenantSlug=t}getSession(){const t=window.localStorage.getItem(u(this.tenantSlug,"session"));try{const e=t?JSON.parse(t):null,s=`zello.storefront.session.${this.tenantSlug}`,o=window.localStorage.getItem(s),i=o?JSON.parse(o):null;if(i!=null&&i.accessToken&&i.customerId){if((e==null?void 0:e.customerId)!==i.customerId){this.clearMessages();const l={...i,conversationId:null,branding:null};return window.localStorage.setItem(u(this.tenantSlug,"session"),JSON.stringify(l)),l}return{...e,...i,conversationId:(e==null?void 0:e.conversationId)??null,branding:(e==null?void 0:e.branding)??null}}return e&&window.localStorage.setItem(s,JSON.stringify(e)),e}catch{return null}}setSession(t){window.localStorage.setItem(u(this.tenantSlug,"session"),JSON.stringify(t));const{accessToken:e,refreshToken:s,customerId:o,tenantId:i}=t;window.localStorage.setItem(`zello.storefront.session.${this.tenantSlug}`,JSON.stringify({accessToken:e,refreshToken:s,customerId:o,tenantId:i}))}clearSession(){window.localStorage.removeItem(u(this.tenantSlug,"session")),window.localStorage.removeItem(`zello.storefront.session.${this.tenantSlug}`),window.localStorage.removeItem(`zello.storefront.cart.${this.tenantSlug}`)}setConversationId(t){const e=this.getSession();e&&this.setSession({...e,conversationId:t})}setBranding(t){const e=this.getSession();e&&this.setSession({...e,branding:t})}getMessages(){const t=window.localStorage.getItem(u(this.tenantSlug,"messages"));if(!t)return[];try{return JSON.parse(t)}catch{return[]}}setMessages(t){const e=t.slice(-100);window.localStorage.setItem(u(this.tenantSlug,"messages"),JSON.stringify(e))}clearMessages(){window.localStorage.removeItem(u(this.tenantSlug,"messages"))}}class v extends Error{constructor(t,e){super(`API request failed with status ${t}`),this.status=t,this.body=e}}class S{constructor(t,e){r(this,"storage");this.baseUrl=t,this.tenantSlug=e,this.storage=new w(e)}async ensureSession(){const t=this.storage.getSession();if(t)return{accessToken:t.accessToken,refreshToken:t.refreshToken,customerId:t.customerId,tenantId:t.tenantId};const e=await this.request("/auth/guest-session",{method:"POST",body:JSON.stringify({tenantSlug:this.tenantSlug}),skipAuth:!0}),s=this.storage.getSession();return s||(this.storage.setSession({...e,conversationId:null,branding:null}),e)}getStoredConversationId(){var t;return((t=this.storage.getSession())==null?void 0:t.conversationId)??null}getCachedBranding(){var t;return((t=this.storage.getSession())==null?void 0:t.branding)??null}async startConversation(t){const e=await this.request(`/conversations?language=${encodeURIComponent(t)}`,{method:"POST"});return this.storage.setConversationId(e.conversation.id),this.storage.setBranding(e.branding),e}async postMessage(t,e){const s=await this.request(`/conversations/${t}/messages`,{method:"POST",body:JSON.stringify({content:e,requestId:crypto.randomUUID(),cartId:window.localStorage.getItem(`zello.storefront.cart.${this.tenantSlug}`)})}),o=s.assistantMessage.intent;return o.action==="add_to_cart"&&typeof o.cart_id=="string"&&(window.localStorage.setItem(`zello.storefront.cart.${this.tenantSlug}`,o.cart_id),window.dispatchEvent(new CustomEvent("zello:cart-changed",{detail:{count:o.cart_count,slug:this.tenantSlug}}))),s}async getProduct(t){return this.request(`/catalog/storefront/products/${t}`)}async transcribeAudio(t){return(await this.request("/voice/transcriptions",{method:"POST",headers:{"Content-Type":t.type||"audio/webm"},body:t})).text}async synthesizeSpeech(t,e){return(await this.requestResponse("/voice/speech",{method:"POST",body:JSON.stringify({text:t,language:e})})).blob()}clearSession(){this.storage.clearSession(),this.storage.clearMessages()}getCachedMessages(){return this.storage.getMessages()}setCachedMessages(t){this.storage.setMessages(t)}async request(t,e={}){return await(await this.requestResponse(t,e)).json()}async requestResponse(t,e={},s=!1){const{skipAuth:o,...i}=e,l=o?null:this.storage.getSession(),a=new Headers(i.headers);a.has("Content-Type")||a.set("Content-Type","application/json"),l&&a.set("Authorization",`Bearer ${l.accessToken}`);const c=await fetch(`${this.baseUrl}${t}`,{...i,headers:a});if(c.status===401&&l&&!s&&await this.tryRefresh(l.refreshToken))return this.requestResponse(t,e,!0);if(!c.ok){const m=await c.json().catch(()=>{});throw new v(c.status,m)}return c}async tryRefresh(t){try{const e=await fetch(`${this.baseUrl}/auth/refresh`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refreshToken:t})});if(!e.ok)return this.clearSession(),!1;const s=await e.json(),o=this.storage.getSession();return this.storage.setSession({...s,conversationId:(o==null?void 0:o.conversationId)??null,branding:(o==null?void 0:o.branding)??null}),!0}catch{return this.clearSession(),!1}}}function E(n,t){const e=document.createElement("div");e.className="zello-product-row";for(const s of n)e.appendChild(C(s,t));return e}function C(n,t){const e=document.createElement("div");e.className="zello-product-card";const s=document.createElement("div");s.className="zello-product-image";const o=n.images[0];if(o){const a=document.createElement("img");a.src=o,a.alt=n.title,a.loading="lazy",s.appendChild(a)}else s.classList.add("zello-product-image-placeholder");e.appendChild(s);const i=document.createElement("div");i.className="zello-product-title",i.textContent=n.title,e.appendChild(i);const l=document.createElement("div");if(l.className="zello-product-price",l.textContent=k(n.price,n.currency),e.appendChild(l),t){const a=document.createElement("button");a.type="button",a.className="zello-action",a.textContent="Add to cart",a.setAttribute("aria-label",`Add ${n.title} to cart`),a.disabled=n.status!=="active"||n.stockQty<=0,a.addEventListener("click",()=>t(n)),e.appendChild(a)}if(n.status==="out_of_stock"||n.stockQty<=0){const a=document.createElement("div");a.className="zello-product-badge",a.textContent="Out of stock",e.appendChild(a)}return e}function k(n,t){const e=typeof n=="string"?Number(n):n;return Number.isNaN(e)?`${t} ${n}`:`${t} ${e.toLocaleString("en-US",{maximumFractionDigits:0})}`}function f(n){return`
    :host {
      --zello-primary: ${n};
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
  `}const I=5,B="#B6602A",T=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>
`,M=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor"/>
  </svg>
`;function A(){return`local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}class b extends HTMLElement{constructor(e){super();r(this,"shadow");r(this,"apiClient");r(this,"conversationId",null);r(this,"messages",[]);r(this,"isOpen",!1);r(this,"isSending",!1);r(this,"lastAssistantIntent",null);r(this,"styleEl");r(this,"launcherButton");r(this,"panel");r(this,"headerEl");r(this,"headerTitleEl");r(this,"messagesEl");r(this,"inputEl");r(this,"sendButton");this.config=e,this.apiClient=new S(e.apiBaseUrl,e.tenantSlug),this.shadow=this.attachShadow({mode:"open"})}connectedCallback(){this.buildDom(),this.addEventListener("zello:presentation",()=>{const s=this.hasAttribute("data-inline");this.panel.setAttribute("role",s?"region":"dialog"),this.setOpen(s,!1)});const e=this.apiClient.getCachedBranding();e&&this.applyBranding(e),this.bootstrap()}buildDom(){if(this.styleEl=document.createElement("style"),this.styleEl.textContent=f(B),this.shadow.appendChild(this.styleEl),this.launcherButton=document.createElement("button"),this.launcherButton.className=`zello-launcher zello-position-${this.config.position}`,this.launcherButton.setAttribute("aria-label","Open chat"),this.launcherButton.innerHTML=T,this.launcherButton.addEventListener("click",()=>this.setOpen(!this.isOpen)),this.shadow.appendChild(this.launcherButton),this.panel=document.createElement("div"),this.panel.className=`zello-panel zello-position-${this.config.position}`,this.panel.setAttribute("role",this.hasAttribute("data-inline")?"region":"dialog"),this.panel.setAttribute("aria-label","Zello AI sales agent"),this.headerEl=this.buildHeader(),this.panel.appendChild(this.headerEl),this.messagesEl=document.createElement("div"),this.messagesEl.className="zello-messages",this.panel.appendChild(this.messagesEl),this.panel.appendChild(this.buildInputRow()),this.config.storefrontPath){const e=document.createElement("nav");e.className="zello-shopping-links";for(const[s,o]of[["Review cart","/cart"],["Checkout","/checkout"]]){const i=document.createElement("a");i.textContent=s,i.href=`${this.config.storefrontPath}${o}`,e.appendChild(i)}this.panel.appendChild(e)}this.shadow.appendChild(this.panel)}buildHeader(){const e=document.createElement("div");e.className="zello-header",this.headerTitleEl=document.createElement("div"),this.headerTitleEl.className="zello-header-title",this.headerTitleEl.textContent="Zello AI · Sales Agent";const s=document.createElement("button");return s.className="zello-close-button",s.setAttribute("aria-label","Close chat"),s.textContent="✕",s.addEventListener("click",()=>this.setOpen(!1)),e.appendChild(this.headerTitleEl),e.appendChild(s),e}buildInputRow(){const e=document.createElement("div");return e.className="zello-input-row",this.inputEl=document.createElement("input"),this.inputEl.className="zello-input",this.inputEl.type="text",this.inputEl.placeholder="Kya chahiye? Budget, colour aur size batayein…",this.inputEl.setAttribute("aria-label","Message Zello"),this.inputEl.addEventListener("keydown",s=>{s.key==="Enter"&&(s.preventDefault(),this.handleSend())}),this.sendButton=document.createElement("button"),this.sendButton.className="zello-send-button",this.sendButton.setAttribute("aria-label","Send message"),this.sendButton.innerHTML=M,this.sendButton.addEventListener("click",()=>void this.handleSend()),e.appendChild(this.inputEl),e.appendChild(this.sendButton),e}async bootstrap(){try{await this.apiClient.ensureSession();const e=this.apiClient.getCachedMessages(),s=this.apiClient.getStoredConversationId();if(e.length>0&&s){this.conversationId=s,this.messages=e,this.renderMessages(),this.onBootstrapped(),window.dispatchEvent(new CustomEvent("zello:agent-ready",{detail:{tenantSlug:this.config.tenantSlug}}));return}const o=await this.apiClient.startConversation(this.config.language);this.conversationId=o.conversation.id,this.applyBranding(o.branding),this.messages=[this.toBubble(o.greeting)],this.apiClient.setCachedMessages(this.messages),this.renderMessages(),this.onBootstrapped(),window.dispatchEvent(new CustomEvent("zello:agent-ready",{detail:{tenantSlug:this.config.tenantSlug}}))}catch(e){this.renderError("Sorry, we couldn't connect right now. Please refresh the page and try again."),console.error("[zello-widget] bootstrap failed",e)}}onBootstrapped(){}applyBranding(e){e.primaryColor&&(this.styleEl.textContent=f(e.primaryColor)),(e.logoUrl||e.greetingPersona)&&(this.headerTitleEl.textContent=e.greetingPersona?"Zello AI":this.headerTitleEl.textContent)}async handleSend(){this.lastAssistantIntent=null;const e=this.inputEl.value.trim();if(!e||this.isSending||!this.conversationId)return;this.isSending=!0,this.inputEl.value="",this.sendButton.disabled=!0;const s=A();this.messages.push({id:s,role:"customer",content:e,createdAt:new Date().toISOString(),pending:!0}),this.renderMessages(),this.renderTypingIndicator(!0);try{const o=await this.apiClient.postMessage(this.conversationId,e),i=this.messages.findIndex(c=>c.id===s),l=this.toBubble(o.customerMessage);i>=0?this.messages[i]=l:this.messages.push(l);const a=this.toBubble(o.assistantMessage);this.messages.push(a),this.lastAssistantIntent=o.assistantMessage.intent??{},this.apiClient.setCachedMessages(this.messages),this.attachProductResults(a)}catch(o){this.messages=this.messages.filter(i=>i.id!==s),this.renderError("That message couldn't be sent. Please try again."),console.error("[zello-widget] send message failed",o)}finally{this.isSending=!1,this.sendButton.disabled=!1,this.renderTypingIndicator(!1),this.renderMessages()}}async attachProductResults(e){var i;const s=(i=this.lastAssistantIntent)==null?void 0:i.matched_product_ids;if(!Array.isArray(s)||s.length===0)return;const o=(await Promise.all(s.slice(0,I).map(l=>this.apiClient.getProduct(String(l)).catch(()=>null)))).filter(l=>l!==null);o.length!==0&&(e.products=o,this.apiClient.setCachedMessages(this.messages),this.renderMessages())}setOpen(e,s=!0){this.isOpen=e,this.panel.classList.toggle("zello-open",e),e&&(s&&this.inputEl.focus(),this.scrollToBottom())}toBubble(e){return{id:e.id,role:e.role,content:e.content,createdAt:e.createdAt}}renderMessages(){this.messagesEl.innerHTML="";const e=[...this.messages].reverse().find(s=>{var o;return(o=s.products)==null?void 0:o.length});for(const s of this.messages){const o=document.createElement("div");if(o.className=`zello-bubble zello-bubble-${s.role==="customer"?"customer":"assistant"}`,s.pending&&o.classList.add("zello-bubble-pending"),o.textContent=s.content,this.messagesEl.appendChild(o),s.products&&s.products.length>0){const i=s===e&&!this.isSending;if(this.messagesEl.appendChild(E(s.products,i?l=>{this.sendSuggestedMessage(`${l.title} ka ek piece cart mein add karo.`)}:void 0)),i){const l=document.createElement("div");l.className="zello-suggestions";const a=[["Recommend for me","In options mein meri zaroorat aur budget ke liye kaunsa behtar hai? Wajah bhi batao."],...s.products.length>1?[["Compare options","In options ko price aur available features ke hisaab se compare karo."]]:[]];for(const[c,m]of a){const g=document.createElement("button");g.type="button",g.className="zello-action",g.textContent=c,g.addEventListener("click",()=>this.sendSuggestedMessage(m)),l.appendChild(g)}this.messagesEl.appendChild(l)}}}this.scrollToBottom()}sendSuggestedMessage(e){this.isSending||(this.inputEl.value=e,this.handleSend())}renderTypingIndicator(e){const s=this.messagesEl.querySelector(".zello-typing");if(s&&s.remove(),e){const o=document.createElement("div");o.className="zello-typing",o.innerHTML="<span></span><span></span><span></span>",this.messagesEl.appendChild(o),this.scrollToBottom()}}renderError(e){const s=document.createElement("div");s.className="zello-bubble zello-bubble-assistant",s.textContent=e,this.messagesEl.appendChild(s),this.scrollToBottom()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}}customElements.define("zello-widget",b);function x(){if(document.querySelector("zello-widget"))return;const n=z(),t=new b(n);y(t,n)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",x):x()})();
