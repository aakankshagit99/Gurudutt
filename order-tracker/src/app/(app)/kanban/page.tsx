import { getOrders } from "@/lib/actions";
import KanbanClient from "./KanbanClient";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const { orders } = await getOrders({ pageSize: 200 });
  return <KanbanClient orders={orders} />;
}
