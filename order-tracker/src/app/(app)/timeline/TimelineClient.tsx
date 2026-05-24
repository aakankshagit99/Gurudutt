"use client";

import { getOrders } from "@/lib/actions";
import { formatDate, getStatusLabel, getPriorityColor } from "@/lib/utils";
import { differenceInDays, format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

type Order = Awaited<ReturnType<typeof getOrders>>["orders"][0];

const getStageColor = (stageName: string) => {
  const normalized = stageName.toUpperCase().replace(/\s/g, "_");
  const colors: Record<string, string> = {
    ORDER_RECEIVED: "bg-blue-500",
    DESIGN: "bg-purple-500",
    PROCUREMENT: "bg-yellow-500",
    MANUFACTURING: "bg-orange-500",
    DISPATCH: "bg-teal-500",
    CUTTING: "bg-red-500",
    TURNING: "bg-indigo-500",
    MILLING: "bg-pink-500",
    BORING: "bg-amber-500",
    VMC: "bg-cyan-500",
    ASSEMBLY: "bg-emerald-500",
    FINISHING: "bg-lime-500",
  };
  return colors[normalized] || "bg-blue-500";
};

export default function TimelineClient({ orders }: { orders: Order[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const totalDays = days.length;

  const getBarStyle = (start: Date, end: Date) => {
    const clampedStart = start < monthStart ? monthStart : start;
    const clampedEnd = end > monthEnd ? monthEnd : end;
    if (clampedStart > monthEnd || clampedEnd < monthStart) return null;

    const left = (differenceInDays(clampedStart, monthStart) / totalDays) * 100;
    const width = ((differenceInDays(clampedEnd, clampedStart) + 1) / totalDays) * 100;
    return { left: `${left}%`, width: `${Math.max(width, 0.5)}%` };
  };

  // Flatten and extract drawings that have at least one stage scheduled
  const drawings = orders.flatMap((o) =>
    o.drawings.map((d) => ({
      ...d,
      project: {
        id: o.id,
        poNumber: o.poNumber,
        projectName: o.projectName,
        priority: o.priority,
        deadline: o.deadline,
      },
    }))
  );

  const drawingsWithDates = drawings.filter((d) => d.stages.some((s) => s.startDate));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Timeline</h1>
          <p className="text-slate-400 text-sm mt-1">Gantt-style view of individual drawing stages</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-secondary py-1.5 px-3">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-slate-200 font-medium min-w-[120px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-secondary py-1.5 px-3">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timeline grid */}
      <div className="glass-card overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header - Day labels */}
          <div className="flex border-b border-slate-800">
            <div className="w-72 flex-shrink-0 border-r border-slate-800 px-4 py-2">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Drawing / PO</span>
            </div>
            <div className="flex-1 relative overflow-hidden">
              <div className="flex">
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={`flex-1 text-center border-r border-slate-800/50 py-2 ${
                      format(day, "d") === format(new Date(), "d") && format(day, "M") === format(new Date(), "M")
                        ? "bg-blue-500/10"
                        : ""
                    }`}
                  >
                    <span className="text-xs text-slate-650 font-mono">{format(day, "d")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today line overlay */}
          <div className="overflow-y-auto max-h-[600px]">
            {drawingsWithDates.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No drawings with stage dates for this month
              </div>
            ) : (
              drawingsWithDates.map((drawing) => {
                const daysLeft = differenceInDays(new Date(drawing.project.deadline), new Date());
                const isOverdue = daysLeft < 0 && drawing.status !== "COMPLETED";

                return (
                  <div key={drawing.id} className="flex border-b border-slate-800/50 hover:bg-slate-900/30 transition-colors">
                    {/* Drawing info */}
                    <div className="w-72 flex-shrink-0 border-r border-slate-800 px-4 py-3">
                      <Link href={`/orders/${drawing.project.id}`} className="group">
                        <p className="text-xs font-mono text-slate-500 flex items-center gap-1">
                          <Package className="w-3 h-3" /> {drawing.project.poNumber}
                        </p>
                        <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                          {drawing.drawingNumber}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{drawing.project.projectName}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`status-badge text-[9px] px-2 py-0.5 ${getPriorityColor(drawing.project.priority)}`}>
                            {drawing.project.priority}
                          </span>
                          {isOverdue && <AlertTriangle className="w-3 h-3 text-red-400" />}
                        </div>
                      </Link>
                    </div>

                    {/* Gantt bars */}
                    <div className="flex-1 relative py-3" style={{ minHeight: "72px" }}>
                      {/* Deadline marker */}
                      {(() => {
                        const deadlineStyle = getBarStyle(new Date(drawing.project.deadline), new Date(drawing.project.deadline));
                        if (!deadlineStyle) return null;
                        return (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500/60 z-10"
                            style={{ left: deadlineStyle.left }}
                            title={`Deadline: ${formatDate(drawing.project.deadline)}`}
                          />
                        );
                      })()}

                      {/* Stage bars */}
                      {drawing.stages.map((stage: { id: string; stageName: string; startDate: Date | null; endDate: Date | null; status: string }) => {
                        if (!stage.startDate) return null;
                        const end = stage.endDate || new Date();
                        const style = getBarStyle(new Date(stage.startDate), new Date(end));
                        if (!style) return null;

                        const color = getStageColor(stage.stageName);
                        const opacity = stage.status === "COMPLETED" ? "opacity-100" :
                          stage.status === "IN_PROGRESS" ? "opacity-80" :
                          stage.status === "DELAYED" ? "opacity-100 !bg-red-500" : "opacity-50";

                        return (
                          <div
                            key={stage.id}
                            className={`absolute timeline-bar ${color} ${opacity} flex items-center px-1`}
                            style={{ ...style, top: "50%", transform: "translateY(-50%)" }}
                            title={`${getStatusLabel(stage.stageName)}: ${formatDate(stage.startDate)} → ${formatDate(stage.endDate)}`}
                          >
                            <span className="text-white text-[8px] font-medium truncate leading-none">
                              {getStatusLabel(stage.stageName)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
