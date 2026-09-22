/**
 * localStorage persistence, namespaced per tenant slug — a shopper's
 * session token and conversation history for tenant A must never bleed
 * into a lookup for tenant B, even though both are stored in the same
 * browser's localStorage under the same top-level domain (the CDN-hosted
 * widget script's origin, not the partner site's).
 */

import type { ChatBubble, TenantBrandingRead } from "../types";

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  customerId: string;
  tenantId: string;
  conversationId: string | null;
  // Cached alongside the session (not just fetched on conversation start)
  // so a returning visitor's widget is themed correctly on the very first
  // paint, before any network round trip resolves — see
  // ui/widget-element.ts's bootstrap().
  branding: TenantBrandingRead | null;
}

function keyFor(tenantSlug: string, suffix: string): string {
  return `zello:${tenantSlug}:${suffix}`;
}

export class WidgetStorage {
  constructor(private readonly tenantSlug: string) {}

  getSession(): StoredSession | null {
    const raw = window.localStorage.getItem(keyFor(this.tenantSlug, "session"));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      // Corrupted or from an incompatible older widget version — treat as
      // absent rather than throwing and breaking the whole widget.
      return null;
    }
  }

  setSession(session: StoredSession): void {
    window.localStorage.setItem(keyFor(this.tenantSlug, "session"), JSON.stringify(session));
  }

  clearSession(): void {
    window.localStorage.removeItem(keyFor(this.tenantSlug, "session"));
  }

  setConversationId(conversationId: string): void {
    const session = this.getSession();
    if (session) {
      this.setSession({ ...session, conversationId });
    }
  }

  setBranding(branding: TenantBrandingRead): void {
    const session = this.getSession();
    if (session) {
      this.setSession({ ...session, branding });
    }
  }

  getMessages(): ChatBubble[] {
    const raw = window.localStorage.getItem(keyFor(this.tenantSlug, "messages"));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ChatBubble[];
    } catch {
      return [];
    }
  }

  setMessages(messages: ChatBubble[]): void {
    // Cap what's persisted — this is a convenience cache for reopening the
    // widget, not the transcript of record (the backend has that). An
    // unbounded local cache would just grow localStorage forever for a
    // long-lived anonymous session.
    const bounded = messages.slice(-100);
    window.localStorage.setItem(keyFor(this.tenantSlug, "messages"), JSON.stringify(bounded));
  }

  clearMessages(): void {
    window.localStorage.removeItem(keyFor(this.tenantSlug, "messages"));
  }
}

export type { StoredSession };
