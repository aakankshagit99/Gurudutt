"use client";

import { useState, useTransition } from "react";
import { updateDrawingStage } from "@/lib/actions";
import { StageStatus } from "@prisma/client";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getStatusLabel } from "@/lib/utils";

interface Stage {
  id: string;
  stageName: string;
  startDate: Date | null;
  endDate: Date | null;
  deadline?: Date | null;
  status: StageStatus;
  assignedTo: string | null;
  remarks: string | null;
}

interface Props {
  drawingId: string;
  stage: Stage;
  users: { id: string; name: string }[];
  onClose: () => void;
}

export default function StageEditModal({ drawingId, stage, users, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    startDate: stage.startDate ? new Date(stage.startDate).toISOString().split("T")[0] : "",
    endDate: stage.endDate ? new Date(stage.endDate).toISOString().split("T")[0] : "",
    deadline: stage.deadline ? new Date(stage.deadline).toISOString().split("T")[0] : "",
    status: stage.status,
    assignedTo: stage.assignedTo || "",
    remarks: stage.remarks || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateDrawingStage({
          drawingId,
          stageName: stage.stageName,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          deadline: form.deadline || null,
          status: form.status,
          assignedTo: form.assignedTo || null,
          remarks: form.remarks || null,
        });
        toast.success("Stage updated successfully!");
        onClose();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to update stage");
      }
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            Edit Stage: <span className="gradient-text">{getStatusLabel(stage.stageName)}</span>
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className="input-field">
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="DELAYED">Delayed</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Start Date</label>
              <input type="date" name="startDate" value={form.startDate} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">End Date</label>
              <input type="date" name="endDate" value={form.endDate} onChange={handleChange} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Stage Deadline</label>
            <input type="date" name="deadline" value={form.deadline} onChange={handleChange} className="input-field" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Assigned To</label>
            <select name="assignedTo" value={form.assignedTo} onChange={handleChange} className="input-field">
              <option value="">— Unassigned —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Remarks</label>
            <textarea name="remarks" value={form.remarks} onChange={handleChange} className="input-field resize-none" rows={3} placeholder="Any notes for this stage..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1 justify-center">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
