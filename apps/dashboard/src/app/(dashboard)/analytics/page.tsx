import { getConversionSummary } from "@/lib/api/analytics";
import { listOrders } from "@/lib/api/orders";
import { listProducts } from "@/lib/api/products";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CountBarChart, CountPieChart, type CountDatum } from "@/components/analytics/analytics-charts";

function countBy<T>(items: T[], key: (item: T) => string): CountDatum[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = key(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
  }));
}

export default async function AnalyticsPage() {
  const [summary, orders, products] = await Promise.all([
    getConversionSummary(),
    listOrders({ limit: 200 }),
    listProducts({ limit: 200 }),
  ]);

  const ordersByStatus = countBy(orders, (order) => order.status);
  const ordersByPaymentMethod = countBy(orders, (order) => order.paymentMethod);
  const productsByStatus = countBy(products, (product) => product.status);

  return (
    <div>
      <PageHeader title="Analytics" description="Conversion performance and catalog health at a glance." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total conversations" value={summary.totalConversations.toLocaleString()} />
        <StatCard label="Total orders" value={summary.totalOrders.toLocaleString()} />
        <StatCard label="Conversion rate" value={`${(summary.conversionRate * 100).toFixed(1)}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersByStatus.length === 0 ? (
              <EmptyState title="No orders yet" description="Charts will populate once checkouts start coming in." />
            ) : (
              <CountBarChart data={ordersByStatus} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersByPaymentMethod.length === 0 ? (
              <EmptyState title="No payments yet" description="Payment method breakdown appears after your first order." />
            ) : (
              <CountPieChart data={ordersByPaymentMethod} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Catalog health</CardTitle>
          </CardHeader>
          <CardContent>
            {productsByStatus.length === 0 ? (
              <EmptyState title="No products yet" description="Add products to see catalog status breakdown." />
            ) : (
              <CountBarChart data={productsByStatus} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
