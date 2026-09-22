-- Zello AI — baseline reference data. Safe to re-run (idempotent via
-- ON CONFLICT). Run after 003_row_level_security.sql.

-- Subscription plans matching the pitch deck's Business Model slide:
-- Rs. 15,000/store/month SaaS licensing + 3-5% transaction commission,
-- tiered by commission rate.
INSERT INTO subscription_plans (id, name, price_monthly, commission_rate, features)
VALUES
    (gen_random_uuid(), 'Pilot', 0.00, 0.0300,
     '{"description": "Free 3-month pilot for direct brand outreach (Khaadi, Sapphire, Alkaram, Imtiaz)."}'),
    (gen_random_uuid(), 'Standard', 15000.00, 0.0400,
     '{"description": "Standard SaaS licensing tier."}'),
    (gen_random_uuid(), 'Growth', 15000.00, 0.0500,
     '{"description": "Higher commission tier unlocking premium analytics (enterprise pricing)."}')
ON CONFLICT (name) DO NOTHING;
