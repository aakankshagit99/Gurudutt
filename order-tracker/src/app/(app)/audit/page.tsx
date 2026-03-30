import { getAuditLogs } from "@/lib/actions";
import { formatDateTime } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await getAuditLogs();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-slate-400 text-sm mt-1">Complete history of all changes in the system</p>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <ClipboardList className="w-5 h-5 text-slate-400" />
          <h2 className="font-semibold text-white">All Activity</h2>
          <span className="text-xs text-slate-500 ml-auto">{logs.length} entries</span>
        </div>

        <div className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-slate-500 text-center py-10">No audit logs yet</p>
          ) : (
            logs.map((log: { id: string; action: string; entityType: string; user?: { name: string } | null; createdAt: Date }) => {
              const actionColors: Record<string, string> = {
                CREATE: "bg-green-500/20 text-green-400",
                UPDATE: "bg-blue-500/20 text-blue-400",
                DELETE: "bg-red-500/20 text-red-400",
                UPDATE_STAGE: "bg-purple-500/20 text-purple-400",
              };

              return (
                <div key={log.id} className="flex gap-4 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:border-slate-700 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColors[log.action] || "bg-slate-700 text-slate-300"}`}>
                        {log.action.replace("_", " ")}
                      </span>
                      <span className="text-sm text-slate-300">{log.entityType}</span>
                      {log.user && (
                        <span className="text-xs text-slate-500">by <span className="text-slate-400">{log.user.name}</span></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{formatDateTime(log.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
