"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { draftApi, adAccountApi, profileApi } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { Edit2, Trash2, Send, Layers, Loader2, X, Pencil, Play, Pause, Search, Download, Upload, CheckCircle2, AlertTriangle, FileText, FolderOpen, FolderTree, Grid3X3, MoreHorizontal, LayoutGrid, List, Share2, Eye, UserPlus } from "lucide-react";
import { OBJECTIVE_LABELS } from "@/lib/meta-schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { toast } from "sonner";
import { cn, extractApiError } from "@/lib/utils";
import { BulkEditPanel } from "@/components/dashboard/BulkEditPanel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function DraftsPage() {
  const profileId = useAppStore((s) => s.profile?.id);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{ current: number; total: number } | null>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'bulkDelete' | 'publish' | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<'date' | 'name' | 'status' | 'objective'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<'mine' | 'shared'>('mine');
  const [sharedDrafts, setSharedDrafts] = useState<any[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [showBulkShare, setShowBulkShare] = useState(false);
  const [bulkShareTargetIds, setBulkShareTargetIds] = useState<string[]>([]);
  const [bulkSharePermission, setBulkSharePermission] = useState("view");
  const [isBulkSharing, setIsBulkSharing] = useState(false);
  const [bulkShareProfiles, setBulkShareProfiles] = useState<any[]>([]);

  const fetchSharedWithMe = async () => {
    setLoadingShared(true);
    try {
      const response = await draftApi.getSharedWithMe();
      setSharedDrafts(response.data);
    } catch (error: any) {
      toast.error(extractApiError(error, "Failed to load shared drafts"));
    } finally {
      setLoadingShared(false);
    }
  };

  const openBulkShare = async () => {
    setShowBulkShare(true);
    setBulkShareTargetIds([]);
    setBulkSharePermission("view");
    try {
      const res = await profileApi.list();
      setBulkShareProfiles(res.data.filter((p: any) => p.id !== profileId));
    } catch {
      toast.error("Failed to load profiles");
    }
  };

  const handleBulkShare = async () => {
    if (bulkShareTargetIds.length === 0 || selectedIds.size === 0) return;
    setIsBulkSharing(true);
    try {
      const res = await draftApi.bulkShareDrafts(Array.from(selectedIds), bulkShareTargetIds, bulkSharePermission);
      toast.success(`Shared ${selectedIds.size} draft${selectedIds.size > 1 ? 's' : ''} with ${bulkShareTargetIds.length} profile${bulkShareTargetIds.length > 1 ? 's' : ''} (${res.data.created} new)`);
      setShowBulkShare(false);
      setBulkShareTargetIds([]);
    } catch (err: any) {
      toast.error(extractApiError(err, "Bulk share failed"));
    } finally {
      setIsBulkSharing(false);
    }
  };

  const fetchDrafts = async () => {
    try {
      setIsLoading(true);
      const response = await draftApi.listCampaigns();
      setDrafts(response.data.items ?? response.data);
    } catch (error: any) {
      console.error("Failed to fetch drafts:", error);
      toast.error(extractApiError(error, "Failed to load drafts"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedIds(new Set());
    fetchDrafts();
    if (activeTab === 'shared') fetchSharedWithMe();
  }, [profileId]);

  useEffect(() => {
    if (activeTab === 'shared') fetchSharedWithMe();
  }, [activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDelete = async (id?: string) => {
    const targetId = id || deleteTargetId;
    if (!targetId) return;
    const prev = drafts;
    setDrafts(d => d.filter(x => x.id !== targetId));
    setSelectedIds(s => { const next = new Set(s); next.delete(targetId); return next; });
    try {
      await draftApi.deleteCampaign(targetId);
      toast.success("Draft deleted");
    } catch (error: any) {
      toast.error(extractApiError(error, "Failed to delete draft"));
      setDrafts(prev);
    } finally {
      setConfirmAction(null);
      setDeleteTargetId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const publishable = drafts.filter((d) => d.status !== "PUBLISHING" && d.status !== "PUBLISHED");
    if (selectedIds.size === publishable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(publishable.map((d) => d.id)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const response = await draftApi.bulkDeleteDrafts(ids);
      toast.success(`${response.data.deleted} draft${response.data.deleted !== 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      fetchDrafts();
    } catch (error: any) {
      toast.error(extractApiError(error, "Bulk delete failed"));
    } finally {
      setIsBulkDeleting(false);
      setConfirmAction(null);
    }
  };

  const handleActivateDraft = async (draft: any) => {
    if (!draft.metaId) return;
    setTogglingId(draft.id);
    try {
      await adAccountApi.bulkActivate([draft.metaId]);
      toast.success('Campaign activated on Meta');
    } catch (err: any) {
      toast.error(extractApiError(err, 'Failed to activate'));
    } finally {
      setTogglingId(null);
    }
  };

  const handlePauseDraft = async (draft: any) => {
    if (!draft.metaId) return;
    setTogglingId(draft.id);
    try {
      await adAccountApi.bulkPause([draft.metaId]);
      toast.success('Campaign paused on Meta');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to pause');
    } finally {
      setTogglingId(null);
    }
  };

  const handleBulkPublish = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkPublishing(true);
    const results: { id: string; success: boolean; error?: string }[] = [];
    try {
      for (let i = 0; i < ids.length; i++) {
        setPublishProgress({ current: i, total: ids.length });
        try {
          await draftApi.publishDraft(ids[i]);
          results.push({ id: ids[i], success: true });
        } catch (err: any) {
          results.push({ id: ids[i], success: false, error: extractApiError(err, "Publish failed") });
        }
        setPublishProgress({ current: i + 1, total: ids.length });
      }
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success);
      if (succeeded > 0) toast.success(`${succeeded} campaign${succeeded > 1 ? "s" : ""} published`);
      failed.forEach((r) => toast.error(r.error || "Unknown error"));
      setSelectedIds(new Set());
      fetchDrafts();
    } finally {
      setIsBulkPublishing(false);
      setPublishProgress(null);
      setConfirmAction(null);
    }
  };

  const handleExport = async (id: string, name: string) => {
    setExportingId(id);
    try {
      const res = await draftApi.exportCampaign(id);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Draft exported");
    } catch (err: any) {
      toast.error(extractApiError(err, "Failed to export draft"));
    } finally {
      setExportingId(null);
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsImporting(true);
      try {
        const text = await file.text();
        const exported = JSON.parse(text);
        if (!exported?.campaign) {
          toast.error("Invalid file: missing campaign data");
          return;
        }
        await draftApi.importCampaign(exported);
        toast.success("Draft imported successfully");
        fetchDrafts();
      } catch (err: any) {
        if (err instanceof SyntaxError) {
          toast.error("Invalid JSON file");
        } else {
          toast.error(extractApiError(err, "Failed to import draft"));
        }
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: "bg-gray-800/50 text-gray-400 border-gray-700",
      VALIDATED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      VALIDATION_FAILED: "bg-red-500/15 text-red-400 border-red-500/30",
      PUBLISHING: "bg-blue-500/15 text-blue-400 border-blue-500/30 animate-pulse",
      PUBLISHED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      FAILED: "bg-red-500/15 text-red-400 border-red-500/30",
    };
    const labels: Record<string, string> = {
      DRAFT: "Draft", VALIDATED: "Validated", VALIDATION_FAILED: "Invalid",
      PUBLISHING: "Publishing...", PUBLISHED: "Published", FAILED: "Failed",
    };
    const Icon: Record<string, React.ElementType> = {
      DRAFT: FileText,
      VALIDATED: CheckCircle2,
      VALIDATION_FAILED: AlertTriangle,
      PUBLISHING: Loader2,
      PUBLISHED: CheckCircle2,
      FAILED: AlertTriangle,
    };
    const StatusIcon = Icon[status] ?? FileText;
    return (
      <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border", styles[status] || "bg-gray-800 text-gray-400")}>
        <StatusIcon className={cn("w-2.5 h-2.5", status === "PUBLISHING" && "animate-spin")} />
        {labels[status] || status}
      </span>
    );
  };

  const publishedDrafts = drafts.filter((d) => d.status === "PUBLISHED");

  const filteredDrafts = useMemo(() => {
    let result = statusFilter === "ALL"
      ? drafts.filter((d) => d.status !== "PUBLISHED")
      : statusFilter === "ALL_INCL_PUBLISHED"
        ? drafts
        : drafts.filter((d) => d.status === statusFilter);

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((d) =>
        d.name.toLowerCase().includes(q) ||
        d.objective?.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case 'status': va = a.status; vb = b.status; break;
        case 'objective': va = a.objective || ''; vb = b.objective || ''; break;
        default: va = new Date(a.updatedAt).getTime(); vb = new Date(b.updatedAt).getTime();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [drafts, statusFilter, debouncedSearch, sortKey, sortDir]);

  const publishableDrafts = filteredDrafts.filter((d) => d.status !== "PUBLISHING" && d.status !== "PUBLISHED");
  const allSelected = publishableDrafts.length > 0 && selectedIds.size === publishableDrafts.length;
  const isBusy = isBulkPublishing || isBulkDeleting;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-100">Internal Drafts</h1>
            <p className="text-gray-500 mt-1 text-sm">Manage and publish drafts to Meta.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleImport}
                disabled={isImporting || isBusy}
                className="gap-1.5 border-gray-800 text-gray-400 hover:text-gray-200 text-xs"
              >
                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Import
              </Button>
              {publishableDrafts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  disabled={isBusy}
                  className="border-gray-800 text-xs"
                  title={`Select all publishable drafts (excludes Publishing and Published)`}
                >
                  {allSelected ? "Deselect All" : `Select All (${publishableDrafts.length})`}
                </Button>
              )}
            </div>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-lg bg-gray-800/40 p-0.5 w-fit">
          <button
            onClick={() => setActiveTab('mine')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
              activeTab === 'mine' ? "bg-gray-700/60 text-white" : "text-gray-500 hover:text-gray-300"
            )}
          >
            My Drafts
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
              activeTab === 'shared' ? "bg-gray-700/60 text-white" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Share2 className="w-3 h-3" /> Shared with me
            {sharedDrafts.length > 0 && (
              <span className="ml-0.5 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
                {sharedDrafts.length}
              </span>
            )}
          </button>
        </div>

        {/* Shared with me tab */}
        {activeTab === 'shared' && (
          <div className="space-y-3">
            {loadingShared ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-gray-900/30 border border-gray-800/40 rounded-xl p-4 space-y-3">
                    <div className="h-4 w-2/3 bg-gray-800/70 rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-gray-800/60 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-gray-800/50 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : sharedDrafts.length === 0 ? (
              <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl p-16 text-center">
                <Share2 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No shared drafts</p>
                <p className="text-gray-600 text-sm mt-1">When other profiles share drafts with you, they&apos;ll appear here.</p>
              </div>
            ) : (
              <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm">
                    <tr className="border-b border-gray-800/60">
                      <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                      <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Objective</th>
                      <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Shared by</th>
                      <th className="text-center text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Permission</th>
                      <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Status</th>
                      <th className="text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sharedDrafts.map((share: any) => {
                      const draft = share.draftCampaign;
                      if (!draft) return null;
                      const canEdit = share.permission === 'edit';
                      return (
                        <tr key={share.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/drafts/${draft.id}`}
                              className="text-sm font-medium text-gray-200 hover:text-white transition-colors truncate block max-w-[280px]"
                            >
                              {draft.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[180px]">
                            {OBJECTIVE_LABELS[draft.objective] || draft.objective}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-400">
                            {share.sharedBy?.name || 'Unknown'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                              canEdit
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                : "bg-gray-800/50 text-gray-400 border-gray-700"
                            )}>
                              {canEdit ? <Edit2 className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                              {canEdit ? 'Edit' : 'View'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {getStatusBadge(draft.status)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Link href={`/drafts/${draft.id}`}>
                              <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-gray-400 hover:text-white">
                                {canEdit ? <Edit2 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {canEdit ? 'Edit' : 'View'}
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Bulk action toolbar — appears when items are selected */}
        {activeTab === 'mine' && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <span className="text-xs text-blue-400/70 shrink-0">{selectedIds.size} selected</span>
            <div className="flex-1 min-w-[8px]" />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              onClick={() => setShowBulkEdit(true)}
              disabled={isBusy}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit ({selectedIds.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              onClick={openBulkShare}
              disabled={isBusy}
            >
              <Share2 className="w-3.5 h-3.5" />
              Share ({selectedIds.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => setConfirmAction('bulkDelete')}
              disabled={isBusy}
            >
              {isBulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              {isBulkDeleting ? "Deleting..." : `Delete (${selectedIds.size})`}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
              onClick={() => setConfirmAction('publish')}
              disabled={isBusy}
            >
              {isBulkPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {isBulkPublishing && publishProgress
                ? `Publishing ${publishProgress.current}/${publishProgress.total}…`
                : `Publish (${selectedIds.size})`}
            </Button>
          </div>
        )}

        {/* Search & Filters */}
        {activeTab === 'mine' && !isLoading && drafts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  placeholder="Search drafts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-950/50 border border-gray-800/60 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500/50 placeholder:text-gray-700"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center rounded-lg border border-gray-800 overflow-hidden shrink-0">
                <button
                  onClick={() => setViewMode('card')}
                  className={cn(
                    "h-9 w-9 flex items-center justify-center",
                    viewMode === 'card' ? "bg-blue-500/15 text-blue-400" : "text-gray-600 hover:text-gray-300 hover:bg-gray-800/50"
                  )}
                  title="Card view"
                  aria-label="Card view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    "h-9 w-9 flex items-center justify-center border-l border-gray-800",
                    viewMode === 'table' ? "bg-blue-500/15 text-blue-400" : "text-gray-600 hover:text-gray-300 hover:bg-gray-800/50"
                  )}
                  title="Table view"
                  aria-label="Table view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => { if (v) setStatusFilter(v); }}>
                <SelectTrigger className="h-8 w-40 bg-gray-950/50 border-gray-800/60 text-xs focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800">
                  <SelectItem value="ALL" className="text-xs text-gray-300">All excl. published</SelectItem>
                  <SelectItem value="ALL_INCL_PUBLISHED" className="text-xs text-gray-300">All statuses</SelectItem>
                  <SelectItem value="DRAFT" className="text-xs text-gray-300">Draft</SelectItem>
                  <SelectItem value="VALIDATED" className="text-xs text-emerald-400">Validated</SelectItem>
                  <SelectItem value="VALIDATION_FAILED" className="text-xs text-red-400">Invalid</SelectItem>
                  <SelectItem value="PUBLISHING" className="text-xs text-blue-400">Publishing</SelectItem>
                  <SelectItem value="PUBLISHED" className="text-xs text-emerald-500">Published</SelectItem>
                  <SelectItem value="FAILED" className="text-xs text-red-400">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={`${sortKey}:${sortDir}`}
                onValueChange={(v) => {
                  if (!v) return;
                  const [k, d] = v.split(':');
                  setSortKey(k as any);
                  setSortDir(d as any);
                }}
              >
                <SelectTrigger className="h-8 w-36 bg-gray-950/50 border-gray-800/60 text-xs focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800">
                  <SelectItem value="date:desc" className="text-xs text-gray-300">Newest first</SelectItem>
                  <SelectItem value="date:asc" className="text-xs text-gray-300">Oldest first</SelectItem>
                  <SelectItem value="name:asc" className="text-xs text-gray-300">Name A-Z</SelectItem>
                  <SelectItem value="name:desc" className="text-xs text-gray-300">Name Z-A</SelectItem>
                  <SelectItem value="status:asc" className="text-xs text-gray-300">Status</SelectItem>
                  <SelectItem value="objective:asc" className="text-xs text-gray-300">Objective</SelectItem>
                </SelectContent>
              </Select>
              {(statusFilter !== "ALL" || debouncedSearch) && (
                <button
                  onClick={() => { setStatusFilter("ALL"); setSearchQuery(""); }}
                  className="text-[11px] text-gray-600 hover:text-gray-400 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
              <span className="text-[11px] text-gray-600 ml-auto">{filteredDrafts.length} draft{filteredDrafts.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}

        {activeTab === 'mine' && (isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-900/30 border border-gray-800/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-2/3 bg-gray-800/70 rounded animate-pulse" />
                  <div className="h-4 w-12 bg-gray-800/70 rounded animate-pulse" />
                </div>
                <div className="h-3 w-1/3 bg-gray-800/60 rounded animate-pulse" />
                <div className="pt-2 flex gap-2">
                  <div className="h-7 w-20 bg-gray-800/60 rounded animate-pulse" />
                  <div className="h-7 w-7 bg-gray-800/60 rounded animate-pulse" />
                  <div className="h-7 w-7 bg-gray-800/60 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl p-16 text-center">
            {debouncedSearch ? (
              <>
                <Search className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No matching drafts</p>
                <p className="text-gray-600 text-sm mt-1">No drafts match &ldquo;{debouncedSearch}&rdquo;.</p>
                <Button variant="ghost" size="sm" className="mt-4 text-gray-500" onClick={() => setSearchQuery("")}>Clear search</Button>
              </>
            ) : statusFilter !== "ALL" && statusFilter !== "ALL_INCL_PUBLISHED" ? (
              <>
                <Search className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No drafts with this status</p>
                <Button variant="ghost" size="sm" className="mt-4 text-gray-500" onClick={() => setStatusFilter("ALL")}>Clear filter</Button>
              </>
            ) : publishedDrafts.length > 0 ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">All drafts published</p>
                <p className="text-gray-600 text-sm mt-1">{publishedDrafts.length} campaign{publishedDrafts.length > 1 ? "s" : ""} live on Meta.</p>
                <Button variant="outline" size="sm" className="mt-4 text-emerald-400 border-emerald-500/30" onClick={() => setStatusFilter("PUBLISHED")}>View published</Button>
              </>
            ) : (
              <>
                <FolderOpen className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No drafts yet</p>
                <p className="text-gray-600 text-sm mt-1">Duplicate campaigns from Explorer or use Wide Create to generate a structure.</p>
                <div className="flex items-center justify-center gap-3 mt-4">
                  <a href="/explorer"><Button variant="outline" size="sm" className="text-gray-300 border-gray-700"><FolderTree className="w-3.5 h-3.5 mr-1.5" />Explorer</Button></a>
                  <a href="/wide-create"><Button variant="outline" size="sm" className="text-gray-300 border-gray-700"><Grid3X3 className="w-3.5 h-3.5 mr-1.5" />Wide Create</Button></a>
                </div>
              </>
            )}
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDrafts.map((draft, index) => {
              const isPublishable = draft.status !== "PUBLISHING" && draft.status !== "PUBLISHED";
              const isSelected = selectedIds.has(draft.id);
              return (
                <Card
                  key={draft.id}
                  className={cn(
                    "bg-gray-900/40 border-gray-800/60 hover:border-gray-700 transition-all duration-200 card-glow opacity-0 animate-fade-in-up",
                    isSelected && "border-blue-500/40 ring-1 ring-blue-500/20 bg-blue-500/5",
                    `stagger-${Math.min(index + 1, 6)}`
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        {isPublishable && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(draft.id)}
                            disabled={isBusy}
                            className="mt-1 shrink-0"
                          />
                        )}
                        <div className="space-y-1.5 min-w-0">
                          <CardTitle className="text-sm font-semibold truncate max-w-[200px] text-gray-200">
                            {draft.name}
                          </CardTitle>
                          <div className="flex gap-2 items-center text-[11px] text-gray-500">
                            <span className="truncate">{OBJECTIVE_LABELS[draft.objective] || draft.objective}</span>
                            <span className="text-gray-700">|</span>
                            <span>{draft._count?.adSets} Ad Sets</span>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(draft.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-800/40">
                      <div className="text-[11px] text-gray-600">
                        {new Date(draft.updatedAt).toLocaleDateString()}
                      </div>
                      <div className="flex gap-1 items-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="More actions">
                                <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 w-36">
                            {draft.status === 'PUBLISHED' && draft.metaId && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleActivateDraft(draft)}
                                  disabled={togglingId === draft.id}
                                  className="text-xs text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10 cursor-pointer"
                                >
                                  <Play className="w-3 h-3 mr-2" /> Activate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handlePauseDraft(draft)}
                                  disabled={togglingId === draft.id}
                                  className="text-xs text-amber-400 focus:text-amber-300 focus:bg-amber-500/10 cursor-pointer"
                                >
                                  <Pause className="w-3 h-3 mr-2" /> Pause
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-gray-800" />
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleExport(draft.id, draft.name)}
                              disabled={exportingId === draft.id}
                              className="text-xs text-gray-300 focus:text-gray-100 focus:bg-gray-800 cursor-pointer"
                            >
                              {exportingId === draft.id
                                ? <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                : <Download className="w-3 h-3 mr-2" />}
                              Export
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            <DropdownMenuItem
                              onClick={() => { setDeleteTargetId(draft.id); setConfirmAction('delete'); }}
                              disabled={isBusy}
                              className="text-xs text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Link href={`/drafts/${draft.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-gray-400 hover:text-white">
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm">
                <tr className="border-b border-gray-800/60">
                  <th className="w-10 px-3 py-3">
                    <Checkbox
                      checked={allSelected && publishableDrafts.length > 0}
                      onCheckedChange={toggleSelectAll}
                      disabled={isBusy || publishableDrafts.length === 0}
                    />
                  </th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Name</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Objective</th>
                  <th className="text-center text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Ad Sets</th>
                  <th className="text-center text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Ads</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Status</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Updated</th>
                  <th className="text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrafts.map((draft) => {
                  const isPublishable = draft.status !== "PUBLISHING" && draft.status !== "PUBLISHED";
                  const isSelected = selectedIds.has(draft.id);
                  return (
                    <tr
                      key={draft.id}
                      className={cn(
                        "border-b border-gray-800/30 transition-colors group/row",
                        isSelected ? "bg-blue-500/5 hover:bg-blue-500/8" : "hover:bg-gray-800/20"
                      )}
                    >
                      <td className="px-3 py-2.5">
                        {isPublishable ? (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(draft.id)}
                            disabled={isBusy}
                          />
                        ) : <div className="w-4" />}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={`/drafts/${draft.id}`} className="text-sm font-medium text-gray-200 hover:text-white transition-colors truncate block max-w-[280px]">
                          {draft.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[180px]">
                        {OBJECTIVE_LABELS[draft.objective] || draft.objective}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-500">
                        {draft._count?.adSets}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-500">
                        {draft._count?.ads ?? 0}
                      </td>
                      <td className="px-3 py-2.5">
                        {getStatusBadge(draft.status)}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-gray-600 whitespace-nowrap">
                        {new Date(draft.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1 items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="More actions">
                                  <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 w-36">
                              {draft.status === 'PUBLISHED' && draft.metaId && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleActivateDraft(draft)}
                                    disabled={togglingId === draft.id}
                                    className="text-xs text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10 cursor-pointer"
                                  >
                                    <Play className="w-3 h-3 mr-2" /> Activate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handlePauseDraft(draft)}
                                    disabled={togglingId === draft.id}
                                    className="text-xs text-amber-400 focus:text-amber-300 focus:bg-amber-500/10 cursor-pointer"
                                  >
                                    <Pause className="w-3 h-3 mr-2" /> Pause
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-gray-800" />
                                </>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleExport(draft.id, draft.name)}
                                disabled={exportingId === draft.id}
                                className="text-xs text-gray-300 focus:text-gray-100 focus:bg-gray-800 cursor-pointer"
                              >
                                {exportingId === draft.id
                                  ? <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                  : <Download className="w-3 h-3 mr-2" />}
                                Export
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-gray-800" />
                              <DropdownMenuItem
                                onClick={() => { setDeleteTargetId(draft.id); setConfirmAction('delete'); }}
                                disabled={isBusy}
                                className="text-xs text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Link href={`/drafts/${draft.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-gray-400 hover:text-white">
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <BulkEditPanel
        isOpen={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        selectedDrafts={drafts.filter((d) => selectedIds.has(d.id))}
        entityLevel="campaign"
        onSuccess={() => {
          setSelectedIds(new Set());
          fetchDrafts();
        }}
      />
      <ConfirmDialog
        open={confirmAction === 'delete'}
        onOpenChange={() => { setConfirmAction(null); setDeleteTargetId(null); }}
        title="Delete Draft"
        description="Are you sure you want to delete this draft?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => handleDelete()}
      />
      <ConfirmDialog
        open={confirmAction === 'bulkDelete'}
        onOpenChange={() => setConfirmAction(null)}
        title="Delete Drafts"
        description={`Delete ${selectedIds.size} draft${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleBulkDelete}
        isLoading={isBulkDeleting}
      />
      <ConfirmDialog
        open={confirmAction === 'publish'}
        onOpenChange={() => setConfirmAction(null)}
        title="Publish to Meta"
        description={
          <div className="space-y-2">
            <p>Publish {selectedIds.size} draft{selectedIds.size !== 1 ? "s" : ""} to Meta? All will be created in PAUSED status.</p>
            <ul className="text-xs text-gray-400 space-y-1 max-h-36 overflow-y-auto border border-gray-800 rounded-md p-2 bg-gray-950/40">
              {Array.from(selectedIds).map(id => {
                const d = drafts.find(x => x.id === id);
                return d ? (
                  <li key={id} className="flex items-center gap-2 truncate">
                    <span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />
                    <span className="truncate text-gray-300">{d.name}</span>
                    <span className="text-gray-600 shrink-0">{OBJECTIVE_LABELS[d.objective] || d.objective}</span>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        }
        confirmLabel="Publish"
        variant="warning"
        onConfirm={handleBulkPublish}
        isLoading={isBulkPublishing}
      />
      {showBulkShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowBulkShare(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
              <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-purple-400" /> Share {selectedIds.size} draft{selectedIds.size > 1 ? 's' : ''}
              </h3>
              <button onClick={() => setShowBulkShare(false)} className="text-gray-600 hover:text-gray-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Selected drafts</label>
                <div className="max-h-28 overflow-y-auto space-y-0.5 border border-gray-800/60 rounded-lg p-2 bg-gray-950/30 text-xs text-gray-500">
                  {Array.from(selectedIds).map(id => {
                    const d = drafts.find(x => x.id === id);
                    return d ? <div key={id} className="truncate py-0.5">• {d.name}</div> : null;
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Share with profiles</label>
                {bulkShareProfiles.length === 0 ? (
                  <p className="text-xs text-gray-600 py-3 text-center">No other profiles available.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-800/60 rounded-lg p-2 bg-gray-950/30">
                    {bulkShareProfiles.map((p: any) => (
                      <label key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-gray-800/40 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={bulkShareTargetIds.includes(p.id)}
                          onChange={(e) => {
                            setBulkShareTargetIds(prev =>
                              e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id)
                            );
                          }}
                          className="rounded border-gray-700 bg-gray-900 text-purple-500 focus:ring-purple-500/30 w-3.5 h-3.5"
                        />
                        <div className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-purple-400">{p.name[0].toUpperCase()}</span>
                        </div>
                        <span className="text-xs text-gray-300">{p.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value={bulkSharePermission} onValueChange={(v) => { if (v) setBulkSharePermission(v); }}>
                  <SelectTrigger className="w-28 h-9 bg-gray-950/50 border-gray-800 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-800">
                    <SelectItem value="view" className="text-xs text-gray-300">View</SelectItem>
                    <SelectItem value="edit" className="text-xs text-gray-300">Edit</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-9 flex-1 bg-purple-600 hover:bg-purple-700"
                  onClick={handleBulkShare}
                  disabled={isBulkSharing || bulkShareTargetIds.length === 0}
                >
                  {isBulkSharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                    <span className="flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" />
                      Share with {bulkShareTargetIds.length || '...'} profile{bulkShareTargetIds.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
