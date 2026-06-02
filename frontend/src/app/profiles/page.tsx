"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Layers, Plus, Loader2, Trash2, ArrowRight, User } from "lucide-react";
import { toast } from "sonner";
import { profileApi } from "@/services/api";
import { useAppStore, Profile } from "@/store/useAppStore";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function ProfilesPage() {
  const router = useRouter();
  const { setProfile, setProfiles } = useAppStore();
  const [profiles, setLocalProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  const fetchProfiles = async () => {
    try {
      const res = await profileApi.list();
      setLocalProfiles(res.data);
      setProfiles(res.data);
    } catch {
      toast.error("Failed to load profiles");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchProfiles();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      await profileApi.create(newName.trim());
      setNewName("");
      toast.success("Profile created");
      await fetchProfiles();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create profile");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await profileApi.delete(deleteTarget.id);
      toast.success("Profile deleted");
      await fetchProfiles();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete profile");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSelect = (profile: Profile) => {
    setProfile(profile);
    toast.success(`Working as ${profile.name}`);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center login-bg relative overflow-hidden p-5">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute top-[-10%] left-[10%] w-[480px] h-[480px] bg-blue-700/10 rounded-full blur-[120px] float-orb pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[5%] w-[400px] h-[400px] bg-blue-500/8 rounded-full blur-[100px] float-orb-delayed pointer-events-none" />

      <div className="w-full max-w-[460px] animate-fade-in-up relative">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/25">
            <Layers className="text-white" style={{ width: 18, height: 18 }} />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">AdSpawn</span>
        </div>

        <div className="bg-gray-900/90 backdrop-blur-xl border border-white/[0.07] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-[1.35rem] font-bold text-gray-100 mb-1.5 tracking-tight">
                Choose a profile
              </h2>
              <p className="text-sm text-gray-500">
                Select a profile to work as, or create a new one.
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : (
              <>
                {profiles.length > 0 ? (
                  <div className="space-y-2 mb-6">
                    {profiles.map((p) => (
                      <div
                        key={p.id}
                        className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all cursor-pointer"
                        onClick={() => handleSelect(p)}
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center shrink-0 border border-blue-500/10">
                          <User className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-200 truncate">{p.name}</p>
                          <p className="text-[11px] text-gray-600">
                            {p._count?.draftCampaigns ?? 0} draft{(p._count?.draftCampaigns ?? 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Delete profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ArrowRight className="w-4 h-4 text-gray-700 group-hover:text-blue-400 transition-colors shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 mb-6">
                    <User className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium text-sm">No profiles yet</p>
                    <p className="text-gray-500 text-xs mt-1">Create your first profile to get started.</p>
                  </div>
                )}

                <div className="border-t border-gray-800/60 pt-5">
                  <form onSubmit={handleCreate} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="New profile name..."
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="flex-1 bg-gray-950/50 border border-gray-800/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 placeholder:text-gray-500 transition-colors"
                      required
                    />
                    <Button
                      type="submit"
                      disabled={isCreating || !newName.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 gap-1.5 shrink-0"
                    >
                      {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Create
                    </Button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Profile"
        description={
          deleteTarget?._count?.draftCampaigns
            ? `"${deleteTarget.name}" has ${deleteTarget._count.draftCampaigns} draft(s). Delete the drafts first, or they will be orphaned.`
            : `Delete profile "${deleteTarget?.name}"? This cannot be undone.`
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}
