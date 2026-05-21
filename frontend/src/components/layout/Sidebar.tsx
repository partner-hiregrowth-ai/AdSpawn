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
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: FolderTree, label: "Explorer", href: "/explorer" },
  { icon: Grid3X3, label: "Wide Create", href: "/wide-create" },
  { icon: Layers, label: "Drafts", href: "/drafts" },
  { icon: History, label: "History", href: "/history" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore();

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
      <div className="flex-1 py-4 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              onClick={() => setMobileSidebarOpen(false)}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium group",
                isActive
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-gray-500 hover:text-gray-200 hover:bg-gray-800/50"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full" />
              )}
              <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-blue-400")} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

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
