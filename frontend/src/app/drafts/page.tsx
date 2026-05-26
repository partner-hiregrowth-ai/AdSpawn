"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { draftApi, adAccountApi } from "@/services/api";
import { Edit2, Trash2, Send, Layers, Loader2, X, Pencil, Play, Pause, Search, Download, Upload } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { toast } from "sonner";
import { cn, extractApiError } from "@/lib/utils";
import { BulkEditPanel } from "@/components/dashboard/BulkEditPanel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{ current: number; total: number } | null>(null);
  const [showPublished, setShowPublished] = useState(false);
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
    fetchDrafts();
  }, []);

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
    setPublishProgress({ current: 0, total: ids.length });
    try {
      const response = await draftApi.bulkPublishDrafts(ids);
      const results: { id: string; success: boolean; error?: string }[] = response.data.results;

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success);

      if (succeeded > 0) toast.success(`${succeeded} campaign${succeeded > 1 ? "s" : ""} published`);
      failed.forEach((r: any) => toast.error(r.userMessage || r.error || "Unknown error"));

      setSelectedIds(new Set());
      fetchDrafts();
    } catch (error: any) {
      toast.error(extractApiError(error, "Bulk publish failed"));
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
      READY: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      VALIDATION_FAILED: "bg-red-500/15 text-red-400 border-red-500/30",
      PUBLISHING: "bg-blue-500/15 text-blue-400 border-blue-500/30 animate-pulse",
      PUBLISHED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      FAILED: "bg-red-500/15 text-red-400 border-red-500/30",
    };
    const labels: Record<string, string> = {
      DRAFT: "Draft", READY: "Ready", VALIDATION_FAILED: "Invalid",
      PUBLISHING: "Publishing...", PUBLISHED: "Published", FAILED: "Failed",
    };
    return (
      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", styles[status] || "bg-gray-800 text-gray-400")}>
        {labels[status] || status}
      </span>
    );
  };

  const publishedDrafts = drafts.filter((d) => d.status === "PUBLISHED");

  const filteredDrafts = useMemo(() => {
    let result = showPublished ? drafts : drafts.filter((d) => d.status !== "PUBLISHED");

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
  }, [drafts, showPublished, debouncedSearch, sortKey, sortDir]);

  const publishableDrafts = filteredDrafts.filter((d) => d.status !== "PUBLISHING" && d.status !== "PUBLISHED");
  const allSelected = publishableDrafts.length > 0 && selectedIds.size === publishableDrafts.length;
  const isBusy = isBulkPublishing || isBulkDeleting;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-100">Internal Drafts</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Manage and publish drafts to Meta.
              {publishedDrafts.length > 0 && (
                <button
                  onClick={() => setShowPublished((v) => !v)}
                  className="ml-2 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  {showPublished ? "Hide published" : `Show ${publishedDrafts.length} published`}
                </button>
              )}
            </p>
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
              <Button variant="outline" size="sm" onClick={toggleSelectAll} disabled={isBusy} className="border-gray-800 text-xs">
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            )}
            {selectedIds.size > 0 && (
              <>
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
                  {isBulkPublishing
                    ? publishProgress
                      ? `${publishProgress.current}/${publishProgress.total}...`
                      : "Publishing..."
                    : `Publish (${selectedIds.size})`}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search & Sort */}
        {!isLoading && drafts.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type="text"
                placeholder="Search by name or objective..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-950/50 border border-gray-800/60 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-gray-700"
              />
            </div>
            {searchQuery && (
              <Button variant="ghost" size="sm" className="text-gray-500 text-xs h-8" onClick={() => setSearchQuery("")}>Clear</Button>
            )}
            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(v) => {
                if (!v) return;
                const [k, d] = v.split(':');
                setSortKey(k as any);
                setSortDir(d as any);
              }}
            >
              <SelectTrigger className="h-9 w-40 shrink-0 bg-blue-500/10 border-blue-500/20 text-blue-400 text-xs focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="date:desc" className="text-xs text-gray-300">Newest first</SelectItem>
                <SelectItem value="date:asc" className="text-xs text-gray-300">Oldest first</SelectItem>
                <SelectItem value="name:asc" className="text-xs text-gray-300">Name A→Z</SelectItem>
                <SelectItem value="name:desc" className="text-xs text-gray-300">Name Z→A</SelectItem>
                <SelectItem value="status:asc" className="text-xs text-gray-300">Status</SelectItem>
                <SelectItem value="objective:asc" className="text-xs text-gray-300">Objective</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading ? (
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
            <Layers className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">
              {debouncedSearch ? "No matching drafts" : publishedDrafts.length > 0 ? "All drafts published" : "No drafts yet"}
            </p>
            <p className="text-gray-600 text-sm mt-1">
              {debouncedSearch
                ? `No drafts match "${debouncedSearch}".`
                : publishedDrafts.length > 0
                ? `${publishedDrafts.length} campaign${publishedDrafts.length > 1 ? "s" : ""} published to Meta.`
                : 'Duplicated campaigns will appear here when you choose "Save as Draft".'}
            </p>
          </div>
        ) : (
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
                            <span className="truncate">{draft.objective}</span>
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
                        {draft.status === 'PUBLISHED' && draft.metaId && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => handleActivateDraft(draft)}
                              disabled={togglingId === draft.id}
                              title="Activate on Meta">
                              {togglingId === draft.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                                : <Play className="w-3.5 h-3.5 text-emerald-600 hover:text-emerald-400" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => handlePauseDraft(draft)}
                              disabled={togglingId === draft.id}
                              title="Pause on Meta">
                              <Pause className="w-3.5 h-3.5 text-amber-600 hover:text-amber-400" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleExport(draft.id, draft.name)}
                          disabled={exportingId === draft.id}
                          title="Export draft"
                        >
                          {exportingId === draft.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                            : <Download className="w-3.5 h-3.5 text-gray-600 hover:text-blue-400" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteTargetId(draft.id); setConfirmAction('delete'); }} disabled={isBusy}>
                          <Trash2 className="w-3.5 h-3.5 text-gray-600 hover:text-red-400" />
                        </Button>
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
        )}
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
        description={`Publish ${selectedIds.size} draft${selectedIds.size !== 1 ? "s" : ""} to Meta? All will be created in PAUSED status.`}
        confirmLabel="Publish"
        variant="warning"
        onConfirm={handleBulkPublish}
        isLoading={isBulkPublishing}
      />
    </DashboardLayout>
  );
}
