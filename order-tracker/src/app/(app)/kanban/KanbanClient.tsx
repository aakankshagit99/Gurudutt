"use client";

import { useState, useEffect, useTransition } from "react";
import { getOrders, moveDrawingToStatus } from "@/lib/actions";
import { formatDate, getDaysRemaining, getPriorityColor, getStatusLabel } from "@/lib/utils";
import { AlertTriangle, Calendar, ExternalLink, Zap, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Order = Awaited<ReturnType<typeof getOrders>>["orders"][0];

interface Props {
  orders: Order[];
}

export default function KanbanClient({ orders }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Flatten drawings from all orders, appending their parent PO project details
  const getDrawingsFromOrders = (ordList: Order[]) => {
    return ordList.flatMap((o) =>
      o.drawings.map((d) => ({
        ...d,
        project: {
          id: o.id,
          poNumber: o.poNumber,
          projectName: o.projectName,
          priority: o.priority,
          deadline: o.deadline,
          customer: o.customer,
        },
      }))
    );
  };

  const [localDrawings, setLocalDrawings] = useState(() => getDrawingsFromOrders(orders));
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalDrawings(getDrawingsFromOrders(orders));
  }, [orders]);

  // Compute dynamic columns based on active stages of drawings in view
  const activeStageNames = Array.from(
    new Set(
      localDrawings.flatMap((d) => d.stages.map((s) => s.stageName))
    )
  ).sort((a, b) => {
    const seqA = localDrawings.flatMap((d) => d.stages).find((s) => s.stageName === a)?.sequence ?? 0;
    const seqB = localDrawings.flatMap((d) => d.stages).find((s) => s.stageName === b)?.sequence ?? 0;
    return seqA - seqB;
  });

  const columns = [
    { key: "NOT_STARTED", label: "Not Started", color: "border-slate-500/40", header: "bg-slate-500/10 text-slate-400" },
    ...activeStageNames.map((stage) => {
      const stageColors: Record<string, string> = {
        ORDER_RECEIVED: "border-blue-500/40 bg-blue-500/10 text-blue-400",
        DESIGN: "border-purple-500/40 bg-purple-500/10 text-purple-400",
        PROCUREMENT: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
        MANUFACTURING: "border-orange-500/40 bg-orange-500/10 text-orange-400",
        DISPATCH: "border-teal-500/40 bg-teal-500/10 text-teal-400",
      };
      const cleanKey = stage.toUpperCase().replace(/\s/g, "_");
      return {
        key: stage,
        label: getStatusLabel(stage),
        color: stageColors[cleanKey]?.split(" ")[0] || "border-blue-500/40",
        header: stageColors[cleanKey] || "bg-blue-500/10 text-blue-400",
      };
    }),
    { key: "COMPLETED", label: "Completed", color: "border-green-500/40", header: "bg-green-500/10 text-green-400" },
  ];

  const toggleCollapse = (columnKey: string) => {
    setCollapsedColumns((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  };

  const handleDragStart = (e: React.DragEvent, drawingId: string) => {
    e.dataTransfer.setData("text/plain", drawingId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const drawingId = e.dataTransfer.getData("text/plain");
    if (!drawingId) return;

    const drawingToMove = localDrawings.find((d) => d.id === drawingId);
    if (!drawingToMove) return;
    if (drawingToMove.status === targetStatus) return;

    // Optimistic UI Update
    const originalDrawings = [...localDrawings];
    setLocalDrawings((prev) =>
      prev.map((d) => (d.id === drawingId ? { ...d, status: targetStatus } : d))
    );

    startTransition(async () => {
      try {
        const res = await moveDrawingToStatus(drawingId, targetStatus);
        if (res.success) {
          toast.success(`Moved drawing to ${targetStatus.replace("_", " ")}`);
          router.refresh();
        } else {
          throw new Error("Failed to update status");
        }
      } catch (err: any) {
        setLocalDrawings(originalDrawings);
        toast.error(err.message || "Failed to update drawing status");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Kanban Board</h1>
        <p className="text-slate-400 text-sm mt-1">Track and drag individual drawings across stages.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const isCollapsed = collapsedColumns[col.key];
          const colDrawings = localDrawings.filter((d) => d.status === col.key);

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
                  {colDrawings.length}
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
                  {colDrawings.length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-2 min-h-[200px] max-h-[calc(100vh-260px)] overflow-y-auto custom-scrollbar">
                {colDrawings.length === 0 ? (
                  <div className="text-center py-8 text-slate-700 text-xs">No drawings</div>
                ) : (
                  colDrawings.map((drawing) => {
                    const daysLeft = getDaysRemaining(drawing.project.deadline);
                    const isOverdue = daysLeft < 0;
                    const completedStages = drawing.stages.filter((s: { status: string }) => s.status === "COMPLETED").length;
                    const progress = drawing.stages.length > 0 ? Math.round((completedStages / drawing.stages.length) * 100) : 0;

                    return (
                      <div
                        key={drawing.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, drawing.id)}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("a, button")) return;
                          router.push(`/orders/${drawing.project.id}`);
                        }}
                        className={`kanban-card cursor-grab active:cursor-grabbing hover:bg-slate-800/40 transition-colors border border-transparent ${
                          isOverdue && drawing.status !== "COMPLETED" ? "border-red-500/30 bg-red-950/5" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1">
                            <Package className="w-2.5 h-2.5 text-slate-600" />
                            {drawing.project.poNumber}
                          </span>
                          <span className={`status-badge text-[9px] px-2 py-0.5 ${getPriorityColor(drawing.project.priority)}`}>
                            {drawing.project.priority === "URGENT" && <Zap className="w-2.5 h-2.5" />}
                            {drawing.project.priority}
                          </span>
                        </div>

                        <p className="text-sm font-bold text-white mb-0.5 leading-tight">{drawing.drawingNumber}</p>
                        <p className="text-[11px] text-slate-400 mb-2 truncate">{drawing.project.projectName}</p>
                        <p className="text-[10px] text-slate-500 mb-3">{drawing.project.customer?.name || "No Customer"}</p>

                        {/* Progress */}
                        <div className="progress-track mb-2 h-1">
                          <div className="progress-fill" style={{ width: `${progress}%` }} />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <div className={`flex items-center gap-1 ${isOverdue && drawing.status !== "COMPLETED" ? "text-red-400" : ""}`}>
                            {isOverdue && drawing.status !== "COMPLETED" ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                            {isOverdue && drawing.status !== "COMPLETED" ? `${Math.abs(daysLeft)}d overdue` : formatDate(drawing.project.deadline)}
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
