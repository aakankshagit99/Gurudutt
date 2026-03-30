import { getDashboardStats } from "@/lib/actions";
import { formatDate, getDaysRemaining, getStatusColor, getStatusLabel } from "@/lib/utils";
import {
  Package, Clock, AlertTriangle, CheckCircle2, TrendingUp,
  ArrowRight, Zap, Activity
} from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  const stats = await getDashboardStats();

  const statCards = [
    {
      label: "Active Orders",
      value: stats.totalOrders,
      icon: Package,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      glow: "glow-blue",
    },
    {
      label: "Nearing Deadline",
      value: stats.nearingDeadline,
      icon: Clock,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      sublabel: "within 7 days",
    },
    {
      label: "Delayed Orders",
      value: stats.delayedOrders,
      icon: AlertTriangle,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      glow: stats.delayedOrders > 0 ? "glow-red" : "",
    },
    {
      label: "Completed",
      value: stats.completedOrders,
      icon: CheckCircle2,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
    },
  ];

  const stageOrder = ["ORDER_RECEIVED", "DESIGN", "PROCUREMENT", "MANUFACTURING", "DISPATCH"];
  const stageColors = {
    ORDER_RECEIVED: "bg-blue-500",
    DESIGN: "bg-purple-500",
    PROCUREMENT: "bg-yellow-500",
    MANUFACTURING: "bg-orange-500",
    DISPATCH: "bg-teal-500",
    COMPLETED: "bg-green-500",
    CANCELLED: "bg-red-500",
    NOT_STARTED: "bg-slate-600",
    IN_PROGRESS: "bg-blue-500",
    DELAYED: "bg-red-500",
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
            <span className="gradient-text">{session?.user?.name?.split(" ")[0]}</span> 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Here&apos;s what&apos;s happening across your production floor today.
          </p>
        </div>
        <Link href="/orders" className="btn-primary hidden sm:flex">
          <Package className="w-4 h-4" /> All Orders
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`stat-card ${card.glow || ""}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 ${card.bg} border ${card.border} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <TrendingUp className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-3xl font-bold text-white">{card.value}</p>
              <p className="text-sm text-slate-400 mt-1">{card.label}</p>
              {card.sublabel && <p className="text-xs text-slate-600 mt-0.5">{card.sublabel}</p>}
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent orders nearing deadline */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <h2 className="font-semibold text-white">Active Orders</h2>
            </div>
            <Link href="/orders" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {stats.recentOrders.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No active orders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentOrders.map((order: { id: string; deadline: Date | string; poNumber: string; projectName: string; customer?: { name: string } | null; stages: Array<{ status: string; stageName: string }> }) => {
                const daysLeft = getDaysRemaining(order.deadline);
                const isUrgent = daysLeft < 7;
                const isOverdue = daysLeft < 0;
                const completedStages = order.stages.filter((s: { status: string }) => s.status === "COMPLETED").length;
                const progress = order.stages.length > 0 ? Math.round((completedStages / order.stages.length) * 100) : 0;

                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="block p-4 rounded-xl border border-slate-800 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-800/40 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-xs text-slate-500 font-mono">{order.poNumber}</span>
                        <p className="text-sm font-medium text-white mt-0.5 group-hover:text-blue-300 transition-colors">
                          {order.projectName}
                        </p>
                        <p className="text-xs text-slate-500">{order.customer?.name || "No Customer"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOverdue && (
                          <span className="text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </span>
                        )}
                        {!isOverdue && isUrgent && (
                          <span className="text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Zap className="w-3 h-3" /> {daysLeft}d left
                          </span>
                        )}
                        {!isOverdue && !isUrgent && (
                          <span className="text-xs text-slate-500">{daysLeft}d left</span>
                        )}
                      </div>
                    </div>

                    {/* Stage pipeline */}
                    <div className="mb-2">
                      <div className="flex gap-1">
                        {["ORDER_RECEIVED", "DESIGN", "PROCUREMENT", "MANUFACTURING", "DISPATCH"].map((stage) => {
                          const s = order.stages.find((st: { stageName: string; status: string }) => st.stageName === stage);
                          const color = stageColors[s?.status as keyof typeof stageColors] || "bg-slate-700";
                          return (
                            <div
                              key={stage}
                              className={`flex-1 h-1.5 rounded-full ${color} transition-all`}
                              title={`${getStatusLabel(stage)}: ${getStatusLabel(s?.status || "NOT_STARTED")}`}
                            />
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5">{progress}% complete · Deadline: {formatDate(order.deadline)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Stage stats */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold text-white">Stage Overview</h2>
          </div>

          <div className="space-y-4">
            {stageOrder.map((stage) => {


              const stageName = getStatusLabel(stage);
              const stageColor = stageColors[stage as keyof typeof stageColors];

              return (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-400">{stageName}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${stageColor} rounded-full`} style={{ width: "100%" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status breakdown */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Stage Status</p>
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {stats.stageStats.map((stat: { status: any; _count: { status: number } }) => (
                <div key={stat.status} className="flex items-center justify-between">
                  <span className={`status-badge ${getStatusColor(stat.status)}`}>
                    {getStatusLabel(stat.status)}
                  </span>
                  <span className="text-sm font-medium text-slate-300">{stat._count.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Delayed orders alert */}
      {stats.delayedOrders > 0 && (
        <div className="glass-card border-red-500/20 p-5 flex items-center justify-between bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-center pulse-delayed">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-white">
                {stats.delayedOrders} order{stats.delayedOrders > 1 ? "s" : ""} past deadline
              </p>
              <p className="text-sm text-slate-400">Immediate attention required</p>
            </div>
          </div>
          <Link
            href="/orders?status=delayed"
            className="btn-danger text-sm"
          >
            View Delayed <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
