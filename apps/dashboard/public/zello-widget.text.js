var M=Object.defineProperty;var N=(d,l,p)=>l in d?M(d,l,{enumerable:!0,configurable:!0,writable:!0,value:p}):d[l]=p;var r=(d,l,p)=>N(d,typeof l!="symbol"?l+"":l,p);(function(){"use strict";const d="https://api.zello.ai/api/v1";function l(){if(document.currentScript instanceof HTMLScriptElement)return document.currentScript;const n=Array.from(document.querySelectorAll("script[data-tenant-slug]"));return n.length>0?n[n.length-1]:null}function p(n){var e;if(n==="urdu"||n==="english"||n==="roman_urdu")return n;const t=(((e=navigator.languages)==null?void 0:e[0])||navigator.language||"").toLowerCase();return t.startsWith("ur")?"urdu":t.startsWith("hi")?"roman_urdu":"english"}function y(){const n=l(),t=n==null?void 0:n.dataset.tenantSlug;if(!t)throw new Error("Zello widget: missing required data-tenant-slug attribute on the embed <script> tag.");const e=n==null?void 0:n.dataset.position;return{tenantSlug:t,apiBaseUrl:(n==null?void 0:n.dataset.apiBaseUrl)||d,language:p(n==null?void 0:n.dataset.language),position:e==="bottom-left"?"bottom-left":"bottom-right",voiceMode:(n==null?void 0:n.dataset.voiceMode)==="browser"?"browser":"auto",autoOpen:(n==null?void 0:n.dataset.autoOpen)==="true"}}function c(n,t){return`zello:${n}:${t}`}class x{constructor(t){this.tenantSlug=t}getSession(){const t=window.localStorage.getItem(c(this.tenantSlug,"session"));try{const e=t?JSON.parse(t):null,s=`zello.storefront.session.${this.tenantSlug}`,o=window.localStorage.getItem(s),i=o?JSON.parse(o):null;if(i!=null&&i.accessToken&&i.customerId){if((e==null?void 0:e.customerId)!==i.customerId){this.clearMessages();const a={...i,conversationId:null,branding:null};return window.localStorage.setItem(c(this.tenantSlug,"session"),JSON.stringify(a)),a}return{...e,...i,conversationId:(e==null?void 0:e.conversationId)??null,branding:(e==null?void 0:e.branding)??null}}return e&&window.localStorage.setItem(s,JSON.stringify(e)),e}catch{return null}}setSession(t){window.localStorage.setItem(c(this.tenantSlug,"session"),JSON.stringify(t));const{accessToken:e,refreshToken:s,customerId:o,tenantId:i}=t;window.localStorage.setItem(`zello.storefront.session.${this.tenantSlug}`,JSON.stringify({accessToken:e,refreshToken:s,customerId:o,tenantId:i}))}clearSession(){window.localStorage.removeItem(c(this.tenantSlug,"session")),window.localStorage.removeItem(`zello.storefront.session.${this.tenantSlug}`),window.localStorage.removeItem(`zello.storefront.cart.${this.tenantSlug}`)}setConversationId(t){const e=this.getSession();e&&this.setSession({...e,conversationId:t})}setBranding(t){const e=this.getSession();e&&this.setSession({...e,branding:t})}getMessages(){const t=window.localStorage.getItem(c(this.tenantSlug,"messages"));if(!t)return[];try{return JSON.parse(t)}catch{return[]}}setMessages(t){const e=t.slice(-100);window.localStorage.setItem(c(this.tenantSlug,"messages"),JSON.stringify(e))}clearMessages(){window.localStorage.removeItem(c(this.tenantSlug,"messages"))}}class z extends Error{constructor(t,e){super(`API request failed with status ${t}`),this.status=t,this.body=e}}class w{constructor(t,e){r(this,"storage");this.baseUrl=t,this.tenantSlug=e,this.storage=new x(e)}async ensureSession(){const t=this.storage.getSession();if(t)return{accessToken:t.accessToken,refreshToken:t.refreshToken,customerId:t.customerId,tenantId:t.tenantId};const e=await this.request("/auth/guest-session",{method:"POST",body:JSON.stringify({tenantSlug:this.tenantSlug}),skipAuth:!0}),s=this.storage.getSession();return s||(this.storage.setSession({...e,conversationId:null,branding:null}),e)}getStoredConversationId(){var t;return((t=this.storage.getSession())==null?void 0:t.conversationId)??null}getCachedBranding(){var t;return((t=this.storage.getSession())==null?void 0:t.branding)??null}async startConversation(t){const e=await this.request(`/conversations?language=${encodeURIComponent(t)}`,{method:"POST"});return this.storage.setConversationId(e.conversation.id),this.storage.setBranding(e.branding),e}async postMessage(t,e){const s=await this.request(`/conversations/${t}/messages`,{method:"POST",body:JSON.stringify({content:e,requestId:crypto.randomUUID(),cartId:window.localStorage.getItem(`zello.storefront.cart.${this.tenantSlug}`)})}),o=s.assistantMessage.intent;return o.action==="add_to_cart"&&typeof o.cart_id=="string"&&(window.localStorage.setItem(`zello.storefront.cart.${this.tenantSlug}`,o.cart_id),window.dispatchEvent(new CustomEvent("zello:cart-changed",{detail:{count:o.cart_count,slug:this.tenantSlug}}))),s}async getProduct(t){return this.request(`/catalog/storefront/products/${t}`)}async transcribeAudio(t){return(await this.request("/voice/transcriptions",{method:"POST",headers:{"Content-Type":t.type||"audio/webm"},body:t})).text}async synthesizeSpeech(t,e){return(await this.requestResponse("/voice/speech",{method:"POST",body:JSON.stringify({text:t,language:e})})).blob()}clearSession(){this.storage.clearSession(),this.storage.clearMessages()}getCachedMessages(){return this.storage.getMessages()}setCachedMessages(t){this.storage.setMessages(t)}async request(t,e={}){return await(await this.requestResponse(t,e)).json()}async requestResponse(t,e={},s=!1){const{skipAuth:o,...i}=e,a=o?null:this.storage.getSession(),u=new Headers(i.headers);u.has("Content-Type")||u.set("Content-Type","application/json"),a&&u.set("Authorization",`Bearer ${a.accessToken}`);const h=await fetch(`${this.baseUrl}${t}`,{...i,headers:u});if(h.status===401&&a&&!s&&await this.tryRefresh(a.refreshToken))return this.requestResponse(t,e,!0);if(!h.ok){const b=await h.json().catch(()=>{});throw new z(h.status,b)}return h}async tryRefresh(t){try{const e=await fetch(`${this.baseUrl}/auth/refresh`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refreshToken:t})});if(!e.ok)return this.clearSession(),!1;const s=await e.json(),o=this.storage.getSession();return this.storage.setSession({...s,conversationId:(o==null?void 0:o.conversationId)??null,branding:(o==null?void 0:o.branding)??null}),!0}catch{return this.clearSession(),!1}}}function v(n){const t=document.createElement("div");t.className="zello-product-row";for(const e of n)t.appendChild(S(e));return t}function S(n){const t=document.createElement("div");t.className="zello-product-card";const e=document.createElement("div");e.className="zello-product-image";const s=n.images[0];if(s){const a=document.createElement("img");a.src=s,a.alt=n.title,a.loading="lazy",e.appendChild(a)}else e.classList.add("zello-product-image-placeholder");t.appendChild(e);const o=document.createElement("div");o.className="zello-product-title",o.textContent=n.title,t.appendChild(o);const i=document.createElement("div");if(i.className="zello-product-price",i.textContent=C(n.price,n.currency),t.appendChild(i),n.status==="out_of_stock"||n.stockQty<=0){const a=document.createElement("div");a.className="zello-product-badge",a.textContent="Out of stock",t.appendChild(a)}return t}function C(n,t){const e=typeof n=="string"?Number(n):n;return Number.isNaN(e)?`${t} ${n}`:`${t} ${e.toLocaleString("en-US",{maximumFractionDigits:0})}`}function g(n){return`
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
  `}const E=5,I="#B6602A",k=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>
