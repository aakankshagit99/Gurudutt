"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  Columns,
  GanttChart,
  Users,
  ClipboardList,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Orders · Table", href: "/orders", icon: Package },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Kanban Board", href: "/kanban", icon: Columns },
  { label: "Timeline", href: "/timeline", icon: GanttChart },
  { label: "Audit Logs", href: "/audit", icon: ClipboardList },
  { label: "Users", href: "/users", icon: Users, adminOnly: true },
];

export default function AppSidebar({ role }: { role?: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNav = navItems.filter(
    (item) => !item.adminOnly || role === "ADMIN"
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-[#080d1a] border-r border-slate-800 transition-all duration-200 z-30",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-white z-10 transition-colors"
        >
          <ChevronDown className={cn("w-3 h-3 transition-transform", collapsed ? "rotate-90" : "-rotate-90")} />
        </button>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
            <div className="w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-blue-400" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">OrderFlow</p>
                <p className="text-xs text-slate-500 truncate">Gurudutt Industries</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn("sidebar-link", isActive && "active")}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="p-3 border-t border-slate-800">
            <div className={cn("flex items-center gap-3 p-2 rounded-lg", !collapsed && "bg-slate-800/40")}>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                {session?.user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{session?.user?.name}</p>
                  <p className="text-xs text-slate-500 capitalize truncate">{((session?.user as unknown) as { role?: string })?.role?.toLowerCase()}</p>
                </div>
              )}
              {!collapsed && (
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
            {collapsed && (
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center justify-center p-2 text-slate-500 hover:text-red-400 transition-colors mt-1"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-slate-800/80 backdrop-blur border border-slate-700 rounded-lg text-slate-400 hover:text-white"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-[#080d1a] border-r border-slate-800">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col h-full">
              {/* Logo */}
              <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
                <div className="w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">OrderFlow</p>
                  <p className="text-xs text-slate-500 truncate">Gurudutt Industries</p>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {filteredNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn("sidebar-link", isActive && "active")}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* User */}
              <div className="p-3 border-t border-slate-800">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/40">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                    {session?.user?.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{session?.user?.name}</p>
                    <p className="text-xs text-slate-500 capitalize truncate">{((session?.user as unknown) as { role?: string })?.role?.toLowerCase()}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
