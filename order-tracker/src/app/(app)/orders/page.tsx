import { getOrders } from "@/lib/actions";
import OrdersClient from "@/components/OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { orders, total } = await getOrders({ page: 1, pageSize: 20 });
  return <OrdersClient initialOrders={orders} initialTotal={total} />;
}
