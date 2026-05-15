"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, Loader2, Code, Shield, Zap, Copy } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { authApi } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
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
    if (searchParams.get('reason') === 'token_expired') {
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

    window.FB.login((response: any) => {
      if (response.authResponse) {
        const accessToken = response.authResponse.accessToken;
        verifyToken(accessToken);
      } else {
        setIsLoggingIn(false);
        if (response.status === 'not_authorized') {
          toast.error("Please authorize the app to continue.");
        } else {
          toast.error("Login cancelled.");
        }
      }
    }, {
      scope: 'ads_management,ads_read,business_management,public_profile,email'
    });
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
      const message = error.response?.data?.message || "Failed to sync account with backend.";
      toast.error(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const features = [
    { icon: Copy, label: "Bulk Duplicate", desc: "Campaigns, ad sets & ads" },
    { icon: Shield, label: "Safety First", desc: "Always created as PAUSED" },
    { icon: Zap, label: "Smart Naming", desc: "Template-based renaming" },
  ];

  return (
    <div className="min-h-screen flex login-bg relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-20 left-[15%] w-72 h-72 bg-blue-600/5 rounded-full blur-3xl float-orb" />
      <div className="absolute bottom-20 right-[10%] w-96 h-96 bg-cyan-600/5 rounded-full blur-3xl float-orb-delayed" />

      {/* Left panel - branding (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 xl:px-24 relative">
        <div className="max-w-md">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent mb-4">
            AdsDuplicator
          </h1>
          <p className="text-lg text-gray-400 mb-10 leading-relaxed">
            Professional Meta Ads management. Duplicate campaign structures safely and efficiently.
          </p>
          <div className="space-y-5">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <f.icon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-200">{f.label}</p>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - login card */}
      <div className="flex-1 flex items-center justify-center px-4 lg:px-16">
        <Card className="w-full max-w-sm border-gray-800/60 bg-gray-900/80 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center space-y-1 pb-4">
            <div className="lg:hidden">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                AdsDuplicator
              </CardTitle>
            </div>
            <div className="hidden lg:block">
              <CardTitle className="text-xl font-bold text-gray-100">
                Welcome back
              </CardTitle>
            </div>
            <CardDescription className="text-gray-500 text-sm">
              Sign in with your Meta account to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleFacebookLogin}
              disabled={isLoggingIn}
              className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white h-11 text-sm font-semibold gap-2.5 transition-all hover:shadow-lg hover:shadow-blue-500/20"
            >
              {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {isLoggingIn ? "Connecting..." : "Continue with Facebook"}
            </Button>

            <div className="pt-4 flex flex-col items-center gap-3">
              <p className="text-center text-[11px] text-gray-600 leading-relaxed">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>

              {!showDevMode && (
                <button
                  onClick={() => setShowDevMode(true)}
                  className="text-[10px] text-gray-700 hover:text-gray-500 transition-colors uppercase tracking-widest"
                >
                  Developer Mode
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dev mode overlay */}
      {showDevMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-sm border-gray-800 bg-gray-900 shadow-2xl animate-fade-in-up">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Code className="w-5 h-5 text-blue-400" />
                Developer Access
              </CardTitle>
              <CardDescription>
                Bypass SDK for local testing.
              </CardDescription>
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
                    {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
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
