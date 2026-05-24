"use client";

import { useState, useTransition, useEffect } from "react";
import { 
  getOrderById, 
  getUsers, 
  createDrawing, 
  deleteDrawing,
  addStageToDrawing, 
  removeStageFromDrawing, 
  getAvailableStages 
} from "@/lib/actions";
import {
  formatDate, formatDateTime, getDaysRemaining, getStatusColor,
  getStatusLabel, getPriorityColor
} from "@/lib/utils";
import {
  ArrowLeft, Edit2,
  Calendar, User, FileText, ClipboardList, Zap, Plus, Trash2, Loader2, Sparkles, ChevronDown, ChevronUp, Clock
} from "lucide-react";
import Link from "next/link";
import StageEditModal from "@/components/StageEditModal";
import EditOrderModal from "@/components/EditOrderModal";
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
  const [editStage, setEditStage] = useState<any | null>(null);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const [activeTab, setActiveTab] = useState<"stages" | "audit">("stages");
  const [isPending, startTransition] = useTransition();
  const [availableStages, setAvailableStages] = useState<string[]>([]);
  const [newDrawingNumber, setNewDrawingNumber] = useState("");
  const [expandedDrawings, setExpandedDrawings] = useState<Record<string, boolean>>({});
  const [activeDrawingIdForStageMenu, setActiveDrawingIdForStageMenu] = useState<string | null>(null);

  useEffect(() => {
    getAvailableStages().then(setAvailableStages);
  }, []);

  const refreshOrder = async () => {
    const updated = await getOrderById(order.id);
    if (updated) setOrder(updated);
  };

  const daysLeft = getDaysRemaining(order.deadline);
  const isOverdue = daysLeft < 0;

  // Compute PO aggregated stages stats
  const totalDrawings = order.drawings?.length || 0;
  const completedDrawings = order.drawings?.filter(d => d.status === "COMPLETED").length || 0;
  
  // Progress is calculated across all drawings' stages
  const totalStagesCount = order.drawings?.reduce((acc, d) => acc + d.stages.length, 0) || 0;
  const completedStagesCount = order.drawings?.reduce((acc, d) => acc + d.stages.filter(s => s.status === "COMPLETED").length, 0) || 0;
  const progress = totalStagesCount > 0 ? Math.round((completedStagesCount / totalStagesCount) * 100) : 0;

  const toggleDrawingExpand = (drawingId: string) => {
    setExpandedDrawings(prev => ({
      ...prev,
      [drawingId]: !prev[drawingId]
    }));
  };

  const handleAddDrawing = () => {
    const trimmed = newDrawingNumber.trim();
    if (!trimmed) {
      toast.error("Please enter a drawing number");
      return;
    }
    startTransition(async () => {
      try {
        const res = await createDrawing(order.id, trimmed);
        if (res.success) {
          toast.success(`Drawing "${trimmed}" added`);
          setNewDrawingNumber("");
          // Automatically expand the new drawing
          setExpandedDrawings(prev => ({ ...prev, [res.drawing.id]: true }));
          await refreshOrder();
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to add drawing");
      }
    });
  };

  const handleDeleteDrawing = (drawingId: string, number: string) => {
    if (!confirm(`Are you sure you want to delete drawing "${number}"?`)) return;
    startTransition(async () => {
      try {
        const res = await deleteDrawing(drawingId);
        if (res.success) {
          toast.success(`Drawing "${number}" deleted`);
          await refreshOrder();
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to delete drawing");
      }
    });
  };

  const handleAddStage = (drawingId: string, stageName: string) => {
    setActiveDrawingIdForStageMenu(null);
    startTransition(async () => {
      try {
        const res = await addStageToDrawing(drawingId, stageName);
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
        const res = await removeStageFromDrawing(stageId);
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
            <button 
              onClick={() => setShowEditOrder(true)} 
              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit Order
            </button>
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
            <p className="text-xs text-slate-500 mb-0.5">Progress ({completedStagesCount}/{totalStagesCount})</p>
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
              {tab === "stages" ? "Drawings & Stages" : "Audit Log"}
            </button>
          ))}
        </div>

        {activeTab === "stages" && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter drawing number..."
              value={newDrawingNumber}
              onChange={(e) => setNewDrawingNumber(e.target.value)}
              className="input-field py-1.5 px-3 text-xs w-48"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddDrawing();
                }
              }}
            />
            <button 
              onClick={handleAddDrawing}
              disabled={isPending}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add Drawing
            </button>
          </div>
        )}
      </div>

      {activeTab === "stages" && (
        <div className="space-y-4">
          {(!order.drawings || order.drawings.length === 0) && (
            <div className="text-center py-12 glass-card">
              <Sparkles className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">No drawings added to this PO yet.</p>
            </div>
          )}
          
          {order.drawings?.map((drawing: any) => {
            const isExpanded = !!expandedDrawings[drawing.id];
            const drawingStagesCount = drawing.stages.length;
            const drawingCompletedStages = drawing.stages.filter((s: any) => s.status === "COMPLETED").length;
            const drawingProgress = drawingStagesCount > 0 ? Math.round((drawingCompletedStages / drawingStagesCount) * 100) : 0;

            return (
              <div key={drawing.id} className="glass-card border border-slate-800/80">
                {/* Drawing Header */}
                <div 
                  onClick={() => toggleDrawingExpand(drawing.id)}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900/30 cursor-pointer hover:bg-slate-900/50 transition-colors select-none gap-3",
                    isExpanded ? "rounded-t-xl border-b border-slate-800/50" : "rounded-xl"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        {drawing.drawingNumber}
                        {drawing.revision && (
                          <span className="text-slate-500 text-xs font-mono">Rev {drawing.revision}</span>
                        )}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {drawingCompletedStages}/{drawingStagesCount} stages completed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 min-w-[120px] sm:min-w-[150px]">
                      <div className="flex-1 progress-track h-1.5">
                        <div className="progress-fill" style={{ width: `${drawingProgress}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-300">{drawingProgress}%</span>
                    </div>

                    <span className={`status-badge ${getStatusColor(drawing.status)} text-[10px]`}>
                      {getStatusLabel(drawing.status)}
                    </span>

                    {/* Add Stage menu for this drawing */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveDrawingIdForStageMenu(activeDrawingIdForStageMenu === drawing.id ? null : drawing.id)}
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                        title="Add stage to drawing"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      {activeDrawingIdForStageMenu === drawing.id && (
                        <div className="absolute right-0 top-full mt-2 w-52 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-50 py-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                          <p className="px-2.5 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Available Stages</p>
                          {availableStages.filter((s: string) => !drawing.stages.some((st: any) => st.stageName === s)).map((s: string) => (
                            <button 
                              key={s} 
                              onClick={() => handleAddStage(drawing.id, s)}
                              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-900 hover:text-blue-400 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteDrawing(drawing.id, drawing.drawingNumber)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      title="Delete drawing"
                      disabled={isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Drawing Stages List */}
                {isExpanded && (
                  <div className="p-4 bg-slate-950/20 space-y-2.5 rounded-b-xl">
                    {drawing.stages.length === 0 && (
                      <p className="text-xs text-slate-500 text-center py-4">No stages added for this drawing.</p>
                    )}
                    {drawing.stages.map((stage: any, index: number) => {
                      const assignedUser = users.find((u: any) => u.id === stage.assignedTo);
                      
                      const renderDeadlineTimer = (stg: any) => {
                        if (stg.status === "COMPLETED") {
                          return (
                            <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                              Done
                            </span>
                          );
                        }
                        if (!stg.deadline) {
                          return <span className="text-[11px] text-slate-650">No deadline</span>;
                        }
                        const days = getDaysRemaining(stg.deadline);
                        if (days < 0) {
                          return (
                            <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded flex items-center gap-1 w-fit animate-pulse">
                              <Clock className="w-3 h-3" /> {Math.abs(days)}d overdue
                            </span>
                          );
                        } else if (days === 0) {
                          return (
                            <span className="text-[10px] font-semibold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                              <Clock className="w-3 h-3" /> Due today
                            </span>
                          );
                        } else {
                          return (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 w-fit ${
                              days < 7 ? "text-yellow-400 bg-yellow-500/10 border border-yellow-500/20" : "text-blue-400 bg-blue-500/10 border border-blue-500/20"
                            }`}>
                              <Clock className="w-3 h-3" /> {days}d left
                            </span>
                          );
                        }
                      };

                      const statusColors: Record<string, string> = {
                        NOT_STARTED: "border-slate-800/80 bg-slate-900/10",
                        IN_PROGRESS: "border-blue-500/20 bg-blue-500/5",
                        COMPLETED: "border-green-500/20 bg-green-500/5",
                        DELAYED: "border-red-500/20 bg-red-500/5",
                      };

                      const canRemove = stage.status !== "COMPLETED";

                      return (
                        <div
                          key={stage.id}
                          className={cn(
                            "p-3 rounded-lg border transition-all hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                            statusColors[stage.status]
                          )}
                        >
                          <div className="flex items-start sm:items-center gap-3">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                              stage.status === "COMPLETED" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                              stage.status === "IN_PROGRESS" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                              stage.status === "DELAYED" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                              "bg-slate-800 text-slate-500 border border-slate-700"
                            )}>
                              {stage.status === "COMPLETED" ? "✓" : index + 1}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm">{stageIcons[stage.stageName.toUpperCase().replace(/\s/g, "_")] || "🔹"}</span>
                                <h4 className="text-sm font-semibold text-white">{stage.stageName}</h4>
                                <span className={`status-badge text-[9px] px-2 py-0.5 ${getStatusColor(stage.status)}`}>
                                  {getStatusLabel(stage.status)}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-slate-400">
                                <div>Start: {formatDate(stage.startDate)}</div>
                                <div>End: {formatDate(stage.endDate)}</div>
                                {assignedUser ? (
                                  <div className="flex items-center gap-1 text-slate-300">
                                    <User className="w-3 h-3 text-slate-500" />
                                    <span>{assignedUser.name}</span>
                                  </div>
                                ) : (
                                  <div className="text-slate-500 italic">Unassigned</div>
                                )}
                                {stage.remarks && (
                                  <div className="flex items-center gap-1 text-slate-400 max-w-[200px] truncate" title={stage.remarks}>
                                    <FileText className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                    <span>{stage.remarks}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 pl-9 sm:pl-0">
                            {/* Deadline Countdown Timer */}
                            {renderDeadlineTimer(stage)}

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setEditStage(stage)}
                                className="btn-secondary py-1 px-2.5 text-[10px]"
                                title="Edit step details"
                              >
                                <Edit2 className="w-3 h-3" /> Edit
                              </button>
                              {canRemove && (
                                <button
                                  onClick={() => handleRemoveStage(stage.id, stage.stageName)}
                                  className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                                  title="Remove stage"
                                  disabled={isPending}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
          drawingId={editStage.drawingId}
          stage={editStage}
          users={users}
          onClose={() => {
            setEditStage(null);
            refreshOrder();
          }}
        />
      )}

      {showEditOrder && (
        <EditOrderModal
          order={order}
          onClose={() => setShowEditOrder(false)}
          onSuccess={refreshOrder}
        />
      )}
    </div>
  );
}
