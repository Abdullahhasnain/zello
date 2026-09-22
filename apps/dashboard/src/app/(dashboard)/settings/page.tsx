import Link from "next/link";
import { getMyTenant } from "@/lib/api/tenants";
import { getMyProfile } from "@/lib/api/users";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PHASE_LABELS: Record<number, string> = {
  1: "Phase 1 — Text assistant",
  2: "Phase 2 — Voice assistant",
  3: "Phase 3 — Guided checkout",
  4: "Phase 4 — Autonomous checkout",
};

export default async function SettingsPage() {
  const [tenant, me] = await Promise.all([getMyTenant(), getMyProfile()]);

  return (
    <div>
      <PageHeader title="Settings" description="Your store and account details." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Store</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Name</span>
              <span className="font-medium text-ink">{tenant.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Slug</span>
              <span className="font-mono text-xs text-ink">{tenant.slug}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Status</span>
              <Badge tone={statusTone(tenant.status)}>{tenant.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Rollout phase</span>
              <span className="text-ink">{PHASE_LABELS[tenant.phase] ?? `Phase ${tenant.phase}`}</span>
            </div>
            <div className="flex gap-2 border-t border-border pt-3">
              <Link href="/widget-studio">
                <Button variant="secondary" size="sm">
                  Edit widget branding
                </Button>
              </Link>
              <Link href={`/store/${tenant.slug}`} target="_blank">
                <Button variant="secondary" size="sm">
                  View storefront ↗
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Email</span>
              <span className="font-medium text-ink">{me.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Role</span>
              <Badge tone="accent">{me.role}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
