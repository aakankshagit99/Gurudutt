import { getCustomers } from "@/lib/actions";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-6">
      <CustomersClient initialCustomers={customers} />
    </div>
  );
}
