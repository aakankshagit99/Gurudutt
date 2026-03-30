"use client";

import { useState } from "react";
import { Plus, Search, Mail, Phone, MapPin, Building2, ChevronRight } from "lucide-react";
import { getCustomers, createCustomer } from "@/lib/actions";
import { toast } from "sonner";

type Customer = Awaited<ReturnType<typeof getCustomers>>[0];

export default function CustomersClient({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string || null,
      phone: formData.get("phone") as string || null,
      address: formData.get("address") as string || null,
    };

    try {
      const res = await createCustomer(data);
      if (res.success) {
        toast.success("Customer added successfully");
        setShowAdd(false);
        // Refresh local state or revalidate (revalidate handled in action)
        const updated = await getCustomers();
        setCustomers(updated);
      }
    } catch (err) {
      toast.error("Failed to add customer");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-slate-400 text-sm mt-1">{customers.length} total customers</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((customer) => (
          <div key={customer.id} className="stat-card group">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Orders</span>
                <p className="text-lg font-bold text-white">{customer._count.orders}</p>
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-white mb-4 group-hover:text-blue-400 transition-colors">
              {customer.name}
            </h3>

            <div className="space-y-2 mb-6 text-sm text-slate-400">
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{customer.address}</span>
                </div>
              )}
            </div>

            <button className="w-full btn-secondary justify-between text-xs py-2">
              View All Orders
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <h2 className="text-xl font-bold text-white mb-6">New Customer</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Company Name</label>
                <input name="name" required className="input-field" placeholder="e.g. Rothe Packtech Pvt Ltd" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Email</label>
                  <input name="email" type="email" className="input-field" placeholder="contact@company.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Phone</label>
                  <input name="phone" className="input-field" placeholder="+91 0000 0000" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Address</label>
                <textarea name="address" className="input-field h-24 resize-none" placeholder="Full company address..." />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={isPending} className="btn-primary flex-1 justify-center">
                  {isPending ? "Adding..." : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
