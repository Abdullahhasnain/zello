import Link from "next/link";
import { listOrders } from "@/lib/api/orders";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    amount,
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const { offset: offsetParam } = await searchParams;
  const offset = Number(offsetParam ?? 0) || 0;

  const orders = await listOrders({ limit: PAGE_SIZE, offset });
  const hasNext = orders.length === PAGE_SIZE;
  const hasPrev = offset > 0;
  const prevOffset = Math.max(0, offset - PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;

  return (
    <div>
      <PageHeader title="Orders" description="Every checkout your AI agent has completed." />

      {orders.length === 0 ? (
        <EmptyState
          title={offset > 0 ? "No more orders" : "No orders yet"}
          description="Completed checkouts from customer conversations will appear here."
        />
      ) : (
        <>
          <TableWrap>
            <Table>
              <Thead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Placed</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                  <Th>Total</Th>
                </Tr>
              </Thead>
              <Tbody>
                {orders.map((order) => (
                  <Tr key={order.id}>
                    <Td className="font-mono text-xs text-ink-faint">{order.id.slice(0, 8)}</Td>
                    <Td>{formatDate(order.placedAt)}</Td>
                    <Td>
                      <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="text-ink-soft">{order.paymentMethod.replace("_", " ")}</span>
                        <Badge tone={statusTone(order.paymentStatus)}>{order.paymentStatus}</Badge>
                      </div>
                    </Td>
                    <Td className="font-medium">{formatCurrency(order.totalAmount, order.currency)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>

          <div className="mt-4 flex justify-end gap-2">
            {hasPrev ? (
              <Link href={`/orders?offset=${prevOffset}`}>
                <Button variant="secondary" size="sm">
                  Previous
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" size="sm" disabled>
                Previous
              </Button>
            )}
            {hasNext ? (
              <Link href={`/orders?offset=${nextOffset}`}>
                <Button variant="secondary" size="sm">
                  Next
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" size="sm" disabled>
                Next
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
