"use client";

import { getOrders } from "@/lib/actions";
import { formatDate, getDaysRemaining, getPriorityColor } from "@/lib/utils";
import { AlertTriangle, Calendar, ExternalLink, Zap } from "lucide-react";
import Link from "next/link";

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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Kanban Board</h1>
        <p className="text-slate-400 text-sm mt-1">Drag-free stage-based order overview</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.overallStatus === col.key);
          return (
            <div key={col.key} className={`kanban-column border ${col.color} min-w-[260px] max-w-[280px]`}>
              {/* Column header */}
              <div className={`px-4 py-3 border-b border-current border-opacity-20 flex items-center justify-between`}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${col.header.split(" ").pop()}`}>
                  {col.label}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${col.header}`}>
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-2 min-h-[200px] max-h-[calc(100vh-260px)] overflow-y-auto">
                {colOrders.length === 0 ? (
                  <div className="text-center py-8 text-slate-700 text-xs">No orders</div>
                ) : (
                  colOrders.map((order) => {
                    const daysLeft = getDaysRemaining(order.deadline);
                    const isOverdue = daysLeft < 0;
                    const completedStages = order.stages.filter((s: { status: string }) => s.status === "COMPLETED").length;
                    const progress = order.stages.length > 0 ? Math.round((completedStages / order.stages.length) * 100) : 0;

                    return (
                      <Link key={order.id} href={`/orders/${order.id}`}>
                        <div className={`kanban-card ${isOverdue ? "border-red-500/30" : ""}`}>
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-mono text-slate-600">{order.poNumber}</span>
                            <span className={`status-badge text-xs ${getPriorityColor(order.priority)}`}>
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
                            <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-400" : "text-slate-500"}`}>
                              {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                              {isOverdue ? `${Math.abs(daysLeft)}d overdue` : formatDate(order.deadline)}
                            </div>
                            <ExternalLink className="w-3 h-3 text-slate-600" />
                          </div>
                        </div>
                      </Link>
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
