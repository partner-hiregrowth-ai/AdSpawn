"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { draftApi } from "@/services/api";
import { Edit2, Trash2, Send, Layers, Loader2, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{ current: number; total: number } | null>(null);
  const [showPublished, setShowPublished] = useState(false);

  const fetchDrafts = async () => {
    try {
      setIsLoading(true);
      const response = await draftApi.listCampaigns();
      setDrafts(response.data);
    } catch (error) {
      console.error("Failed to fetch drafts:", error);
      toast.error("Failed to load drafts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft?")) return;
    const prev = drafts;
    setDrafts(d => d.filter(x => x.id !== id));
    setSelectedIds(s => { const next = new Set(s); next.delete(id); return next; });
    try {
      await draftApi.deleteCampaign(id);
      toast.success("Draft deleted");
    } catch (error) {
      toast.error("Failed to delete draft");
      setDrafts(prev);
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
    if (!confirm(`Delete ${ids.length} draft${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;

    setIsBulkDeleting(true);
    try {
      const response = await draftApi.bulkDeleteDrafts(ids);
      toast.success(`${response.data.deleted} draft${response.data.deleted !== 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      fetchDrafts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Bulk delete failed");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkPublish = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Publish ${ids.length} draft${ids.length > 1 ? "s" : ""} to Meta? All will be created in PAUSED status.`)) return;

    setIsBulkPublishing(true);
    setPublishProgress({ current: 0, total: ids.length });
    try {
      const response = await draftApi.bulkPublishDrafts(ids);
      const results: { id: string; success: boolean; error?: string }[] = response.data.results;

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success);

      if (succeeded > 0) toast.success(`${succeeded} campaign${succeeded > 1 ? "s" : ""} published`);
      failed.forEach((r) => toast.error(`Failed: ${r.error || "Unknown error"}`));

      setSelectedIds(new Set());
      fetchDrafts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Bulk publish failed");
    } finally {
      setIsBulkPublishing(false);
      setPublishProgress(null);
    }
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
  const visibleDrafts = showPublished ? drafts : drafts.filter((d) => d.status !== "PUBLISHED");
  const publishableDrafts = visibleDrafts.filter((d) => d.status !== "PUBLISHING" && d.status !== "PUBLISHED");
  const allSelected = publishableDrafts.length > 0 && selectedIds.size === publishableDrafts.length;
  const isBusy = isBulkPublishing || isBulkDeleting;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex justify-between items-center">
          <div>
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
          <div className="flex items-center gap-2">
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
                  className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={handleBulkDelete}
                  disabled={isBusy}
                >
                  {isBulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  {isBulkDeleting ? "Deleting..." : `Delete (${selectedIds.size})`}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                  onClick={handleBulkPublish}
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

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-900/30 border border-gray-800/40 rounded-xl animate-pulse h-44" />
            ))}
          </div>
        ) : visibleDrafts.length === 0 ? (
          <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl p-16 text-center">
            <Layers className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">
              {publishedDrafts.length > 0 ? "All drafts published" : "No drafts yet"}
            </p>
            <p className="text-gray-600 text-sm mt-1">
              {publishedDrafts.length > 0
                ? `${publishedDrafts.length} campaign${publishedDrafts.length > 1 ? "s" : ""} published to Meta.`
                : 'Duplicated campaigns will appear here when you choose "Save as Draft".'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleDrafts.map((draft, index) => {
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
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(draft.id)} disabled={isBusy}>
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
    </DashboardLayout>
  );
}
