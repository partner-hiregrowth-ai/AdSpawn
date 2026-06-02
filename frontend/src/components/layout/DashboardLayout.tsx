"use client";

import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { ErrorBoundary } from "./ErrorBoundary";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsModal } from "./ShortcutsModal";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useAppHydration } from "@/store/useAppStore";
import { useGlobalData } from "@/store/useGlobalData";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const appHydrated = useAppHydration();
  const { user, profile, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore();
  const [mounted, setMounted] = useState(false);

  // Use the optimized global data hook
  useGlobalData();

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    if (!token && !user) {
      router.push("/login");
      return;
    }
    const savedProfileId = localStorage.getItem("profileId");
    if (!profile && !savedProfileId) {
      router.push("/profiles");
    }
  }, [user, profile, router]);

  if (!mounted || !appHydrated) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <CommandPalette />
      <ShortcutsModal />
      <Navbar />
      <div className="flex relative">
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 top-14 z-30 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto h-[calc(100vh-56px)] min-w-0">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
