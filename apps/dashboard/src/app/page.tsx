import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PRICING_PLANS } from "@/lib/pricing";

const PROBLEM_STATS = [
  { value: "68%", label: "Cart abandonment", detail: "Rigid keyword filters confuse shoppers who leave without buying." },
  { value: "0", label: "Platforms understand Roman Urdu", detail: "Most shoppers type and speak naturally in Roman Urdu — no existing platform gets it." },
  { value: "Rs. 40–60k", label: "Cost per human sales rep, per month", detail: "Out of reach for most retailers, and it doesn't scale past business hours." },
];

const SOLUTION_FEATURES = [
  {
    title: "Voice-first interaction",
    description: "Customers speak naturally — Roman Urdu, Urdu, or English — no menus, no filters.",
  },
  {
    title: "Conversational intelligence",
    description: "Understands intent, recommends products, and guides the shopper's journey turn by turn.",
  },
  {
    title: "Checkout assistance",
    description: "Guides shoppers to cart and Cash on Delivery checkout with clear confirmation.",
  },
  {
    title: "Unified partner inventory",
    description: "Pulls live product data across your catalog in real time via API, CSV, or platform sync.",
  },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Greets", description: "The widget speaks first — every visitor, every time." },
  { step: "2", title: "Listens", description: "The customer states their need, out loud or by typing." },
  { step: "3", title: "Understands", description: "Extracts intent, budget, and preferences from what they said." },
  { step: "4", title: "Finds", description: "Searches your live catalog semantically — Roman Urdu included." },
  { step: "5", title: "Adds to cart", description: "Reserves the item the moment the shopper confirms." },
  { step: "6", title: "Checks out", description: "Guides customers through Cash on Delivery checkout. Wallet payments are coming soon." },
];

const MARKET_STATS = [
  { value: "$5B+", label: "Pakistani e-commerce market by 2026" },
  { value: "190M+", label: "Mobile subscribers" },
  { value: "80M+", label: "Internet users" },
  { value: "$151B", label: "Global voice commerce market (2025)" },
];


export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <MarketingHeader />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-ink">
            Pakistan&apos;s first AI voice sales agent
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl font-bold leading-tight text-ink sm:text-5xl">
            Every Pakistani website that talks, sells, and closes the sale — autonomously.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base text-ink-soft sm:text-lg">
            A customer lands on your store. Zello AI greets them by voice, listens to what they need,
            finds the right product, and assists with Cash on Delivery checkout — entirely through natural conversation in
            Roman Urdu, Urdu, or English.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sign-up">
              <Button size="lg">Get started free</Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="secondary" size="lg">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-border bg-surface py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">The problem</span>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">
              Pakistani e-commerce is losing sales every day
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {PROBLEM_STATS.map((stat) => (
              <Card key={stat.label} className="p-6">
                <p className="font-display text-3xl font-bold text-accent">{stat.value}</p>
                <p className="mt-2 text-sm font-semibold text-ink">{stat.label}</p>
                <p className="mt-1 text-sm text-ink-soft">{stat.detail}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent2">The solution</span>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">
              A voice agent that sells for you
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {SOLUTION_FEATURES.map((feature) => (
              <Card key={feature.title} className="p-6">
                <h3 className="font-display text-base font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-surface py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">How it works</span>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">
              From greeting to checkout assistance
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step}>
                <span className="font-display text-2xl font-bold text-accent">{item.step}</span>
                <h3 className="mt-1 text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-xs text-ink-soft">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Market */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent2">
              Market opportunity
            </span>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">
              A $5 billion market with zero voice-AI players
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-4">
            {MARKET_STATS.map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-3xl font-bold text-ink">{stat.value}</p>
                <p className="mt-1 text-sm text-ink-soft">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-y border-border bg-surface py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">Pricing</span>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">
              Simple pricing that grows with your store
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {PRICING_PLANS.map((tier) => (
              <Card key={tier.id} className={`flex flex-col p-6 ${tier.featured ? "border-2 border-accent shadow-card" : ""}`}>
                {tier.badge ? <span className="mb-3 w-fit rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-ink">{tier.badge}</span> : null}
                <h3 className="text-lg font-semibold text-ink">{tier.name}</h3>
                <p className="mt-3 font-display text-2xl font-bold text-ink">{tier.price}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-soft">{tier.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
                <Link href={tier.id === "enterprise" ? "mailto:hello@zello.ai?subject=Enterprise%20Zello%20AI" : `/sign-up?plan=${tier.id}`} className="mt-6"><Button variant={tier.featured ? "primary" : "secondary"} className="w-full">{tier.cta}</Button></Link>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-center text-sm font-medium text-ink">14-day free pilot · No credit card required · Cancel anytime</p>
          <p className="mt-2 text-center text-xs text-ink-faint">Voice and AI usage limits depend on the selected plan. We will always notify customers before any additional usage charges.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2"><Card className="p-5"><h3 className="font-semibold text-ink">Pricing FAQ</h3><p className="mt-3 text-sm text-ink-soft"><strong>Is setup included?</strong> Setup is free for founding customers. Custom integrations may require a one-time implementation fee.</p><p className="mt-3 text-sm text-ink-soft"><strong>Does Zello take commission on sales?</strong> No commission is charged on standard monthly plans.</p></Card><Card className="p-5"><p className="text-sm text-ink-soft"><strong>What happens after the free pilot?</strong> Select a paid plan or stop using Zello—no automatic charge.</p><p className="mt-3 text-sm text-ink-soft"><strong>Are JazzCash and Easypaisa included?</strong> Coming soon; MVP supports COD checkout assistance.</p><p className="mt-3 text-sm text-ink-soft"><strong>Custom website?</strong> Available on Pro and Enterprise.</p></Card></div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          Ready to let your store talk to every customer?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
          Start with a free pilot — no card required.
        </p>
        <div className="mt-6">
          <Link href="/sign-up">
            <Button size="lg">Get started free</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-ink-faint sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} Zello AI. All rights reserved.</span>
          <span>Pre-revenue · MVP ready</span>
        </div>
      </footer>
    </div>
  );
}
