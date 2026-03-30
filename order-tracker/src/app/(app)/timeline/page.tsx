import { getOrders } from "@/lib/actions";
import TimelineClient from "./TimelineClient";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const { orders } = await getOrders({ pageSize: 100 });
  return <TimelineClient orders={orders} />;
}
