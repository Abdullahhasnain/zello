/**
 * Domain types mirroring services/api/app/modules/**\/schemas.py and the DDL
 * in db/ddl/. Field names are camelCase here (API responses are camelCase
 * per the Pydantic aliasing convention in app/shared/schema.py); the
 * underlying Postgres columns are snake_case — see docs/architecture/erd.md.
 */

export type UUID = string;
export type ISODateTime = string;

export type StorePhase = 1 | 2 | 3 | 4;

export type StoreUserRole = "owner" | "staff" | "viewer";
export type AdminRole = "super_admin" | "ops" | "support" | "finance";

export type ConversationChannel = "widget" | "whatsapp" | "instagram" | "tiktok";
export type ConversationStatus = "active" | "completed" | "abandoned" | "escalated";
export type MessageRole = "customer" | "assistant" | "system";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "fulfilled"
  | "cancelled"
  | "refunded";

export type PaymentProvider = "jazzcash" | "easypaisa" | "cod";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";
export type CommissionStatus = "pending" | "invoiced" | "paid";
export type ProductStatus = "active" | "out_of_stock" | "archived";
export type InventoryAdjustmentReason = "restock" | "sale" | "correction" | "return";

export interface TenantBranding {
  logoUrl?: string;
  primaryColor?: string;
  greetingPersona?: string;
  languageMix?: Array<"roman_urdu" | "urdu" | "english">;
}

export interface Tenant {
  id: UUID;
  name: string;
  slug: string;
  status: "pilot" | "active" | "suspended" | "churned";
  phase: StorePhase;
  branding: TenantBranding;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface FeatureFlag {
  id: UUID;
  tenantId: UUID;
  key: "voice_enabled" | "autonomous_checkout_enabled" | string;
  enabled: boolean;
  updatedAt: ISODateTime;
}

export interface StoreUser {
  id: UUID;
  tenantId: UUID;
  email: string;
  role: StoreUserRole;
}

export interface AdminUser {
  id: UUID;
  email: string;
  role: AdminRole;
}

export interface Category {
  id: UUID;
  tenantId: UUID;
  name: string;
  slug: string;
  parentId?: UUID;
}

export interface Brand {
  id: UUID;
  tenantId: UUID;
  name: string;
  slug: string;
  logoUrl?: string;
}

export interface Product {
  id: UUID;
  tenantId: UUID;
  externalId: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  stockQty: number;
  categoryId?: UUID;
  brandId?: UUID;
  images: string[];
  attributes: Record<string, unknown>;
  status: ProductStatus;
}

export interface ProductVariant {
  id: UUID;
  tenantId: UUID;
  productId: UUID;
  sku: string;
  attributes: Record<string, unknown>;
  price?: number;
  stockQty: number;
  status: ProductStatus;
}

export interface ProductImage {
  id: UUID;
  tenantId: UUID;
  productId: UUID;
  url: string;
  altText?: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface InventoryAdjustment {
  id: UUID;
  tenantId: UUID;
  productId: UUID;
  variantId?: UUID;
  delta: number;
  reason: InventoryAdjustmentReason;
  resultingStockQty: number;
  createdAt: ISODateTime;
}

export interface Customer {
  id: UUID;
  tenantId: UUID;
  phone?: string;
  name?: string;
  createdAt: ISODateTime;
}

export interface Conversation {
  id: UUID;
  tenantId: UUID;
  customerId?: UUID;
  channel: ConversationChannel;
  status: ConversationStatus;
  language: "roman_urdu" | "urdu" | "english";
  context: Record<string, unknown>;
  startedAt: ISODateTime;
  lastActivityAt: ISODateTime;
  endedAt?: ISODateTime;
}

export interface ConversationMessage {
  id: UUID;
  conversationId: UUID;
  role: MessageRole;
  content: string;
  audioUrl?: string;
  intent?: Record<string, unknown>;
  confidence?: number;
  createdAt: ISODateTime;
}

export interface Cart {
  id: UUID;
  tenantId: UUID;
  conversationId?: UUID;
  customerId?: UUID;
  status: "open" | "converted" | "abandoned";
}

export interface CartItem {
  id: UUID;
  cartId: UUID;
  productId: UUID;
  quantity: number;
  unitPrice: number;
}

export interface CartItemDetail {
  id: UUID;
  productId: UUID;
  productTitle: string;
  productImageUrl?: string;
  quantity: number;
  unitPrice: number;
}

export interface CartDetail {
  id: UUID;
  tenantId: UUID;
  status: string;
  items: CartItemDetail[];
  subtotal: number;
}

export interface GuestSession {
  accessToken: string;
  refreshToken: string;
  customerId: string;
  tenantId: string;
}

export interface TenantPublic {
  name: string;
  slug: string;
  branding: TenantBranding;
}

export interface Order {
  id: UUID;
  tenantId: UUID;
  cartId?: UUID;
  customerId?: UUID;
  conversationId?: UUID;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  paymentMethod: PaymentProvider;
  paymentStatus: PaymentStatus;
  placedAt: ISODateTime;
}

export interface OrderItem {
  id: UUID;
  orderId: UUID;
  productId: UUID;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Payment {
  id: UUID;
  orderId: UUID;
  tenantId: UUID;
  provider: PaymentProvider;
  providerRef?: string;
  amount: number;
  status: PaymentStatus;
  createdAt: ISODateTime;
}

export interface SubscriptionPlan {
  id: UUID;
  name: string;
  priceMonthly: number;
  commissionRate: number;
  features: Record<string, unknown>;
}

export interface Subscription {
  id: UUID;
  tenantId: UUID;
  planId: UUID;
  status: SubscriptionStatus;
  currentPeriodStart: ISODateTime;
  currentPeriodEnd: ISODateTime;
  trialEnd?: ISODateTime;
}

export interface CommissionLedgerEntry {
  id: UUID;
  tenantId: UUID;
  orderId: UUID;
  amount: number;
  rate: number;
  status: CommissionStatus;
}

export interface Invoice {
  id: UUID;
  tenantId: UUID;
  periodStart: ISODateTime;
  periodEnd: ISODateTime;
  amountDue: number;
  status: "draft" | "issued" | "paid" | "overdue";
}

export interface ConversionSummary {
  totalConversations: number;
  totalOrders: number;
  conversionRate: number;
}
