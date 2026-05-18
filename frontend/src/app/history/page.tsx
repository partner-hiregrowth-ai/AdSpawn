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
import { CheckCircle2, XCircle, Clock, ExternalLink, Loader2, Trash2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { duplicationApi } from "@/services/api";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await duplicationApi.getHistory();
      setHistory(response.data);
    } catch (error) {
      toast.error("Failed to fetch duplication history");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = history;
    setHistory(h => h.filter(item => item.id !== id));
    try {
      await duplicationApi.deleteHistory(id);
      toast.success("History item deleted");
    } catch (error) {
      toast.error("Failed to delete history item");
      setHistory(prev);
    }
  };

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const response = await duplicationApi.cleanupHistory();
      toast.success(`Removed ${response.data.deletedCount} items no longer on Facebook.`);
      fetchHistory();
    } catch (error) {
      toast.error("Failed to cleanup history");
    } finally {
      setCleaning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">History</h2>
            <p className="text-gray-500 mt-1 text-sm">Audit log of all duplication actions.</p>
          </div>
          <div className="flex gap-2">
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

        <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center text-gray-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <p className="text-sm">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-16 text-center">
              <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No history yet</p>
              <p className="text-gray-600 text-sm mt-1">Duplication actions will appear here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800/40 hover:bg-transparent">
                  <TableHead className="text-gray-500 text-xs font-medium">Type</TableHead>
                  <TableHead className="text-gray-500 text-xs font-medium">Source</TableHead>
                  <TableHead className="text-gray-500 text-xs font-medium">Target</TableHead>
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
                      "border-gray-800/30 hover:bg-gray-800/20 transition-colors opacity-0 animate-fade-in-up",
                      `stagger-${Math.min(index + 1, 6)}`
                    )}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-800/50 text-gray-400 w-fit">
                          {job.type}
                        </span>
                        {job.details?.isConversion ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 w-fit">
                            CONVERSION
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 w-fit">
                            DUPLICATE
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">{job.sourceId}</TableCell>
                    <TableCell>
                      {job.targetId ? (
                        <span className="flex items-center gap-1 text-blue-400 text-xs font-mono">
                          {job.targetId}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      ) : (
                        <span className="text-gray-700">--</span>
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
                        onClick={() => handleDelete(job.id)}
                        className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
