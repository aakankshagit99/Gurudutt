"use client";

import { useState, useTransition, useEffect } from "react";
import { updateOrder, getCustomers } from "@/lib/actions";
import { Priority } from "@prisma/client";
import { X, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Props {
  order: {
    id: string;
    customerId: string | null;
    projectName: string;
    poNumber: string;
    orderDate: Date | string;
    deadline: Date | string;
    priority: Priority;
    notes: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditOrderModal({ order, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const [customers, setCustomers] = useState<Awaited<ReturnType<typeof getCustomers>>>([]);
  const [form, setForm] = useState({
    customerId: order.customerId || "",
    projectName: order.projectName,
    poNumber: order.poNumber,
    orderDate: new Date(order.orderDate).toISOString().split("T")[0],
    deadline: new Date(order.deadline).toISOString().split("T")[0],
    priority: order.priority,
    notes: order.notes || "",
  });

  useEffect(() => {
    getCustomers().then(setCustomers);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) {
      toast.error("Please select a customer");
      return;
    }
    startTransition(async () => {
      try {
        await updateOrder(order.id, form);
        toast.success("Order updated successfully!");
        onSuccess();
        onClose();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to update order");
      }
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-2xl bg-[#0a0f1e]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500/15 border border-blue-500/25 rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Edit Order</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Customer *</label>
                <Link href="/customers" className="text-xs text-blue-400 hover:underline hover:text-blue-300">
                  + Create Customer
                </Link>
              </div>
              <select 
                name="customerId" 
                value={form.customerId} 
                onChange={handleChange} 
                required 
                className="input-field"
              >
                <option value="">Select Customer</option>
                {customers.map((c: { id: string; name: string }) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">PO Number *</label>
              <input name="poNumber" value={form.poNumber} onChange={handleChange} required className="input-field" placeholder="PO-2024-001" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Project Name *</label>
            <input name="projectName" value={form.projectName} onChange={handleChange} required className="input-field" placeholder="Steel Frame Assembly" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Order Date</label>
              <input type="date" name="orderDate" value={form.orderDate} onChange={handleChange} required className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Deadline *</label>
              <input type="date" name="deadline" value={form.deadline} onChange={handleChange} required className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Priority</label>
              <select name="priority" value={form.priority} onChange={handleChange} className="input-field">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} className="input-field resize-none h-20" placeholder="Any relevant notes..." />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1 justify-center">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
