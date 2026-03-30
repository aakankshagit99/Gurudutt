import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, differenceInDays, isPast } from "date-fns";
import { StageStatus, Priority } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy, HH:mm");
}

export function getDaysRemaining(deadline: Date | string): number {
  return differenceInDays(new Date(deadline), new Date());
}

export function isDelayed(deadline: Date | string, status: string): boolean {
  if (status === "COMPLETED" || status === "CANCELLED") return false;
  return isPast(new Date(deadline));
}

export function getStatusColor(status: string | StageStatus): string {
  const colors: Record<string, string> = {
    ORDER_RECEIVED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    DESIGN: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    PROCUREMENT: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    MANUFACTURING: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    DISPATCH: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    COMPLETED: "bg-green-500/20 text-green-400 border-green-500/30",
    CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
    NOT_STARTED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    IN_PROGRESS: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    DELAYED: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return colors[status] || "bg-slate-500/20 text-slate-400 border-slate-500/30";
}

export function getPriorityColor(priority: Priority): string {
  const colors: Record<Priority, string> = {
    LOW: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    MEDIUM: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    URGENT: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return colors[priority];
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ORDER_RECEIVED: "Order Received",
    DESIGN: "Design",
    PROCUREMENT: "Procurement",
    MANUFACTURING: "Manufacturing",
    DISPATCH: "Dispatch",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NOT_STARTED: "Not Started",
    IN_PROGRESS: "In Progress",
    DELAYED: "Delayed",
  };
  return labels[status] || status;
}

export function getPriorityLabel(priority: Priority): string {
  const labels: Record<Priority, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
  };
  return labels[priority];
}

export function calculateOverallStatus(stages: { status: StageStatus; stageName: string }[]): string {
  if (stages.length === 0) return "NOT_STARTED";
  
  const allCompleted = stages.every((s) => s.status === "COMPLETED");
  if (allCompleted) return "COMPLETED";

  const hasDelayed = stages.some((s) => s.status === "DELAYED");
  if (hasDelayed) return "DELAYED";

  const inProgress = stages.find((s) => s.status === "IN_PROGRESS");
  if (inProgress) return inProgress.stageName;

  const firstNotStarted = stages.find((s) => s.status === "NOT_STARTED");
  if (firstNotStarted) return firstNotStarted.stageName;

  return "NOT_STARTED";
}
