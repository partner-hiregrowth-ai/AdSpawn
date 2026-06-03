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

type AuthState = "checking" | "authenticated" | "unauthenticated" | "needs_profile";

function AuthLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    </div>
  );
}

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const appHydrated = useAppHydration();
  const { user, profile, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore();
  const [authState, setAuthState] = useState<AuthState>("checking");

  useGlobalData();

  useEffect(() => {
    if (!appHydrated) return;

    const token = localStorage.getItem("token");
    if (!token && !user) {
      setAuthState("unauthenticated");
      router.replace("/login");
      return;
    }

    const savedProfileId = localStorage.getItem("profileId");
    if (!profile && !savedProfileId) {
      setAuthState("needs_profile");
      router.replace("/profiles");
      return;
    }

    setAuthState("authenticated");
  }, [appHydrated, user, profile, router]);

  if (!appHydrated || authState === "checking") return <AuthLoadingSkeleton />;
  if (authState === "unauthenticated" || authState === "needs_profile") return <AuthLoadingSkeleton />;

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
