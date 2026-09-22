import Link from "next/link";
import { getConversionSummary } from "@/lib/api/analytics";
import { listOrders } from "@/lib/api/orders";
import { listProducts } from "@/lib/api/products";
import { getMyTenant } from "@/lib/api/tenants";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    amount,
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default async function DashboardHomePage() {
  const [tenant, summary, recentOrders, recentProducts] = await Promise.all([
    getMyTenant(),
    getConversionSummary(),
    listOrders({ limit: 5 }),
    listProducts({ limit: 5 }),
  ]);

  const conversionPercent = `${(summary.conversionRate * 100).toFixed(1)}%`;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${tenant.name}`}
        description="Here's how your AI sales agent is performing."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Conversations" value={summary.totalConversations.toLocaleString()} />
        <StatCard label="Orders placed" value={summary.totalOrders.toLocaleString()} />
        <StatCard label="Conversion rate" value={conversionPercent} />
        <StatCard label="Products live" value={recentProducts.length.toLocaleString()} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent orders</CardTitle>
            <Link href="/orders" className="text-sm font-medium text-accent hover:text-accent-ink">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <EmptyState
                title="No orders yet"
                description="Once a customer completes checkout through your AI agent, it'll show up here."
              />
            ) : (
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Placed</Th>
                      <Th>Status</Th>
                      <Th>Payment</Th>
                      <Th>Total</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {recentOrders.map((order) => (
                      <Tr key={order.id}>
                        <Td>{formatDate(order.placedAt)}</Td>
                        <Td>
                          <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                        </Td>
                        <Td>
                          <Badge tone={statusTone(order.paymentStatus)}>{order.paymentMethod}</Badge>
                        </Td>
                        <Td className="font-medium">{formatCurrency(order.totalAmount, order.currency)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Catalog</CardTitle>
            <Link href="/products" className="text-sm font-medium text-accent hover:text-accent-ink">
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            {recentProducts.length === 0 ? (
              <EmptyState
                title="No products yet"
                description="Connect your catalog so your AI agent has something to sell."
                action={
                  <Link href="/onboarding">
                    <Button size="sm">Connect catalog</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {recentProducts.map((product) => (
                  <li key={product.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="truncate text-ink">{product.title}</span>
                    <span className="ml-3 shrink-0 font-medium tabular-nums text-ink-soft">
                      {formatCurrency(product.price, product.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
