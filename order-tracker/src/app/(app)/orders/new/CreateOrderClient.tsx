"use client";

import { useState, useTransition } from "react";
import { createOrder, addAvailableStage, getCustomers } from "@/lib/actions";
import { Priority } from "@prisma/client";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  initialCustomers: Awaited<ReturnType<typeof getCustomers>>;
  initialStages: string[];
}

export default function CreateOrderClient({ initialCustomers, initialStages }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [availableStages, setAvailableStages] = useState<string[]>(initialStages);
  const [selectedStages, setSelectedStages] = useState<string[]>(initialStages.slice(0, 5));
  const [form, setForm] = useState({
    customerId: "",
    projectName: "",
    poNumber: "",
    orderDate: new Date().toISOString().split("T")[0],
    deadline: "",
    priority: "MEDIUM" as Priority,
    notes: "",
  });

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
        router.push("/orders");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to create order");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link 
          href="/orders" 
          className="w-8 h-8 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Create New Order</h1>
          <p className="text-slate-400 text-sm mt-0.5">Fill in the project details and setup the production route.</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                {initialCustomers.map((c) => (
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider text-blue-400">Select Production Stages</label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setSelectedStages(availableStages)} className="text-[10px] text-slate-500 hover:text-blue-400 uppercase tracking-widest font-bold">Select All</button>
                <button type="button" onClick={() => setSelectedStages([])} className="text-[10px] text-slate-500 hover:text-red-400 uppercase tracking-widest font-bold">Clear All</button>
              </div>
            </div>
            
            {/* Custom Stage input */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Type custom stage and press Enter to add..."
                className="input-field text-xs py-1.5"
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (!val) return;
                    try {
                      const updated = await addAvailableStage(val);
                      setAvailableStages(updated);
                      const matchedName = updated.find(s => s.toLowerCase() === val.toLowerCase()) || val;
                      if (!selectedStages.includes(matchedName)) {
                        setSelectedStages(prev => [...prev, matchedName]);
                      }
                      e.currentTarget.value = "";
                      toast.success(`Stage "${matchedName}" created!`);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to add stage");
                    }
                  }
                }}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-950/40 rounded-xl border border-slate-800 max-h-60 overflow-y-auto custom-scrollbar">
              {availableStages.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => toggleStage(stage)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-all border ${
                    selectedStages.includes(stage)
                      ? "bg-blue-600/20 border-blue-500/50 text-blue-100"
                      : "bg-slate-800/30 border-slate-700/50 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300"
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
            <textarea name="notes" value={form.notes} onChange={handleChange} className="input-field resize-none h-24" placeholder="Any relevant notes..." />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <Link href="/orders" className="btn-secondary flex-1 justify-center">Cancel</Link>
            <button type="submit" disabled={isPending} className="btn-primary flex-1 justify-center">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
