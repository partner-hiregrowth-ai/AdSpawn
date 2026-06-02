"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  History,
  FolderTree,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Grid3X3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const menuItems = [
  { icon: LayoutDashboard, label: "Account", href: "/dashboard", desc: "Select an ad account to work with" },
  { icon: FolderTree, label: "Explorer", href: "/explorer", desc: "Browse campaigns, ad sets, and ads — select to duplicate or convert" },
  { icon: Layers, label: "Drafts", href: "/drafts", desc: "Edit campaign drafts and publish to Meta" },
  { icon: Grid3X3, label: "Wide Create", href: "/wide-create", desc: "Build bulk campaign structures from scratch across multiple objectives" },
  { icon: History, label: "History", href: "/history", desc: "Log of all duplication and conversion jobs" },
  { icon: Settings, label: "Settings", href: "/settings", desc: "Account, team, and connection settings" },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen, selectedAccount } = useAppStore();

  return (
    <aside className={cn(
      "sidebar-transition border-r border-gray-800/60 bg-gray-950 flex flex-col",
      // Mobile: fixed overlay positioned below the navbar
      "fixed top-14 left-0 bottom-0 z-40",
      // Desktop: back in normal flex flow
      "md:relative md:top-auto md:left-auto md:bottom-auto md:z-auto md:h-[calc(100vh-56px)]",
      // Width
      sidebarCollapsed ? "w-[68px]" : "w-60",
      // Mobile open/close via translate; desktop always visible
      mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
      "md:translate-x-0",
    )}>
      <div className="flex-1 py-4 px-3 space-y-0.5">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={sidebarCollapsed ? `${item.label} — ${item.desc}` : item.desc}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setMobileSidebarOpen(false)}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium group",
                "transition-all duration-200 ease-out",
                isActive
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-gray-500 hover:text-gray-200 hover:bg-gray-800/60"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full transition-all duration-200" />
              )}
              <item.icon className={cn(
                "w-[18px] h-[18px] shrink-0 transition-colors duration-200",
                isActive ? "text-blue-400" : "group-hover:text-gray-300"
              )} />
              {!sidebarCollapsed && (
                <span className="transition-opacity duration-150">{item.label}</span>
              )}
            </Link>
          );
        })}
      </div>

      {selectedAccount && (
        <div className={cn("px-3 pb-2", sidebarCollapsed && "px-2")}>
          {sidebarCollapsed ? (
            <div
              title={selectedAccount.name}
              className="flex items-center justify-center w-full py-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-blue-400 ring-2 ring-blue-400/20" />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span className="text-xs text-blue-300 truncate">{selectedAccount.name}</span>
            </div>
          )}
        </div>
      )}
      <div className="p-3 border-t border-gray-800/60">
        <button
          onClick={toggleSidebar}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800/50 transition-colors w-full text-sm"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="w-[18px] h-[18px] shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="w-[18px] h-[18px] shrink-0" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 px-3 mt-2 text-[10px] text-gray-700">
            <Zap className="w-3 h-3" />
            AdSpawn v1.0
          </div>
        )}
      </div>
    </aside>
  );
};
