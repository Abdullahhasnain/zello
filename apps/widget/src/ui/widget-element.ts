import { ApiClient } from "../transport/api-client";
import type { WidgetConfig } from "../config";
import type {
  ChatBubble,
  ConversationMessage,
  StorefrontProduct,
  TenantBrandingRead,
} from "../types";
import { buildProductRow } from "./product-card";
import { buildStyles } from "./styles";

// How many of a turn's matched products actually get fetched and shown —
// kept small and constant for the same reason
// app/modules/conversations/router.py's _REPLY_PRODUCT_LIMIT is: a chat
// panel full of product cards stops being a usable reply regardless of how
// many the search itself found.
const MAX_DISPLAYED_PRODUCTS = 5;

const DEFAULT_PRIMARY_COLOR = "#B6602A";

const LAUNCHER_ICON = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.8l1.45 5.75L19 10l-5.55 1.45L12 17.2l-1.45-5.75L5 10l5.55-1.45L12 2.8z" fill="currentColor"/>
    <path d="M19 15.5l.6 2.1 2.1.6-2.1.6-.6 2.1-.6-2.1-2.1-.6 2.1-.6.6-2.1z" fill="currentColor"/>
  </svg>
`;

const SEND_ICON = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor"/>
  </svg>
`;

function uid(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The whole widget in one custom element: a floating launcher button and
 * a chat panel, both rendered into a Shadow DOM root so the partner
 * site's CSS can never bleed in and the widget's own styles can never
 * bleed out (see ui/styles.ts). No framework — this is the Phase 1
 * text-only bundle (see vite.config.ts and the SRS's IP-protection
 * requirement), and a few hundred lines of direct DOM manipulation is
 * simpler and smaller than pulling in a rendering library for it.
 */
export class ZelloWidgetElement extends HTMLElement {
  protected readonly shadow: ShadowRoot;
  protected readonly apiClient: ApiClient;

  private conversationId: string | null = null;
  protected messages: ChatBubble[] = [];
  protected isOpen = false;
  private isExpanded = false;
  private isSending = false;
  // A visual affordance only. The backend action remains the source of truth
  // and clears this state on any non-successful or completed response.
  private pendingCartProductId: string | null = null;
  // Set to the just-received assistant reply's `intent` dict on a
  // successful send, reset to null at the start of every handleSend() call
  // (including its early-return guards) — this is how ui/voice-widget-element.ts
  // (the only other reader) tells a successful turn from a failed/skipped
  // one without handleSend() needing to change its own error-swallowing
  // behavior for the text-only flow. See handleSend() below.
  protected lastAssistantIntent: Record<string, unknown> | null = null;

  private styleEl!: HTMLStyleElement;
  protected launcherButton!: HTMLButtonElement;
  protected panel!: HTMLDivElement;
  protected headerEl!: HTMLDivElement;
  private headerTitleEl!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  protected inputEl!: HTMLInputElement;
  protected sendButton!: HTMLButtonElement;

  constructor(private readonly config: WidgetConfig) {
    super();
    this.apiClient = new ApiClient(config.apiBaseUrl, config.tenantSlug);
    this.shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.buildDom();
    this.addEventListener("zello:presentation", () => {
      const inline = this.hasAttribute("data-inline");
      this.panel.setAttribute("role", inline ? "region" : "dialog");
      this.setOpen(inline, false);
    });

    // Apply any cached branding immediately — a returning visitor's widget
    // is themed correctly on the very first paint, before bootstrap()'s
    // network calls resolve.
    const cachedBranding = this.apiClient.getCachedBranding();
    if (cachedBranding) {
      this.applyBranding(cachedBranding);
    }

    void this.bootstrap();
  }

  // --- DOM construction ---

  private buildDom(): void {
    this.styleEl = document.createElement("style");
    this.styleEl.textContent = buildStyles(DEFAULT_PRIMARY_COLOR);
    this.shadow.appendChild(this.styleEl);

    this.launcherButton = document.createElement("button");
    this.launcherButton.className = `zello-launcher zello-position-${this.config.position}`;
    this.launcherButton.setAttribute("aria-label", "Ask Zello AI");
    this.launcherButton.innerHTML = `${LAUNCHER_ICON}<span>Ask Zello AI</span>`;
    this.launcherButton.addEventListener("click", () =>
      this.setOpen(!this.isOpen),
    );
    this.shadow.appendChild(this.launcherButton);

    this.panel = document.createElement("div");
    this.panel.className = `zello-panel zello-position-${this.config.position}`;
    this.panel.setAttribute("role", this.hasAttribute("data-inline") ? "region" : "dialog");
    this.panel.setAttribute("aria-label", "Zello AI sales agent");
    this.headerEl = this.buildHeader();
    this.panel.appendChild(this.headerEl);

    this.messagesEl = document.createElement("div");
    this.messagesEl.className = "zello-messages";
    this.panel.appendChild(this.messagesEl);

    this.panel.appendChild(this.buildInputRow());
    if (this.config.storefrontPath) {
      const actions = document.createElement("nav");
      actions.className = "zello-shopping-links";
      for (const [label, suffix] of [["Review cart", "/cart"], ["Checkout", "/checkout"]]) {
        const link = document.createElement("a");
        link.textContent = label;
        link.href = `${this.config.storefrontPath}${suffix}`;
        actions.appendChild(link);
      }
      this.panel.appendChild(actions);
    }
    this.shadow.appendChild(this.panel);
  }

  private buildHeader(): HTMLDivElement {
    const header = document.createElement("div");
    header.className = "zello-header";

    this.headerTitleEl = document.createElement("div");
    this.headerTitleEl.className = "zello-header-title";
    this.headerTitleEl.innerHTML = "<span class=\"zello-orb\">✦</span><span><strong>Zello AI</strong><small><i></i> Online · Your AI shopping assistant</small></span>";

    const expandButton = document.createElement("button");
    expandButton.className = "zello-expand-button";
    expandButton.setAttribute("aria-label", "Expand assistant");
    expandButton.textContent = "↗";
    expandButton.addEventListener("click", () => {
      this.isExpanded = !this.isExpanded;
      this.panel.classList.toggle("zello-expanded", this.isExpanded);
      expandButton.textContent = this.isExpanded ? "↙" : "↗";
      expandButton.setAttribute("aria-label", this.isExpanded ? "Reduce assistant" : "Expand assistant");
    });

    const closeButton = document.createElement("button");
    closeButton.className = "zello-close-button";
    closeButton.setAttribute("aria-label", "Close chat");
    closeButton.textContent = "✕";
    closeButton.addEventListener("click", () => this.setOpen(false));

    header.appendChild(this.headerTitleEl);
    header.appendChild(expandButton);
    header.appendChild(closeButton);
    return header;
  }

  private buildInputRow(): HTMLFormElement {
    const row = document.createElement("form");
    row.className = "zello-input-row";
    row.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.handleSend();
    });

    this.inputEl = document.createElement("input");
    this.inputEl.className = "zello-input";
    this.inputEl.type = "text";
    this.inputEl.placeholder = "Kya chahiye? Budget, colour aur size batayein…";
    this.inputEl.setAttribute("aria-label", "Message Zello");

    this.sendButton = document.createElement("button");
    this.sendButton.type = "submit";
    this.sendButton.className = "zello-send-button";
    this.sendButton.setAttribute("aria-label", "Send message");
    this.sendButton.innerHTML = SEND_ICON;

    row.appendChild(this.inputEl);
    row.appendChild(this.sendButton);
    return row;
  }

  // --- Bootstrap: session + conversation history / auto-greeting ---

  private async bootstrap(): Promise<void> {
    try {
      await this.apiClient.ensureSession();

      const cachedMessages = this.apiClient.getCachedMessages();
      const cachedConversationId = this.apiClient.getStoredConversationId();
      if (cachedMessages.length > 0 && cachedConversationId) {
        this.conversationId = cachedConversationId;
        this.messages = cachedMessages;
        this.renderMessages();
        this.onBootstrapped();
        window.dispatchEvent(new CustomEvent("zello:agent-ready", { detail: { tenantSlug: this.config.tenantSlug } }));
        return;
      }

      const started = await this.apiClient.startConversation(
        this.config.language,
      );
      this.conversationId = started.conversation.id;
      this.applyBranding(started.branding);
      this.messages = [this.toBubble(started.greeting)];
      this.apiClient.setCachedMessages(this.messages);
      this.renderMessages();
      this.onBootstrapped();
      window.dispatchEvent(new CustomEvent("zello:agent-ready", { detail: { tenantSlug: this.config.tenantSlug } }));
    } catch (error) {
      this.renderError(
        "Sorry, we couldn't connect right now. Please refresh the page and try again.",
      );
      // eslint-disable-next-line no-console
      console.error("[zello-widget] bootstrap failed", error);
    }
  }

  /** No-op in this text-only base — ui/voice-widget-element.ts overrides it
   * to schedule the proactive greeting prompt once real conversation
   * content (the actual, branding-aware greeting text) exists to show. */
  protected onBootstrapped(): void {}

  private applyBranding(branding: TenantBrandingRead): void {
    if (branding.primaryColor) {
      this.styleEl.textContent = buildStyles(branding.primaryColor);
    }
    if (branding.logoUrl || branding.greetingPersona) {
      this.headerTitleEl.textContent = branding.greetingPersona
        ? "Zello AI"
        : this.headerTitleEl.textContent;
    }
  }

  // --- Sending a message ---

  protected async handleSend(): Promise<void> {
    this.lastAssistantIntent = null;
    const content = this.inputEl.value.trim();
    if (!content || this.isSending || !this.conversationId) {
      return;
    }

    this.isSending = true;
    this.inputEl.value = "";
    this.setSendingState(true);

    const optimisticId = uid();
    this.messages.push({
      id: optimisticId,
      role: "customer",
      content,
      createdAt: new Date().toISOString(),
      pending: true,
    });
    this.renderMessages();
    this.renderTypingIndicator(true);

    try {
      const exchange = await this.apiClient.postMessage(
        this.conversationId,
        content,
      );
      const customerIndex = this.messages.findIndex(
        (m) => m.id === optimisticId,
      );
      const customerBubble = this.toBubble(exchange.customerMessage);
      if (customerIndex >= 0) {
        this.messages[customerIndex] = customerBubble;
      } else {
        this.messages.push(customerBubble);
      }
      const assistantBubble = this.toBubble(exchange.assistantMessage);
      if (exchange.action?.type === "ADD_TO_CART") {
        assistantBubble.action = exchange.action;
      }
      this.pendingCartProductId = null;
      this.messages.push(assistantBubble);
      this.lastAssistantIntent = exchange.assistantMessage.intent ?? {};
      this.apiClient.setCachedMessages(this.messages);
      // Fired after the finally-block's render below so the text reply
      // appears immediately; product cards pop in once the extra fetches
      // resolve rather than blocking the reply on them.
      void this.attachProductResults(assistantBubble);
    } catch (error) {
      this.pendingCartProductId = null;
      this.messages = this.messages.filter((m) => m.id !== optimisticId);
      this.renderError("That message couldn't be sent. Please try again.");
      // eslint-disable-next-line no-console
      console.error("[zello-widget] send message failed", error);
    } finally {
      this.isSending = false;
      this.setSendingState(false);
      this.renderTypingIndicator(false);
      this.renderMessages();
    }
  }

  private setSendingState(sending: boolean): void {
    this.sendButton.disabled = sending;
    this.sendButton.setAttribute("aria-busy", String(sending));
    this.sendButton.setAttribute("aria-label", sending ? "Sending message" : "Send message");
    this.sendButton.innerHTML = sending
      ? '<span class="zello-send-loading" aria-hidden="true"></span>'
      : SEND_ICON;
  }

  /** Fetches the real catalog record for each product the assistant's
   * reply was grounded in (see app/modules/conversations/router.py's
   * `matched_product_ids`) and attaches them to that turn's bubble so
   * renderMessages() can show real title/price/image — never text the AI
   * composed on its own. One bad/deleted product id must not blank out the
   * rest, hence the per-id `.catch(() => null)` before filtering. */
  protected async attachProductResults(bubble: ChatBubble): Promise<void> {
    const ids = this.lastAssistantIntent?.matched_product_ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return;
    }

    const products = (
      await Promise.all(
        ids
          .slice(0, MAX_DISPLAYED_PRODUCTS)
          .map((id) => this.apiClient.getProduct(String(id)).catch(() => null)),
      )
    ).filter((product): product is StorefrontProduct => product !== null);

    if (products.length === 0) {
      return;
    }
    bubble.products = products;
    this.apiClient.setCachedMessages(this.messages);
    this.renderMessages();
  }

  // --- Rendering ---

  protected setOpen(open: boolean, focus = true): void {
    this.isOpen = open;
    this.panel.classList.toggle("zello-open", open);
    if (open) {
      if (focus) this.inputEl.focus();
      this.scrollToBottom();
    }
  }

  private toBubble(message: ConversationMessage): ChatBubble {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    };
  }

  private renderMessages(): void {
    this.messagesEl.innerHTML = "";
    const latestAssistant = [...this.messages].reverse().find((message) => message.role === "assistant");
    for (const bubble of this.messages) {
      const el = document.createElement("div");
      el.className = `zello-bubble zello-bubble-${bubble.role === "customer" ? "customer" : "assistant"}`;
      if (bubble.pending) {
        el.classList.add("zello-bubble-pending");
      }
      el.textContent = bubble.content;
      this.messagesEl.appendChild(el);

      if (bubble.action?.type === "ADD_TO_CART") {
        this.messagesEl.appendChild(this.buildCartConfirmationCard(bubble.action));
      }

      // Keep conversational text, but only render product cards for the
      // latest recommendation. This avoids stale sneakers filling the panel
      // after a shopper asks about a different category.
      if (bubble.products && bubble.products.length > 0 && bubble === latestAssistant) {
        const actionable = !this.isSending;
        this.messagesEl.appendChild(buildProductRow(bubble.products, {
          onAdd: actionable ? (product) => this.beginCartAction(product) : undefined,
          pendingProductId: this.pendingCartProductId,
          addedProductId: bubble.action?.payload.productId,
        }));
        if (actionable) {
          const actions = document.createElement("div");
          actions.className = "zello-suggestions";
          const prompts = [
            ["✦ Recommend for me", "In options mein meri zaroorat aur budget ke liye kaunsa behtar hai? Wajah bhi batao."],
            ...(bubble.products.length > 1 ? [["Compare options", "In options ko price aur available features ke hisaab se compare karo."], ["Cheaper options", "Koi sasta option hai?"]] : []),
            ["Different colour", "Kya ye kisi aur colour mein available hai?"],
          ];
          for (const [label, prompt] of prompts) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "zello-action";
            button.textContent = label!;
            button.addEventListener("click", () => this.sendSuggestedMessage(prompt!));
            actions.appendChild(button);
          }
          this.messagesEl.appendChild(actions);
        }
      }
    }
    if (this.messages.length === 1 && !this.isSending) {
      this.messagesEl.appendChild(this.buildQuickChips());
    }
    this.scrollToBottom();
  }

  private sendSuggestedMessage(content: string): void {
    if (this.isSending) return;
    this.inputEl.value = content;
    void this.handleSend();
  }

  private beginCartAction(product: StorefrontProduct): void {
    if (this.isSending || product.status !== "active" || product.stockQty <= 0) return;
    this.pendingCartProductId = product.id;
    this.renderMessages();
    this.sendSuggestedMessage(`${product.title} ka ek piece cart mein add karo.`);
  }

  /** These are conversation starters, not catalog data. They use the same
   * typed-message path as a shopper's own words and are shown only before a
   * customer has started a shopping journey. */
  private buildQuickChips(): HTMLDivElement {
    const chips = document.createElement("div");
    chips.className = "zello-suggestions zello-quick-chips";
    for (const [label, prompt] of [
      ["👟 Sneakers", "Mujhe sneakers dikhayein"],
      ["👕 T-Shirts", "Mujhe t-shirts dikhayein"],
      ["Hoodies", "Mujhe hoodies dikhayein"],
      ["Jeans", "Mujhe jeans dikhayein"],
    ]) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "zello-action";
      chip.textContent = label;
      chip.addEventListener("click", () => this.sendSuggestedMessage(prompt));
      chips.appendChild(chip);
    }
    return chips;
  }

  /** Renders a deterministic receipt card from the completed backend action,
   * rather than trusting conversational text to represent a cart mutation. */
  private buildCartConfirmationCard(action: NonNullable<ChatBubble["action"]>): HTMLDivElement {
    const card = document.createElement("div");
    card.className = "zello-cart-confirmation";

    const title = document.createElement("strong");
    title.textContent = `${action.payload.title} added to cart`;
    card.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "zello-cart-actions";

    const viewCart = document.createElement("button");
    viewCart.type = "button";
    viewCart.className = "zello-action";
    viewCart.textContent = "View cart";
    viewCart.addEventListener("click", () => {
      if (this.config.storefrontPath) {
        window.location.assign(`${this.config.storefrontPath}/cart`);
        return;
      }
      window.dispatchEvent(new CustomEvent("zello:view-cart", {
        detail: { tenantSlug: this.config.tenantSlug },
      }));
    });
    actions.appendChild(viewCart);

    const similar = document.createElement("button");
    similar.type = "button";
    similar.className = "zello-action";
    similar.textContent = "Show similar";
    similar.addEventListener("click", () => {
      this.sendSuggestedMessage(`Show me similar products to ${action.payload.title}.`);
    });
    actions.appendChild(similar);

    const continueShopping = document.createElement("button");
    continueShopping.type = "button";
    continueShopping.className = "zello-action";
    continueShopping.textContent = "Continue shopping";
    continueShopping.addEventListener("click", () => this.inputEl.focus());
    actions.appendChild(continueShopping);

    card.appendChild(actions);
    return card;
  }

  private renderTypingIndicator(show: boolean): void {
    const existing = this.messagesEl.querySelector(".zello-typing");
    if (existing) {
      existing.remove();
    }
    if (show) {
      const indicator = document.createElement("div");
      indicator.className = "zello-typing";
      indicator.innerHTML = "<span></span><span></span><span></span><em>Options check kar raha hoon…</em>";
      this.messagesEl.appendChild(indicator);
      this.scrollToBottom();
    }
  }

  private renderError(message: string): void {
    const el = document.createElement("div");
    el.className = "zello-bubble zello-bubble-assistant";
    el.textContent = message;
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}
