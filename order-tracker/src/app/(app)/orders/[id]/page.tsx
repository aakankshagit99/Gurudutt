import { getOrderById, getUsers } from "@/lib/actions";
import { notFound } from "next/navigation";
import OrderDetailClient from "./OrderDetailClient";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, users] = await Promise.all([getOrderById(id), getUsers()]);
  if (!order) notFound();
  return <OrderDetailClient order={order} users={users} />;
}
