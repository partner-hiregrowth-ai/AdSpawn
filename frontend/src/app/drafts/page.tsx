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
    try {
      await draftApi.deleteCampaign(id);
      toast.success("Draft deleted");
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      fetchDrafts();
    } catch (error) {
      toast.error("Failed to delete draft");
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

      if (succeeded > 0) toast.success(`${succeeded} campaign${succeeded > 1 ? "s" : ""} published successfully`);
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
    switch (status) {
      case "DRAFT":
        return <Badge variant="outline">Draft</Badge>;
      case "READY":
        return <Badge className="bg-green-600">Ready</Badge>;
      case "VALIDATION_FAILED":
        return <Badge variant="destructive">Invalid</Badge>;
      case "PUBLISHING":
        return <Badge className="bg-blue-600 animate-pulse">Publishing...</Badge>;
      case "PUBLISHED":
        return <Badge className="bg-green-700">Published</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const publishedDrafts = drafts.filter((d) => d.status === "PUBLISHED");
  const visibleDrafts = showPublished ? drafts : drafts.filter((d) => d.status !== "PUBLISHED");
  const publishableDrafts = visibleDrafts.filter((d) => d.status !== "PUBLISHING" && d.status !== "PUBLISHED");
  const allSelected = publishableDrafts.length > 0 && selectedIds.size === publishableDrafts.length;
  const isBusy = isBulkPublishing || isBulkDeleting;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Internal Drafts</h1>
            <p className="text-gray-400 mt-1">
              Manage and publish drafts to Meta.
              {publishedDrafts.length > 0 && (
                <button
                  onClick={() => setShowPublished((v) => !v)}
                  className="ml-3 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  {showPublished ? "Hide published" : `Show ${publishedDrafts.length} published`}
                </button>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {publishableDrafts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                disabled={isBusy}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            )}
            {selectedIds.size > 0 && (
              <>
                <Button
                  variant="outline"
                  className="gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={handleBulkDelete}
                  disabled={isBusy}
                >
                  {isBulkDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  {isBulkDeleting ? "Deleting..." : `Delete (${selectedIds.size})`}
                </Button>
                <Button
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                  onClick={handleBulkPublish}
                  disabled={isBusy}
                >
                  {isBulkPublishing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isBulkPublishing
                    ? publishProgress
                      ? `Publishing ${publishProgress.current}/${publishProgress.total}...`
                      : "Publishing..."
                    : `Publish Selected (${selectedIds.size})`}
                </Button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-gray-900 border-gray-800 animate-pulse h-48" />
            ))}
          </div>
        ) : visibleDrafts.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800 p-12 text-center">
            <Layers className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium">
              {publishedDrafts.length > 0 ? "All drafts published" : "No drafts found"}
            </h3>
            <p className="text-gray-400 mt-2">
              {publishedDrafts.length > 0
                ? `${publishedDrafts.length} campaign${publishedDrafts.length > 1 ? "s are" : " is"} published to Meta.`
                : 'Duplicated campaigns will appear here when you choose "Save as Draft".'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleDrafts.map((draft) => {
              const isPublishable = draft.status !== "PUBLISHING" && draft.status !== "PUBLISHED";
              const isSelected = selectedIds.has(draft.id);
              return (
                <Card
                  key={draft.id}
                  className={`bg-gray-900 border-gray-800 hover:border-blue-500/50 transition-colors ${isSelected ? "border-blue-500 ring-1 ring-blue-500/50" : ""}`}
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
                        <div className="space-y-1 min-w-0">
                          <CardTitle className="text-lg truncate max-w-[180px]">{draft.name}</CardTitle>
                          <div className="flex gap-2 items-center text-xs text-gray-400">
                            <span className="truncate">{draft.objective}</span>
                            <span>•</span>
                            <span>{draft._count?.adSets} Ad Sets</span>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(draft.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center mt-4">
                      <div className="text-xs text-gray-500">
                        Updated {new Date(draft.updatedAt).toLocaleDateString()}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(draft.id)} disabled={isBusy}>
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </Button>
                        <Link href={`/drafts/${draft.id}`}>
                          <Button size="sm" className="gap-2">
                            <Edit2 className="w-4 h-4" />
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
