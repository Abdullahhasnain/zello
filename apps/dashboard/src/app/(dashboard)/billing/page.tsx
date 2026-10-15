import { getMyProfile } from "@/lib/api/users";
import { getMyTenant } from "@/lib/api/tenants";
import { getSubscription, listInvoices, listPendingCommission } from "@/lib/api/billing";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(
    amount,
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(iso));
}

export default async function BillingPage() {
  const me = await getMyProfile();

  if (me.role !== "owner") {
    return (
      <div>
        <PageHeader title="Billing" description="Subscription, invoices, and commission." />
        <EmptyState
          title="Owner access required"
          description="Ask your store owner if you need visibility into billing."
        />
      </div>
    );
  }

  const [subscription, invoices, commission, tenant] = await Promise.all([
    getSubscription(),
    listInvoices(),
    listPendingCommission(),
    getMyTenant(),
  ]);

  return (
    <div>
      <PageHeader title="Plan & Usage" description="Your selected plan, trial status, and usage visibility." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">Status</span>
                  <Badge tone={statusTone(subscription.status)}>{subscription.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">Current period</span>
                  <span className="text-ink">
                    {formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}
                  </span>
                </div>
                {subscription.trialEnd ? (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-soft">Trial ends</span>
                    <span className="text-ink">{formatDate(subscription.trialEnd)}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3 text-sm"><p className="text-ink">Selected plan: <strong className="capitalize">{String(tenant.branding.selectedPlan ?? "growth")}</strong></p><p className="text-ink-soft">Activation and billing are completed only after Zello confirms your plan. No automatic charge is made.</p><a className="font-medium text-accent" href="mailto:hello@zello.ai?subject=Zello%20AI%20plan%20activation">Contact Zello to activate or upgrade →</a></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending commission</CardTitle>
          </CardHeader>
          <CardContent>
            {commission.length === 0 ? (
              <EmptyState title="No pending commission" description="Commission accrues 3–5% per completed order." />
            ) : (
              <ul className="divide-y divide-border">
                {commission.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-ink-soft">Order {entry.orderId.slice(0, 8)}</span>
                    <span className="font-medium text-ink">{formatCurrency(entry.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <EmptyState title="No invoices yet" description="Invoices will appear here at the end of each billing period." />
            ) : (
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Period</Th>
                      <Th>Amount due</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {invoices.map((invoice) => (
                      <Tr key={invoice.id}>
                        <Td>
                          {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                        </Td>
                        <Td className="font-medium">{formatCurrency(invoice.amountDue)}</Td>
                        <Td>
                          <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
