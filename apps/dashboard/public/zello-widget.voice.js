var be=Object.defineProperty;var we=(p,u,m)=>u in p?be(p,u,{enumerable:!0,configurable:!0,writable:!0,value:m}):p[u]=m;var a=(p,u,m)=>we(p,typeof u!="symbol"?u+"":u,m);(function(){"use strict";const p="https://api.zello.ai/api/v1";function u(){if(document.currentScript instanceof HTMLScriptElement)return document.currentScript;const o=Array.from(document.querySelectorAll("script[data-tenant-slug]"));return o.length>0?o[o.length-1]:null}function m(o){var e;if(o==="urdu"||o==="english"||o==="roman_urdu")return o;const i=(((e=navigator.languages)==null?void 0:e[0])||navigator.language||"").toLowerCase();return i.startsWith("ur")?"urdu":i.startsWith("hi")?"roman_urdu":"english"}function V(){var t;const o=u(),i=o==null?void 0:o.dataset.tenantSlug;if(!i)throw new Error("Zello widget: missing required data-tenant-slug attribute on the embed <script> tag.");const e=o==null?void 0:o.dataset.position;return{tenantSlug:i,apiBaseUrl:(o==null?void 0:o.dataset.apiBaseUrl)||p,language:m(o==null?void 0:o.dataset.language),position:e==="bottom-left"?"bottom-left":"bottom-right",voiceMode:(o==null?void 0:o.dataset.voiceMode)==="browser"?"browser":"auto",autoOpen:(o==null?void 0:o.dataset.autoOpen)==="true",mountTarget:o==null?void 0:o.dataset.mountTarget,storefrontPath:(t=o==null?void 0:o.dataset.storefrontPath)!=null&&t.startsWith("/store/")?o.dataset.storefrontPath:void 0}}function O(o,i){const e=i.mountTarget?document.getElementById(i.mountTarget):null;if(!e){document.body.appendChild(o);return}const t=()=>{o.toggleAttribute("data-inline",e.dataset.agentInline==="true"),o.dispatchEvent(new Event("zello:presentation"))},s=()=>{t(),e.appendChild(o)};e.dataset.agentReady==="true"?s():window.addEventListener("zello:stage-ready",s,{once:!0});const r=new MutationObserver(t);r.observe(e,{attributes:!0,attributeFilter:["data-agent-inline"]}),window.addEventListener("pagehide",()=>r.disconnect(),{once:!0})}function g(o,i){return`zello:${o}:${i}`}class R{constructor(i){this.tenantSlug=i}getSession(){const i=window.localStorage.getItem(g(this.tenantSlug,"session"));try{const e=i?JSON.parse(i):null,t=`zello.storefront.session.${this.tenantSlug}`,s=window.localStorage.getItem(t),r=s?JSON.parse(s):null;if(r!=null&&r.accessToken&&r.customerId){if((e==null?void 0:e.customerId)!==r.customerId){this.clearMessages();const n={...r,conversationId:null,branding:null};return window.localStorage.setItem(g(this.tenantSlug,"session"),JSON.stringify(n)),n}return{...e,...r,conversationId:(e==null?void 0:e.conversationId)??null,branding:(e==null?void 0:e.branding)??null}}return e&&window.localStorage.setItem(t,JSON.stringify(e)),e}catch{return null}}setSession(i){window.localStorage.setItem(g(this.tenantSlug,"session"),JSON.stringify(i));const{accessToken:e,refreshToken:t,customerId:s,tenantId:r}=i;window.localStorage.setItem(`zello.storefront.session.${this.tenantSlug}`,JSON.stringify({accessToken:e,refreshToken:t,customerId:s,tenantId:r}))}clearSession(){window.localStorage.removeItem(g(this.tenantSlug,"session")),window.localStorage.removeItem(`zello.storefront.session.${this.tenantSlug}`),window.localStorage.removeItem(`zello.storefront.cart.${this.tenantSlug}`)}setConversationId(i){const e=this.getSession();e&&this.setSession({...e,conversationId:i})}setBranding(i){const e=this.getSession();e&&this.setSession({...e,branding:i})}getMessages(){const i=window.localStorage.getItem(g(this.tenantSlug,"messages"));if(!i)return[];try{return JSON.parse(i)}catch{return[]}}setMessages(i){const e=i.slice(-100);window.localStorage.setItem(g(this.tenantSlug,"messages"),JSON.stringify(e))}clearMessages(){window.localStorage.removeItem(g(this.tenantSlug,"messages"))}}class b extends Error{constructor(i,e){super(`API request failed with status ${i}`),this.status=i,this.body=e}}class N{constructor(i,e){a(this,"storage");this.baseUrl=i,this.tenantSlug=e,this.storage=new R(e)}async ensureSession(){const i=this.storage.getSession();if(i)return{accessToken:i.accessToken,refreshToken:i.refreshToken,customerId:i.customerId,tenantId:i.tenantId};const e=await this.request("/auth/guest-session",{method:"POST",body:JSON.stringify({tenantSlug:this.tenantSlug}),skipAuth:!0}),t=this.storage.getSession();return t||(this.storage.setSession({...e,conversationId:null,branding:null}),e)}getStoredConversationId(){var i;return((i=this.storage.getSession())==null?void 0:i.conversationId)??null}getCachedBranding(){var i;return((i=this.storage.getSession())==null?void 0:i.branding)??null}async startConversation(i){const e=await this.request(`/conversations?language=${encodeURIComponent(i)}`,{method:"POST"});return this.storage.setConversationId(e.conversation.id),this.storage.setBranding(e.branding),e}async postMessage(i,e){const t=await this.request(`/conversations/${i}/messages`,{method:"POST",body:JSON.stringify({content:e,requestId:crypto.randomUUID(),cartId:window.localStorage.getItem(`zello.storefront.cart.${this.tenantSlug}`)})}),s=t.assistantMessage.intent;return s.action==="add_to_cart"&&typeof s.cart_id=="string"&&(window.localStorage.setItem(`zello.storefront.cart.${this.tenantSlug}`,s.cart_id),window.dispatchEvent(new CustomEvent("zello:cart-changed",{detail:{count:s.cart_count,slug:this.tenantSlug}}))),t}async getProduct(i){return this.request(`/catalog/storefront/products/${i}`)}async transcribeAudio(i){return(await this.request("/voice/transcriptions",{method:"POST",headers:{"Content-Type":i.type||"audio/webm"},body:i})).text}async synthesizeSpeech(i,e){return(await this.requestResponse("/voice/speech",{method:"POST",body:JSON.stringify({text:i,language:e})})).blob()}clearSession(){this.storage.clearSession(),this.storage.clearMessages()}getCachedMessages(){return this.storage.getMessages()}setCachedMessages(i){this.storage.setMessages(i)}async request(i,e={}){return await(await this.requestResponse(i,e)).json()}async requestResponse(i,e={},t=!1){const{skipAuth:s,...r}=e,n=s?null:this.storage.getSession(),l=new Headers(r.headers);l.has("Content-Type")||l.set("Content-Type","application/json"),n&&l.set("Authorization",`Bearer ${n.accessToken}`);const c=await fetch(`${this.baseUrl}${i}`,{...r,headers:l});if(c.status===401&&n&&!t&&await this.tryRefresh(n.refreshToken))return this.requestResponse(i,e,!0);if(!c.ok){const d=await c.json().catch(()=>{});throw new b(c.status,d)}return c}async tryRefresh(i){try{const e=await fetch(`${this.baseUrl}/auth/refresh`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refreshToken:i})});if(!e.ok)return this.clearSession(),!1;const t=await e.json(),s=this.storage.getSession();return this.storage.setSession({...t,conversationId:(s==null?void 0:s.conversationId)??null,branding:(s==null?void 0:s.branding)??null}),!0}catch{return this.clearSession(),!1}}}const U={english:"en-US",roman_urdu:"ur-PK",urdu:"ur-PK"},_={english:"en-US",roman_urdu:"ur-PK",urdu:"ur-PK"};function z(o){return o==="english"||o==="urdu"||o==="roman_urdu"?o:"english"}function H(o){return U[z(o)]}function $(o){return _[z(o)]}const q=2e4,D=1100,j=.025;function F(){for(const o of["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4"])if(MediaRecorder.isTypeSupported(o))return o;return""}class f{constructor(){a(this,"recorder",null);a(this,"stream",null);a(this,"audioContext",null);a(this,"animationFrame",null);a(this,"timeout",null);a(this,"aborted",!1)}static isSupported(){var i;return typeof MediaRecorder<"u"&&typeof navigator<"u"&&!!((i=navigator.mediaDevices)!=null&&i.getUserMedia)}async start(i){if(this.recorder||!f.isSupported()){i.onError("not-supported","Audio recording isn't supported in this browser.");return}try{this.aborted=!1;const e=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}});this.stream=e;const t=F(),s=new MediaRecorder(e,t?{mimeType:t}:void 0),r=[];this.recorder=s,s.ondataavailable=n=>{n.data.size>0&&r.push(n.data)},s.onerror=()=>{this.cleanup(),i.onError("unknown","The microphone recording failed. Please try again.")},s.onstop=()=>{const n=this.aborted,l=s.mimeType||t||"audio/webm";if(this.cleanup(),n)return;const c=new Blob(r,{type:l});if(c.size<200){i.onError("no-speech","I couldn't hear anything. Please try again.");return}i.onAudio(c)},s.start(250),this.startVoiceActivityDetection(e),this.timeout=setTimeout(()=>this.stop(),q)}catch(e){this.cleanup();const t=e instanceof DOMException&&(e.name==="NotAllowedError"||e.name==="SecurityError");i.onError(t?"permission-denied":"unknown",t?"Microphone access was denied.":"Could not start the microphone.")}}stop(){var i;((i=this.recorder)==null?void 0:i.state)==="recording"&&this.recorder.stop()}abort(){var i;this.aborted=!0,((i=this.recorder)==null?void 0:i.state)==="recording"?this.recorder.stop():this.cleanup()}isActive(){var i;return((i=this.recorder)==null?void 0:i.state)==="recording"}startVoiceActivityDetection(i){const e=window.AudioContext;if(!e)return;const t=new e,s=t.createAnalyser();s.fftSize=512,t.createMediaStreamSource(i).connect(s);const r=new Uint8Array(s.fftSize);let n=!1,l=performance.now();const c=()=>{if(!this.isActive())return;s.getByteTimeDomainData(r);let d=0;for(const ve of r){const M=(ve-128)/128;d+=M*M}const h=Math.sqrt(d/r.length),I=performance.now();if(h>=j)n=!0,l=I;else if(n&&I-l>=D){this.stop();return}this.animationFrame=requestAnimationFrame(c)};this.audioContext=t,this.animationFrame=requestAnimationFrame(c)}cleanup(){var i,e;this.animationFrame!==null&&cancelAnimationFrame(this.animationFrame),this.timeout!==null&&clearTimeout(this.timeout),(i=this.stream)==null||i.getTracks().forEach(t=>t.stop()),(e=this.audioContext)==null||e.close(),this.animationFrame=null,this.timeout=null,this.stream=null,this.audioContext=null,this.recorder=null}}class G{constructor(){a(this,"audio",null);a(this,"objectUrl",null)}async play(i,e){this.stop();const t=URL.createObjectURL(i),s=new Audio(t);this.objectUrl=t,this.audio=s,s.onplay=()=>{var r;return(r=e.onStart)==null?void 0:r.call(e)},s.onended=()=>{this.cleanup(),e.onEnd()},s.onerror=()=>{this.cleanup(),e.onError("synthesis-failed","The generated voice reply could not be played.")};try{await s.play()}catch{this.cleanup(),e.onError("synthesis-failed","The browser blocked voice playback.")}}pause(){var i;(i=this.audio)==null||i.pause()}resume(){var i;(i=this.audio)==null||i.play()}stop(){this.audio&&(this.audio.onplay=null,this.audio.onended=null,this.audio.onerror=null,this.audio.pause(),this.audio.currentTime=0),this.cleanup()}isSpeaking(){return!!this.audio&&!this.audio.paused&&!this.audio.ended}isPaused(){return!!this.audio&&this.audio.paused&&this.audio.currentTime>0&&!this.audio.ended}cleanup(){this.objectUrl&&URL.revokeObjectURL(this.objectUrl),this.objectUrl=null,this.audio=null}}function E(){const o=window;return o.SpeechRecognition??o.webkitSpeechRecognition??null}function w(){return E()!==null}const J=15e3;class Y{constructor(){a(this,"recognition",null);a(this,"timeoutHandle",null);a(this,"active",!1)}start(i,e){if(this.active)return;const t=E();if(!t){e.onError("not-supported","Speech recognition isn't supported in this browser.");return}const s=new t;s.lang=i,s.continuous=!1,s.interimResults=!0,s.maxAlternatives=1;let r="";s.onresult=n=>{for(let l=n.resultIndex;l<n.results.length;l++){const c=n.results[l],d=c==null?void 0:c[0];!c||!d||(c.isFinal?(r+=d.transcript,e.onResult(r.trim(),!0)):e.onResult((r+d.transcript).trim(),!1))}},s.onerror=n=>{const l=n.error==="not-allowed"||n.error==="service-not-allowed"?"permission-denied":n.error==="no-speech"?"no-speech":n.error==="network"?"network":n.error==="aborted"?"aborted":"unknown";e.onError(l,n.message||`Speech recognition error: ${n.error}`)},s.onend=()=>{this.clearTimeout(),this.active=!1,this.recognition=null,e.onEnd()},this.recognition=s,this.active=!0,this.timeoutHandle=setTimeout(()=>{this.stop()},J);try{s.start()}catch{this.clearTimeout(),this.active=!1,this.recognition=null,e.onError("unknown","Could not start voice recognition. Please try again.")}}stop(){var i;this.clearTimeout(),(i=this.recognition)==null||i.stop()}abort(){var i;this.clearTimeout(),(i=this.recognition)==null||i.abort(),this.active=!1,this.recognition=null}isActive(){return this.active}clearTimeout(){this.timeoutHandle!==null&&(clearTimeout(this.timeoutHandle),this.timeoutHandle=null)}}function S(){return typeof window<"u"&&"speechSynthesis"in window}function W(o){var r;const i=window.speechSynthesis.getVoices();if(i.length===0)return null;const e=i.find(n=>n.lang.toLowerCase()===o.toLowerCase());if(e)return e;const t=(r=o.split("-")[0])==null?void 0:r.toLowerCase();return(t?i.find(n=>n.lang.toLowerCase().startsWith(t)):void 0)??null}async function K(){window.speechSynthesis.getVoices().length>0||await new Promise(o=>{const i=setTimeout(o,1e3);window.speechSynthesis.addEventListener("voiceschanged",()=>{clearTimeout(i),o()},{once:!0})})}class Z{async speak(i,e,t){if(!S()){t.onError("not-supported","Voice playback isn't supported in this browser.");return}if(!i.trim()){t.onEnd();return}window.speechSynthesis.cancel(),await K();const s=new SpeechSynthesisUtterance(i);s.lang=e;const r=W(e);r&&(s.voice=r),s.onstart=()=>{var n;return(n=t.onStart)==null?void 0:n.call(t)},s.onend=()=>t.onEnd(),s.onerror=n=>{if(n.error==="interrupted"||n.error==="canceled"){t.onEnd();return}t.onError("synthesis-failed",`Speech synthesis error: ${n.error}`)},window.speechSynthesis.speak(s)}pause(){window.speechSynthesis.speaking&&!window.speechSynthesis.paused&&window.speechSynthesis.pause()}resume(){window.speechSynthesis.paused&&window.speechSynthesis.resume()}stop(){window.speechSynthesis.cancel()}isSpeaking(){return window.speechSynthesis.speaking}isPaused(){return window.speechSynthesis.paused}}const y={voiceEnabled:!0,muted:!1};function k(o){return`zello:${o}:voice-prefs`}function C(o){return`zello:${o}:proactive-prompt-shown`}function X(o){const i=window.localStorage.getItem(k(o));if(!i)return{...y};try{return{...y,...JSON.parse(i)}}catch{return{...y}}}function B(o,i){window.localStorage.setItem(k(o),JSON.stringify(i))}function Q(o){return window.sessionStorage.getItem(C(o))==="1"}function ee(o){window.sessionStorage.setItem(C(o),"1")}function te(o,i){const e=document.createElement("div");e.className="zello-product-row";for(const t of o)e.appendChild(ie(t,i));return e}function ie(o,i){const e=document.createElement("div");e.className="zello-product-card";const t=document.createElement("div");t.className="zello-product-image";const s=o.images[0];if(s){const l=document.createElement("img");l.src=s,l.alt=o.title,l.loading="lazy",t.appendChild(l)}else t.classList.add("zello-product-image-placeholder");e.appendChild(t);const r=document.createElement("div");r.className="zello-product-title",r.textContent=o.title,e.appendChild(r);const n=document.createElement("div");if(n.className="zello-product-price",n.textContent=se(o.price,o.currency),e.appendChild(n),i){const l=document.createElement("button");l.type="button",l.className="zello-action",l.textContent="Add to cart",l.setAttribute("aria-label",`Add ${o.title} to cart`),l.disabled=o.status!=="active"||o.stockQty<=0,l.addEventListener("click",()=>i(o)),e.appendChild(l)}if(o.status==="out_of_stock"||o.stockQty<=0){const l=document.createElement("div");l.className="zello-product-badge",l.textContent="Out of stock",e.appendChild(l)}return e}function se(o,i){const e=typeof o=="string"?Number(o):o;return Number.isNaN(e)?`${i} ${o}`:`${i} ${e.toLocaleString("en-US",{maximumFractionDigits:0})}`}function T(o){return`
    :host {
      --zello-primary: ${o};
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
  `}const oe=5,ne="#B6602A",re=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>
