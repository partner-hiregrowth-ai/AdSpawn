"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, ExternalLink, Loader2, Trash2, RefreshCw, User } from "lucide-react";
import { useEffect, useState } from "react";
import { duplicationApi } from "@/services/api";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, extractApiError } from "@/lib/utils";

type OperationType = 'PUBLISH' | 'DRAFT_DUPLICATE' | 'CONVERSION' | 'DUPLICATE';

function getOperation(details: any): OperationType {
  const op = details?.operation;
  if (op === 'PUBLISH') return 'PUBLISH';
  if (op === 'DRAFT_DUPLICATE') return 'DRAFT_DUPLICATE';
  if (details?.isConversion) return 'CONVERSION';
  return 'DUPLICATE';
}

const OPERATION_BADGE: Record<OperationType, { label: string; className: string }> = {
  PUBLISH:        { label: 'PUBLISH',    className: 'bg-emerald-500/10 text-emerald-400' },
  DRAFT_DUPLICATE:{ label: 'DRAFT DUP', className: 'bg-amber-500/10 text-amber-400' },
  CONVERSION:     { label: 'CONVERSION', className: 'bg-blue-500/10 text-blue-400' },
  DUPLICATE:      { label: 'DUPLICATE',  className: 'bg-violet-500/10 text-violet-400' },
};

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await duplicationApi.getHistory();
      setHistory(response.data);
    } catch (error: any) {
      toast.error(extractApiError(error, "Couldn't load history. Check your connection and try Refresh."));
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    const prev = history;
    setDeleting(true);
    setHistory(h => h.filter(item => item.id !== id));
    try {
      await duplicationApi.deleteHistory(id);
      toast.success("History item deleted");
      setPendingDeleteId(null);
    } catch (error: any) {
      toast.error(extractApiError(error, "Couldn't delete that history item. It may have been removed already."));
      setHistory(prev);
    } finally {
      setDeleting(false);
    }
  };

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const response = await duplicationApi.cleanupHistory();
      const n = response.data.deletedCount;
      toast.success(n === 0 ? "All history items are still on Facebook — nothing to clean up." : `Removed ${n} item${n === 1 ? "" : "s"} that no longer exist on Facebook.`);
      fetchHistory();
    } catch (error: any) {
      toast.error(extractApiError(error, "Couldn't sync with Facebook. Check your Facebook connection in Settings."));
    } finally {
      setCleaning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-gray-100">History</h2>
            <p className="text-gray-500 mt-1 text-sm">
              Audit log of all actions — duplications, conversions, draft publishes.
              {!loading && history.length > 0 && (
                <span className="ml-2 text-gray-600">
                  Last: {formatDistanceToNow(new Date(history[0].createdAt), { addSuffix: true })}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanup}
              disabled={cleaning || loading || history.length === 0}
              className="gap-1.5 border-gray-800 text-gray-400 hover:text-gray-200"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", cleaning && "animate-spin")} />
              {cleaning ? "Syncing..." : "Sync with Facebook"}
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchHistory} className="text-gray-500">
              Refresh
            </Button>
          </div>
        </div>

        <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl">
          {loading ? (
            <div className="divide-y divide-gray-800/30">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <div className="h-4 w-16 bg-gray-800/60 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-gray-800/60 rounded animate-pulse" />
                  <div className="h-4 w-28 bg-gray-800/60 rounded animate-pulse" />
                  <div className="h-4 w-28 bg-gray-800/60 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-800/60 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-800/60 rounded animate-pulse" />
                  <div className="flex-1" />
                  <div className="h-4 w-20 bg-gray-800/60 rounded animate-pulse" />
                  <div className="h-6 w-6 bg-gray-800/60 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="p-16 text-center">
              <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No history yet</p>
              <p className="text-gray-500 text-sm mt-1">Duplications, conversions, and draft publishes will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm">
                <TableRow className="border-gray-800/40 hover:bg-transparent">
                  <TableHead className="text-gray-500 text-xs font-medium">Profile</TableHead>
                  <TableHead className="text-gray-500 text-xs font-medium">Type</TableHead>
                  <TableHead className="text-gray-500 text-xs font-medium">Source</TableHead>
                  <TableHead className="text-gray-500 text-xs font-medium">Target</TableHead>
                  <TableHead className="text-gray-500 text-xs font-medium">Ad Account</TableHead>
                  <TableHead className="text-gray-500 text-xs font-medium">Status</TableHead>
                  <TableHead className="text-gray-500 text-xs font-medium">When</TableHead>
                  <TableHead className="text-gray-500 text-xs font-medium text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((job, index) => (
                  <TableRow
                    key={job.id}
                    className={cn(
                      "border-gray-800/30 hover:bg-gray-800/20 transition-colors animate-fade-in-up",
                      `stagger-${Math.min(index + 1, 6)}`
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="text-xs text-gray-300 truncate max-w-[100px]">
                          {job.profile?.name || <span className="text-gray-600 italic">—</span>}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-800/50 text-gray-400 w-fit">
                          {job.type}
                        </span>
                        {(() => {
                          const op = getOperation(job.details);
                          const badge = OPERATION_BADGE[op];
                          return (
                            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md w-fit", badge.className)}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">{job.sourceId}</TableCell>
                    <TableCell>
                      {job.targetId ? (
                        <span className="flex items-center gap-1 text-blue-400 text-xs font-mono">
                          {job.targetId}
                          {getOperation(job.details) !== 'DRAFT_DUPLICATE' && (
                            <ExternalLink className="w-2.5 h-2.5" />
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-700">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.details?.adAccountId ? (
                        <span className="text-[11px] text-gray-500 font-mono truncate block max-w-[140px]" title={job.details.adAccountId}>
                          {job.details.adAccountId}
                        </span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.status === "COMPLETED" ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Success
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-red-400 text-xs">
                          <XCircle className="w-3.5 h-3.5" />
                          Failed
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-500" title={format(new Date(job.createdAt), "yyyy-MM-dd HH:mm:ss")}>
                        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => setPendingDeleteId(job.id)}
                        className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10"
                        title="Delete"
                        aria-label="Delete history item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title="Delete history item?"
        description="This removes the local audit entry. The campaign or ad set on Facebook is not affected."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        isLoading={deleting}
      />
    </DashboardLayout>
  );
}
