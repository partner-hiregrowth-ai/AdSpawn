"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { OBJECTIVE_LABELS } from "@/lib/meta-schema";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  X,
  RefreshCw,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

type CampaignStatus = "pending" | "publishing" | "success" | "failed";

interface CampaignEntry {
  id: string;
  name: string;
  objective: string;
  status: CampaignStatus;
  error?: string;
  metaCampaignId?: string;
}

interface BulkPublishModalProps {
  open: boolean;
  campaignIds: string[];
  drafts: Array<{ id: string; name: string; objective: string }>;
  onClose: () => void;
  onComplete: (succeeded: number, failed: number) => void;
}

export function BulkPublishModal({
  open,
  campaignIds,
  drafts,
  onClose,
  onComplete,
}: BulkPublishModalProps) {
  const [entries, setEntries] = useState<CampaignEntry[]>([]);
  const [phase, setPhase] = useState<"confirm" | "running" | "done">("confirm");
  const [authError, setAuthError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    hasCompletedRef.current = false;
    setPhase("confirm");
    setAuthError(null);
    setEntries(
      campaignIds.map((id) => {
        const d = drafts.find((x) => x.id === id);
        return {
          id,
          name: d?.name ?? id,
          objective: d?.objective ?? "",
          status: "pending",
        };
      })
    );
  }, [open, campaignIds, drafts]);

  const runPublish = useCallback(
    async (ids: string[]) => {
      setPhase("running");
      setAuthError(null);

      setEntries((prev) =>
        prev.map((e) =>
          ids.includes(e.id) ? { ...e, status: "pending", error: undefined } : e
        )
      );

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const token = localStorage.getItem("token");
      const profileId = localStorage.getItem("profileId");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (profileId) headers["X-Profile-Id"] = profileId;

      try {
        const res = await fetch(
          `${API_BASE_URL}/drafts/campaigns/bulk-publish-stream`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ campaignIds: ids }),
            signal: ctrl.signal,
          }
        );

        if (!res.ok || !res.body) {
          const text = await res.text();
          let msg = "Publish failed";
          try { msg = JSON.parse(text).error || msg; } catch {}
          setEntries((prev) =>
            prev.map((e) =>
              ids.includes(e.id) && e.status === "pending"
                ? { ...e, status: "failed", error: msg }
                : e
            )
          );
          setPhase("done");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              switch (event.type) {
                case "progress":
                  setEntries((prev) =>
                    prev.map((e) =>
                      e.id === event.id ? { ...e, status: "publishing" } : e
                    )
                  );
                  break;
                case "result":
                  setEntries((prev) =>
                    prev.map((e) =>
                      e.id === event.id
                        ? {
                            ...e,
                            status: event.status === "success" ? "success" : "failed",
                            error: event.error,
                            metaCampaignId: event.metaCampaignId,
                          }
                        : e
                    )
                  );
                  break;
                case "auth_error":
                  setAuthError(event.error);
                  setEntries((prev) =>
                    prev.map((e) =>
                      e.status === "pending" || e.status === "publishing"
                        ? { ...e, status: "failed", error: "Token expired" }
                        : e
                    )
                  );
                  break;
                case "done":
                  break;
              }
            } catch {}
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setEntries((prev) =>
          prev.map((e) =>
            ids.includes(e.id) && (e.status === "pending" || e.status === "publishing")
              ? { ...e, status: "failed", error: "Network error" }
              : e
          )
        );
      } finally {
        abortRef.current = null;
        setPhase("done");
      }
    },
    []
  );

  const succeeded = entries.filter((e) => e.status === "success").length;
  const failed = entries.filter((e) => e.status === "failed").length;
  const failedIds = entries.filter((e) => e.status === "failed").map((e) => e.id);
  const isRunning = phase === "running";
  const isDone = phase === "done";

  useEffect(() => {
    if (isDone && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete(succeeded, failed);
    }
  }, [isDone, succeeded, failed, onComplete]);

  const handleRetry = () => {
    if (failedIds.length === 0) return;
    runPublish(failedIds);
  };

  const handleClose = () => {
    if (isRunning) {
      abortRef.current?.abort();
    }
    onClose();
  };

  if (!open) return null;

  const statusIcon = (status: CampaignStatus) => {
    switch (status) {
      case "pending":
        return <Clock className="w-3.5 h-3.5 text-gray-600" />;
      case "publishing":
        return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
      case "success":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case "failed":
        return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    }
  };

  const progressPct =
    entries.length > 0
      ? Math.round(
          ((succeeded + failed) / entries.length) * 100
        )
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={isDone || phase === "confirm" ? handleClose : undefined}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
          <div className="flex items-center gap-2.5">
            <Send className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-gray-100">
              {phase === "confirm"
                ? "Publish to Meta"
                : isDone
                  ? "Publish Complete"
                  : "Publishing..."}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {isRunning && (
              <span className="text-[11px] text-gray-500 font-mono tabular-nums">
                {succeeded + failed}/{entries.length}
              </span>
            )}
            {!isRunning && (
              <button
                onClick={handleClose}
                className="text-gray-600 hover:text-gray-300 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {isRunning && (
          <div className="h-0.5 bg-gray-800">
            <div
              className="h-full bg-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {/* Confirm phase */}
        {phase === "confirm" && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-400">
              Publish {entries.length} draft{entries.length !== 1 ? "s" : ""} to
              Meta? All campaigns will be created in <strong className="text-gray-300">PAUSED</strong> status.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-800/60 rounded-lg p-2 bg-gray-950/30">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center gap-2 py-1 px-1 text-xs">
                  <span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />
                  <span className="text-gray-300 truncate flex-1">{e.name}</span>
                  <span className="text-gray-600 shrink-0">
                    {OBJECTIVE_LABELS[e.objective] || e.objective}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                onClick={() => runPublish(campaignIds)}
              >
                <Send className="w-3.5 h-3.5" />
                Publish {entries.length}
              </Button>
            </div>
          </div>
        )}

        {/* Running / Done — campaign list */}
        {(isRunning || isDone) && (
          <div className="p-2">
            <div className="max-h-72 overflow-y-auto space-y-0.5">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2 rounded-lg transition-colors",
                    e.status === "publishing" && "bg-blue-500/5",
                    e.status === "success" && "bg-emerald-500/5",
                    e.status === "failed" && "bg-red-500/5"
                  )}
                >
                  <div className="mt-0.5 shrink-0">{statusIcon(e.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-medium truncate",
                          e.status === "success"
                            ? "text-emerald-300"
                            : e.status === "failed"
                              ? "text-red-300"
                              : e.status === "publishing"
                                ? "text-blue-300"
                                : "text-gray-400"
                        )}
                      >
                        {e.name}
                      </span>
                      <span className="text-[10px] text-gray-600 shrink-0">
                        {OBJECTIVE_LABELS[e.objective] || e.objective}
                      </span>
                    </div>
                    {e.status === "failed" && e.error && (
                      <p className="text-[11px] text-red-400/70 mt-0.5 line-clamp-2">
                        {e.error}
                      </p>
                    )}
                    {e.status === "publishing" && (
                      <p className="text-[11px] text-blue-400/50 mt-0.5">
                        Creating on Meta...
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auth error banner */}
        {authError && (
          <div className="mx-5 mb-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-300">
              Facebook token expired. Remaining drafts were skipped. Please reconnect and retry.
            </p>
          </div>
        )}

        {/* Done footer */}
        {isDone && (
          <div className="px-5 py-3 border-t border-gray-800/60 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              {succeeded > 0 && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {succeeded} published
                </span>
              )}
              {failed > 0 && (
                <span className="text-red-400 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {failed} failed
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {failedIds.length > 0 && !authError && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                  onClick={handleRetry}
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry {failedIds.length}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleClose} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