`,ae=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor"/>
  </svg>
`;function le(){return`local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}class ce extends HTMLElement{constructor(e){super();a(this,"shadow");a(this,"apiClient");a(this,"conversationId",null);a(this,"messages",[]);a(this,"isOpen",!1);a(this,"isSending",!1);a(this,"lastAssistantIntent",null);a(this,"styleEl");a(this,"launcherButton");a(this,"panel");a(this,"headerEl");a(this,"headerTitleEl");a(this,"messagesEl");a(this,"inputEl");a(this,"sendButton");this.config=e,this.apiClient=new N(e.apiBaseUrl,e.tenantSlug),this.shadow=this.attachShadow({mode:"open"})}connectedCallback(){this.buildDom(),this.addEventListener("zello:presentation",()=>{const t=this.hasAttribute("data-inline");this.panel.setAttribute("role",t?"region":"dialog"),this.setOpen(t,!1)});const e=this.apiClient.getCachedBranding();e&&this.applyBranding(e),this.bootstrap()}buildDom(){if(this.styleEl=document.createElement("style"),this.styleEl.textContent=T(ne),this.shadow.appendChild(this.styleEl),this.launcherButton=document.createElement("button"),this.launcherButton.className=`zello-launcher zello-position-${this.config.position}`,this.launcherButton.setAttribute("aria-label","Open chat"),this.launcherButton.innerHTML=re,this.launcherButton.addEventListener("click",()=>this.setOpen(!this.isOpen)),this.shadow.appendChild(this.launcherButton),this.panel=document.createElement("div"),this.panel.className=`zello-panel zello-position-${this.config.position}`,this.panel.setAttribute("role",this.hasAttribute("data-inline")?"region":"dialog"),this.panel.setAttribute("aria-label","Zello AI sales agent"),this.headerEl=this.buildHeader(),this.panel.appendChild(this.headerEl),this.messagesEl=document.createElement("div"),this.messagesEl.className="zello-messages",this.panel.appendChild(this.messagesEl),this.panel.appendChild(this.buildInputRow()),this.config.storefrontPath){const e=document.createElement("nav");e.className="zello-shopping-links";for(const[t,s]of[["Review cart","/cart"],["Checkout","/checkout"]]){const r=document.createElement("a");r.textContent=t,r.href=`${this.config.storefrontPath}${s}`,e.appendChild(r)}this.panel.appendChild(e)}this.shadow.appendChild(this.panel)}buildHeader(){const e=document.createElement("div");e.className="zello-header",this.headerTitleEl=document.createElement("div"),this.headerTitleEl.className="zello-header-title",this.headerTitleEl.textContent="Zello AI · Sales Agent";const t=document.createElement("button");return t.className="zello-close-button",t.setAttribute("aria-label","Close chat"),t.textContent="✕",t.addEventListener("click",()=>this.setOpen(!1)),e.appendChild(this.headerTitleEl),e.appendChild(t),e}buildInputRow(){const e=document.createElement("div");return e.className="zello-input-row",this.inputEl=document.createElement("input"),this.inputEl.className="zello-input",this.inputEl.type="text",this.inputEl.placeholder="Kya chahiye? Budget, colour aur size batayein…",this.inputEl.setAttribute("aria-label","Message Zello"),this.inputEl.addEventListener("keydown",t=>{t.key==="Enter"&&(t.preventDefault(),this.handleSend())}),this.sendButton=document.createElement("button"),this.sendButton.className="zello-send-button",this.sendButton.setAttribute("aria-label","Send message"),this.sendButton.innerHTML=ae,this.sendButton.addEventListener("click",()=>void this.handleSend()),e.appendChild(this.inputEl),e.appendChild(this.sendButton),e}async bootstrap(){try{await this.apiClient.ensureSession();const e=this.apiClient.getCachedMessages(),t=this.apiClient.getStoredConversationId();if(e.length>0&&t){this.conversationId=t,this.messages=e,this.renderMessages(),this.onBootstrapped();return}const s=await this.apiClient.startConversation(this.config.language);this.conversationId=s.conversation.id,this.applyBranding(s.branding),this.messages=[this.toBubble(s.greeting)],this.apiClient.setCachedMessages(this.messages),this.renderMessages(),this.onBootstrapped()}catch(e){this.renderError("Sorry, we couldn't connect right now. Please refresh the page and try again."),console.error("[zello-widget] bootstrap failed",e)}}onBootstrapped(){}applyBranding(e){e.primaryColor&&(this.styleEl.textContent=T(e.primaryColor)),(e.logoUrl||e.greetingPersona)&&(this.headerTitleEl.textContent=e.greetingPersona?"Zello AI":this.headerTitleEl.textContent)}async handleSend(){this.lastAssistantIntent=null;const e=this.inputEl.value.trim();if(!e||this.isSending||!this.conversationId)return;this.isSending=!0,this.inputEl.value="",this.sendButton.disabled=!0;const t=le();this.messages.push({id:t,role:"customer",content:e,createdAt:new Date().toISOString(),pending:!0}),this.renderMessages(),this.renderTypingIndicator(!0);try{const s=await this.apiClient.postMessage(this.conversationId,e),r=this.messages.findIndex(c=>c.id===t),n=this.toBubble(s.customerMessage);r>=0?this.messages[r]=n:this.messages.push(n);const l=this.toBubble(s.assistantMessage);this.messages.push(l),this.lastAssistantIntent=s.assistantMessage.intent??{},this.apiClient.setCachedMessages(this.messages),this.attachProductResults(l)}catch(s){this.messages=this.messages.filter(r=>r.id!==t),this.renderError("That message couldn't be sent. Please try again."),console.error("[zello-widget] send message failed",s)}finally{this.isSending=!1,this.sendButton.disabled=!1,this.renderTypingIndicator(!1),this.renderMessages()}}async attachProductResults(e){var r;const t=(r=this.lastAssistantIntent)==null?void 0:r.matched_product_ids;if(!Array.isArray(t)||t.length===0)return;const s=(await Promise.all(t.slice(0,oe).map(n=>this.apiClient.getProduct(String(n)).catch(()=>null)))).filter(n=>n!==null);s.length!==0&&(e.products=s,this.apiClient.setCachedMessages(this.messages),this.renderMessages())}setOpen(e,t=!0){this.isOpen=e,this.panel.classList.toggle("zello-open",e),e&&(t&&this.inputEl.focus(),this.scrollToBottom())}toBubble(e){return{id:e.id,role:e.role,content:e.content,createdAt:e.createdAt}}renderMessages(){this.messagesEl.innerHTML="";const e=[...this.messages].reverse().find(t=>{var s;return(s=t.products)==null?void 0:s.length});for(const t of this.messages){const s=document.createElement("div");if(s.className=`zello-bubble zello-bubble-${t.role==="customer"?"customer":"assistant"}`,t.pending&&s.classList.add("zello-bubble-pending"),s.textContent=t.content,this.messagesEl.appendChild(s),t.products&&t.products.length>0){const r=t===e&&!this.isSending;if(this.messagesEl.appendChild(te(t.products,r?n=>{this.sendSuggestedMessage(`${n.title} ka ek piece cart mein add karo.`)}:void 0)),r){const n=document.createElement("div");n.className="zello-suggestions";const l=[["Recommend for me","In options mein meri zaroorat aur budget ke liye kaunsa behtar hai? Wajah bhi batao."],...t.products.length>1?[["Compare options","In options ko price aur available features ke hisaab se compare karo."]]:[]];for(const[c,d]of l){const h=document.createElement("button");h.type="button",h.className="zello-action",h.textContent=c,h.addEventListener("click",()=>this.sendSuggestedMessage(d)),n.appendChild(h)}this.messagesEl.appendChild(n)}}}this.scrollToBottom()}sendSuggestedMessage(e){this.isSending||(this.inputEl.value=e,this.handleSend())}renderTypingIndicator(e){const t=this.messagesEl.querySelector(".zello-typing");if(t&&t.remove(),e){const s=document.createElement("div");s.className="zello-typing",s.innerHTML="<span></span><span></span><span></span>",this.messagesEl.appendChild(s),this.scrollToBottom()}}renderError(e){const t=document.createElement("div");t.className="zello-bubble zello-bubble-assistant",t.textContent=e,this.messagesEl.appendChild(t),this.scrollToBottom()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}}function de(){return`
    .zello-greeting-button {
      margin: 8px 16px; padding: 12px 16px; border: none; border-radius: 12px;
      background: var(--zello-primary); color: white; cursor: pointer; font-weight: 600;
    }
    :host([data-inline]) .zello-mic-button {
      width: 52px; height: 52px; background: #26392f; color: white;
    }
    :host([data-inline]) .zello-mic-button.zello-mic-listening { background: #d64545; }
    .zello-mic-button,
    .zello-pause-button {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: var(--zello-ink-soft);
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .zello-mic-button:hover:not(:disabled),
    .zello-pause-button:hover:not(:disabled) {
      background: var(--zello-surface-alt);
    }
    .zello-mic-button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .zello-mic-button svg,
    .zello-pause-button svg {
      width: 20px;
      height: 20px;
    }

    .zello-mic-listening {
      color: #ffffff;
      background: #d64545;
      animation: zello-mic-pulse 1.4s ease-in-out infinite;
    }
    .zello-mic-listening:hover { background: #c23b3b; }

    .zello-mic-processing svg {
      animation: zello-mic-spin 1s linear infinite;
    }

    .zello-mic-speaking {
      color: #ffffff;
      background: var(--zello-primary);
    }

    .zello-mic-error {
      color: #d64545;
    }

    @keyframes zello-mic-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(214, 69, 69, 0.35); }
      50% { box-shadow: 0 0 0 8px rgba(214, 69, 69, 0); }
    }
    @keyframes zello-mic-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .zello-voice-status {
      display: none;
      align-items: center;
      gap: 6px;
      padding: 2px 16px 8px;
      font-size: 12px;
      color: var(--zello-ink-soft);
      flex: 0 0 auto;
    }
    .zello-voice-status-visible {
      display: flex;
    }
    .zello-voice-status-error {
      color: #d64545;
    }
    .zello-voice-disclosure {
      padding: 4px 16px 2px;
      font-size: 10px;
      color: var(--zello-ink-soft);
      text-align: center;
      flex: 0 0 auto;
    }

    .zello-header-icon-button {
      background: transparent;
      border: none;
      color: var(--zello-primary-ink);
      cursor: pointer;
      padding: 4px;
      opacity: 0.85;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }
    .zello-header-icon-button:hover {
      opacity: 1;
    }
    .zello-header-icon-button svg {
      width: 18px;
      height: 18px;
    }

    .zello-launcher-attention {
      animation: zello-launcher-bounce 1.8s ease-in-out infinite;
    }
    @keyframes zello-launcher-bounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }

    .zello-proactive-bubble {
      position: fixed;
      bottom: 92px;
      z-index: 2147483000;
      width: 240px;
      max-width: calc(100vw - 40px);
      background: var(--zello-surface);
      color: var(--zello-ink);
      border-radius: 14px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
      padding: 14px 18px 12px 16px;
      cursor: pointer;
      animation: zello-proactive-in 0.25s ease;
    }
    .zello-proactive-bubble.zello-position-bottom-right { right: 20px; }
    .zello-proactive-bubble.zello-position-bottom-left { left: 20px; }
    @keyframes zello-proactive-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .zello-proactive-dismiss {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 22px;
      height: 22px;
      background: transparent;
      border: none;
      color: var(--zello-ink-soft);
      cursor: pointer;
      font-size: 12px;
      border-radius: 50%;
    }
    .zello-proactive-dismiss:hover {
      background: var(--zello-surface-alt);
    }
    .zello-proactive-text {
      font-size: 13px;
      line-height: 1.45;
      color: var(--zello-ink);
      padding-right: 12px;
    }
    .zello-proactive-hint {
      margin-top: 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--zello-primary);
    }
  `}const v=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19 11a7 7 0 01-14 0M12 19v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`,ue=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 15a3 3 0 003-3V6a3 3 0 00-5.94-.7M9 9.35V12a3 3 0 004.6 2.54" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19 11a7 7 0 01-1.13 3.82M6.16 6.16A7 7 0 0019 11M12 19v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`,A=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
  </svg>
