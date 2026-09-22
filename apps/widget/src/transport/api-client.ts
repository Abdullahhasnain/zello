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
    return this.request<MessageExchangeResponse>(
      `/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
    );
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
    const response = await this.requestResponse("/voice/speech", {
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
    if (response.status === 401 && session) {
      const refreshed = await this.tryRefresh(session.refreshToken);
      if (refreshed) {
        return this.requestResponse(path, init);
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