`,B=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor"/>
  </svg>
`;function T(){return`local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}class m extends HTMLElement{constructor(e){super();r(this,"shadow");r(this,"apiClient");r(this,"conversationId",null);r(this,"messages",[]);r(this,"isOpen",!1);r(this,"isSending",!1);r(this,"lastAssistantIntent",null);r(this,"styleEl");r(this,"launcherButton");r(this,"panel");r(this,"headerEl");r(this,"headerTitleEl");r(this,"messagesEl");r(this,"inputEl");r(this,"sendButton");this.config=e,this.apiClient=new w(e.apiBaseUrl,e.tenantSlug),this.shadow=this.attachShadow({mode:"open"})}connectedCallback(){this.buildDom();const e=this.apiClient.getCachedBranding();e&&this.applyBranding(e),this.bootstrap()}buildDom(){this.styleEl=document.createElement("style"),this.styleEl.textContent=g(I),this.shadow.appendChild(this.styleEl),this.launcherButton=document.createElement("button"),this.launcherButton.className=`zello-launcher zello-position-${this.config.position}`,this.launcherButton.setAttribute("aria-label","Open chat"),this.launcherButton.innerHTML=k,this.launcherButton.addEventListener("click",()=>this.setOpen(!this.isOpen)),this.shadow.appendChild(this.launcherButton),this.panel=document.createElement("div"),this.panel.className=`zello-panel zello-position-${this.config.position}`,this.panel.setAttribute("role","dialog"),this.panel.setAttribute("aria-label","Chat with us"),this.headerEl=this.buildHeader(),this.panel.appendChild(this.headerEl),this.messagesEl=document.createElement("div"),this.messagesEl.className="zello-messages",this.panel.appendChild(this.messagesEl),this.panel.appendChild(this.buildInputRow()),this.shadow.appendChild(this.panel)}buildHeader(){const e=document.createElement("div");e.className="zello-header",this.headerTitleEl=document.createElement("div"),this.headerTitleEl.className="zello-header-title",this.headerTitleEl.textContent="Chat with us";const s=document.createElement("button");return s.className="zello-close-button",s.setAttribute("aria-label","Close chat"),s.textContent="✕",s.addEventListener("click",()=>this.setOpen(!1)),e.appendChild(this.headerTitleEl),e.appendChild(s),e}buildInputRow(){const e=document.createElement("div");return e.className="zello-input-row",this.inputEl=document.createElement("input"),this.inputEl.className="zello-input",this.inputEl.type="text",this.inputEl.placeholder="Type a message...",this.inputEl.addEventListener("keydown",s=>{s.key==="Enter"&&(s.preventDefault(),this.handleSend())}),this.sendButton=document.createElement("button"),this.sendButton.className="zello-send-button",this.sendButton.setAttribute("aria-label","Send message"),this.sendButton.innerHTML=B,this.sendButton.addEventListener("click",()=>void this.handleSend()),e.appendChild(this.inputEl),e.appendChild(this.sendButton),e}async bootstrap(){try{await this.apiClient.ensureSession();const e=this.apiClient.getCachedMessages(),s=this.apiClient.getStoredConversationId();if(e.length>0&&s){this.conversationId=s,this.messages=e,this.renderMessages(),this.onBootstrapped();return}const o=await this.apiClient.startConversation(this.config.language);this.conversationId=o.conversation.id,this.applyBranding(o.branding),this.messages=[this.toBubble(o.greeting)],this.apiClient.setCachedMessages(this.messages),this.renderMessages(),this.onBootstrapped()}catch(e){this.renderError("Sorry, we couldn't connect right now. Please refresh the page and try again."),console.error("[zello-widget] bootstrap failed",e)}}onBootstrapped(){}applyBranding(e){e.primaryColor&&(this.styleEl.textContent=g(e.primaryColor)),(e.logoUrl||e.greetingPersona)&&(this.headerTitleEl.textContent=e.greetingPersona?"Zello AI":this.headerTitleEl.textContent)}async handleSend(){this.lastAssistantIntent=null;const e=this.inputEl.value.trim();if(!e||this.isSending||!this.conversationId)return;this.isSending=!0,this.inputEl.value="",this.sendButton.disabled=!0;const s=T();this.messages.push({id:s,role:"customer",content:e,createdAt:new Date().toISOString(),pending:!0}),this.renderMessages(),this.renderTypingIndicator(!0);try{const o=await this.apiClient.postMessage(this.conversationId,e),i=this.messages.findIndex(h=>h.id===s),a=this.toBubble(o.customerMessage);i>=0?this.messages[i]=a:this.messages.push(a);const u=this.toBubble(o.assistantMessage);this.messages.push(u),this.lastAssistantIntent=o.assistantMessage.intent??{},this.apiClient.setCachedMessages(this.messages),this.attachProductResults(u)}catch(o){this.messages=this.messages.filter(i=>i.id!==s),this.renderError("That message couldn't be sent. Please try again."),console.error("[zello-widget] send message failed",o)}finally{this.isSending=!1,this.sendButton.disabled=!1,this.renderTypingIndicator(!1),this.renderMessages()}}async attachProductResults(e){var i;const s=(i=this.lastAssistantIntent)==null?void 0:i.matched_product_ids;if(!Array.isArray(s)||s.length===0)return;const o=(await Promise.all(s.slice(0,E).map(a=>this.apiClient.getProduct(String(a)).catch(()=>null)))).filter(a=>a!==null);o.length!==0&&(e.products=o,this.apiClient.setCachedMessages(this.messages),this.renderMessages())}setOpen(e,s=!0){this.isOpen=e,this.panel.classList.toggle("zello-open",e),e&&(s&&this.inputEl.focus(),this.scrollToBottom())}toBubble(e){return{id:e.id,role:e.role,content:e.content,createdAt:e.createdAt}}renderMessages(){this.messagesEl.innerHTML="";for(const e of this.messages){const s=document.createElement("div");s.className=`zello-bubble zello-bubble-${e.role==="customer"?"customer":"assistant"}`,e.pending&&s.classList.add("zello-bubble-pending"),s.textContent=e.content,this.messagesEl.appendChild(s),e.products&&e.products.length>0&&this.messagesEl.appendChild(v(e.products))}this.scrollToBottom()}renderTypingIndicator(e){const s=this.messagesEl.querySelector(".zello-typing");if(s&&s.remove(),e){const o=document.createElement("div");o.className="zello-typing",o.innerHTML="<span></span><span></span><span></span>",this.messagesEl.appendChild(o),this.scrollToBottom()}}renderError(e){const s=document.createElement("div");s.className="zello-bubble zello-bubble-assistant",s.textContent=e,this.messagesEl.appendChild(s),this.scrollToBottom()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}}customElements.define("zello-widget",m);function f(){if(document.querySelector("zello-widget"))return;const n=y(),t=new m(n);document.body.appendChild(t)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f):f()})();
