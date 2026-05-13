"use client";

import { useAppStore } from "@/store/useAppStore";
import { User, LogOut, Bell } from "lucide-react";
import { Button } from "../ui/button";

export const Navbar = () => {
  const { user, selectedAccount } = useAppStore();

  return (
    <nav className="h-16 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-blue-300 bg-clip-text text-transparent">
          AdsDuplicator
        </h1>
        {selectedAccount && (
          <div className="px-3 py-1 rounded-full bg-blue-900/30 border border-blue-500/50 text-blue-400 text-sm">
            {selectedAccount.name}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 pl-4 border-l border-gray-800">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-200">{user?.name || "Member"}</p>
            {user?.email && <p className="text-xs text-gray-500">{user.email}</p>}
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
            <User className="w-6 h-6 text-white" />
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-gray-400 hover:text-red-400"
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/login";
            }}
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
};
