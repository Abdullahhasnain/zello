var we=Object.defineProperty;var ze=(f,m,v)=>m in f?we(f,m,{enumerable:!0,configurable:!0,writable:!0,value:v}):f[m]=v;var l=(f,m,v)=>ze(f,typeof m!="symbol"?m+"":m,v);(function(){"use strict";const f="https://api.zello.ai/api/v1";function m(){if(document.currentScript instanceof HTMLScriptElement)return document.currentScript;const s=Array.from(document.querySelectorAll("script[data-tenant-slug]"));return s.length>0?s[s.length-1]:null}function v(s){var e;if(s==="urdu"||s==="english"||s==="roman_urdu")return s;const i=(((e=navigator.languages)==null?void 0:e[0])||navigator.language||"").toLowerCase();return i.startsWith("ur")?"urdu":i.startsWith("hi")?"roman_urdu":"english"}function V(){var t;const s=m(),i=s==null?void 0:s.dataset.tenantSlug;if(!i)throw new Error("Zello widget: missing required data-tenant-slug attribute on the embed <script> tag.");const e=s==null?void 0:s.dataset.position;return{tenantSlug:i,apiBaseUrl:(s==null?void 0:s.dataset.apiBaseUrl)||f,language:v(s==null?void 0:s.dataset.language),position:e==="bottom-left"?"bottom-left":"bottom-right",voiceMode:(s==null?void 0:s.dataset.voiceMode)==="browser"?"browser":"auto",autoOpen:(s==null?void 0:s.dataset.autoOpen)==="true",mountTarget:s==null?void 0:s.dataset.mountTarget,storefrontPath:(t=s==null?void 0:s.dataset.storefrontPath)!=null&&t.startsWith("/store/")?s.dataset.storefrontPath:void 0}}function _(s,i){const e=i.mountTarget?document.getElementById(i.mountTarget):null;if(!e){document.body.appendChild(s);return}const t=()=>{s.toggleAttribute("data-inline",e.dataset.agentInline==="true"),s.dispatchEvent(new Event("zello:presentation"))},o=()=>{t(),e.appendChild(s)};e.dataset.agentReady==="true"?o():window.addEventListener("zello:stage-ready",o,{once:!0});const n=new MutationObserver(t);n.observe(e,{attributes:!0,attributeFilter:["data-agent-inline"]}),window.addEventListener("pagehide",()=>n.disconnect(),{once:!0})}function b(s,i){return`zello:${s}:${i}`}class U{constructor(i){this.tenantSlug=i}getSession(){const i=window.localStorage.getItem(b(this.tenantSlug,"session"));try{const e=i?JSON.parse(i):null,t=`zello.storefront.session.${this.tenantSlug}`,o=window.localStorage.getItem(t),n=o?JSON.parse(o):null;if(n!=null&&n.accessToken&&n.customerId){if((e==null?void 0:e.customerId)!==n.customerId){this.clearMessages();const r={...n,conversationId:null,branding:null};return window.localStorage.setItem(b(this.tenantSlug,"session"),JSON.stringify(r)),r}return{...e,...n,conversationId:(e==null?void 0:e.conversationId)??null,branding:(e==null?void 0:e.branding)??null}}return e&&window.localStorage.setItem(t,JSON.stringify(e)),e}catch{return null}}setSession(i){window.localStorage.setItem(b(this.tenantSlug,"session"),JSON.stringify(i));const{accessToken:e,refreshToken:t,customerId:o,tenantId:n}=i;window.localStorage.setItem(`zello.storefront.session.${this.tenantSlug}`,JSON.stringify({accessToken:e,refreshToken:t,customerId:o,tenantId:n}))}clearSession(){window.localStorage.removeItem(b(this.tenantSlug,"session")),window.localStorage.removeItem(`zello.storefront.session.${this.tenantSlug}`),window.localStorage.removeItem(`zello.storefront.cart.${this.tenantSlug}`)}setConversationId(i){const e=this.getSession();e&&this.setSession({...e,conversationId:i})}setBranding(i){const e=this.getSession();e&&this.setSession({...e,branding:i})}getMessages(){const i=window.localStorage.getItem(b(this.tenantSlug,"messages"));if(!i)return[];try{return JSON.parse(i)}catch{return[]}}setMessages(i){const e=i.slice(-100);window.localStorage.setItem(b(this.tenantSlug,"messages"),JSON.stringify(e))}clearMessages(){window.localStorage.removeItem(b(this.tenantSlug,"messages"))}}class y extends Error{constructor(i,e){super(`API request failed with status ${i}`),this.status=i,this.body=e}}class ${constructor(i,e){l(this,"storage");this.baseUrl=i,this.tenantSlug=e,this.storage=new U(e)}async ensureSession(){const i=this.storage.getSession();if(i)return{accessToken:i.accessToken,refreshToken:i.refreshToken,customerId:i.customerId,tenantId:i.tenantId};const e=await this.request("/auth/guest-session",{method:"POST",body:JSON.stringify({tenantSlug:this.tenantSlug}),skipAuth:!0}),t=this.storage.getSession();return t||(this.storage.setSession({...e,conversationId:null,branding:null}),e)}getStoredConversationId(){var i;return((i=this.storage.getSession())==null?void 0:i.conversationId)??null}getCachedBranding(){var i;return((i=this.storage.getSession())==null?void 0:i.branding)??null}async startConversation(i){const e=await this.request(`/conversations?language=${encodeURIComponent(i)}`,{method:"POST"});return this.storage.setConversationId(e.conversation.id),this.storage.setBranding(e.branding),e}async postMessage(i,e){var c,h;const t=crypto.randomUUID(),o=window.location.pathname.match(/\/product\/([^/]+)/),n=JSON.stringify({content:e,requestId:t,cartId:window.localStorage.getItem(`zello.storefront.cart.${this.tenantSlug}`),currentProductId:o==null?void 0:o[1]});let r;try{r=await this.readMessageStream(i,n)}catch{r=await this.request(`/conversations/${i}/messages`,{method:"POST",body:n})}const a=r.assistantMessage.intent;if((((c=r.action)==null?void 0:c.type)==="ADD_TO_CART"||a.action==="add_to_cart")&&typeof a.cart_id=="string"){const u=((h=r.action)==null?void 0:h.type)==="ADD_TO_CART"?r.action.payload:void 0;window.localStorage.setItem(`zello.storefront.cart.${this.tenantSlug}`,a.cart_id),window.dispatchEvent(new CustomEvent("zello:cart-changed",{detail:{count:a.cart_count,slug:this.tenantSlug,productId:u==null?void 0:u.productId,quantity:u==null?void 0:u.quantity,title:u==null?void 0:u.title}}))}return r}async readMessageStream(i,e){const t=await this.requestResponse(`/conversations/${i}/messages/stream`,{method:"POST",body:e});if(!t.body)throw new Error("Streaming response body is unavailable");const o=t.body.getReader(),n=new TextDecoder;let r="",a=null;const d=c=>{if(!c.trim())return;const h=JSON.parse(c);h.type==="complete"&&h.data&&(a=h.data)};for(;;){const{done:c,value:h}=await o.read();r+=n.decode(h,{stream:!c});const u=r.split(`
`);r=u.pop()??"";for(const g of u)d(g);if(c)break}if(d(r),!a)throw new Error("Stream ended before the assistant reply completed");return a}async getProduct(i){return this.request(`/catalog/storefront/products/${i}`)}async transcribeAudio(i){return(await this.request("/voice/transcriptions",{method:"POST",headers:{"Content-Type":i.type||"audio/webm"},body:i})).text}async synthesizeSpeech(i,e){return(await this.requestResponse("/voice/tts",{method:"POST",body:JSON.stringify({text:i,language:e})})).blob()}clearSession(){this.storage.clearSession(),this.storage.clearMessages()}getCachedMessages(){return this.storage.getMessages()}setCachedMessages(i){this.storage.setMessages(i)}async request(i,e={}){return await(await this.requestResponse(i,e)).json()}async requestResponse(i,e={},t=!1){const{skipAuth:o,...n}=e,r=o?null:this.storage.getSession(),a=new Headers(n.headers);a.has("Content-Type")||a.set("Content-Type","application/json"),r&&a.set("Authorization",`Bearer ${r.accessToken}`);const d=await fetch(`${this.baseUrl}${i}`,{...n,headers:a});if(d.status===401&&r&&!t&&await this.tryRefresh(r.refreshToken))return this.requestResponse(i,e,!0);if(!d.ok){const c=await d.json().catch(()=>{});throw new y(d.status,c)}return d}async tryRefresh(i){try{const e=await fetch(`${this.baseUrl}/auth/refresh`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refreshToken:i})});if(!e.ok)return this.clearSession(),!1;const t=await e.json(),o=this.storage.getSession();return this.storage.setSession({...t,conversationId:(o==null?void 0:o.conversationId)??null,branding:(o==null?void 0:o.branding)??null}),!0}catch{return this.clearSession(),!1}}}const H={english:"en-US",roman_urdu:"ur-PK",urdu:"ur-PK"},D={english:"en-US",roman_urdu:"ur-PK",urdu:"ur-PK"};function T(s){return s==="english"||s==="urdu"||s==="roman_urdu"?s:"english"}function q(s){return H[T(s)]}function j(s){return D[T(s)]}const F=2e4,Y=1100,G=.025;function J(){for(const s of["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4"])if(MediaRecorder.isTypeSupported(s))return s;return""}class w{constructor(i){l(this,"recorder",null);l(this,"stream",null);l(this,"audioContext",null);l(this,"animationFrame",null);l(this,"timeout",null);l(this,"aborted",!1);this.serverSpeaker=i}static isSupported(){var i;return typeof MediaRecorder<"u"&&typeof navigator<"u"&&!!((i=navigator.mediaDevices)!=null&&i.getUserMedia)}async start(i){if(this.recorder||!w.isSupported()){i.onError("not-supported","Audio recording isn't supported in this browser.");return}try{this.aborted=!1;const e=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}});this.stream=e;const t=J(),o=new MediaRecorder(e,t?{mimeType:t}:void 0),n=[];this.recorder=o,o.ondataavailable=r=>{r.data.size>0&&n.push(r.data)},o.onerror=()=>{this.cleanup(),i.onError("unknown","The microphone recording failed. Please try again.")},o.onstop=()=>{const r=this.aborted,a=o.mimeType||t||"audio/webm";if(this.cleanup(),r)return;const d=new Blob(n,{type:a});if(d.size<200){i.onError("no-speech","I couldn't hear anything. Please try again.");return}i.onAudio(d)},o.start(250),this.startVoiceActivityDetection(e),this.timeout=setTimeout(()=>this.stop(),F)}catch(e){this.cleanup();const t=e instanceof DOMException&&(e.name==="NotAllowedError"||e.name==="SecurityError");i.onError(t?"permission-denied":"unknown",t?"Microphone access was denied.":"Could not start the microphone.")}}stop(){var i;((i=this.recorder)==null?void 0:i.state)==="recording"&&this.recorder.stop()}abort(){var i;this.aborted=!0,((i=this.recorder)==null?void 0:i.state)==="recording"?this.recorder.stop():this.cleanup()}isActive(){var i;return((i=this.recorder)==null?void 0:i.state)==="recording"}startVoiceActivityDetection(i){const e=window.AudioContext;if(!e)return;const t=new e,o=t.createAnalyser();o.fftSize=512,t.createMediaStreamSource(i).connect(o);const n=new Uint8Array(o.fftSize);let r=!1,a=performance.now();const d=()=>{var g;if(!this.isActive())return;o.getByteTimeDomainData(n);let c=0;for(const x of n){const p=(x-128)/128;c+=p*p}const h=Math.sqrt(c/n.length),u=performance.now();if(h>=G)!r&&((g=this.serverSpeaker)!=null&&g.isPlaying)&&this.serverSpeaker.stopAudio(),r=!0,a=u;else if(r&&u-a>=Y){this.stop();return}this.animationFrame=requestAnimationFrame(d)};this.audioContext=t,this.animationFrame=requestAnimationFrame(d)}cleanup(){var i,e;this.animationFrame!==null&&cancelAnimationFrame(this.animationFrame),this.timeout!==null&&clearTimeout(this.timeout),(i=this.stream)==null||i.getTracks().forEach(t=>t.stop()),(e=this.audioContext)==null||e.close(),this.animationFrame=null,this.timeout=null,this.stream=null,this.audioContext=null,this.recorder=null}}class K{constructor(){l(this,"audio",null);l(this,"objectUrl",null)}async play(i,e){this.stop();const t=URL.createObjectURL(i),o=new Audio(t);this.objectUrl=t,this.audio=o,o.onplay=()=>{var n;return(n=e.onStart)==null?void 0:n.call(e)},o.onended=()=>{this.cleanup(),e.onEnd()},o.onerror=()=>{this.cleanup(),e.onError("synthesis-failed","The generated voice reply could not be played.")};try{await o.play()}catch{this.cleanup(),e.onError("synthesis-failed","The browser blocked voice playback.")}}pause(){var i;(i=this.audio)==null||i.pause()}resume(){var i;(i=this.audio)==null||i.play()}stop(){this.stopAudio()}stopAudio(){this.audio&&(this.audio.onplay=null,this.audio.onended=null,this.audio.onerror=null,this.audio.pause(),this.audio.currentTime=0),this.cleanup()}get isPlaying(){return this.isSpeaking()}isSpeaking(){return!!this.audio&&!this.audio.paused&&!this.audio.ended}isPaused(){return!!this.audio&&this.audio.paused&&this.audio.currentTime>0&&!this.audio.ended}cleanup(){this.objectUrl&&URL.revokeObjectURL(this.objectUrl),this.objectUrl=null,this.audio=null}}function B(){const s=window;return s.SpeechRecognition??s.webkitSpeechRecognition??null}function S(){return B()!==null}const W=15e3;class Z{constructor(){l(this,"recognition",null);l(this,"timeoutHandle",null);l(this,"active",!1)}start(i,e){if(this.active)return;const t=B();if(!t){e.onError("not-supported","Speech recognition isn't supported in this browser.");return}const o=new t;o.lang=i,o.continuous=!1,o.interimResults=!0,o.maxAlternatives=1;let n="";o.onresult=r=>{for(let a=r.resultIndex;a<r.results.length;a++){const d=r.results[a],c=d==null?void 0:d[0];!d||!c||(d.isFinal?(n+=c.transcript,e.onResult(n.trim(),!0)):e.onResult((n+c.transcript).trim(),!1))}},o.onerror=r=>{const a=r.error==="not-allowed"||r.error==="service-not-allowed"?"permission-denied":r.error==="no-speech"?"no-speech":r.error==="network"?"network":r.error==="aborted"?"aborted":"unknown";e.onError(a,r.message||`Speech recognition error: ${r.error}`)},o.onend=()=>{this.clearTimeout(),this.active=!1,this.recognition=null,e.onEnd()},this.recognition=o,this.active=!0,this.timeoutHandle=setTimeout(()=>{this.stop()},W);try{o.start()}catch{this.clearTimeout(),this.active=!1,this.recognition=null,e.onError("unknown","Could not start voice recognition. Please try again.")}}stop(){var i;this.clearTimeout(),(i=this.recognition)==null||i.stop()}abort(){var i;this.clearTimeout(),(i=this.recognition)==null||i.abort(),this.active=!1,this.recognition=null}isActive(){return this.active}clearTimeout(){this.timeoutHandle!==null&&(clearTimeout(this.timeoutHandle),this.timeoutHandle=null)}}function k(){return typeof window<"u"&&"speechSynthesis"in window}function Q(s){return s.replace(/(?:(\$|£|€)\s*|(PKR|USD|Rs\.?)\s+)(\d[\d,]*)(?:\.(\d+))?/gi,(e,t,o,n,r)=>{const a=(t??o??"").toUpperCase(),d=a==="$"||a==="USD"?"dollars":a==="£"?"pounds":a==="€"?"euros":"rupees",c=a==="PKR"||a.startsWith("RS")?"paisa":"cents",h=r?Number(`${r}00`.slice(0,2)):0,u=n.replace(/,/g,"");return h>0?`${u} ${d} and ${h} ${c}`:`${u} ${d}`}).replace(/[*_`~]/g,"").replace(/#+/g,"").replace(/\s{2,}/g," ").trim()}function X(s){var n;const i=window.speechSynthesis.getVoices();if(i.length===0)return null;const e=i.find(r=>r.lang.toLowerCase()===s.toLowerCase());if(e)return e;const t=(n=s.split("-")[0])==null?void 0:n.toLowerCase();return(t?i.find(r=>r.lang.toLowerCase().startsWith(t)):void 0)??null}async function ee(){window.speechSynthesis.getVoices().length>0||await new Promise(s=>{const i=setTimeout(s,1e3);window.speechSynthesis.addEventListener("voiceschanged",()=>{clearTimeout(i),s()},{once:!0})})}class te{async speak(i,e,t){if(!k()){t.onError("not-supported","Voice playback isn't supported in this browser.");return}const o=Q(i);if(!o){t.onEnd();return}window.speechSynthesis.cancel(),await ee();const n=new SpeechSynthesisUtterance(o);n.lang=e;const r=X(e);r&&(n.voice=r),n.onstart=()=>{var a;return(a=t.onStart)==null?void 0:a.call(t)},n.onend=()=>t.onEnd(),n.onerror=a=>{if(a.error==="interrupted"||a.error==="canceled"){t.onEnd();return}t.onError("synthesis-failed",`Speech synthesis error: ${a.error}`)},window.speechSynthesis.speak(n)}pause(){window.speechSynthesis.speaking&&!window.speechSynthesis.paused&&window.speechSynthesis.pause()}resume(){window.speechSynthesis.paused&&window.speechSynthesis.resume()}stop(){window.speechSynthesis.cancel()}isSpeaking(){return window.speechSynthesis.speaking}isPaused(){return window.speechSynthesis.paused}}const E={voiceEnabled:!0,muted:!1};function A(s){return`zello:${s}:voice-prefs`}function L(s){return`zello:${s}:proactive-prompt-shown`}function ie(s){const i=window.localStorage.getItem(A(s));if(!i)return{...E};try{return{...E,...JSON.parse(i)}}catch{return{...E}}}function P(s,i){window.localStorage.setItem(A(s),JSON.stringify(i))}function oe(s){return window.sessionStorage.getItem(L(s))==="1"}function se(s){window.sessionStorage.setItem(L(s),"1")}function ne(s,i={}){const e=document.createElement("div");e.className="zello-product-row",e.setAttribute("aria-label","Recommended products");for(const[t,o]of s.entries())e.appendChild(re(o,t,i));return e}function re(s,i,{onAdd:e,pendingProductId:t,addedProductId:o}){const n=document.createElement("div");if(n.className="zello-product-card",s.id===t&&n.classList.add("zello-product-card-pending"),s.id===o&&n.classList.add("zello-product-card-added"),i===0){const p=document.createElement("span");p.className="zello-product-recommendation",p.textContent="✦ Top match",n.appendChild(p)}const r=document.createElement("div");r.className="zello-product-image";const a=s.images[0];if(a){const p=document.createElement("img");p.src=a,p.alt=s.title,p.loading="lazy",r.appendChild(p)}else r.classList.add("zello-product-image-placeholder");n.appendChild(r);const d=document.createElement("div");d.className="zello-product-title",d.textContent=s.title,n.appendChild(d);const c=document.createElement("div");c.className="zello-product-price",c.textContent=ae(s.price,s.currency),n.appendChild(c);const h=s.status==="active"&&s.stockQty>0,u=document.createElement("div");u.className="zello-product-stock",u.textContent=h?"● In stock":"Out of stock",n.appendChild(u);const g=s.id===t,x=s.id===o;if(e||g||x){const p=document.createElement("button");p.type="button",p.className="zello-product-add",p.setAttribute("aria-label",`Add ${s.title} to cart`),p.disabled=!h||g||x||!e,p.textContent=x?"✓ Added":g?"Adding…":"🛒 Add to cart",e&&!g&&!x&&p.addEventListener("click",()=>e(s)),n.appendChild(p)}if(!h){const p=document.createElement("div");p.className="zello-product-badge",p.textContent="Out of stock",n.appendChild(p)}return n}function ae(s,i){const e=typeof s=="string"?Number(s):s;return Number.isNaN(e)?`${i} ${s}`:`${i} ${e.toLocaleString("en-US",{maximumFractionDigits:0})}`}function I(s){return`
    :host {
      --zello-primary: ${s};
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
  `}const le=5,de="#B6602A",ce=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.8l1.45 5.75L19 10l-5.55 1.45L12 17.2l-1.45-5.75L5 10l5.55-1.45L12 2.8z" fill="currentColor"/>
    <path d="M19 15.5l.6 2.1 2.1.6-2.1.6-.6 2.1-.6-2.1-2.1-.6 2.1-.6.6-2.1z" fill="currentColor"/>
  </svg>
`,M=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor"/>
  </svg>
`;function ue(){return`local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}class pe extends HTMLElement{constructor(e){super();l(this,"shadow");l(this,"apiClient");l(this,"conversationId",null);l(this,"messages",[]);l(this,"isOpen",!1);l(this,"isExpanded",!1);l(this,"isSending",!1);l(this,"pendingCartProductId",null);l(this,"lastAssistantIntent",null);l(this,"styleEl");l(this,"launcherButton");l(this,"panel");l(this,"headerEl");l(this,"headerTitleEl");l(this,"messagesEl");l(this,"inputEl");l(this,"sendButton");this.config=e,this.apiClient=new $(e.apiBaseUrl,e.tenantSlug),this.shadow=this.attachShadow({mode:"open"})}connectedCallback(){this.buildDom(),this.addEventListener("zello:presentation",()=>{const t=this.hasAttribute("data-inline");this.panel.setAttribute("role",t?"region":"dialog"),this.setOpen(t,!1)});const e=this.apiClient.getCachedBranding();e&&this.applyBranding(e),this.bootstrap()}buildDom(){if(this.styleEl=document.createElement("style"),this.styleEl.textContent=I(de),this.shadow.appendChild(this.styleEl),this.launcherButton=document.createElement("button"),this.launcherButton.className=`zello-launcher zello-position-${this.config.position}`,this.launcherButton.setAttribute("aria-label","Ask Zello AI"),this.launcherButton.innerHTML=`${ce}<span>Ask Zello AI</span>`,this.launcherButton.addEventListener("click",()=>this.setOpen(!this.isOpen)),this.shadow.appendChild(this.launcherButton),this.panel=document.createElement("div"),this.panel.className=`zello-panel zello-position-${this.config.position}`,this.panel.setAttribute("role",this.hasAttribute("data-inline")?"region":"dialog"),this.panel.setAttribute("aria-label","Zello AI sales agent"),this.headerEl=this.buildHeader(),this.panel.appendChild(this.headerEl),this.messagesEl=document.createElement("div"),this.messagesEl.className="zello-messages",this.panel.appendChild(this.messagesEl),this.panel.appendChild(this.buildInputRow()),this.config.storefrontPath){const e=document.createElement("nav");e.className="zello-shopping-links";for(const[t,o]of[["Review cart","/cart"],["Checkout","/checkout"]]){const n=document.createElement("a");n.textContent=t,n.href=`${this.config.storefrontPath}${o}`,e.appendChild(n)}this.panel.appendChild(e)}this.shadow.appendChild(this.panel)}buildHeader(){const e=document.createElement("div");e.className="zello-header",this.headerTitleEl=document.createElement("div"),this.headerTitleEl.className="zello-header-title",this.headerTitleEl.innerHTML='<span class="zello-orb">✦</span><span><strong>Zello AI</strong><small><i></i> Online · Your AI shopping assistant</small></span>';const t=document.createElement("button");t.className="zello-expand-button",t.setAttribute("aria-label","Expand assistant"),t.textContent="↗",t.addEventListener("click",()=>{this.isExpanded=!this.isExpanded,this.panel.classList.toggle("zello-expanded",this.isExpanded),t.textContent=this.isExpanded?"↙":"↗",t.setAttribute("aria-label",this.isExpanded?"Reduce assistant":"Expand assistant")});const o=document.createElement("button");return o.className="zello-close-button",o.setAttribute("aria-label","Close chat"),o.textContent="✕",o.addEventListener("click",()=>this.setOpen(!1)),e.appendChild(this.headerTitleEl),e.appendChild(t),e.appendChild(o),e}buildInputRow(){const e=document.createElement("form");return e.className="zello-input-row",e.addEventListener("submit",t=>{t.preventDefault(),this.handleSend()}),this.inputEl=document.createElement("input"),this.inputEl.className="zello-input",this.inputEl.type="text",this.inputEl.placeholder="Kya chahiye? Budget, colour aur size batayein…",this.inputEl.setAttribute("aria-label","Message Zello"),this.sendButton=document.createElement("button"),this.sendButton.type="submit",this.sendButton.className="zello-send-button",this.sendButton.setAttribute("aria-label","Send message"),this.sendButton.innerHTML=M,this.sendButton.addEventListener("click",t=>{t.preventDefault(),e.requestSubmit()}),e.appendChild(this.inputEl),e.appendChild(this.sendButton),e}async bootstrap(){try{await this.apiClient.ensureSession();const e=this.apiClient.getCachedMessages(),t=this.apiClient.getStoredConversationId();if(e.length>0&&t){this.conversationId=t,this.messages=e,this.renderMessages(),this.onBootstrapped(),window.dispatchEvent(new CustomEvent("zello:agent-ready",{detail:{tenantSlug:this.config.tenantSlug}}));return}const o=await this.apiClient.startConversation(this.config.language);this.conversationId=o.conversation.id,this.applyBranding(o.branding),this.messages=[this.toBubble(o.greeting)],this.apiClient.setCachedMessages(this.messages),this.renderMessages(),this.onBootstrapped(),window.dispatchEvent(new CustomEvent("zello:agent-ready",{detail:{tenantSlug:this.config.tenantSlug}}))}catch(e){this.renderError("Sorry, we couldn't connect right now. Please refresh the page and try again."),console.error("[zello-widget] bootstrap failed",e)}}onBootstrapped(){}applyBranding(e){e.primaryColor&&(this.styleEl.textContent=I(e.primaryColor)),(e.logoUrl||e.greetingPersona)&&(this.headerTitleEl.textContent=e.greetingPersona?"Zello AI":this.headerTitleEl.textContent)}async handleSend(){var o;this.lastAssistantIntent=null;const e=this.inputEl.value.trim();if(!e||this.isSending||!this.conversationId)return;this.isSending=!0,this.inputEl.value="",this.setSendingState(!0);const t=ue();this.messages.push({id:t,role:"customer",content:e,createdAt:new Date().toISOString(),pending:!0}),this.renderMessages(),this.renderTypingIndicator(!0);try{const n=await this.apiClient.postMessage(this.conversationId,e),r=this.messages.findIndex(c=>c.id===t),a=this.toBubble(n.customerMessage);r>=0?this.messages[r]=a:this.messages.push(a);const d=this.toBubble(n.assistantMessage);((o=n.action)==null?void 0:o.type)==="ADD_TO_CART"&&(d.action=n.action),this.pendingCartProductId=null,this.messages.push(d),this.lastAssistantIntent=n.assistantMessage.intent??{},this.apiClient.setCachedMessages(this.messages),this.attachProductResults(d)}catch(n){this.pendingCartProductId=null,this.messages=this.messages.filter(r=>r.id!==t),this.renderError("That message couldn't be sent. Please try again."),console.error("[zello-widget] send message failed",n)}finally{this.isSending=!1,this.setSendingState(!1),this.renderTypingIndicator(!1),this.renderMessages()}}setSendingState(e){this.sendButton.disabled=e,this.sendButton.setAttribute("aria-busy",String(e)),this.sendButton.setAttribute("aria-label",e?"Sending message":"Send message"),this.sendButton.innerHTML=e?'<span class="zello-send-loading" aria-hidden="true"></span>':M}async attachProductResults(e){var n;const t=(n=this.lastAssistantIntent)==null?void 0:n.matched_product_ids;if(!Array.isArray(t)||t.length===0)return;const o=(await Promise.all(t.slice(0,le).map(r=>this.apiClient.getProduct(String(r)).catch(()=>null)))).filter(r=>r!==null);o.length!==0&&(e.products=o,this.apiClient.setCachedMessages(this.messages),this.renderMessages())}setOpen(e,t=!0){this.isOpen=e,this.panel.classList.toggle("zello-open",e),e&&(t&&this.inputEl.focus(),this.scrollToBottom())}toBubble(e){return{id:e.id,role:e.role,content:e.content,createdAt:e.createdAt}}renderMessages(){var t,o;this.messagesEl.innerHTML="";const e=[...this.messages].reverse().find(n=>n.role==="assistant");for(const n of this.messages){const r=document.createElement("div");if(r.className=`zello-bubble zello-bubble-${n.role==="customer"?"customer":"assistant"}`,n.pending&&r.classList.add("zello-bubble-pending"),r.textContent=n.content,this.messagesEl.appendChild(r),((t=n.action)==null?void 0:t.type)==="ADD_TO_CART"&&this.messagesEl.appendChild(this.buildCartConfirmationCard(n.action)),n.products&&n.products.length>0&&n===e){const a=!this.isSending;if(this.messagesEl.appendChild(ne(n.products,{onAdd:a?d=>this.beginCartAction(d):void 0,pendingProductId:this.pendingCartProductId,addedProductId:(o=n.action)==null?void 0:o.payload.productId})),a){const d=document.createElement("div");d.className="zello-suggestions";const c=[["✦ Recommend for me","In options mein meri zaroorat aur budget ke liye kaunsa behtar hai? Wajah bhi batao."],...n.products.length>1?[["Compare options","In options ko price aur available features ke hisaab se compare karo."],["Cheaper options","Koi sasta option hai?"]]:[],["Different colour","Kya ye kisi aur colour mein available hai?"]];for(const[h,u]of c){const g=document.createElement("button");g.type="button",g.className="zello-action",g.textContent=h,g.addEventListener("click",()=>this.sendSuggestedMessage(u)),d.appendChild(g)}this.messagesEl.appendChild(d)}}}this.messages.length===1&&!this.isSending&&this.messagesEl.appendChild(this.buildQuickChips()),this.scrollToBottom()}sendSuggestedMessage(e){this.isSending||(this.inputEl.value=e,this.handleSend())}beginCartAction(e){this.isSending||e.status!=="active"||e.stockQty<=0||(this.pendingCartProductId=e.id,this.renderMessages(),this.sendSuggestedMessage(`${e.title} ka ek piece cart mein add karo.`))}buildQuickChips(){const e=document.createElement("div");e.className="zello-suggestions zello-quick-chips";for(const[t,o]of[["👟 Sneakers","Mujhe sneakers dikhayein"],["👕 T-Shirts","Mujhe t-shirts dikhayein"],["Hoodies","Mujhe hoodies dikhayein"],["Jeans","Mujhe jeans dikhayein"]]){const n=document.createElement("button");n.type="button",n.className="zello-action",n.textContent=t,n.addEventListener("click",()=>this.sendSuggestedMessage(o)),e.appendChild(n)}return e}buildCartConfirmationCard(e){const t=document.createElement("div");t.className="zello-cart-confirmation";const o=document.createElement("strong");o.textContent=`${e.payload.title} added to cart`,t.appendChild(o);const n=document.createElement("div");n.className="zello-cart-actions";const r=document.createElement("button");r.type="button",r.className="zello-action",r.textContent="View cart",r.addEventListener("click",()=>{if(this.config.storefrontPath){window.location.assign(`${this.config.storefrontPath}/cart`);return}window.dispatchEvent(new CustomEvent("zello:view-cart",{detail:{tenantSlug:this.config.tenantSlug}}))}),n.appendChild(r);const a=document.createElement("button");a.type="button",a.className="zello-action",a.textContent="Show similar",a.addEventListener("click",()=>{this.sendSuggestedMessage(`Show me similar products to ${e.payload.title}.`)}),n.appendChild(a);const d=document.createElement("button");return d.type="button",d.className="zello-action",d.textContent="Continue shopping",d.addEventListener("click",()=>this.inputEl.focus()),n.appendChild(d),t.appendChild(n),t}renderTypingIndicator(e){const t=this.messagesEl.querySelector(".zello-typing");if(t&&t.remove(),e){const o=document.createElement("div");o.className="zello-typing",o.innerHTML="<span></span><span></span><span></span><em>Options check kar raha hoon…</em>",this.messagesEl.appendChild(o),this.scrollToBottom()}}renderError(e){const t=document.createElement("div");t.className="zello-bubble zello-bubble-assistant",t.textContent=e,this.messagesEl.appendChild(t),this.scrollToBottom()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}}function he(){return`
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
      background: rgba(255,255,255,.06);
      color: #b9c8e5;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .zello-mic-button:hover:not(:disabled),
    .zello-pause-button:hover:not(:disabled) {
      background: rgba(126,108,255,.2);
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
      background: linear-gradient(135deg, #ff536a, #d73764);
      animation: zello-mic-pulse 1.4s ease-in-out infinite;
    }
    .zello-mic-listening:hover { background: #c23b3b; }

    .zello-mic-processing svg {
      animation: zello-mic-spin 1s linear infinite;
    }

    .zello-mic-speaking {
      color: #ffffff;
      background: linear-gradient(135deg, #725eff, #2678ff);
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
      color: #a9b9d6;
      flex: 0 0 auto;
    }
    .zello-voice-status-visible {
      display: flex;
    }
    .zello-voice-status-visible::before {
      content: ""; width: 26px; height: 12px; display: inline-block;
      background: linear-gradient(90deg, #7a68ff 16%, transparent 16% 28%, #7a68ff 28% 44%, transparent 44% 56%, #7a68ff 56% 72%, transparent 72% 84%, #7a68ff 84%);
      border-radius: 4px; opacity: .9; animation: zello-wave 1s ease-in-out infinite;
    }
    @keyframes zello-wave { 50% { transform: scaleY(1.45); opacity: .55; } }
    .zello-voice-status-error {
      color: #d64545;
    }
    .zello-voice-disclosure {
      padding: 4px 16px 2px;
      font-size: 10px;
      color: #71829f;
      text-align: center;
      flex: 0 0 auto;
    }

    .zello-header-icon-button {
      color: #dce5ff;
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
  `}const z=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19 11a7 7 0 01-14 0M12 19v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`,ge=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 15a3 3 0 003-3V6a3 3 0 00-5.94-.7M9 9.35V12a3 3 0 004.6 2.54" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19 11a7 7 0 01-1.13 3.82M6.16 6.16A7 7 0 0019 11M12 19v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`,R=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
  </svg>
`,C=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/>
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>
  </svg>
`,me=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5v14l11-7z" fill="currentColor"/>
  </svg>
`,fe=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"/>
    <path d="M15.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`,be=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"/>
    <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`,ve=45e3,xe=4e3;class O extends pe{constructor(e){super(e);l(this,"recognizer",new Z);l(this,"speaker",new te);l(this,"serverSpeaker",new K);l(this,"serverRecorder",new w(this.serverSpeaker));l(this,"voiceSupported");l(this,"serverTranscriptionUnavailable",!1);l(this,"serverSpeechUnavailable",!1);l(this,"activeSpeaker",null);l(this,"speechRequestId",0);l(this,"tenantSlug");l(this,"position");l(this,"voicePrefs");l(this,"voiceState","idle");l(this,"lastReplyLanguage");l(this,"greetingText","");l(this,"greetingStarted",!1);l(this,"autoOpen");l(this,"greetingButton",null);l(this,"voiceStyleEl");l(this,"voiceStatusEl");l(this,"micButton");l(this,"pauseButton");l(this,"muteButton");l(this,"voiceToggleButton");l(this,"proactiveBubble",null);l(this,"proactiveTimer",null);l(this,"audioUnlocked",!1);l(this,"unlockAudio",()=>{this.audioUnlocked=!0,this.tryAutoGreet()});this.tenantSlug=e.tenantSlug,this.position=e.position,this.autoOpen=e.autoOpen===!0,this.lastReplyLanguage=e.language,this.serverTranscriptionUnavailable=e.voiceMode==="browser",this.serverSpeechUnavailable=e.voiceMode==="browser",this.voiceSupported=w.isSupported()||S()&&k(),this.voicePrefs=ie(this.tenantSlug)}connectedCallback(){if(super.connectedCallback(),this.addVoiceStyles(),this.addVoiceControls(),this.addHeaderControls(),this.autoOpen&&(!this.hasMountTarget()||this.hasAttribute("data-inline"))&&this.setOpen(!0,!1),this.launcherButton.addEventListener("click",()=>this.handleLauncherToggled()),this.voiceSupported){const e={once:!0,capture:!0,passive:!0};window.addEventListener("pointerdown",this.unlockAudio,e),window.addEventListener("keydown",this.unlockAudio,e),window.addEventListener("touchstart",this.unlockAudio,e),window.addEventListener("scroll",this.unlockAudio,e)}}disconnectedCallback(){this.recognizer.abort(),this.serverRecorder.abort(),this.stopSpeech(),this.proactiveTimer!==null&&clearTimeout(this.proactiveTimer),window.removeEventListener("pointerdown",this.unlockAudio,!0),window.removeEventListener("keydown",this.unlockAudio,!0),window.removeEventListener("touchstart",this.unlockAudio,!0),window.removeEventListener("scroll",this.unlockAudio,!0)}onBootstrapped(){var t;if(this.hasMountTarget()&&!this.hasAttribute("data-inline"))return;if(this.autoOpen){this.greetingText=((t=this.messages.find(o=>o.role==="assistant"))==null?void 0:t.content)??"",this.voicePrefs.voiceEnabled&&!this.voicePrefs.muted&&this.greetingText&&(this.showGreetingButton(),this.startVoiceGreeting(!1));return}if(!this.voicePrefs.voiceEnabled||oe(this.tenantSlug))return;const e=this.messages.find(o=>o.role==="assistant");this.greetingText=(e==null?void 0:e.content)??"Hello! How can I help you today?",this.proactiveTimer=setTimeout(()=>{this.isOpen||this.showProactivePrompt(this.greetingText)},xe),this.tryAutoGreet()}tryAutoGreet(){this.greetingStarted||!this.audioUnlocked||!this.greetingText||(this.autoOpen?!this.isOpen:this.isOpen)||!this.voicePrefs.voiceEnabled||this.voicePrefs.muted||(this.autoOpen||this.showProactivePrompt(this.greetingText),this.startVoiceGreeting(!1))}hasMountTarget(){var e;return((e=this.parentElement)==null?void 0:e.id)==="zello-agent-stage"}showGreetingButton(){if(this.greetingButton)return;const e=document.createElement("button");e.type="button",e.textContent="Shuru karein — greeting sunein",e.className="zello-greeting-button",e.addEventListener("click",()=>{!this.voicePrefs.voiceEnabled||this.voicePrefs.muted||(this.stopSpeech(),this.greetingStarted=!1,this.startVoiceGreeting(!1))}),this.panel.insertBefore(e,this.voiceStatusEl),this.greetingButton=e}canAutoplayAudio(){const e=navigator.userActivation;return(e==null?void 0:e.hasBeenActive)===!0}startVoiceGreeting(e){if(this.greetingStarted)return;if(this.greetingStarted=!0,!(this.voiceSupported&&this.voicePrefs.voiceEnabled&&!this.voicePrefs.muted&&!!this.greetingText)){e&&this.maybeAutoListen();return}this.setVoiceState("speaking"),this.speakText(this.greetingText,this.lastReplyLanguage,{onEnd:()=>{var o;(o=this.greetingButton)==null||o.remove(),this.greetingButton=null,this.voiceState==="speaking"&&this.setVoiceState("idle"),e&&this.maybeAutoListen()},onError:()=>{this.autoOpen&&(this.greetingStarted=!1,this.showGreetingButton()),this.voiceState==="speaking"&&this.setVoiceState("idle"),e&&this.maybeAutoListen()}})}addVoiceStyles(){this.voiceStyleEl=document.createElement("style"),this.voiceStyleEl.textContent=he(),this.shadow.appendChild(this.voiceStyleEl)}addVoiceControls(){const e=this.shadow.querySelector(".zello-input-row");if(!e)return;this.voiceStatusEl=document.createElement("div"),this.voiceStatusEl.className="zello-voice-status",this.voiceStatusEl.setAttribute("role","status"),this.voiceStatusEl.setAttribute("aria-live","polite");const t=document.createElement("div");t.className="zello-voice-disclosure",t.textContent="Voice replies are AI-generated.",this.panel.insertBefore(t,e),this.panel.insertBefore(this.voiceStatusEl,e),this.pauseButton=document.createElement("button"),this.pauseButton.type="button",this.pauseButton.className="zello-pause-button zello-hidden",this.pauseButton.innerHTML=C,this.pauseButton.setAttribute("aria-label","Pause speaking"),this.pauseButton.addEventListener("click",()=>this.handlePauseClick()),this.micButton=document.createElement("button"),this.micButton.type="button",this.micButton.className="zello-mic-button",this.micButton.innerHTML=z,this.voiceSupported?(this.micButton.setAttribute("aria-label","Start voice input"),this.micButton.addEventListener("click",()=>this.handleMicClick())):(this.micButton.disabled=!0,this.micButton.title="Voice isn't supported in this browser",this.micButton.setAttribute("aria-label","Voice input unavailable in this browser")),e.insertBefore(this.pauseButton,this.sendButton),e.insertBefore(this.micButton,this.sendButton),this.updateMicButtonVisibility()}addHeaderControls(){this.muteButton=document.createElement("button"),this.muteButton.type="button",this.muteButton.className="zello-header-icon-button",this.muteButton.addEventListener("click",()=>this.toggleMute()),this.updateMuteButton(),this.voiceToggleButton=document.createElement("button"),this.voiceToggleButton.type="button",this.voiceToggleButton.className="zello-header-icon-button",this.voiceToggleButton.addEventListener("click",()=>this.toggleVoiceEnabled()),this.updateVoiceToggleButton();const e=this.headerEl.querySelector(".zello-close-button");this.headerEl.insertBefore(this.voiceToggleButton,e),this.headerEl.insertBefore(this.muteButton,e)}handleLauncherToggled(){if(this.dismissProactivePrompt(),!this.isOpen){this.recognizer.abort(),this.serverRecorder.abort(),this.stopSpeech(),this.voiceState!=="idle"&&this.setVoiceState("idle");return}this.greetingStarted?this.maybeAutoListen():this.startVoiceGreeting(!0)}maybeAutoListen(){this.voiceSupported&&this.voicePrefs.voiceEnabled&&this.voiceState==="idle"&&this.startListening()}showProactivePrompt(e){if(this.proactiveBubble)return;this.proactiveTimer!==null&&(clearTimeout(this.proactiveTimer),this.proactiveTimer=null);const t=document.createElement("div");t.className=`zello-proactive-bubble zello-position-${this.position}`,t.setAttribute("role","button"),t.setAttribute("tabindex","0");const o=document.createElement("button");o.type="button",o.className="zello-proactive-dismiss",o.setAttribute("aria-label","Dismiss"),o.textContent="✕",o.addEventListener("click",a=>{a.stopPropagation(),this.dismissProactivePrompt()});const n=document.createElement("div");n.className="zello-proactive-text",n.textContent=e;const r=document.createElement("div");r.className="zello-proactive-hint",r.textContent=this.voiceSupported?"🎤 Tap to talk":"💬 Tap to chat",t.appendChild(o),t.appendChild(n),t.appendChild(r),t.addEventListener("click",()=>{this.dismissProactivePrompt(),this.setOpen(!0),this.startVoiceGreeting(!0)}),this.shadow.appendChild(t),this.proactiveBubble=t,this.launcherButton.classList.add("zello-launcher-attention"),se(this.tenantSlug),(this.audioUnlocked||this.canAutoplayAudio())&&this.startVoiceGreeting(!1)}dismissProactivePrompt(){var e;this.proactiveTimer!==null&&(clearTimeout(this.proactiveTimer),this.proactiveTimer=null),(e=this.proactiveBubble)==null||e.remove(),this.proactiveBubble=null,this.launcherButton.classList.remove("zello-launcher-attention")}handleMicClick(){if(this.voicePrefs.voiceEnabled)switch(this.voiceState){case"listening":this.recognizer.stop(),this.serverRecorder.stop();return;case"speaking":this.startListening();return;case"processing":return;case"idle":case"error":this.startListening()}}startListening(){const e=w.isSupported()&&!this.serverTranscriptionUnavailable;if((this.activeSpeaker==="browser"||!e)&&(this.speechRequestId+=1,this.speaker.stop(),e||this.serverSpeaker.stopAudio(),this.activeSpeaker=null),this.setVoiceState("listening"),e){this.serverRecorder.start({onAudio:t=>{this.setVoiceState("processing"),this.transcribeAndSend(t)},onError:(t,o)=>{if(t==="no-speech"||t==="aborted"){this.setVoiceState("idle");return}this.setVoiceState("error",this.describeVoiceError(t,o))}});return}this.startBrowserListening()}startBrowserListening(){if(!S()){this.setVoiceState("error","Voice transcription is unavailable right now.");return}const e=q(this.lastReplyLanguage);this.recognizer.start(e,{onResult:(t,o)=>{this.inputEl.value=t,o&&t&&(this.setVoiceState("processing"),this.sendVoiceMessage(t))},onError:(t,o)=>{if(t==="no-speech"||t==="aborted"){this.setVoiceState("idle");return}this.setVoiceState("error",this.describeVoiceError(t,o))},onEnd:()=>{this.voiceState==="listening"&&this.setVoiceState("idle")}})}async transcribeAndSend(e){try{const t=(await this.apiClient.transcribeAudio(e)).trim();if(!t){this.setVoiceState("error","I couldn't hear that clearly. Please try again.");return}this.inputEl.value=t,await this.sendVoiceMessage(t)}catch(t){t instanceof y&&t.status===503&&(this.serverTranscriptionUnavailable=!0),this.setVoiceState("error",S()?"Server transcription is unavailable. Tap the mic to retry with browser speech.":"Voice transcription is temporarily unavailable. Please type your message.")}}async sendVoiceMessage(e){this.inputEl.value=e;const t=Symbol("timed-out");if(await Promise.race([this.handleSend().then(()=>"sent"),new Promise(a=>{setTimeout(()=>a(t),ve)})])===t){this.setVoiceState("error","That's taking longer than expected. Please try again in a moment.");return}if(this.lastAssistantIntent===null){this.setVoiceState("error","That message couldn't be sent. Please check your connection and try again.");return}const n=typeof this.lastAssistantIntent.detected_language=="string"?this.lastAssistantIntent.detected_language:this.lastReplyLanguage;this.lastReplyLanguage=n;const r=this.messages[this.messages.length-1];this.speakReply((r==null?void 0:r.content)??"")}speakReply(e){if(this.voicePrefs.muted||!this.voicePrefs.voiceEnabled){this.setVoiceState("idle"),this.maybeAutoListen();return}this.setVoiceState("speaking"),this.speakText(e,this.lastReplyLanguage,{onEnd:()=>{this.voiceState==="speaking"&&(this.setVoiceState("idle"),this.maybeAutoListen())},onError:(t,o)=>this.setVoiceState("error",this.describeVoiceError(t,o))})}async speakText(e,t,o){const n=++this.speechRequestId,r=()=>{n===this.speechRequestId&&(this.activeSpeaker=null,o.onEnd())},a=(c,h)=>{n===this.speechRequestId&&(this.activeSpeaker=null,o.onError(c,h))};if(!this.serverSpeechUnavailable)try{const c=await this.apiClient.synthesizeSpeech(e,t);if(n!==this.speechRequestId)return;this.activeSpeaker="server",await this.serverSpeaker.play(c,{onEnd:r,onError:a});return}catch(c){c instanceof y&&c.status===503&&(this.serverSpeechUnavailable=!0)}if(!k()){a("not-supported","Voice playback isn't supported in this browser.");return}if(n!==this.speechRequestId)return;this.activeSpeaker="browser";const d=j(t);await this.speaker.speak(e,d,{onEnd:r,onError:a})}handlePauseClick(){const e=this.activeSpeaker==="server"?this.serverSpeaker:this.speaker;e.isPaused()?(e.resume(),this.pauseButton.innerHTML=C,this.pauseButton.setAttribute("aria-label","Pause speaking")):(e.pause(),this.pauseButton.innerHTML=me,this.pauseButton.setAttribute("aria-label","Resume speaking"))}stopSpeech(){this.speechRequestId+=1,this.activeSpeaker=null,this.speaker.stop(),this.serverSpeaker.stop()}toggleMute(){this.voicePrefs={...this.voicePrefs,muted:!this.voicePrefs.muted},P(this.tenantSlug,this.voicePrefs),this.voicePrefs.muted&&this.voiceState==="speaking"&&(this.stopSpeech(),this.setVoiceState("idle")),this.updateMuteButton()}updateMuteButton(){this.muteButton.innerHTML=this.voicePrefs.muted?be:fe;const e=this.voicePrefs.muted?"Unmute voice replies":"Mute voice replies";this.muteButton.setAttribute("aria-label",e),this.muteButton.setAttribute("aria-pressed",String(this.voicePrefs.muted)),this.muteButton.title=e}toggleVoiceEnabled(){this.voicePrefs={...this.voicePrefs,voiceEnabled:!this.voicePrefs.voiceEnabled},P(this.tenantSlug,this.voicePrefs),this.voicePrefs.voiceEnabled||(this.recognizer.abort(),this.serverRecorder.abort(),this.stopSpeech(),this.setVoiceState("idle"),this.dismissProactivePrompt()),this.updateVoiceToggleButton(),this.updateMicButtonVisibility()}updateVoiceToggleButton(){this.voiceToggleButton.innerHTML=this.voicePrefs.voiceEnabled?z:ge;const e=this.voicePrefs.voiceEnabled?"Turn voice off":"Turn voice on";this.voiceToggleButton.setAttribute("aria-label",e),this.voiceToggleButton.setAttribute("aria-pressed",String(this.voicePrefs.voiceEnabled)),this.voiceToggleButton.title=e}updateMicButtonVisibility(){const e=this.voiceSupported&&this.voicePrefs.voiceEnabled;this.micButton.classList.toggle("zello-hidden",!e),e||this.pauseButton.classList.add("zello-hidden")}describeVoiceError(e,t){switch(e){case"permission-denied":return"Microphone access was denied. Please allow microphone access in your browser settings and try again.";case"network":return"A network problem interrupted voice recognition. Please try again.";case"not-supported":return"Voice isn't supported in this browser.";case"synthesis-failed":return"Couldn't play the voice reply. You can still read the response above.";case"transcription-failed":return"I couldn't understand that audio. Please try again.";default:return t||"Something went wrong with voice. Please try again."}}setVoiceState(e,t){switch(this.voiceState=e,this.micButton.classList.remove("zello-mic-listening","zello-mic-processing","zello-mic-speaking","zello-mic-error"),this.voiceStatusEl.classList.remove("zello-voice-status-visible","zello-voice-status-error"),this.voiceStatusEl.textContent="",this.pauseButton.classList.add("zello-hidden"),this.micButton.disabled=!this.voiceSupported||!this.voicePrefs.voiceEnabled,e){case"listening":this.micButton.classList.add("zello-mic-listening"),this.micButton.innerHTML=R,this.micButton.setAttribute("aria-label","Stop listening"),this.voiceStatusEl.textContent="Listening…",this.voiceStatusEl.classList.add("zello-voice-status-visible");break;case"processing":this.micButton.classList.add("zello-mic-processing"),this.micButton.disabled=!0,this.micButton.innerHTML=z,this.voiceStatusEl.textContent="Thinking…",this.voiceStatusEl.classList.add("zello-voice-status-visible");break;case"speaking":this.micButton.classList.add("zello-mic-speaking"),this.micButton.innerHTML=R,this.micButton.setAttribute("aria-label","Stop speaking"),this.voiceSupported&&this.voicePrefs.voiceEnabled&&this.pauseButton.classList.remove("zello-hidden"),this.pauseButton.innerHTML=C,this.pauseButton.setAttribute("aria-label","Pause speaking"),this.voiceStatusEl.textContent="Speaking…",this.voiceStatusEl.classList.add("zello-voice-status-visible");break;case"error":this.micButton.classList.add("zello-mic-error"),this.micButton.innerHTML=z,this.micButton.setAttribute("aria-label","Start voice input"),this.voiceStatusEl.textContent=t??"Something went wrong.",this.voiceStatusEl.classList.add("zello-voice-status-visible","zello-voice-status-error");break;case"idle":default:this.micButton.innerHTML=z,this.micButton.setAttribute("aria-label","Start voice input");break}}}customElements.define("zello-widget",O);function N(){if(document.querySelector("zello-widget"))return;const s=V(),i=new O(s);_(i,s)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",N):N()})();
