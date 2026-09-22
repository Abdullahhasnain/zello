/**
 * Mirrors the backend's camelCase response shapes (see
 * services/api/app/modules/{auth,conversations}/schemas.py). Hand-written
 * rather than generated — same convention as packages/types/src/domain.ts.
 */

export interface GuestSessionResponse {
  accessToken: string;
  refreshToken: string;
  customerId: string;
  tenantId: string;
}

export type MessageRole = "customer" | "assistant" | "system";

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  audioUrl: string | null;
  intent: Record<string, unknown>;
  confidence: number | null;
  createdAt: string;
}

export interface ConversationRead {
  id: string;
  tenantId: string;
  customerId: string | null;
  channel: string;
  status: string;
  language: string;
  context: Record<string, unknown>;
  startedAt: string;
  lastActivityAt: string;
  endedAt: string | null;
}

export interface ConversationStartResponse {
  conversation: ConversationRead;
  greeting: ConversationMessage;
  branding: TenantBrandingRead;
}

export interface MessageExchangeResponse {
  customerMessage: ConversationMessage;
  assistantMessage: ConversationMessage;
}

export interface VoiceTranscriptionResponse {
  text: string;
}

export interface TenantBrandingRead {
  logoUrl?: string;
  primaryColor?: string;
  greetingPersona?: string;
  languageMix?: string[];
}

/** Mirrors services/api/app/modules/catalog/schemas.py's ProductRead —
 * only the fields the widget actually displays. Fetched by product id
 * from the assistant reply's `intent.matched_product_ids` (see
 * ui/widget-element.ts's attachProductResults) so the widget can show
 * real catalog data — title/price/image — instead of just the AI's text
 * description of a product. */
export interface StorefrontProduct {
  id: string;
  title: string;
  price: number | string;
  currency: string;
  images: string[];
  stockQty: number;
  status: string;
}

/** Widget-local chat bubble shape — a superset that also represents
 * transient "sending..." state before the server round trip resolves. */
export interface ChatBubble {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  pending?: boolean;
  /** Populated after the fact (see attachProductResults) once the
   * assistant's matched products have been fetched — absent while that
   * fetch is still in flight or when the turn matched no products. */
  products?: StorefrontProduct[];
}
