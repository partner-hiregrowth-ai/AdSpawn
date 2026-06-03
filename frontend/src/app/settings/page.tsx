"use client";

import { useState } from "react";
import useSWR from "swr";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { userApi, teamApi } from "@/services/api";
import { Team, TokenStatus, UserStats, UserProfile } from "@/types";
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
  LogOut,
  Trash2,
  RefreshCw,
  Layers,
  Send,
  Copy,
  BarChart3,
  Users,
  ClipboardCopy,
  UserMinus,
} from "lucide-react";

export default function SettingsPage() {
  const { user: storeUser } = useAppStore();

  const { data: profile, isLoading: loadingProfile } = useSWR<UserProfile>("/user/profile");
  const { data: tokenStatus, isLoading: loadingToken, mutate: mutateToken } = useSWR<TokenStatus>(
    "/user/token-status",
    { onError: () => ({ valid: false, expiresAt: null, scopes: [], message: "Failed to check" }) }
  );
  const { data: stats, isLoading: loadingStats } = useSWR<UserStats>("/user/stats");
  const { data: team, isLoading: loadingTeam, mutate: mutateTeam } = useSWR<Team>("/team");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const handleRegenerateInvite = async () => {
    setRegenerating(true);
    try {
      const res = await teamApi.regenerateInvite();
      mutateTeam(team ? { ...team, inviteCode: res.data.inviteCode } : undefined, false);
      toast.success("Invite code regenerated");
    } catch (err: unknown) { toast.error(extractApiError(err, "Failed to regenerate invite code")); }
    finally { setRegenerating(false); }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMember(memberId);
    try {
      await teamApi.removeMember(memberId);
      mutateTeam(team ? { ...team, members: team.members.filter(m => m.id !== memberId), memberCount: team.memberCount - 1 } : undefined, false);
      toast.success("Member removed");
    } catch (err: unknown) { toast.error(extractApiError(err, "Failed to remove member")); }
    finally { setRemovingMember(null); }
  };

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
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gray-800/60 animate-pulse shrink-0" />
                <div className="space-y-2 min-w-0">
                  <div className="h-5 w-32 bg-gray-800/60 rounded animate-pulse" />
                  <div className="h-4 w-44 bg-gray-800/40 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-800/30 rounded animate-pulse" />
                </div>
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

        {/* Team */}
        <Card className="border-gray-800/60 bg-gray-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingTeam ? (
              <div className="space-y-3">
                <div className="h-5 w-40 bg-gray-800/60 rounded animate-pulse" />
                <div className="h-4 w-28 bg-gray-800/40 rounded animate-pulse" />
              </div>
            ) : team ? (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-200">{team.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{team.memberCount} member{team.memberCount !== 1 ? "s" : ""}</p>
                </div>

                {team.inviteCode && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1.5">Invite code (admin only)</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-blue-400 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700/50">
                        {team.inviteCode}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-gray-500 gap-1"
                        onClick={() => { navigator.clipboard.writeText(team.inviteCode!); toast.success("Copied!"); }}
                      >
                        <ClipboardCopy className="w-3 h-3" /> Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-gray-500 gap-1"
                        onClick={handleRegenerateInvite}
                        disabled={regenerating}
                      >
                        <RefreshCw className={cn("w-3 h-3", regenerating && "animate-spin")} /> Regenerate
                      </Button>
                    </div>
                  </div>
                )}

                {team.members.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">Members</p>
                    <div className="space-y-1">
                      {team.members.map(m => (
                        <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-gray-800/30 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                              <User className="w-3 h-3 text-gray-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-gray-300 truncate">{m.name || "Unnamed"}</p>
                              <p className="text-[10px] text-gray-600 truncate">{m.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded",
                              m.role === 'admin' ? "bg-blue-500/15 text-blue-400" : "bg-gray-800/50 text-gray-500"
                            )}>
                              {m.role}
                            </span>
                            {team.inviteCode && m.role !== 'admin' && (
                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                disabled={removingMember === m.id}
                                className="p-1 text-gray-600 hover:text-red-400 transition-colors rounded"
                                title="Remove member"
                              >
                                <UserMinus className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">No team found</p>
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
                onClick={() => mutateToken()}
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
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-800/60 animate-pulse shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-24 bg-gray-800/60 rounded animate-pulse" />
                    <div className="h-3 w-48 bg-gray-800/40 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-5 w-20 bg-gray-800/40 rounded-full animate-pulse" />)}
                </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-gray-950/50 border border-gray-800/40 rounded-lg px-3 py-3 flex flex-col items-center gap-1.5">
                    <div className="w-4 h-4 bg-gray-800/60 rounded animate-pulse" />
                    <div className="h-6 w-10 bg-gray-800/60 rounded animate-pulse" />
                    <div className="h-3 w-16 bg-gray-800/40 rounded animate-pulse" />
                  </div>
                ))}
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
