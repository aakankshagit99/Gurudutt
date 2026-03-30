"use client";

import { useState, useTransition, useEffect } from "react";
import { createOrder, getCustomers, getAvailableStages } from "@/lib/actions";
import { Priority } from "@prisma/client";
import { X, Package, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
}

export default function CreateOrderModal({ onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [customers, setCustomers] = useState<Awaited<ReturnType<typeof getCustomers>>>([]);
  const [availableStages, setAvailableStages] = useState<string[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [form, setForm] = useState({
    customerId: "",
    projectName: "",
    poNumber: "",
    orderDate: new Date().toISOString().split("T")[0],
    deadline: "",
    priority: "MEDIUM" as Priority,
    notes: "",
  });

  useEffect(() => {
    getCustomers().then(setCustomers);
    getAvailableStages().then((stages) => {
      setAvailableStages(stages);
      // Default stages (first few or all)
      setSelectedStages(stages.slice(0, 5));
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const toggleStage = (stage: string) => {
    setSelectedStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) {
      toast.error("Please select a customer");
      return;
    }
    if (selectedStages.length === 0) {
      toast.error("Please select at least one stage");
      return;
    }
    startTransition(async () => {
      try {
        await createOrder({ ...form, stageNames: selectedStages });
        toast.success("Order created successfully!");
        onClose();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to create order");
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
            <h2 className="text-lg font-semibold text-white">New Order</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Customer *</label>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider text-blue-400">Select Production Stages</label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setSelectedStages(availableStages)} className="text-[10px] text-slate-500 hover:text-blue-400 uppercase tracking-widest font-bold">Select All</button>
                <button type="button" onClick={() => setSelectedStages([])} className="text-[10px] text-slate-500 hover:text-red-400 uppercase tracking-widest font-bold">Clear All</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-900/50 rounded-xl border border-slate-800 max-h-48 overflow-y-auto custom-scrollbar">
              {availableStages.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => toggleStage(stage)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all border ${
                    selectedStages.includes(stage)
                      ? "bg-blue-600/20 border-blue-500/50 text-blue-100"
                      : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                    selectedStages.includes(stage) ? "bg-blue-500 border-transparent" : "border-slate-600"
                  }`}>
                    {selectedStages.includes(stage) && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="truncate">{stage}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} className="input-field resize-none h-20" placeholder="Any relevant notes..." />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1 justify-center">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
