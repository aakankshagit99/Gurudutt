"use client";

import { useState, useTransition, useEffect } from "react";
import { 
  getOrderById, 
  getUsers, 
  addStageToOrder, 
  removeStageFromOrder, 
  getAvailableStages 
} from "@/lib/actions";
import {
  formatDate, formatDateTime, getDaysRemaining, getStatusColor,
  getStatusLabel, getPriorityColor
} from "@/lib/utils";
import {
  ArrowLeft, Edit2,
  Calendar, User, FileText, ClipboardList, Zap, Plus, Trash2, Loader2, Sparkles
} from "lucide-react";
import Link from "next/link";
import StageEditModal from "@/components/StageEditModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Order = NonNullable<Awaited<ReturnType<typeof getOrderById>>>;
type UserList = Awaited<ReturnType<typeof getUsers>>;

const stageIcons: Record<string, string> = {
  ORDER_RECEIVED: "📋",
  DESIGN: "✏️",
  PROCUREMENT: "🛒",
  MANUFACTURING: "⚙️",
  DISPATCH: "🚚",
  CUTTING: "🔪",
  TURNING: "🔄",
  MILLING: "🏗️",
  BORING: "🕳️",
  DRILLING_COUNTER: "⏺️",
  TEETH_CUTTING: "🦷",
  SLOTTING: "📏",
  DRILLING: "🔩",
  DRILLING_TAPPING: "🛠️",
  REAMING: "🔧",
  KEYWAY: "🔑",
  HARDENING: "🔥",
  CG: "✨",
  ENGRAVING: "✒️",
  BLACKODISING: "🌑",
  PLATING: "💎",
  WELDING: "⚡",
  ASSEMBLY: "🧩",
  FINISHING: "✨",
  SURFACE_GRINDING: "🪚",
  THREADING: "🧵",
  ANODISING: "🌈",
  VMC: "💻",
  STEP_MILLING: "🪜",
  CHAMFERING: "📐",
  NUMBERING: "🔢",
  LASER_MARKING: "🔦",
};

