"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, Loader2, Code, Info } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { authApi } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAppStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [devToken, setDevToken] = useState("");

  const handleFacebookLogin = () => {
    if (!window.FB) {
      toast.error("Facebook SDK not loaded. Check your App ID or AdBlocker.");
      return;
    }

    setIsLoggingIn(true);
    
    window.FB.login((response: any) => {
      if (response.authResponse) {
        const accessToken = response.authResponse.accessToken;
        verifyToken(accessToken);
      } else {
        setIsLoggingIn(false);
        toast.error("User cancelled login or did not fully authorize.");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <Card className="w-full max-w-md border-gray-800 bg-gray-900 shadow-2xl">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-blue-300 bg-clip-text text-transparent">
            AdsDuplicator
          </CardTitle>
          <CardDescription className="text-gray-400">
            Professional Meta Ads Management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg text-sm text-blue-300 mb-6">
            <p className="font-semibold mb-1">Safety First</p>
            All duplicated structures are automatically set to PAUSED to prevent accidental spend.
          </div>

          <Button 
            onClick={handleFacebookLogin}
            disabled={isLoggingIn}
            className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white h-12 text-lg font-semibold gap-3"
          >
            {isLoggingIn ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-6 h-6" />}
            {isLoggingIn ? "Connecting..." : "Login with Facebook"}
          </Button>

          <div className="pt-6 flex flex-col items-center gap-4">
            <p className="text-center text-xs text-gray-500">
              By logging in, you agree to our Terms of Service and Privacy Policy.
            </p>
            
            {!showDevMode && (
              <button 
                onClick={() => setShowDevMode(true)}
                className="text-[10px] text-gray-700 hover:text-gray-500 transition-colors uppercase tracking-widest"
              >
                Localhost Debug Mode
              </button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {showDevMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-sm border-gray-800 bg-gray-900 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
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
                  <Label htmlFor="token" className="text-gray-300">Meta Access Token</Label>
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
                  <Button type="submit" disabled={isLoggingIn} className="flex-[2] bg-blue-600">
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
