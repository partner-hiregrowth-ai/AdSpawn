"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Zap, Layers, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function RootPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/dashboard");
    } else {
      setChecking(false);
    }
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] -z-10" />

      {/* Navigation */}
      <nav className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg italic">A</div>
          <span className="text-xl font-bold tracking-tight">AdSpawn</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy</Link>
          <Link 
            href="/login" 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto py-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-medium mb-8">
          <Zap className="w-3 h-3" />
          Next-Gen Meta Ad Management
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent">
          Duplicate. Convert. <br />Scale Faster.
        </h1>
        
        <p className="text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed">
          The ultimate developer tool for Meta Ads. Switch objectives, bulk edit, and validate campaigns with zero risk.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link 
            href="/login" 
            className="px-8 py-4 bg-white text-black hover:bg-gray-200 rounded-xl font-bold text-lg flex items-center gap-2 transition-all group"
          >
            Get Started
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link 
            href="/privacy" 
            className="px-8 py-4 bg-gray-900 border border-gray-800 hover:border-gray-700 text-white rounded-xl font-bold text-lg transition-all"
          >
            Learn Privacy
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 text-left">
          <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Bulk Operations</h3>
            <p className="text-gray-500 text-sm">Manage hundreds of campaigns across accounts in a single workspace.</p>
          </div>
          <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Objective Conversion</h3>
            <p className="text-gray-500 text-sm">Instantly switch objectives (e.g. Traffic to Sales) with intelligent field mapping.</p>
          </div>
          <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Pre-flight Validation</h3>
            <p className="text-gray-500 text-sm">Catch Meta API errors before you publish with our local constraint engine.</p>
          </div>
        </div>
      </main>

      <footer className="p-10 border-t border-gray-900 text-center text-gray-600 text-sm">
        <p>© 2026 AdSpawn. All rights reserved.</p>
        <div className="mt-4 flex justify-center gap-6">
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
          <a href="#" className="hover:text-gray-400 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-gray-400 transition-colors">Documentation</a>
        </div>
      </footer>
    </div>
  );
}
