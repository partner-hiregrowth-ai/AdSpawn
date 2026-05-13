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
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { duplicationApi } from "@/services/api";
import { toast } from "sonner";
import { format } from "date-fns";

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Duplication History</h2>
            <p className="text-gray-400 mt-1">Audit log of all duplication actions performed.</p>
          </div>
          <button 
            onClick={fetchHistory}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center text-gray-500 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p>Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-20 text-center text-gray-500">
              No duplication history found.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-gray-950/50">
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-300">Type</TableHead>
                  <TableHead className="text-gray-300">Source ID</TableHead>
                  <TableHead className="text-gray-300">Target ID</TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-300 text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((job) => (
                  <TableRow key={job.id} className="border-gray-800 hover:bg-gray-800/30 transition-colors">
                    <TableCell>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                        {job.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-400">{job.sourceId}</TableCell>
                    <TableCell>
                      {job.targetId ? (
                        <div className="flex items-center gap-1 text-blue-400 text-xs">
                          {job.targetId}
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.status === "COMPLETED" ? (
                        <div className="flex items-center gap-1.5 text-green-400 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Success
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-red-400 text-sm">
                          <XCircle className="w-4 h-4" />
                          Failed
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-500">
                      <div className="flex items-center justify-end gap-1.5">
                        <Clock className="w-3 h-3" />
                        {format(new Date(job.createdAt), "yyyy-MM-dd HH:mm")}
                      </div>
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