export default function OrderDetailClient({ order: initialOrder, users }: { order: Order; users: UserList }) {
  const [order, setOrder] = useState(initialOrder);
  const [editStage, setEditStage] = useState<Order["stages"][0] | null>(null);
  const [activeTab, setActiveTab] = useState<"stages" | "audit">("stages");
  const [isPending, startTransition] = useTransition();
  const [availableStages, setAvailableStages] = useState<string[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);

  useEffect(() => {
    getAvailableStages().then(setAvailableStages);
  }, []);

  const refreshOrder = async () => {
    const updated = await getOrderById(order.id);
    if (updated) setOrder(updated);
  };

  const daysLeft = getDaysRemaining(order.deadline);
  const isOverdue = daysLeft < 0;
  const completedStages = order.stages.filter((s: any) => s.status === "COMPLETED").length;
  const totalStagesCount = order.stages.length;
  const progress = totalStagesCount > 0 ? Math.round((completedStages / totalStagesCount) * 100) : 0;

  const handleAddStage = (stageName: string) => {
    setShowAddMenu(false);
    startTransition(async () => {
      try {
        const res = await addStageToOrder(order.id, stageName);
        if (res.success) {
          toast.success(`Stage "${stageName}" added`);
          await refreshOrder();
        }
      } catch (err) {
        toast.error("Failed to add stage");
      }
    });
  };

  const handleRemoveStage = (stageId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the "${name}" stage?`)) return;
    startTransition(async () => {
      try {
        const res = await removeStageFromOrder(stageId);
        if (res.success) {
          toast.success("Stage removed");
          await refreshOrder();
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to remove stage");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back */}
      <Link href="/orders" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      {/* Header card */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-slate-500">{order.poNumber}</span>
              <span className={`status-badge ${getPriorityColor(order.priority)}`}>
                {order.priority === "URGENT" && <Zap className="w-3 h-3" />}
                {order.priority}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white">{order.projectName}</h1>
            <p className="text-slate-400 mt-0.5">{order.customer?.name || "No Customer"}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`status-badge ${getStatusColor(order.overallStatus)} text-sm px-3 py-1`}>
              {getStatusLabel(order.overallStatus)}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-800">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Order Date</p>
            <p className="text-sm text-slate-200 font-medium">{formatDate(order.orderDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Deadline</p>
            <p className={`text-sm font-medium ${isOverdue ? "text-red-400" : "text-slate-200"}`}>
              {formatDate(order.deadline)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Days Remaining</p>
            <p className={`text-sm font-medium ${isOverdue ? "text-red-400" : daysLeft < 7 ? "text-yellow-400" : "text-slate-200"}`}>
              {isOverdue ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days`}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Progress ({completedStages}/{totalStagesCount})</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-sm font-medium text-slate-200">{progress}%</span>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="mt-4 p-3 bg-slate-900/40 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-500 mb-1">Notes</p>
            <p className="text-sm text-slate-300">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800 w-fit">
          {(["stages", "audit"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                activeTab === tab
                  ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {tab === "stages" ? "Production Stages" : "Audit Log"}
            </button>
          ))}
        </div>

        {activeTab === "stages" && (
          <div className="relative">
            <button 
              onClick={() => setShowAddMenu(!showAddMenu)} 
              className="btn-primary py-2 px-4 text-sm"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Stage
            </button>
            
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 py-2 max-h-64 overflow-y-auto custom-scrollbar">
                <p className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Available Stages</p>
                {availableStages.filter((s: string) => !order.stages.some((st: any) => st.stageName === s)).map((s: string) => (
                  <button 
                    key={s} 
                    onClick={() => handleAddStage(s)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-blue-400 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {activeTab === "stages" && (
        <div className="space-y-3 relative">
          {order.stages.length === 0 && (
            <div className="text-center py-12 glass-card">
              <Sparkles className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">No stages added to this order yet.</p>
            </div>
          )}
          {order.stages.map((stage: any, index: number) => {
            const assignedUser = users.find((u: any) => u.id === stage.assignedTo);
            const statusColors: Record<string, string> = {
              NOT_STARTED: "border-slate-800 bg-slate-900/20",
              IN_PROGRESS: "border-blue-500/30 bg-blue-500/5",
              COMPLETED: "border-green-500/30 bg-green-500/5",
              DELAYED: "border-red-500/30 bg-red-500/5",
            };

            const canRemove = stage.status !== "COMPLETED";

            return (
              <div
                key={stage.id}
                className={cn(
                  "glass-card p-5 border transition-all hover:border-slate-700",
                  statusColors[stage.status]
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Step number */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                      stage.status === "COMPLETED" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                      stage.status === "IN_PROGRESS" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                      stage.status === "DELAYED" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                      "bg-slate-800 text-slate-500 border border-slate-700"
                    )}>
                      {stage.status === "COMPLETED" ? "✓" : index + 1}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-base">{stageIcons[stage.stageName.toUpperCase().replace(/\s/g, "_")] || "🔹"}</span>
                        <h3 className="font-semibold text-white">{stage.stageName}</h3>
                        <span className={`status-badge ${getStatusColor(stage.status)}`}>
                          {getStatusLabel(stage.status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-xs">Start: {formatDate(stage.startDate)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-xs">End: {formatDate(stage.endDate)}</span>
                        </div>
                        {assignedUser && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <User className="w-3.5 h-3.5 text-slate-600" />
                            <span className="text-xs">{assignedUser.name}</span>
                          </div>
                        )}
                        {stage.remarks && (
                          <div className="flex items-center gap-1.5 text-slate-400 col-span-2">
                            <FileText className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                            <span className="text-xs truncate">{stage.remarks}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-4">
                    <button
                      onClick={() => setEditStage(stage)}
                      className="btn-secondary py-1.5 px-3 text-xs"
                      title="Edit stage details"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Edit</span>
                    </button>
                    {canRemove && (
                      <button
                        onClick={() => handleRemoveStage(stage.id, stage.stageName)}
                        className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                        title="Remove stage"
                        disabled={isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "audit" && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <ClipboardList className="w-5 h-5 text-slate-400" />
            <h2 className="font-semibold text-white">Audit Trail</h2>
          </div>
          {order.auditLogs.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No audit logs yet</p>
          ) : (
            <div className="space-y-3">
              {order.auditLogs.map((log: any) => (
                <div key={log.id} className="flex gap-4 p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-200">
                        {log.action.replace("_", " ")} · {log.entityType}
                      </span>
                      {log.user && <span className="text-xs text-slate-500">by {log.user.name}</span>}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{formatDateTime(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editStage && (
        <StageEditModal
          orderId={order.id}
          stage={editStage}
          users={users}
          onClose={() => {
            setEditStage(null);
            refreshOrder();
          }}
        />
      )}
    </div>
  );
}
