import { WidgetStorage } from "../core/storage";
import type {
  ConversationStartResponse,
  GuestSessionResponse,
  MessageExchangeResponse,
  StorefrontProduct,
  TenantBrandingRead,
  VoiceTranscriptionResponse,
} from "../types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API request failed with status ${status}`);
  }
}

/**
 * Talks to the backend on the customer widget's behalf: bootstraps a
 * guest session (see docs/architecture/auth-flow.md), attaches the access
 * token to every subsequent call, and transparently refreshes once on a
 * 401 before giving up — a shopper mid-conversation should never see an
 * auth error just because their access token's short TTL expired.
 */
export class ApiClient {
  private readonly storage: WidgetStorage;

  constructor(
    private readonly baseUrl: string,
    private readonly tenantSlug: string,
  ) {
    this.storage = new WidgetStorage(tenantSlug);
  }

  async ensureSession(): Promise<GuestSessionResponse> {
    const existing = this.storage.getSession();
    if (existing) {
      return {
        accessToken: existing.accessToken,
        refreshToken: existing.refreshToken,
        customerId: existing.customerId,
        tenantId: existing.tenantId,
      };
    }

    const session = await this.request<GuestSessionResponse>(
      "/auth/guest-session",
      {
        method: "POST",
        body: JSON.stringify({ tenantSlug: this.tenantSlug }),
        skipAuth: true,
      },
    );
    const racedSession = this.storage.getSession();
    if (racedSession) return racedSession;
    this.storage.setSession({
      ...session,
      conversationId: null,
      branding: null,
    });
    return session;
  }

  getStoredConversationId(): string | null {
    return this.storage.getSession()?.conversationId ?? null;
  }

  getCachedBranding(): TenantBrandingRead | null {
    return this.storage.getSession()?.branding ?? null;
  }

  async startConversation(
    language: string,
  ): Promise<ConversationStartResponse> {
    const result = await this.request<ConversationStartResponse>(
      `/conversations?language=${encodeURIComponent(language)}`,
      { method: "POST" },
    );
    this.storage.setConversationId(result.conversation.id);
    this.storage.setBranding(result.branding);
    return result;
  }

  async postMessage(
    conversationId: string,
    content: string,
  ): Promise<MessageExchangeResponse> {
    const requestId = crypto.randomUUID();
    const body = JSON.stringify({
      content,
      requestId,
      cartId: window.localStorage.getItem(`zello.storefront.cart.${this.tenantSlug}`),
    });
    let result: MessageExchangeResponse;
    try {
      result = await this.readMessageStream(conversationId, body);
    } catch {
      // Safe during rolling deploys and transient stream interruptions: the
      // same requestId makes the backend replay the persisted turn instead
      // of duplicating a message or cart mutation.
      result = await this.request<MessageExchangeResponse>(
        `/conversations/${conversationId}/messages`,
        { method: "POST", body },
      );
    }
    const intent = result.assistantMessage.intent;
    // The typed action is emitted only after the backend's add_item call
    // succeeds. Keep the legacy intent check as a compatibility fallback for
    // already-deployed API versions.
    const addedToCart = result.action?.type === "ADD_TO_CART" || intent.action === "add_to_cart";
    if (addedToCart && typeof intent.cart_id === "string") {
      const actionPayload = result.action?.type === "ADD_TO_CART" ? result.action.payload : undefined;
      window.localStorage.setItem(`zello.storefront.cart.${this.tenantSlug}`, intent.cart_id);
      window.dispatchEvent(new CustomEvent("zello:cart-changed", {
        // `count` and `slug` are the original public event contract. The
        // completed action fields are additive so a host store can update its
        // own product-level cart state without parsing assistant prose.
        detail: {
          count: intent.cart_count,
          slug: this.tenantSlug,
          productId: actionPayload?.productId,
          quantity: actionPayload?.quantity,
          title: actionPayload?.title,
        },
      }));
    }
    return result;
  }

  private async readMessageStream(
    conversationId: string,
    body: string,
  ): Promise<MessageExchangeResponse> {
    const response = await this.requestResponse(
      `/conversations/${conversationId}/messages/stream`,
      { method: "POST", body },
    );
    if (!response.body) throw new Error("Streaming response body is unavailable");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let completed: MessageExchangeResponse | null = null;
    const consume = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line) as { type?: string; data?: MessageExchangeResponse };
      if (event.type === "complete" && event.data) completed = event.data;
    };

    while (true) {
      const { done, value } = await reader.read();
      buffered += decoder.decode(value, { stream: !done });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) consume(line);
      if (done) break;
    }
    consume(buffered);
    if (!completed) throw new Error("Stream ended before the assistant reply completed");
    return completed;
  }

  /** Same tenant-scoped, RLS-isolated read the storefront pages use (see
   * app/modules/catalog/router.py's storefront_get_product) — never a
   * separate/looser lookup path just because it's called from the widget. */
  async getProduct(productId: string): Promise<StorefrontProduct> {
    return this.request<StorefrontProduct>(
      `/catalog/storefront/products/${productId}`,
    );
  }

  async transcribeAudio(audio: Blob): Promise<string> {
    const response = await this.request<VoiceTranscriptionResponse>(
      "/voice/transcriptions",
      {
        method: "POST",
        headers: { "Content-Type": audio.type || "audio/webm" },
        body: audio,
      },
    );
    return response.text;
  }

  async synthesizeSpeech(text: string, language: string): Promise<Blob> {
    const response = await this.requestResponse("/voice/tts", {
      method: "POST",
      body: JSON.stringify({ text, language }),
    });
    return response.blob();
  }

  clearSession(): void {
    this.storage.clearSession();
    this.storage.clearMessages();
  }

  getCachedMessages() {
    return this.storage.getMessages();
  }

  setCachedMessages(messages: ReturnType<WidgetStorage["getMessages"]>): void {
    this.storage.setMessages(messages);
  }

  private async request<T>(
    path: string,
    init: RequestInit & { skipAuth?: boolean } = {},
  ): Promise<T> {
    const response = await this.requestResponse(path, init);
    return (await response.json()) as T;
  }

  private async requestResponse(
    path: string,
    init: RequestInit & { skipAuth?: boolean } = {},
    refreshedOnce = false,
  ): Promise<Response> {
    const { skipAuth, ...requestInit } = init;
    const session = skipAuth ? null : this.storage.getSession();
    const headers = new Headers(requestInit.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (session) {
      headers.set("Authorization", `Bearer ${session.accessToken}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...requestInit,
      headers,
    });
    if (response.status === 401 && session && !refreshedOnce) {
      const refreshed = await this.tryRefresh(session.refreshToken);
      if (refreshed) {
        return this.requestResponse(path, init, true);
      }
    }
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new ApiError(response.status, body);
    }
    return response;
  }

  private async tryRefresh(refreshToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        this.clearSession();
        return false;
      }
      const refreshed = (await response.json()) as GuestSessionResponse;
      const existing = this.storage.getSession();
      this.storage.setSession({
        ...refreshed,
        conversationId: existing?.conversationId ?? null,
        branding: existing?.branding ?? null,
      });
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }
}