`,x=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/>
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>
  </svg>
`,he=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5v14l11-7z" fill="currentColor"/>
  </svg>
`,pe=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"/>
    <path d="M15.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`,ge=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"/>
    <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`,me=45e3,fe=4e3;class L extends ce{constructor(e){super(e);a(this,"recognizer",new Y);a(this,"speaker",new Z);a(this,"serverRecorder",new f);a(this,"serverSpeaker",new G);a(this,"voiceSupported");a(this,"serverTranscriptionUnavailable",!1);a(this,"serverSpeechUnavailable",!1);a(this,"activeSpeaker",null);a(this,"speechRequestId",0);a(this,"tenantSlug");a(this,"position");a(this,"voicePrefs");a(this,"voiceState","idle");a(this,"lastReplyLanguage");a(this,"greetingText","");a(this,"greetingStarted",!1);a(this,"autoOpen");a(this,"greetingButton",null);a(this,"voiceStyleEl");a(this,"voiceStatusEl");a(this,"micButton");a(this,"pauseButton");a(this,"muteButton");a(this,"voiceToggleButton");a(this,"proactiveBubble",null);a(this,"proactiveTimer",null);a(this,"audioUnlocked",!1);a(this,"unlockAudio",()=>{this.audioUnlocked=!0,this.tryAutoGreet()});this.tenantSlug=e.tenantSlug,this.position=e.position,this.autoOpen=e.autoOpen===!0,this.lastReplyLanguage=e.language,this.serverTranscriptionUnavailable=e.voiceMode==="browser",this.serverSpeechUnavailable=e.voiceMode==="browser",this.voiceSupported=f.isSupported()||w()&&S(),this.voicePrefs=X(this.tenantSlug)}connectedCallback(){if(super.connectedCallback(),this.addVoiceStyles(),this.addVoiceControls(),this.addHeaderControls(),this.autoOpen&&(!this.hasMountTarget()||this.hasAttribute("data-inline"))&&this.setOpen(!0,!1),this.launcherButton.addEventListener("click",()=>this.handleLauncherToggled()),this.voiceSupported){const e={once:!0,capture:!0,passive:!0};window.addEventListener("pointerdown",this.unlockAudio,e),window.addEventListener("keydown",this.unlockAudio,e),window.addEventListener("touchstart",this.unlockAudio,e),window.addEventListener("scroll",this.unlockAudio,e)}}disconnectedCallback(){this.recognizer.abort(),this.serverRecorder.abort(),this.stopSpeech(),this.proactiveTimer!==null&&clearTimeout(this.proactiveTimer),window.removeEventListener("pointerdown",this.unlockAudio,!0),window.removeEventListener("keydown",this.unlockAudio,!0),window.removeEventListener("touchstart",this.unlockAudio,!0),window.removeEventListener("scroll",this.unlockAudio,!0)}onBootstrapped(){var t;if(this.hasMountTarget()&&!this.hasAttribute("data-inline"))return;if(this.autoOpen){this.greetingText=((t=this.messages.find(s=>s.role==="assistant"))==null?void 0:t.content)??"",this.voicePrefs.voiceEnabled&&!this.voicePrefs.muted&&this.greetingText&&(this.showGreetingButton(),this.startVoiceGreeting(!1));return}if(!this.voicePrefs.voiceEnabled||Q(this.tenantSlug))return;const e=this.messages.find(s=>s.role==="assistant");this.greetingText=(e==null?void 0:e.content)??"Hello! How can I help you today?",this.proactiveTimer=setTimeout(()=>{this.isOpen||this.showProactivePrompt(this.greetingText)},fe),this.tryAutoGreet()}tryAutoGreet(){this.greetingStarted||!this.audioUnlocked||!this.greetingText||(this.autoOpen?!this.isOpen:this.isOpen)||!this.voicePrefs.voiceEnabled||this.voicePrefs.muted||(this.autoOpen||this.showProactivePrompt(this.greetingText),this.startVoiceGreeting(!1))}hasMountTarget(){var e;return((e=this.parentElement)==null?void 0:e.id)==="zello-agent-stage"}showGreetingButton(){if(this.greetingButton)return;const e=document.createElement("button");e.type="button",e.textContent="Shuru karein — greeting sunein",e.className="zello-greeting-button",e.addEventListener("click",()=>{!this.voicePrefs.voiceEnabled||this.voicePrefs.muted||(this.stopSpeech(),this.greetingStarted=!1,this.startVoiceGreeting(!1))}),this.panel.insertBefore(e,this.voiceStatusEl),this.greetingButton=e}canAutoplayAudio(){const e=navigator.userActivation;return(e==null?void 0:e.hasBeenActive)===!0}startVoiceGreeting(e){if(this.greetingStarted)return;if(this.greetingStarted=!0,!(this.voiceSupported&&this.voicePrefs.voiceEnabled&&!this.voicePrefs.muted&&!!this.greetingText)){e&&this.maybeAutoListen();return}this.setVoiceState("speaking"),this.speakText(this.greetingText,this.lastReplyLanguage,{onEnd:()=>{var s;(s=this.greetingButton)==null||s.remove(),this.greetingButton=null,this.voiceState==="speaking"&&this.setVoiceState("idle"),e&&this.maybeAutoListen()},onError:()=>{this.autoOpen&&(this.greetingStarted=!1,this.showGreetingButton()),this.voiceState==="speaking"&&this.setVoiceState("idle"),e&&this.maybeAutoListen()}})}addVoiceStyles(){this.voiceStyleEl=document.createElement("style"),this.voiceStyleEl.textContent=de(),this.shadow.appendChild(this.voiceStyleEl)}addVoiceControls(){const e=this.shadow.querySelector(".zello-input-row");if(!e)return;this.voiceStatusEl=document.createElement("div"),this.voiceStatusEl.className="zello-voice-status",this.voiceStatusEl.setAttribute("role","status"),this.voiceStatusEl.setAttribute("aria-live","polite");const t=document.createElement("div");t.className="zello-voice-disclosure",t.textContent="Voice replies are AI-generated.",this.panel.insertBefore(t,e),this.panel.insertBefore(this.voiceStatusEl,e),this.pauseButton=document.createElement("button"),this.pauseButton.type="button",this.pauseButton.className="zello-pause-button zello-hidden",this.pauseButton.innerHTML=x,this.pauseButton.setAttribute("aria-label","Pause speaking"),this.pauseButton.addEventListener("click",()=>this.handlePauseClick()),this.micButton=document.createElement("button"),this.micButton.type="button",this.micButton.className="zello-mic-button",this.micButton.innerHTML=v,this.voiceSupported?(this.micButton.setAttribute("aria-label","Start voice input"),this.micButton.addEventListener("click",()=>this.handleMicClick())):(this.micButton.disabled=!0,this.micButton.title="Voice isn't supported in this browser",this.micButton.setAttribute("aria-label","Voice input unavailable in this browser")),e.insertBefore(this.pauseButton,this.sendButton),e.insertBefore(this.micButton,this.sendButton),this.updateMicButtonVisibility()}addHeaderControls(){this.muteButton=document.createElement("button"),this.muteButton.type="button",this.muteButton.className="zello-header-icon-button",this.muteButton.addEventListener("click",()=>this.toggleMute()),this.updateMuteButton(),this.voiceToggleButton=document.createElement("button"),this.voiceToggleButton.type="button",this.voiceToggleButton.className="zello-header-icon-button",this.voiceToggleButton.addEventListener("click",()=>this.toggleVoiceEnabled()),this.updateVoiceToggleButton();const e=this.headerEl.querySelector(".zello-close-button");this.headerEl.insertBefore(this.voiceToggleButton,e),this.headerEl.insertBefore(this.muteButton,e)}handleLauncherToggled(){if(this.dismissProactivePrompt(),!this.isOpen){this.recognizer.abort(),this.serverRecorder.abort(),this.stopSpeech(),this.voiceState!=="idle"&&this.setVoiceState("idle");return}this.greetingStarted?this.maybeAutoListen():this.startVoiceGreeting(!0)}maybeAutoListen(){this.voiceSupported&&this.voicePrefs.voiceEnabled&&this.voiceState==="idle"&&this.startListening()}showProactivePrompt(e){if(this.proactiveBubble)return;this.proactiveTimer!==null&&(clearTimeout(this.proactiveTimer),this.proactiveTimer=null);const t=document.createElement("div");t.className=`zello-proactive-bubble zello-position-${this.position}`,t.setAttribute("role","button"),t.setAttribute("tabindex","0");const s=document.createElement("button");s.type="button",s.className="zello-proactive-dismiss",s.setAttribute("aria-label","Dismiss"),s.textContent="✕",s.addEventListener("click",l=>{l.stopPropagation(),this.dismissProactivePrompt()});const r=document.createElement("div");r.className="zello-proactive-text",r.textContent=e;const n=document.createElement("div");n.className="zello-proactive-hint",n.textContent=this.voiceSupported?"🎤 Tap to talk":"💬 Tap to chat",t.appendChild(s),t.appendChild(r),t.appendChild(n),t.addEventListener("click",()=>{this.dismissProactivePrompt(),this.setOpen(!0),this.startVoiceGreeting(!0)}),this.shadow.appendChild(t),this.proactiveBubble=t,this.launcherButton.classList.add("zello-launcher-attention"),ee(this.tenantSlug),(this.audioUnlocked||this.canAutoplayAudio())&&this.startVoiceGreeting(!1)}dismissProactivePrompt(){var e;this.proactiveTimer!==null&&(clearTimeout(this.proactiveTimer),this.proactiveTimer=null),(e=this.proactiveBubble)==null||e.remove(),this.proactiveBubble=null,this.launcherButton.classList.remove("zello-launcher-attention")}handleMicClick(){if(this.voicePrefs.voiceEnabled)switch(this.voiceState){case"listening":this.recognizer.stop(),this.serverRecorder.stop();return;case"speaking":this.stopSpeech(),this.setVoiceState("idle"),this.startListening();return;case"processing":return;case"idle":case"error":this.startListening()}}startListening(){if(this.setVoiceState("listening"),f.isSupported()&&!this.serverTranscriptionUnavailable){this.serverRecorder.start({onAudio:e=>{this.setVoiceState("processing"),this.transcribeAndSend(e)},onError:(e,t)=>{if(e==="no-speech"||e==="aborted"){this.setVoiceState("idle");return}this.setVoiceState("error",this.describeVoiceError(e,t))}});return}this.startBrowserListening()}startBrowserListening(){if(!w()){this.setVoiceState("error","Voice transcription is unavailable right now.");return}const e=H(this.lastReplyLanguage);this.recognizer.start(e,{onResult:(t,s)=>{this.inputEl.value=t,s&&t&&(this.setVoiceState("processing"),this.sendVoiceMessage(t))},onError:(t,s)=>{if(t==="no-speech"||t==="aborted"){this.setVoiceState("idle");return}this.setVoiceState("error",this.describeVoiceError(t,s))},onEnd:()=>{this.voiceState==="listening"&&this.setVoiceState("idle")}})}async transcribeAndSend(e){try{const t=(await this.apiClient.transcribeAudio(e)).trim();if(!t){this.setVoiceState("error","I couldn't hear that clearly. Please try again.");return}this.inputEl.value=t,await this.sendVoiceMessage(t)}catch(t){t instanceof b&&t.status===503&&(this.serverTranscriptionUnavailable=!0),this.setVoiceState("error",w()?"Server transcription is unavailable. Tap the mic to retry with browser speech.":"Voice transcription is temporarily unavailable. Please type your message.")}}async sendVoiceMessage(e){this.inputEl.value=e;const t=Symbol("timed-out");if(await Promise.race([this.handleSend().then(()=>"sent"),new Promise(l=>{setTimeout(()=>l(t),me)})])===t){this.setVoiceState("error","That's taking longer than expected. Please try again in a moment.");return}if(this.lastAssistantIntent===null){this.setVoiceState("error","That message couldn't be sent. Please check your connection and try again.");return}const r=typeof this.lastAssistantIntent.detected_language=="string"?this.lastAssistantIntent.detected_language:this.lastReplyLanguage;this.lastReplyLanguage=r;const n=this.messages[this.messages.length-1];this.speakReply((n==null?void 0:n.content)??"")}speakReply(e){if(this.voicePrefs.muted||!this.voicePrefs.voiceEnabled){this.setVoiceState("idle"),this.maybeAutoListen();return}this.setVoiceState("speaking"),this.speakText(e,this.lastReplyLanguage,{onEnd:()=>{this.voiceState==="speaking"&&(this.setVoiceState("idle"),this.maybeAutoListen())},onError:(t,s)=>this.setVoiceState("error",this.describeVoiceError(t,s))})}async speakText(e,t,s){const r=++this.speechRequestId,n=()=>{r===this.speechRequestId&&(this.activeSpeaker=null,s.onEnd())},l=(d,h)=>{r===this.speechRequestId&&(this.activeSpeaker=null,s.onError(d,h))};if(!this.serverSpeechUnavailable)try{const d=await this.apiClient.synthesizeSpeech(e,t);if(r!==this.speechRequestId)return;this.activeSpeaker="server",await this.serverSpeaker.play(d,{onEnd:n,onError:l});return}catch(d){d instanceof b&&d.status===503&&(this.serverSpeechUnavailable=!0)}if(!S()){l("not-supported","Voice playback isn't supported in this browser.");return}if(r!==this.speechRequestId)return;this.activeSpeaker="browser";const c=$(t);await this.speaker.speak(e,c,{onEnd:n,onError:l})}handlePauseClick(){const e=this.activeSpeaker==="server"?this.serverSpeaker:this.speaker;e.isPaused()?(e.resume(),this.pauseButton.innerHTML=x,this.pauseButton.setAttribute("aria-label","Pause speaking")):(e.pause(),this.pauseButton.innerHTML=he,this.pauseButton.setAttribute("aria-label","Resume speaking"))}stopSpeech(){this.speechRequestId+=1,this.activeSpeaker=null,this.speaker.stop(),this.serverSpeaker.stop()}toggleMute(){this.voicePrefs={...this.voicePrefs,muted:!this.voicePrefs.muted},B(this.tenantSlug,this.voicePrefs),this.voicePrefs.muted&&this.voiceState==="speaking"&&(this.stopSpeech(),this.setVoiceState("idle")),this.updateMuteButton()}updateMuteButton(){this.muteButton.innerHTML=this.voicePrefs.muted?ge:pe;const e=this.voicePrefs.muted?"Unmute voice replies":"Mute voice replies";this.muteButton.setAttribute("aria-label",e),this.muteButton.title=e}toggleVoiceEnabled(){this.voicePrefs={...this.voicePrefs,voiceEnabled:!this.voicePrefs.voiceEnabled},B(this.tenantSlug,this.voicePrefs),this.voicePrefs.voiceEnabled||(this.recognizer.abort(),this.serverRecorder.abort(),this.stopSpeech(),this.setVoiceState("idle"),this.dismissProactivePrompt()),this.updateVoiceToggleButton(),this.updateMicButtonVisibility()}updateVoiceToggleButton(){this.voiceToggleButton.innerHTML=this.voicePrefs.voiceEnabled?v:ue;const e=this.voicePrefs.voiceEnabled?"Turn voice off":"Turn voice on";this.voiceToggleButton.setAttribute("aria-label",e),this.voiceToggleButton.title=e}updateMicButtonVisibility(){const e=this.voiceSupported&&this.voicePrefs.voiceEnabled;this.micButton.classList.toggle("zello-hidden",!e),e||this.pauseButton.classList.add("zello-hidden")}describeVoiceError(e,t){switch(e){case"permission-denied":return"Microphone access was denied. Please allow microphone access in your browser settings and try again.";case"network":return"A network problem interrupted voice recognition. Please try again.";case"not-supported":return"Voice isn't supported in this browser.";case"synthesis-failed":return"Couldn't play the voice reply. You can still read the response above.";case"transcription-failed":return"I couldn't understand that audio. Please try again.";default:return t||"Something went wrong with voice. Please try again."}}setVoiceState(e,t){switch(this.voiceState=e,this.micButton.classList.remove("zello-mic-listening","zello-mic-processing","zello-mic-speaking","zello-mic-error"),this.voiceStatusEl.classList.remove("zello-voice-status-visible","zello-voice-status-error"),this.voiceStatusEl.textContent="",this.pauseButton.classList.add("zello-hidden"),this.micButton.disabled=!this.voiceSupported||!this.voicePrefs.voiceEnabled,e){case"listening":this.micButton.classList.add("zello-mic-listening"),this.micButton.innerHTML=A,this.micButton.setAttribute("aria-label","Stop listening"),this.voiceStatusEl.textContent="Listening…",this.voiceStatusEl.classList.add("zello-voice-status-visible");break;case"processing":this.micButton.classList.add("zello-mic-processing"),this.micButton.disabled=!0,this.micButton.innerHTML=v,this.voiceStatusEl.textContent="Thinking…",this.voiceStatusEl.classList.add("zello-voice-status-visible");break;case"speaking":this.micButton.classList.add("zello-mic-speaking"),this.micButton.innerHTML=A,this.micButton.setAttribute("aria-label","Stop speaking"),this.voiceSupported&&this.voicePrefs.voiceEnabled&&this.pauseButton.classList.remove("zello-hidden"),this.pauseButton.innerHTML=x,this.pauseButton.setAttribute("aria-label","Pause speaking"),this.voiceStatusEl.textContent="Speaking…",this.voiceStatusEl.classList.add("zello-voice-status-visible");break;case"error":this.micButton.classList.add("zello-mic-error"),this.micButton.innerHTML=v,this.micButton.setAttribute("aria-label","Start voice input"),this.voiceStatusEl.textContent=t??"Something went wrong.",this.voiceStatusEl.classList.add("zello-voice-status-visible","zello-voice-status-error");break;case"idle":default:this.micButton.innerHTML=v,this.micButton.setAttribute("aria-label","Start voice input");break}}}customElements.define("zello-widget",L);function P(){if(document.querySelector("zello-widget"))return;const o=V(),i=new L(o);O(i,o)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",P):P()})();
