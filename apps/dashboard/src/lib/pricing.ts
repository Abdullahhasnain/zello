export type PricingPlan = { id: "founding" | "growth" | "pro" | "enterprise"; name: string; price: string; badge?: string; cta: string; featured?: boolean; features: readonly string[] };

export const PRICING_PLANS: readonly PricingPlan[] = [
  { id: "founding", name: "Founding Customer", price: "Rs 9,999/month", badge: "Only 10 stores", cta: "Become a Founding Customer", features: ["First 10 stores · price locked for 3 months", "One e-commerce store", "AI voice and text sales agent", "Roman Urdu, Urdu and English", "Discovery, comparison and add-to-cart", "Basic sales analytics", "Shopify or WooCommerce integration", "Free setup during founding offer"] },
  { id: "growth", name: "Growth", price: "Rs 14,999/month", badge: "Most Popular", cta: "Start 14-Day Free Pilot", featured: true, features: ["One e-commerce store", "AI voice and text sales agent", "Roman Urdu, Urdu and English", "Recommendations and comparison", "Cart and COD checkout assistance", "Shopify or WooCommerce integration", "Catalog synchronization", "Conversation and conversion analytics", "Email support"] },
  { id: "pro", name: "Pro", price: "Rs 29,999/month", cta: "Choose Pro", features: ["Everything in Growth", "Higher conversation and voice limits", "Advanced analytics", "Customer intent and demand insights", "Priority catalog synchronization", "Custom sales-agent behaviour", "Priority support", "API and custom-store integration"] },
  { id: "enterprise", name: "Enterprise", price: "Starting from Rs 60,000/month", cta: "Contact Sales", features: ["Multiple stores", "Custom usage limits and integrations", "Dedicated onboarding", "Role-based team access", "Advanced reporting", "Service-level support", "Custom security requirements"] },
] as const;
export type PlanId = PricingPlan["id"];
