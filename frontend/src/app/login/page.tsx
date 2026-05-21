"use client";

import { Button } from "@/components/ui/button";
import { LogIn, Loader2, Code, Shield, Zap, Copy, Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { authApi } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAppStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [devToken, setDevToken] = useState("");

  useEffect(() => {
    if (searchParams.get("reason") === "token_expired") {
      toast.error("Your Facebook session expired. Please log in again.");
    }
  }, [searchParams]);

  const handleFacebookLogin = () => {
    const appId = process.env.NEXT_PUBLIC_FB_APP_ID;
    if (!appId || appId === "your_facebook_app_id") {
      toast.error("Facebook App ID is not configured. Please check your .env.local file.");
      return;
    }
    if (!window.FB) {
      toast.error("Facebook SDK not loaded. This is often caused by AdBlockers or a slow connection.");
      return;
    }
    setIsLoggingIn(true);
    window.FB.login(
      (response: any) => {
        if (response.authResponse) {
          verifyToken(response.authResponse.accessToken);
        } else {
          setIsLoggingIn(false);
          toast.error(response.status === "not_authorized" ? "Please authorize the app to continue." : "Login cancelled.");
        }
      },
      { scope: "ads_management,ads_read,business_management,public_profile,email" }
    );
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devToken) return;
    setIsLoggingIn(true);
    await verifyToken(devToken);
  };

  const verifyToken = async (accessToken: string) => {
    try {
      const response = await authApi.loginWithFacebook(accessToken);
      localStorage.setItem("token", response.data.token);
      setUser(response.data.user);
      toast.success("Successfully logged in!");
      router.push("/dashboard");
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to sync account with backend.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const features = [
    { icon: Copy,   label: "Bulk Duplicate",       desc: "Clone full campaign structures in seconds" },
    { icon: Zap,    label: "Objective Conversion",  desc: "Switch objectives without losing structure" },
    { icon: Shield, label: "Always Safe",           desc: "Every object created as PAUSED" },
  ];

  return (
    <div className="min-h-screen flex login-bg relative overflow-hidden">
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:56px_56px]" />

      {/* Ambient glow orbs */}
      <div className="absolute top-[-10%] left-[10%] w-[480px] h-[480px] bg-blue-700/10 rounded-full blur-[120px] float-orb pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[5%]  w-[400px] h-[400px] bg-blue-500/8  rounded-full blur-[100px] float-orb-delayed pointer-events-none" />

      {/* ── Left branding panel (desktop only) ── */}
      <div className="hidden lg:flex flex-col justify-center px-16 xl:px-24 relative w-[52%] xl:w-[55%]">
        <div className="max-w-lg">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Layers className="w-5.5 h-5.5 text-white" style={{ width: 22, height: 22 }} />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">AdSpawn</span>
          </div>

          {/* Headline */}
          <h1 className="text-[2.75rem] xl:text-5xl font-bold leading-[1.15] text-white mb-5">
            Meta Ads management
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
              at scale.
            </span>
          </h1>

          <p className="text-base text-gray-400 leading-relaxed mb-10 max-w-md">
            Duplicate, convert, and publish campaign structures safely — powered by Meta Marketing API v21.0.
          </p>

          {/* Feature list */}
          <div className="space-y-3.5">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-3.5 group">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all duration-200">
                  <f.icon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-200">{f.label}</span>
                  <span className="text-sm text-gray-600"> — {f.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Divider + API badge */}
          <div className="mt-12 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-gray-800/80 to-transparent" />
            <span className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.15em] whitespace-nowrap">
              Meta Marketing API v21.0
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-gray-800/80 to-transparent" />
          </div>
        </div>
      </div>

      {/* ── Right login panel ── */}
      <div className="flex-1 flex items-center justify-center p-5 lg:px-16">
        <div className="w-full max-w-[400px] animate-fade-in-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/25">
              <Layers className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">AdSpawn</span>
          </div>

          {/* Card */}
          <div className="bg-gray-900/90 backdrop-blur-xl border border-white/[0.07] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Top accent line */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

            <div className="p-8">
              {/* Header */}
              <div className="mb-7">
                <h2 className="text-[1.35rem] font-bold text-gray-100 mb-1.5 tracking-tight">
                  Welcome back
                </h2>
                <p className="text-sm text-gray-500">
                  Sign in with your Meta account to continue
                </p>
              </div>

              {/* Facebook login button */}
              <Button
                onClick={handleFacebookLogin}
                disabled={isLoggingIn}
                className="w-full bg-[#1877F2] hover:bg-[#1568d3] text-white h-12 text-sm font-semibold gap-2.5 rounded-xl transition-all duration-150 hover:shadow-lg hover:shadow-blue-600/25 active:scale-[0.98]"
              >
                {isLoggingIn
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <FacebookIcon className="w-4 h-4" />
                }
                {isLoggingIn ? "Connecting..." : "Continue with Facebook"}
              </Button>

              {/* Safety notice */}
              <div className="mt-4 flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <Shield className="w-3.5 h-3.5 text-gray-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  All new campaigns are created{" "}
                  <span className="text-gray-400 font-semibold">PAUSED</span>.
                  Nothing goes live without your approval.
                </p>
              </div>

              {/* Footer */}
              <div className="mt-5 space-y-3 text-center">
                <p className="text-[11px] text-gray-700 leading-relaxed">
                  By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
                {!showDevMode && (
                  <button
                    onClick={() => setShowDevMode(true)}
                    className="text-[10px] text-gray-700 hover:text-gray-500 transition-colors uppercase tracking-[0.14em]"
                  >
                    Developer Mode
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dev mode overlay ── */}
      {showDevMode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-sm border-gray-800 bg-gray-900 shadow-2xl animate-fade-in-up">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Code className="w-5 h-5 text-blue-400" />
                Developer Access
              </CardTitle>
              <CardDescription>Bypass SDK for local testing.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDevLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="token" className="text-gray-300 text-sm">Meta Access Token</Label>
                  <Input
                    id="token"
                    placeholder="EAA..."
                    value={devToken}
                    onChange={(e) => setDevToken(e.target.value)}
                    className="bg-gray-950 border-gray-800 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setShowDevMode(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoggingIn} className="flex-[2] bg-blue-600 hover:bg-blue-700">
                    {isLoggingIn && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Submit
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
