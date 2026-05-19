import { getCustomers, getAvailableStages } from "@/lib/actions";
import CreateOrderClient from "./CreateOrderClient";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const customers = await getCustomers();
  const availableStages = await getAvailableStages();

  return <CreateOrderClient initialCustomers={customers} initialStages={availableStages} />;
}
