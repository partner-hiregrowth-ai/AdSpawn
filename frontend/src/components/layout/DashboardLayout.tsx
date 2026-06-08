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
import { AlertTriangle, X } from "lucide-react";

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

function TokenExpiryBanner() {
  const tokenExpiresAt = useAppStore((s) => s.tokenExpiresAt);
  const [dismissed, setDismissed] = useState(false);

  if (!tokenExpiresAt || dismissed) return null;

  const expiresAt = new Date(tokenExpiresAt);
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft > 7 || daysLeft < 0) return null;

  const isUrgent = daysLeft <= 2;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-xs ${isUrgent ? "bg-red-500/10 border-b border-red-500/20" : "bg-amber-500/10 border-b border-amber-500/20"}`}>
      <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${isUrgent ? "text-red-400" : "text-amber-400"}`} />
      <span className={isUrgent ? "text-red-300" : "text-amber-300"}>
        Your Facebook token expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}.
      </span>
      <a href="/login" className={`font-medium underline underline-offset-2 ${isUrgent ? "text-red-400 hover:text-red-300" : "text-amber-400 hover:text-amber-300"}`}>
        Reconnect now
      </a>
      <button onClick={() => setDismissed(true)} className="ml-auto text-gray-600 hover:text-gray-400 shrink-0" aria-label="Dismiss">
        <X className="w-3 h-3" />
      </button>
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
    <div className="dark min-h-screen bg-gray-950 text-gray-100">
      <CommandPalette />
      <ShortcutsModal />
      <Navbar />
      <TokenExpiryBanner />
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
