"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { userApi } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";
import { cn, extractApiError } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  User,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  LogOut,
  Trash2,
  RefreshCw,
  Layers,
  Send,
  Copy,
  BarChart3,
} from "lucide-react";

interface TokenStatus {
  valid: boolean;
  expiresAt: string | null;
  scopes: string[];
  message?: string;
}

interface Stats {
  draftCount: number;
  publishedCount: number;
  jobCount: number;
  accountCount: number;
}

interface Profile {
  id: string;
  facebookId: string;
  name: string | null;
  email: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const { user: storeUser } = useAppStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await userApi.getProfile();
      setProfile(res.data);
    } catch {
      // fall back to store user if API fails
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchTokenStatus = async () => {
    setLoadingToken(true);
    try {
      const res = await userApi.getTokenStatus();
      setTokenStatus(res.data);
    } catch (err) {
      setTokenStatus({ valid: false, expiresAt: null, scopes: [], message: "Failed to check" });
    } finally {
      setLoadingToken(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await userApi.getStats();
      setStats(res.data);
    } catch (err: any) {
      toast.error(extractApiError(err, "Couldn't load your stats. Refresh the page or check your connection."));
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchTokenStatus();
    fetchStats();
  }, []);

  const user = profile || storeUser;

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await userApi.deleteAccount();
      localStorage.removeItem("token");
      window.location.href = "/login";
    } catch (err: any) {
      toast.error(extractApiError(err, "Failed to delete account"));
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const tokenExpiry = tokenStatus?.expiresAt ? new Date(tokenStatus.expiresAt) : null;
  const daysUntilExpiry = tokenExpiry
    ? Math.ceil((tokenExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage your profile, connection, and account.</p>
        </div>

        {/* Profile */}
        <Card className="border-gray-800/60 bg-gray-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingProfile && !user ? (
              <div className="flex items-center gap-3 text-gray-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading profile...</span>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center ring-2 ring-gray-800 shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-200">{user?.name || "Unknown"}</p>
                  <p className="text-sm text-gray-500">{user?.email || "No email"}</p>
                  <p className="text-xs text-gray-600 mt-0.5">FB ID: {user?.facebookId || "—"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meta Connection */}
        <Card className="border-gray-800/60 bg-gray-900/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                Meta Connection
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTokenStatus}
                disabled={loadingToken}
                className="h-7 text-xs text-gray-500 gap-1.5"
              >
                <RefreshCw className={cn("w-3 h-3", loadingToken && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingToken ? (
              <div className="flex items-center gap-3 text-gray-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Checking token status...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    tokenStatus?.valid ? "bg-emerald-500/15" : "bg-red-500/15"
                  )}>
                    {tokenStatus?.valid ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4.5 h-4.5 text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-200">
                      {tokenStatus?.valid ? "Connected" : "Disconnected"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {tokenStatus?.valid
                        ? tokenExpiry
                          ? `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""} (${tokenExpiry.toLocaleDateString()})`
                          : "Token is valid"
                        : tokenStatus?.message || "Token is invalid or expired"}
                    </p>
                  </div>
                </div>

                {tokenStatus?.scopes && tokenStatus.scopes.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">Permissions granted:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tokenStatus.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-800/60 text-gray-400 border border-gray-700/50"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!tokenStatus?.valid && (
                  <Button
                    size="sm"
                    className="bg-[#1877F2] hover:bg-[#1568d3] text-white gap-2"
                    onClick={() => { window.location.href = "/login"; }}
                  >
                    Reconnect with Facebook
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <Card className="border-gray-800/60 bg-gray-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <div className="flex items-center gap-3 text-gray-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading stats...</span>
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Ad Accounts", value: stats.accountCount, icon: Layers },
                  { label: "Active Drafts", value: stats.draftCount, icon: Copy },
                  { label: "Published", value: stats.publishedCount, icon: Send },
                  { label: "Total Jobs", value: stats.jobCount, icon: BarChart3 },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-gray-950/50 border border-gray-800/40 rounded-lg px-3 py-3 text-center"
                  >
                    <s.icon className="w-4 h-4 text-gray-600 mx-auto mb-1.5" />
                    <p className="text-xl font-bold text-gray-200">{s.value}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="border-gray-800/60 bg-gray-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Account Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-gray-300">Sign out</p>
                <p className="text-xs text-gray-600">Log out of this session.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-1.5 border-gray-700 text-gray-400 hover:text-gray-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </Button>
            </div>
            <div className="border-t border-gray-800/40" />
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-red-400">Delete account</p>
                <p className="text-xs text-gray-600">Permanently delete your account and all data.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Account"
        description="This will permanently delete your account, all drafts, templates, and history. This action cannot be undone."
        confirmLabel="Delete Everything"
        variant="danger"
        onConfirm={handleDeleteAccount}
        isLoading={isDeleting}
      />
    </DashboardLayout>
  );
}
