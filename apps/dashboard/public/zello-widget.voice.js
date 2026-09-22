var ve=Object.defineProperty;var be=(h,d,p)=>d in h?ve(h,d,{enumerable:!0,configurable:!0,writable:!0,value:p}):h[d]=p;var r=(h,d,p)=>be(h,typeof d!="symbol"?d+"":d,p);(function(){"use strict";const h="https://api.zello.ai/api/v1";function d(){if(document.currentScript instanceof HTMLScriptElement)return document.currentScript;const s=Array.from(document.querySelectorAll("script[data-tenant-slug]"));return s.length>0?s[s.length-1]:null}function p(s){var e;if(s==="urdu"||s==="english"||s==="roman_urdu")return s;const t=(((e=navigator.languages)==null?void 0:e[0])||navigator.language||"").toLowerCase();return t.startsWith("ur")?"urdu":t.startsWith("hi")?"roman_urdu":"english"}function V(){const s=d(),t=s==null?void 0:s.dataset.tenantSlug;if(!t)throw new Error("Zello widget: missing required data-tenant-slug attribute on the embed <script> tag.");const e=s==null?void 0:s.dataset.position;return{tenantSlug:t,apiBaseUrl:(s==null?void 0:s.dataset.apiBaseUrl)||h,language:p(s==null?void 0:s.dataset.language),position:e==="bottom-left"?"bottom-left":"bottom-right"}}function g(s,t){return`zello:${s}:${t}`}class R{constructor(t){this.tenantSlug=t}getSession(){const t=window.localStorage.getItem(g(this.tenantSlug,"session"));if(!t)return null;try{return JSON.parse(t)}catch{return null}}setSession(t){window.localStorage.setItem(g(this.tenantSlug,"session"),JSON.stringify(t))}clearSession(){window.localStorage.removeItem(g(this.tenantSlug,"session"))}setConversationId(t){const e=this.getSession();e&&this.setSession({...e,conversationId:t})}setBranding(t){const e=this.getSession();e&&this.setSession({...e,branding:t})}getMessages(){const t=window.localStorage.getItem(g(this.tenantSlug,"messages"));if(!t)return[];try{return JSON.parse(t)}catch{return[]}}setMessages(t){const e=t.slice(-100);window.localStorage.setItem(g(this.tenantSlug,"messages"),JSON.stringify(e))}clearMessages(){window.localStorage.removeItem(g(this.tenantSlug,"messages"))}}class v extends Error{constructor(t,e){super(`API request failed with status ${t}`),this.status=t,this.body=e}}class N{constructor(t,e){r(this,"storage");this.baseUrl=t,this.tenantSlug=e,this.storage=new R(e)}async ensureSession(){const t=this.storage.getSession();if(t)return{accessToken:t.accessToken,refreshToken:t.refreshToken,customerId:t.customerId,tenantId:t.tenantId};const e=await this.request("/auth/guest-session",{method:"POST",body:JSON.stringify({tenantSlug:this.tenantSlug}),skipAuth:!0});return this.storage.setSession({...e,conversationId:null,branding:null}),e}getStoredConversationId(){var t;return((t=this.storage.getSession())==null?void 0:t.conversationId)??null}getCachedBranding(){var t;return((t=this.storage.getSession())==null?void 0:t.branding)??null}async startConversation(t){const e=await this.request(`/conversations?language=${encodeURIComponent(t)}`,{method:"POST"});return this.storage.setConversationId(e.conversation.id),this.storage.setBranding(e.branding),e}async postMessage(t,e){return this.request(`/conversations/${t}/messages`,{method:"POST",body:JSON.stringify({content:e})})}async getProduct(t){return this.request(`/catalog/storefront/products/${t}`)}async transcribeAudio(t){return(await this.request("/voice/transcriptions",{method:"POST",headers:{"Content-Type":t.type||"audio/webm"},body:t})).text}async synthesizeSpeech(t,e){return(await this.requestResponse("/voice/speech",{method:"POST",body:JSON.stringify({text:t,language:e})})).blob()}clearSession(){this.storage.clearSession(),this.storage.clearMessages()}getCachedMessages(){return this.storage.getMessages()}setCachedMessages(t){this.storage.setMessages(t)}async request(t,e={}){return await(await this.requestResponse(t,e)).json()}async requestResponse(t,e={}){const{skipAuth:i,...o}=e,a=i?null:this.storage.getSession(),n=new Headers(o.headers);n.has("Content-Type")||n.set("Content-Type","application/json"),a&&n.set("Authorization",`Bearer ${a.accessToken}`);const l=await fetch(`${this.baseUrl}${t}`,{...o,headers:n});if(l.status===401&&a&&await this.tryRefresh(a.refreshToken))return this.requestResponse(t,e);if(!l.ok){const c=await l.json().catch(()=>{});throw new v(l.status,c)}return l}async tryRefresh(t){try{const e=await fetch(`${this.baseUrl}/auth/refresh`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refreshToken:t})});if(!e.ok)return this.clearSession(),!1;const i=await e.json(),o=this.storage.getSession();return this.storage.setSession({...i,conversationId:(o==null?void 0:o.conversationId)??null,branding:(o==null?void 0:o.branding)??null}),!0}catch{return this.clearSession(),!1}}}const O={english:"en-US",roman_urdu:"ur-PK",urdu:"ur-PK"},U={english:"en-US",roman_urdu:"ur-PK",urdu:"ur-PK"};function z(s){return s==="english"||s==="urdu"||s==="roman_urdu"?s:"english"}function _(s){return O[z(s)]}function H(s){return U[z(s)]}const q=2e4,D=1100,j=.025;function $(){for(const s of["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4"])if(MediaRecorder.isTypeSupported(s))return s;return""}class m{constructor(){r(this,"recorder",null);r(this,"stream",null);r(this,"audioContext",null);r(this,"animationFrame",null);r(this,"timeout",null);r(this,"aborted",!1)}static isSupported(){var t;return typeof MediaRecorder<"u"&&typeof navigator<"u"&&!!((t=navigator.mediaDevices)!=null&&t.getUserMedia)}async start(t){if(this.recorder||!m.isSupported()){t.onError("not-supported","Audio recording isn't supported in this browser.");return}try{this.aborted=!1;const e=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}});this.stream=e;const i=$(),o=new MediaRecorder(e,i?{mimeType:i}:void 0),a=[];this.recorder=o,o.ondataavailable=n=>{n.data.size>0&&a.push(n.data)},o.onerror=()=>{this.cleanup(),t.onError("unknown","The microphone recording failed. Please try again.")},o.onstop=()=>{const n=this.aborted,l=o.mimeType||i||"audio/webm";if(this.cleanup(),n)return;const c=new Blob(a,{type:l});if(c.size<200){t.onError("no-speech","I couldn't hear anything. Please try again.");return}t.onAudio(c)},o.start(250),this.startVoiceActivityDetection(e),this.timeout=setTimeout(()=>this.stop(),q)}catch(e){this.cleanup();const i=e instanceof DOMException&&(e.name==="NotAllowedError"||e.name==="SecurityError");t.onError(i?"permission-denied":"unknown",i?"Microphone access was denied.":"Could not start the microphone.")}}stop(){var t;((t=this.recorder)==null?void 0:t.state)==="recording"&&this.recorder.stop()}abort(){var t;this.aborted=!0,((t=this.recorder)==null?void 0:t.state)==="recording"?this.recorder.stop():this.cleanup()}isActive(){var t;return((t=this.recorder)==null?void 0:t.state)==="recording"}startVoiceActivityDetection(t){const e=window.AudioContext;if(!e)return;const i=new e,o=i.createAnalyser();o.fftSize=512,i.createMediaStreamSource(t).connect(o);const a=new Uint8Array(o.fftSize);let n=!1,l=performance.now();const c=()=>{if(!this.isActive())return;o.getByteTimeDomainData(a);let u=0;for(const fe of a){const I=(fe-128)/128;u+=I*I}const x=Math.sqrt(u/a.length),M=performance.now();if(x>=j)n=!0,l=M;else if(n&&M-l>=D){this.stop();return}this.animationFrame=requestAnimationFrame(c)};this.audioContext=i,this.animationFrame=requestAnimationFrame(c)}cleanup(){var t,e;this.animationFrame!==null&&cancelAnimationFrame(this.animationFrame),this.timeout!==null&&clearTimeout(this.timeout),(t=this.stream)==null||t.getTracks().forEach(i=>i.stop()),(e=this.audioContext)==null||e.close(),this.animationFrame=null,this.timeout=null,this.stream=null,this.audioContext=null,this.recorder=null}}class F{constructor(){r(this,"audio",null);r(this,"objectUrl",null)}async play(t,e){this.stop();const i=URL.createObjectURL(t),o=new Audio(i);this.objectUrl=i,this.audio=o,o.onplay=()=>{var a;return(a=e.onStart)==null?void 0:a.call(e)},o.onended=()=>{this.cleanup(),e.onEnd()},o.onerror=()=>{this.cleanup(),e.onError("synthesis-failed","The generated voice reply could not be played.")};try{await o.play()}catch{this.cleanup(),e.onError("synthesis-failed","The browser blocked voice playback.")}}pause(){var t;(t=this.audio)==null||t.pause()}resume(){var t;(t=this.audio)==null||t.play()}stop(){this.audio&&(this.audio.onplay=null,this.audio.onended=null,this.audio.onerror=null,this.audio.pause(),this.audio.currentTime=0),this.cleanup()}isSpeaking(){return!!this.audio&&!this.audio.paused&&!this.audio.ended}isPaused(){return!!this.audio&&this.audio.paused&&this.audio.currentTime>0&&!this.audio.ended}cleanup(){this.objectUrl&&URL.revokeObjectURL(this.objectUrl),this.objectUrl=null,this.audio=null}}function E(){const s=window;return s.SpeechRecognition??s.webkitSpeechRecognition??null}function b(){return E()!==null}const G=15e3;class Y{constructor(){r(this,"recognition",null);r(this,"timeoutHandle",null);r(this,"active",!1)}start(t,e){if(this.active)return;const i=E();if(!i){e.onError("not-supported","Speech recognition isn't supported in this browser.");return}const o=new i;o.lang=t,o.continuous=!1,o.interimResults=!0,o.maxAlternatives=1;let a="";o.onresult=n=>{for(let l=n.resultIndex;l<n.results.length;l++){const c=n.results[l],u=c==null?void 0:c[0];!c||!u||(c.isFinal?(a+=u.transcript,e.onResult(a.trim(),!0)):e.onResult((a+u.transcript).trim(),!1))}},o.onerror=n=>{const l=n.error==="not-allowed"||n.error==="service-not-allowed"?"permission-denied":n.error==="no-speech"?"no-speech":n.error==="network"?"network":n.error==="aborted"?"aborted":"unknown";e.onError(l,n.message||`Speech recognition error: ${n.error}`)},o.onend=()=>{this.clearTimeout(),this.active=!1,this.recognition=null,e.onEnd()},this.recognition=o,this.active=!0,this.timeoutHandle=setTimeout(()=>{this.stop()},G);try{o.start()}catch{this.clearTimeout(),this.active=!1,this.recognition=null,e.onError("unknown","Could not start voice recognition. Please try again.")}}stop(){var t;this.clearTimeout(),(t=this.recognition)==null||t.stop()}abort(){var t;this.clearTimeout(),(t=this.recognition)==null||t.abort(),this.active=!1,this.recognition=null}isActive(){return this.active}clearTimeout(){this.timeoutHandle!==null&&(clearTimeout(this.timeoutHandle),this.timeoutHandle=null)}}function w(){return typeof window<"u"&&"speechSynthesis"in window}function J(s){var a;const t=window.speechSynthesis.getVoices();if(t.length===0)return null;const e=t.find(n=>n.lang.toLowerCase()===s.toLowerCase());if(e)return e;const i=(a=s.split("-")[0])==null?void 0:a.toLowerCase();return(i?t.find(n=>n.lang.toLowerCase().startsWith(i)):void 0)??null}async function K(){window.speechSynthesis.getVoices().length>0||await new Promise(s=>{const t=setTimeout(s,1e3);window.speechSynthesis.addEventListener("voiceschanged",()=>{clearTimeout(t),s()},{once:!0})})}class W{async speak(t,e,i){if(!w()){i.onError("not-supported","Voice playback isn't supported in this browser.");return}if(!t.trim()){i.onEnd();return}window.speechSynthesis.cancel(),await K();const o=new SpeechSynthesisUtterance(t);o.lang=e;const a=J(e);a&&(o.voice=a),o.onstart=()=>{var n;return(n=i.onStart)==null?void 0:n.call(i)},o.onend=()=>i.onEnd(),o.onerror=n=>{if(n.error==="interrupted"||n.error==="canceled"){i.onEnd();return}i.onError("synthesis-failed",`Speech synthesis error: ${n.error}`)},window.speechSynthesis.speak(o)}pause(){window.speechSynthesis.speaking&&!window.speechSynthesis.paused&&window.speechSynthesis.pause()}resume(){window.speechSynthesis.paused&&window.speechSynthesis.resume()}stop(){window.speechSynthesis.cancel()}isSpeaking(){return window.speechSynthesis.speaking}isPaused(){return window.speechSynthesis.paused}}const S={voiceEnabled:!0,muted:!1};function k(s){return`zello:${s}:voice-prefs`}function C(s){return`zello:${s}:proactive-prompt-shown`}function Z(s){const t=window.localStorage.getItem(k(s));if(!t)return{...S};try{return{...S,...JSON.parse(t)}}catch{return{...S}}}function B(s,t){window.localStorage.setItem(k(s),JSON.stringify(t))}function X(s){return window.sessionStorage.getItem(C(s))==="1"}function Q(s){window.sessionStorage.setItem(C(s),"1")}function ee(s){const t=document.createElement("div");t.className="zello-product-row";for(const e of s)t.appendChild(te(e));return t}function te(s){const t=document.createElement("div");t.className="zello-product-card";const e=document.createElement("div");e.className="zello-product-image";const i=s.images[0];if(i){const n=document.createElement("img");n.src=i,n.alt=s.title,n.loading="lazy",e.appendChild(n)}else e.classList.add("zello-product-image-placeholder");t.appendChild(e);const o=document.createElement("div");o.className="zello-product-title",o.textContent=s.title,t.appendChild(o);const a=document.createElement("div");if(a.className="zello-product-price",a.textContent=ie(s.price,s.currency),t.appendChild(a),s.status==="out_of_stock"||s.stockQty<=0){const n=document.createElement("div");n.className="zello-product-badge",n.textContent="Out of stock",t.appendChild(n)}return t}function ie(s,t){const e=typeof s=="string"?Number(s):s;return Number.isNaN(e)?`${t} ${s}`:`${t} ${e.toLocaleString("en-US",{maximumFractionDigits:0})}`}function T(s){return`
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
  `}const se=5,oe="#B6602A",ne=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>
