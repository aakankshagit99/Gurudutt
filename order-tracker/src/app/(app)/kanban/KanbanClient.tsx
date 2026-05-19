"use client";

import { useState, useEffect, useTransition } from "react";
import { getOrders, moveOrderToStatus } from "@/lib/actions";
import { formatDate, getDaysRemaining, getPriorityColor } from "@/lib/utils";
import { AlertTriangle, Calendar, ExternalLink, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Order = Awaited<ReturnType<typeof getOrders>>["orders"][0];

const COLUMNS = [
  { key: "ORDER_RECEIVED", label: "Order Received", color: "border-blue-500/40", header: "bg-blue-500/10 text-blue-400" },
  { key: "DESIGN", label: "Design", color: "border-purple-500/40", header: "bg-purple-500/10 text-purple-400" },
  { key: "PROCUREMENT", label: "Procurement", color: "border-yellow-500/40", header: "bg-yellow-500/10 text-yellow-400" },
  { key: "MANUFACTURING", label: "Manufacturing", color: "border-orange-500/40", header: "bg-orange-500/10 text-orange-400" },
  { key: "DISPATCH", label: "Dispatch", color: "border-teal-500/40", header: "bg-teal-500/10 text-teal-400" },
  { key: "COMPLETED", label: "Completed", color: "border-green-500/40", header: "bg-green-500/10 text-green-400" },
];

export default function KanbanClient({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [localOrders, setLocalOrders] = useState(orders);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  const toggleCollapse = (columnKey: string) => {
    setCollapsedColumns((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  };

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData("text/plain", orderId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData("text/plain");
    if (!orderId) return;

    const orderToMove = localOrders.find((o) => o.id === orderId);
    if (!orderToMove) return;
    if (orderToMove.overallStatus === targetStatus) return;

    // Optimistic UI Update
    const originalOrders = [...localOrders];
    setLocalOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, overallStatus: targetStatus } : o))
    );

    startTransition(async () => {
      try {
        const res = await moveOrderToStatus(orderId, targetStatus);
        if (res.success) {
          toast.success(`Moved order to ${targetStatus.replace("_", " ")}`);
          router.refresh();
        } else {
          throw new Error("Failed to update status");
        }
      } catch (err: any) {
        setLocalOrders(originalOrders);
        toast.error(err.message || "Failed to update order status");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Kanban Board</h1>
        <p className="text-slate-400 text-sm mt-1">Drag and drop orders between stages. Collapsible columns enabled.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const isCollapsed = collapsedColumns[col.key];
          const colOrders = localOrders.filter((o) => o.overallStatus === col.key);

          if (isCollapsed) {
            return (
              <div
                key={col.key}
                className={`border ${col.color} min-w-[40px] w-[40px] flex flex-col items-center py-4 bg-[#0f1629]/40 rounded-xl transition-all duration-300 flex-shrink-0`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                <button
                  onClick={() => toggleCollapse(col.key)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white mb-4 transition-colors"
                  title="Expand column"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div
                  className="flex-1 flex items-center justify-center"
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${col.header.split(" ").pop()}`}>
                    {col.label}
                  </span>
                </div>
                <span className={`mt-4 text-[10px] font-bold px-2 py-0.5 rounded-full ${col.header}`}>
                  {colOrders.length}
                </span>
              </div>
            );
          }

          return (
            <div
              key={col.key}
              className={`kanban-column border ${col.color} min-w-[270px] max-w-[290px] rounded-xl transition-all duration-300`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className="px-4 py-3 border-b border-current border-opacity-20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCollapse(col.key)}
                    className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors"
                    title="Collapse column"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${col.header.split(" ").pop()}`}>
                    {col.label}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${col.header}`}>
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-2 min-h-[200px] max-h-[calc(100vh-260px)] overflow-y-auto custom-scrollbar">
                {colOrders.length === 0 ? (
                  <div className="text-center py-8 text-slate-700 text-xs">No orders</div>
                ) : (
                  colOrders.map((order) => {
                    const daysLeft = getDaysRemaining(order.deadline);
                    const isOverdue = daysLeft < 0;
                    const completedStages = order.stages.filter((s: { status: string }) => s.status === "COMPLETED").length;
                    const progress = order.stages.length > 0 ? Math.round((completedStages / order.stages.length) * 100) : 0;

                    return (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, order.id)}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("a, button")) return;
                          router.push(`/orders/${order.id}`);
                        }}
                        className={`kanban-card cursor-grab active:cursor-grabbing hover:bg-slate-800/40 transition-colors border border-transparent ${
                          isOverdue ? "border-red-500/30 bg-red-950/5" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-[10px] font-mono text-slate-500">{order.poNumber}</span>
                          <span className={`status-badge text-[10px] ${getPriorityColor(order.priority)}`}>
                            {order.priority === "URGENT" && <Zap className="w-2.5 h-2.5" />}
                            {order.priority}
                          </span>
                        </div>

                        <p className="text-sm font-medium text-white mb-0.5 line-clamp-2">{order.projectName}</p>
                        <p className="text-xs text-slate-500 mb-3">{order.customer?.name || "No Customer"}</p>

                        {/* Progress */}
                        <div className="progress-track mb-2">
                          <div className="progress-fill" style={{ width: `${progress}%` }} />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-1 text-[11px] ${isOverdue ? "text-red-400" : "text-slate-500"}`}>
                            {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                            {isOverdue ? `${Math.abs(daysLeft)}d overdue` : formatDate(order.deadline)}
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-500 hover:text-white transition-colors" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
