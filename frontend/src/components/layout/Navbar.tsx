"use client";

import { useAppStore } from "@/store/useAppStore";
import { usePathname } from "next/navigation";
import { User, LogOut, ChevronRight, Menu } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import React from "react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/explorer": "Explorer",
  "/drafts": "Drafts",
  "/history": "History",
  "/settings": "Settings",
};

export const Navbar = () => {
  const { user, selectedAccount, toggleMobileSidebar } = useAppStore();
  const pathname = usePathname();
  const currentPage = pageTitles[pathname] || (pathname.startsWith("/drafts/") ? "Draft Editor" : "");

  return (
    <nav className="h-14 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-5 sticky top-0 z-50">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleMobileSidebar}
          className="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors -ml-1 shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent shrink-0">
          AdSpawn
        </h1>
        {currentPage && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-gray-700 shrink-0" />
            <span className="text-sm text-gray-400 font-medium hidden sm:inline">{currentPage}</span>
          </>
        )}
        {selectedAccount && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-gray-700 shrink-0 hidden sm:inline" />
            <div className="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium max-w-[120px] truncate hidden sm:block">
              {selectedAccount.name}
            </div>
          </>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<button className="flex items-center gap-2 sm:gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-800/50 transition-colors outline-none shrink-0" />}
        >
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-300 leading-none">{user?.name || "Member"}</p>
            {user?.email && <p className="text-[11px] text-gray-600 mt-0.5">{user.email}</p>}
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center ring-2 ring-gray-800 shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-800">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-gray-200">{user?.name || "Member"}</p>
            {user?.email && <p className="text-xs text-gray-500">{user.email}</p>}
          </div>
          <DropdownMenuSeparator className="bg-gray-800" />
          <DropdownMenuItem
            onClick={() => {
              const store = useAppStore.getState();
              store.setUser(null);
              store.setSelectedAccount(null);
              store.setAdAccounts([]);
              localStorage.removeItem("token");
              window.location.href = "/login";
            }}
            className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
};