`,re=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor"/>
  </svg>
`;function ae(){return`local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}class le extends HTMLElement{constructor(e){super();r(this,"shadow");r(this,"apiClient");r(this,"conversationId",null);r(this,"messages",[]);r(this,"isOpen",!1);r(this,"isSending",!1);r(this,"lastAssistantIntent",null);r(this,"styleEl");r(this,"launcherButton");r(this,"panel");r(this,"headerEl");r(this,"headerTitleEl");r(this,"messagesEl");r(this,"inputEl");r(this,"sendButton");this.config=e,this.apiClient=new N(e.apiBaseUrl,e.tenantSlug),this.shadow=this.attachShadow({mode:"open"})}connectedCallback(){this.buildDom();const e=this.apiClient.getCachedBranding();e&&this.applyBranding(e),this.bootstrap()}buildDom(){this.styleEl=document.createElement("style"),this.styleEl.textContent=T(oe),this.shadow.appendChild(this.styleEl),this.launcherButton=document.createElement("button"),this.launcherButton.className=`zello-launcher zello-position-${this.config.position}`,this.launcherButton.setAttribute("aria-label","Open chat"),this.launcherButton.innerHTML=ne,this.launcherButton.addEventListener("click",()=>this.setOpen(!this.isOpen)),this.shadow.appendChild(this.launcherButton),this.panel=document.createElement("div"),this.panel.className=`zello-panel zello-position-${this.config.position}`,this.panel.setAttribute("role","dialog"),this.panel.setAttribute("aria-label","Chat with us"),this.headerEl=this.buildHeader(),this.panel.appendChild(this.headerEl),this.messagesEl=document.createElement("div"),this.messagesEl.className="zello-messages",this.panel.appendChild(this.messagesEl),this.panel.appendChild(this.buildInputRow()),this.shadow.appendChild(this.panel)}buildHeader(){const e=document.createElement("div");e.className="zello-header",this.headerTitleEl=document.createElement("div"),this.headerTitleEl.className="zello-header-title",this.headerTitleEl.textContent="Chat with us";const i=document.createElement("button");return i.className="zello-close-button",i.setAttribute("aria-label","Close chat"),i.textContent="✕",i.addEventListener("click",()=>this.setOpen(!1)),e.appendChild(this.headerTitleEl),e.appendChild(i),e}buildInputRow(){const e=document.createElement("div");return e.className="zello-input-row",this.inputEl=document.createElement("input"),this.inputEl.className="zello-input",this.inputEl.type="text",this.inputEl.placeholder="Type a message...",this.inputEl.addEventListener("keydown",i=>{i.key==="Enter"&&(i.preventDefault(),this.handleSend())}),this.sendButton=document.createElement("button"),this.sendButton.className="zello-send-button",this.sendButton.setAttribute("aria-label","Send message"),this.sendButton.innerHTML=re,this.sendButton.addEventListener("click",()=>void this.handleSend()),e.appendChild(this.inputEl),e.appendChild(this.sendButton),e}async bootstrap(){try{await this.apiClient.ensureSession();const e=this.apiClient.getCachedMessages(),i=this.apiClient.getStoredConversationId();if(e.length>0&&i){this.conversationId=i,this.messages=e,this.renderMessages(),this.onBootstrapped();return}const o=await this.apiClient.startConversation(this.config.language);this.conversationId=o.conversation.id,this.applyBranding(o.branding),this.messages=[this.toBubble(o.greeting)],this.apiClient.setCachedMessages(this.messages),this.renderMessages(),this.onBootstrapped()}catch(e){this.renderError("Sorry, we couldn't connect right now. Please refresh the page and try again."),console.error("[zello-widget] bootstrap failed",e)}}onBootstrapped(){}applyBranding(e){e.primaryColor&&(this.styleEl.textContent=T(e.primaryColor)),(e.logoUrl||e.greetingPersona)&&(this.headerTitleEl.textContent=e.greetingPersona?"Zello AI":this.headerTitleEl.textContent)}async handleSend(){this.lastAssistantIntent=null;const e=this.inputEl.value.trim();if(!e||this.isSending||!this.conversationId)return;this.isSending=!0,this.inputEl.value="",this.sendButton.disabled=!0;const i=ae();this.messages.push({id:i,role:"customer",content:e,createdAt:new Date().toISOString(),pending:!0}),this.renderMessages(),this.renderTypingIndicator(!0);try{const o=await this.apiClient.postMessage(this.conversationId,e),a=this.messages.findIndex(c=>c.id===i),n=this.toBubble(o.customerMessage);a>=0?this.messages[a]=n:this.messages.push(n);const l=this.toBubble(o.assistantMessage);this.messages.push(l),this.lastAssistantIntent=o.assistantMessage.intent??{},this.apiClient.setCachedMessages(this.messages),this.attachProductResults(l)}catch(o){this.messages=this.messages.filter(a=>a.id!==i),this.renderError("That message couldn't be sent. Please try again."),console.error("[zello-widget] send message failed",o)}finally{this.isSending=!1,this.sendButton.disabled=!1,this.renderTypingIndicator(!1),this.renderMessages()}}async attachProductResults(e){var a;const i=(a=this.lastAssistantIntent)==null?void 0:a.matched_product_ids;if(!Array.isArray(i)||i.length===0)return;const o=(await Promise.all(i.slice(0,se).map(n=>this.apiClient.getProduct(String(n)).catch(()=>null)))).filter(n=>n!==null);o.length!==0&&(e.products=o,this.apiClient.setCachedMessages(this.messages),this.renderMessages())}setOpen(e){this.isOpen=e,this.panel.classList.toggle("zello-open",e),e&&(this.inputEl.focus(),this.scrollToBottom())}toBubble(e){return{id:e.id,role:e.role,content:e.content,createdAt:e.createdAt}}renderMessages(){this.messagesEl.innerHTML="";for(const e of this.messages){const i=document.createElement("div");i.className=`zello-bubble zello-bubble-${e.role==="customer"?"customer":"assistant"}`,e.pending&&i.classList.add("zello-bubble-pending"),i.textContent=e.content,this.messagesEl.appendChild(i),e.products&&e.products.length>0&&this.messagesEl.appendChild(ee(e.products))}this.scrollToBottom()}renderTypingIndicator(e){const i=this.messagesEl.querySelector(".zello-typing");if(i&&i.remove(),e){const o=document.createElement("div");o.className="zello-typing",o.innerHTML="<span></span><span></span><span></span>",this.messagesEl.appendChild(o),this.scrollToBottom()}}renderError(e){const i=document.createElement("div");i.className="zello-bubble zello-bubble-assistant",i.textContent=e,this.messagesEl.appendChild(i),this.scrollToBottom()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}}function ce(){return`
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
  `}const f=`
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
`,y=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/>
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>
  </svg>
`,de=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5v14l11-7z" fill="currentColor"/>
  </svg>
`,he=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"/>
    <path d="M15.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`,pe=`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"/>
    <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`,ge=45e3,me=4e3;class L extends le{constructor(e){super(e);r(this,"recognizer",new Y);r(this,"speaker",new W);r(this,"serverRecorder",new m);r(this,"serverSpeaker",new F);r(this,"voiceSupported");r(this,"serverTranscriptionUnavailable",!1);r(this,"serverSpeechUnavailable",!1);r(this,"activeSpeaker",null);r(this,"speechRequestId",0);r(this,"tenantSlug");r(this,"position");r(this,"voicePrefs");r(this,"voiceState","idle");r(this,"lastReplyLanguage");r(this,"greetingText","");r(this,"greetingStarted",!1);r(this,"voiceStyleEl");r(this,"voiceStatusEl");r(this,"micButton");r(this,"pauseButton");r(this,"muteButton");r(this,"voiceToggleButton");r(this,"proactiveBubble",null);r(this,"proactiveTimer",null);r(this,"audioUnlocked",!1);r(this,"unlockAudio",()=>{this.audioUnlocked=!0,this.tryAutoGreet()});this.tenantSlug=e.tenantSlug,this.position=e.position,this.lastReplyLanguage=e.language,this.voiceSupported=m.isSupported()||b()&&w(),this.voicePrefs=Z(this.tenantSlug)}connectedCallback(){if(super.connectedCallback(),this.addVoiceStyles(),this.addVoiceControls(),this.addHeaderControls(),this.launcherButton.addEventListener("click",()=>this.handleLauncherToggled()),this.voiceSupported){const e={once:!0,capture:!0,passive:!0};window.addEventListener("pointerdown",this.unlockAudio,e),window.addEventListener("keydown",this.unlockAudio,e),window.addEventListener("touchstart",this.unlockAudio,e),window.addEventListener("scroll",this.unlockAudio,e)}}disconnectedCallback(){this.recognizer.abort(),this.serverRecorder.abort(),this.stopSpeech(),this.proactiveTimer!==null&&clearTimeout(this.proactiveTimer),window.removeEventListener("pointerdown",this.unlockAudio,!0),window.removeEventListener("keydown",this.unlockAudio,!0),window.removeEventListener("touchstart",this.unlockAudio,!0),window.removeEventListener("scroll",this.unlockAudio,!0)}onBootstrapped(){if(!this.voicePrefs.voiceEnabled||X(this.tenantSlug))return;const e=this.messages.find(i=>i.role==="assistant");this.greetingText=(e==null?void 0:e.content)??"Hello! How can I help you today?",this.proactiveTimer=setTimeout(()=>{this.isOpen||this.showProactivePrompt(this.greetingText)},me),this.tryAutoGreet()}tryAutoGreet(){this.greetingStarted||!this.audioUnlocked||!this.greetingText||this.isOpen||!this.voicePrefs.voiceEnabled||this.voicePrefs.muted||(this.showProactivePrompt(this.greetingText),this.startVoiceGreeting(!1))}canAutoplayAudio(){const e=navigator.userActivation;return(e==null?void 0:e.hasBeenActive)===!0}startVoiceGreeting(e){if(this.greetingStarted)return;if(this.greetingStarted=!0,!(this.voiceSupported&&this.voicePrefs.voiceEnabled&&!this.voicePrefs.muted&&!!this.greetingText)){e&&this.maybeAutoListen();return}this.setVoiceState("speaking"),this.speakText(this.greetingText,this.lastReplyLanguage,{onEnd:()=>{this.voiceState==="speaking"&&this.setVoiceState("idle"),e&&this.maybeAutoListen()},onError:()=>{this.voiceState==="speaking"&&this.setVoiceState("idle"),e&&this.maybeAutoListen()}})}addVoiceStyles(){this.voiceStyleEl=document.createElement("style"),this.voiceStyleEl.textContent=ce(),this.shadow.appendChild(this.voiceStyleEl)}addVoiceControls(){const e=this.shadow.querySelector(".zello-input-row");if(!e)return;this.voiceStatusEl=document.createElement("div"),this.voiceStatusEl.className="zello-voice-status",this.voiceStatusEl.setAttribute("role","status"),this.voiceStatusEl.setAttribute("aria-live","polite");const i=document.createElement("div");i.className="zello-voice-disclosure",i.textContent="Voice replies are AI-generated.",this.panel.insertBefore(i,e),this.panel.insertBefore(this.voiceStatusEl,e),this.pauseButton=document.createElement("button"),this.pauseButton.type="button",this.pauseButton.className="zello-pause-button zello-hidden",this.pauseButton.innerHTML=y,this.pauseButton.setAttribute("aria-label","Pause speaking"),this.pauseButton.addEventListener("click",()=>this.handlePauseClick()),this.micButton=document.createElement("button"),this.micButton.type="button",this.micButton.className="zello-mic-button",this.micButton.innerHTML=f,this.voiceSupported?(this.micButton.setAttribute("aria-label","Start voice input"),this.micButton.addEventListener("click",()=>this.handleMicClick())):(this.micButton.disabled=!0,this.micButton.title="Voice isn't supported in this browser",this.micButton.setAttribute("aria-label","Voice input unavailable in this browser")),e.insertBefore(this.pauseButton,this.sendButton),e.insertBefore(this.micButton,this.sendButton),this.updateMicButtonVisibility()}addHeaderControls(){this.muteButton=document.createElement("button"),this.muteButton.type="button",this.muteButton.className="zello-header-icon-button",this.muteButton.addEventListener("click",()=>this.toggleMute()),this.updateMuteButton(),this.voiceToggleButton=document.createElement("button"),this.voiceToggleButton.type="button",this.voiceToggleButton.className="zello-header-icon-button",this.voiceToggleButton.addEventListener("click",()=>this.toggleVoiceEnabled()),this.updateVoiceToggleButton();const e=this.headerEl.querySelector(".zello-close-button");this.headerEl.insertBefore(this.voiceToggleButton,e),this.headerEl.insertBefore(this.muteButton,e)}handleLauncherToggled(){if(this.dismissProactivePrompt(),!this.isOpen){this.recognizer.abort(),this.serverRecorder.abort(),this.stopSpeech(),this.voiceState!=="idle"&&this.setVoiceState("idle");return}this.greetingStarted?this.maybeAutoListen():this.startVoiceGreeting(!0)}maybeAutoListen(){this.voiceSupported&&this.voicePrefs.voiceEnabled&&this.voiceState==="idle"&&this.startListening()}showProactivePrompt(e){if(this.proactiveBubble)return;this.proactiveTimer!==null&&(clearTimeout(this.proactiveTimer),this.proactiveTimer=null);const i=document.createElement("div");i.className=`zello-proactive-bubble zello-position-${this.position}`,i.setAttribute("role","button"),i.setAttribute("tabindex","0");const o=document.createElement("button");o.type="button",o.className="zello-proactive-dismiss",o.setAttribute("aria-label","Dismiss"),o.textContent="✕",o.addEventListener("click",l=>{l.stopPropagation(),this.dismissProactivePrompt()});const a=document.createElement("div");a.className="zello-proactive-text",a.textContent=e;const n=document.createElement("div");n.className="zello-proactive-hint",n.textContent=this.voiceSupported?"🎤 Tap to talk":"💬 Tap to chat",i.appendChild(o),i.appendChild(a),i.appendChild(n),i.addEventListener("click",()=>{this.dismissProactivePrompt(),this.setOpen(!0),this.startVoiceGreeting(!0)}),this.shadow.appendChild(i),this.proactiveBubble=i,this.launcherButton.classList.add("zello-launcher-attention"),Q(this.tenantSlug),(this.audioUnlocked||this.canAutoplayAudio())&&this.startVoiceGreeting(!1)}dismissProactivePrompt(){var e;this.proactiveTimer!==null&&(clearTimeout(this.proactiveTimer),this.proactiveTimer=null),(e=this.proactiveBubble)==null||e.remove(),this.proactiveBubble=null,this.launcherButton.classList.remove("zello-launcher-attention")}handleMicClick(){if(this.voicePrefs.voiceEnabled)switch(this.voiceState){case"listening":this.recognizer.stop(),this.serverRecorder.stop();return;case"speaking":this.stopSpeech(),this.setVoiceState("idle"),this.startListening();return;case"processing":return;case"idle":case"error":this.startListening()}}startListening(){if(this.setVoiceState("listening"),m.isSupported()&&!this.serverTranscriptionUnavailable){this.serverRecorder.start({onAudio:e=>{this.setVoiceState("processing"),this.transcribeAndSend(e)},onError:(e,i)=>{if(e==="no-speech"||e==="aborted"){this.setVoiceState("idle");return}this.setVoiceState("error",this.describeVoiceError(e,i))}});return}this.startBrowserListening()}startBrowserListening(){if(!b()){this.setVoiceState("error","Voice transcription is unavailable right now.");return}const e=_(this.lastReplyLanguage);this.recognizer.start(e,{onResult:(i,o)=>{this.inputEl.value=i,o&&i&&(this.setVoiceState("processing"),this.sendVoiceMessage(i))},onError:(i,o)=>{if(i==="no-speech"||i==="aborted"){this.setVoiceState("idle");return}this.setVoiceState("error",this.describeVoiceError(i,o))},onEnd:()=>{this.voiceState==="listening"&&this.setVoiceState("idle")}})}async transcribeAndSend(e){try{const i=(await this.apiClient.transcribeAudio(e)).trim();if(!i){this.setVoiceState("error","I couldn't hear that clearly. Please try again.");return}this.inputEl.value=i,await this.sendVoiceMessage(i)}catch(i){i instanceof v&&i.status===503&&(this.serverTranscriptionUnavailable=!0),this.setVoiceState("error",b()?"Server transcription is unavailable. Tap the mic to retry with browser speech.":"Voice transcription is temporarily unavailable. Please type your message.")}}async sendVoiceMessage(e){this.inputEl.value=e;const i=Symbol("timed-out");if(await Promise.race([this.handleSend().then(()=>"sent"),new Promise(l=>{setTimeout(()=>l(i),ge)})])===i){this.setVoiceState("error","That's taking longer than expected. Please try again in a moment.");return}if(this.lastAssistantIntent===null){this.setVoiceState("error","That message couldn't be sent. Please check your connection and try again.");return}const a=typeof this.lastAssistantIntent.detected_language=="string"?this.lastAssistantIntent.detected_language:this.lastReplyLanguage;this.lastReplyLanguage=a;const n=this.messages[this.messages.length-1];this.speakReply((n==null?void 0:n.content)??"")}speakReply(e){if(this.voicePrefs.muted||!this.voicePrefs.voiceEnabled){this.setVoiceState("idle"),this.maybeAutoListen();return}this.setVoiceState("speaking"),this.speakText(e,this.lastReplyLanguage,{onEnd:()=>{this.voiceState==="speaking"&&(this.setVoiceState("idle"),this.maybeAutoListen())},onError:(i,o)=>this.setVoiceState("error",this.describeVoiceError(i,o))})}async speakText(e,i,o){const a=++this.speechRequestId,n=()=>{a===this.speechRequestId&&(this.activeSpeaker=null,o.onEnd())},l=(u,x)=>{a===this.speechRequestId&&(this.activeSpeaker=null,o.onError(u,x))};if(!this.serverSpeechUnavailable)try{const u=await this.apiClient.synthesizeSpeech(e,i);if(a!==this.speechRequestId)return;this.activeSpeaker="server",await this.serverSpeaker.play(u,{onEnd:n,onError:l});return}catch(u){u instanceof v&&u.status===503&&(this.serverSpeechUnavailable=!0)}if(!w()){l("not-supported","Voice playback isn't supported in this browser.");return}if(a!==this.speechRequestId)return;this.activeSpeaker="browser";const c=H(i);await this.speaker.speak(e,c,{onEnd:n,onError:l})}handlePauseClick(){const e=this.activeSpeaker==="server"?this.serverSpeaker:this.speaker;e.isPaused()?(e.resume(),this.pauseButton.innerHTML=y,this.pauseButton.setAttribute("aria-label","Pause speaking")):(e.pause(),this.pauseButton.innerHTML=de,this.pauseButton.setAttribute("aria-label","Resume speaking"))}stopSpeech(){this.speechRequestId+=1,this.activeSpeaker=null,this.speaker.stop(),this.serverSpeaker.stop()}toggleMute(){this.voicePrefs={...this.voicePrefs,muted:!this.voicePrefs.muted},B(this.tenantSlug,this.voicePrefs),this.voicePrefs.muted&&this.voiceState==="speaking"&&(this.stopSpeech(),this.setVoiceState("idle")),this.updateMuteButton()}updateMuteButton(){this.muteButton.innerHTML=this.voicePrefs.muted?pe:he;const e=this.voicePrefs.muted?"Unmute voice replies":"Mute voice replies";this.muteButton.setAttribute("aria-label",e),this.muteButton.title=e}toggleVoiceEnabled(){this.voicePrefs={...this.voicePrefs,voiceEnabled:!this.voicePrefs.voiceEnabled},B(this.tenantSlug,this.voicePrefs),this.voicePrefs.voiceEnabled||(this.recognizer.abort(),this.serverRecorder.abort(),this.stopSpeech(),this.setVoiceState("idle"),this.dismissProactivePrompt()),this.updateVoiceToggleButton(),this.updateMicButtonVisibility()}updateVoiceToggleButton(){this.voiceToggleButton.innerHTML=this.voicePrefs.voiceEnabled?f:ue;const e=this.voicePrefs.voiceEnabled?"Turn voice off":"Turn voice on";this.voiceToggleButton.setAttribute("aria-label",e),this.voiceToggleButton.title=e}updateMicButtonVisibility(){const e=this.voiceSupported&&this.voicePrefs.voiceEnabled;this.micButton.classList.toggle("zello-hidden",!e),e||this.pauseButton.classList.add("zello-hidden")}describeVoiceError(e,i){switch(e){case"permission-denied":return"Microphone access was denied. Please allow microphone access in your browser settings and try again.";case"network":return"A network problem interrupted voice recognition. Please try again.";case"not-supported":return"Voice isn't supported in this browser.";case"synthesis-failed":return"Couldn't play the voice reply. You can still read the response above.";case"transcription-failed":return"I couldn't understand that audio. Please try again.";default:return i||"Something went wrong with voice. Please try again."}}setVoiceState(e,i){switch(this.voiceState=e,this.micButton.classList.remove("zello-mic-listening","zello-mic-processing","zello-mic-speaking","zello-mic-error"),this.voiceStatusEl.classList.remove("zello-voice-status-visible","zello-voice-status-error"),this.voiceStatusEl.textContent="",this.pauseButton.classList.add("zello-hidden"),this.micButton.disabled=!this.voiceSupported||!this.voicePrefs.voiceEnabled,e){case"listening":this.micButton.classList.add("zello-mic-listening"),this.micButton.innerHTML=A,this.micButton.setAttribute("aria-label","Stop listening"),this.voiceStatusEl.textContent="Listening…",this.voiceStatusEl.classList.add("zello-voice-status-visible");break;case"processing":this.micButton.classList.add("zello-mic-processing"),this.micButton.disabled=!0,this.micButton.innerHTML=f,this.voiceStatusEl.textContent="Thinking…",this.voiceStatusEl.classList.add("zello-voice-status-visible");break;case"speaking":this.micButton.classList.add("zello-mic-speaking"),this.micButton.innerHTML=A,this.micButton.setAttribute("aria-label","Stop speaking"),this.voiceSupported&&this.voicePrefs.voiceEnabled&&this.pauseButton.classList.remove("zello-hidden"),this.pauseButton.innerHTML=y,this.pauseButton.setAttribute("aria-label","Pause speaking"),this.voiceStatusEl.textContent="Speaking…",this.voiceStatusEl.classList.add("zello-voice-status-visible");break;case"error":this.micButton.classList.add("zello-mic-error"),this.micButton.innerHTML=f,this.micButton.setAttribute("aria-label","Start voice input"),this.voiceStatusEl.textContent=i??"Something went wrong.",this.voiceStatusEl.classList.add("zello-voice-status-visible","zello-voice-status-error");break;case"idle":default:this.micButton.innerHTML=f,this.micButton.setAttribute("aria-label","Start voice input");break}}}customElements.define("zello-widget",L);function P(){if(document.querySelector("zello-widget"))return;const s=V(),t=new L(s);document.body.appendChild(t)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",P):P()})();
