"use client";

import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { user } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // In a real app, check for token here
    const token = localStorage.getItem("auth_token");
    if (!token && !user) {
      // router.push("/login"); // Commented for development
    }
  }, [user, router]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto h-[calc(100vh-64px)]">
          {children}
        </main>
      </div>
    </div>
  );
};
