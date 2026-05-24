"use client";

import { useState, useTransition, useEffect } from "react";
import { getOrders } from "@/lib/actions";
import { formatDate, getDaysRemaining, getStatusColor, getStatusLabel, getPriorityColor } from "@/lib/utils";
import {
  Plus, Search, Download, RefreshCw,
  ChevronLeft, ChevronRight, ExternalLink, Zap
} from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";

type Order = Awaited<ReturnType<typeof getOrders>>["orders"][0];

export default function OrdersClient({ initialOrders, initialTotal }: {
  initialOrders: Order[];
  initialTotal: number;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const pageSize = 20;

  const fetchOrders = (params?: { search?: string; status?: string; priority?: string; page?: number }) => {
    startTransition(async () => {
      const result = await getOrders({
        search: params?.search ?? search,
        status: params?.status ?? status,
        priority: params?.priority ?? priority,
        page: params?.page ?? page,
        pageSize,
      });
      setOrders(result.orders);
      setTotal(result.total);
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchOrders({ search, page: 1 }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleStatusFilter = (val: string) => {
    setStatus(val);
    setPage(1);
    fetchOrders({ status: val, page: 1 });
  };

  const handlePriorityFilter = (val: string) => {
    setPriority(val);
    setPage(1);
    fetchOrders({ priority: val, page: 1 });
  };

  const handleExport = () => {
    const data = orders.map((o) => ({
      "PO Number": o.poNumber,
      "Customer": o.customer?.name || "No Customer",
      "Project": o.projectName,
      "Order Date": formatDate(o.orderDate),
      "Deadline": formatDate(o.deadline),
      "Priority": o.priority,
      "Status": getStatusLabel(o.overallStatus),
      "Days Remaining": getDaysRemaining(o.deadline),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `orders-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const totalPages = Math.ceil(total / pageSize);

  const stageColors: Record<string, string> = {
    NOT_STARTED: "bg-slate-700",
    IN_PROGRESS: "bg-blue-500",
    COMPLETED: "bg-green-500",
    DELAYED: "bg-red-500",
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-slate-400 text-sm mt-1">{total} total orders</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button onClick={handleExport} className="btn-secondary" title="Export to Excel">
            <Download className="w-4 h-4" /> Export
          </button>
          <Link href="/orders/new" className="btn-primary">
            <Plus className="w-4 h-4" /> New Order
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by customer, project, or PO number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select value={status} onChange={(e) => handleStatusFilter(e.target.value)} className="input-field sm:w-48">
          <option value="">All Statuses</option>
          <option value="ORDER_RECEIVED">Order Received</option>
          <option value="DESIGN">Design</option>
          <option value="PROCUREMENT">Procurement</option>
          <option value="MANUFACTURING">Manufacturing</option>
          <option value="DISPATCH">Dispatch</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select value={priority} onChange={(e) => handlePriorityFilter(e.target.value)} className="input-field sm:w-40">
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
        <button onClick={() => fetchOrders()} className="btn-secondary w-full sm:w-auto flex justify-center" disabled={isPending}>
          <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Project / Customer</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Pipeline</th>
              <th>Deadline</th>
              <th>Days Left</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-500">
                  No orders found
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const daysLeft = getDaysRemaining(order.deadline);
                const isOverdue = daysLeft < 0;
                const isUrgent = daysLeft >= 0 && daysLeft < 7;

                return (
                  <tr key={order.id} className={isOverdue ? "bg-red-950/10" : ""}>
                    <td>
                      <span className="font-mono text-xs text-slate-400">{order.poNumber}</span>
                    </td>
                    <td>
                      <Link 
                        href={`/orders/${order.id}`}
                        className="font-medium text-white hover:text-blue-400 transition-colors"
                      >
                        {order.projectName}
                      </Link>
                      <p className="text-xs text-slate-500">{order.customer?.name || "No Customer"}</p>
                    </td>
                    <td>
                      <span className={`status-badge ${getPriorityColor(order.priority)}`}>
                        {order.priority === "URGENT" && <Zap className="w-3 h-3" />}
                        {order.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusColor(order.overallStatus)}`}>
                        {getStatusLabel(order.overallStatus)}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-0.5 flex-wrap max-w-[150px]">
                        {order.stages.map((s: { stageName: string; status: string }) => {
                          return (
                            <div
                              key={s.stageName}
                              className={`w-6 h-1.5 rounded-full ${stageColors[s.status || "NOT_STARTED"]}`}
                              title={`${getStatusLabel(s.stageName)}: ${getStatusLabel(s.status || "NOT_STARTED")}`}
                            />
                          );
                        })}
                      </div>
                    </td>
                    <td className="text-slate-300">{formatDate(order.deadline)}</td>
                    <td>
                      <span className={`text-sm font-medium ${isOverdue ? "text-red-400" : isUrgent ? "text-yellow-400" : "text-slate-400"}`}>
                        {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-slate-500 hover:text-blue-400 transition-colors"
                          title="View order details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPage(p => p - 1); fetchOrders({ page: page - 1 }); }}
              disabled={page === 1 || isPending}
              className="btn-secondary py-1.5 px-3"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
            <button
              onClick={() => { setPage(p => p + 1); fetchOrders({ page: page + 1 }); }}
              disabled={page === totalPages || isPending}
              className="btn-secondary py-1.5 px-3"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
