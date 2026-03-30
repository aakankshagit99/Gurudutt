import { getUsers } from "@/lib/actions";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await auth();
  if (((session?.user as unknown) as { role?: string })?.role !== "ADMIN") redirect("/dashboard");

  const users = await getUsers();

  const roleColors: Record<string, string> = {
    ADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
    MANAGER: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ENGINEER: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-slate-400 text-sm mt-1">{users.length} users in the system</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <Shield className="w-4 h-4 text-red-400" />
          <span className="text-xs text-red-400 font-medium">Admin Only</span>
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user: { id: string; name: string; email: string; role: string; department: string | null }) => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                      {user.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium text-white">{user.name}</span>
                  </div>
                </td>
                <td className="text-slate-400">{user.email}</td>
                <td>
                  <span className={`status-badge ${roleColors[user.role] || "bg-slate-500/20 text-slate-400"}`}>
                    {user.role}
                  </span>
                </td>
                <td className="text-slate-400">{user.department || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
