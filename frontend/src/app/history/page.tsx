"use client";

import { useState } from "react";
import useSWR from "swr";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { activityApi, duplicationApi } from "@/services/api";
import { ActivityFeed, ActivityItem, HistoryJobDetails } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { cn, extractApiError } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import {
  Clock,
  Copy,
  Send,
  Sparkles,
  Grid3X3,
  ArrowRightLeft,
  Layers,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Trash2,
  Users,
  User,
  ExternalLink,
} from "lucide-react";

type Scope = "mine" | "team";
type FilterKey = "all" | "duplicate" | "publish" | "conversion" | "draft" | "ai_create" | "wide_create";

const FILTERS: { key: FilterKey; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All", icon: Clock },
  { key: "duplicate", label: "Duplications", icon: Copy },
  { key: "publish", label: "Publishes", icon: Send },
  { key: "conversion", label: "Conversions", icon: ArrowRightLeft },
  { key: "draft", label: "Drafts", icon: Layers },
  { key: "ai_create", label: "AI Create", icon: Sparkles },
  { key: "wide_create", label: "Wide Create", icon: Grid3X3 },
];

type OperationType = "PUBLISH" | "DRAFT" | "CONVERSION" | "DUPLICATE" | "AI_CREATE" | "WIDE_CREATE";

function getOperation(details: HistoryJobDetails | null | undefined): OperationType {
  const op = details?.operation;
  if (op === "PUBLISH") return "PUBLISH";
  if (op === "DRAFT_DUPLICATE") return "DRAFT";
  if (op === "AI_CREATE") return "AI_CREATE";
  if (op === "WIDE_CREATE") return "WIDE_CREATE";
  if (details?.isConversion && details?.savedAsDraft) return "DRAFT";
  if (details?.isConversion) return "CONVERSION";
  return "DUPLICATE";
}

function getDraftSource(details: HistoryJobDetails | null | undefined): string | null {
  if (details?.isConversion && details?.savedAsDraft) return "Conversion";
  if (details?.operation === "DRAFT_DUPLICATE") return "Duplicate";
  return null;
}

const OP_CONFIG: Record<OperationType, { label: string; verb: string; color: string; bg: string }> = {
  DUPLICATE:  { label: "Duplicate",    verb: "Duplicated",              color: "text-violet-400",  bg: "bg-violet-500/15" },
  PUBLISH:    { label: "Publish",      verb: "Published",               color: "text-emerald-400", bg: "bg-emerald-500/15" },
  CONVERSION: { label: "Conversion",   verb: "Converted objective for", color: "text-blue-400",    bg: "bg-blue-500/15" },
  DRAFT:      { label: "Draft",        verb: "Saved to drafts",         color: "text-amber-400",   bg: "bg-amber-500/15" },
  AI_CREATE:  { label: "AI Create",    verb: "Created via AI",          color: "text-pink-400",    bg: "bg-pink-500/15" },
  WIDE_CREATE:{ label: "Wide Create",  verb: "Created via Wide Create", color: "text-cyan-400",    bg: "bg-cyan-500/15" },
};

function getDisplayName(item: ActivityItem): string {
  return item.profile?.name || item.user.name || item.user.email || "Unknown";
}

function getInitials(item: ActivityItem): string {
  const name = item.profile?.name || item.user.name || item.user.email || "?";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function describeDetail(item: ActivityItem, op: OperationType): string {
  if (op === "AI_CREATE" && item.details?.totalCreated) {
    const tc = item.details.totalCreated;
    if (typeof tc === "object") {
      if ((tc as any).campaigns) return `${(tc as any).campaigns} campaign${(tc as any).campaigns === 1 ? "" : "s"}`;
    } else {
      return `${tc} item${tc === 1 ? "" : "s"}`;
    }
  } else if (op === "WIDE_CREATE" && item.details?.templateName) {
    return `"${item.details.templateName}"`;
  } else if (item.sourceId) {
    return item.type === "CAMPAIGN" ? "a campaign" : item.type === "ADSET" ? "an ad set" : item.type === "AD" ? "an ad" : item.type.toLowerCase();
  }
  return "";
}

export default function HistoryPage() {
  const { profile, selectedAccount } = useAppStore();
  const [scope, setScope] = useState<Scope>("mine");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading, mutate } = useSWR<ActivityFeed>(
    ["history", scope, filter, page, profile?.id, selectedAccount?.id],
    () =>
      activityApi
        .getTeamActivity({
          scope,
          filter: filter === "all" ? undefined : filter,
          page,
          pageSize: 30,
        })
        .then((r) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const items = data?.items || [];
  const isTeam = scope === "team";

  const handleFilterChange = (key: FilterKey) => {
    setFilter(key);
    setPage(1);
  };

  const handleScopeChange = (s: Scope) => {
    setScope(s);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setDeleting(true);
    const prev = data;
    mutate(
      data
        ? { ...data, items: data.items.filter((i) => i.id !== id), total: data.total - 1 }
        : undefined,
      false
    );
    try {
      await duplicationApi.deleteHistory(id);
      toast.success("Item deleted");
      setPendingDeleteId(null);
      mutate();
    } catch (error: unknown) {
      toast.error(extractApiError(error, "Couldn't delete that item."));
      mutate(prev, false);
    } finally {
      setDeleting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await duplicationApi.cleanupHistory();
      const n = response.data.deletedCount;
      toast.success(
        n === 0
          ? "All items are still on Facebook — nothing to clean up."
          : `Removed ${n} item${n === 1 ? "" : "s"} that no longer exist on Facebook.`
      );
      mutate();
    } catch (error: unknown) {
      toast.error(extractApiError(error, "Couldn't sync with Facebook."));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-gray-100">History</h2>
            <p className="text-gray-500 mt-1 text-sm">
              {isTeam
                ? "All actions across your team."
                : "Your duplications, conversions, publishes, and creations."}
              {!isLoading && items.length > 0 && (
                <span className="ml-2 text-gray-600">
                  Last: {formatDistanceToNow(new Date(items[0].createdAt), { addSuffix: true })}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing || isLoading || items.length === 0}
              className="gap-1.5 border-gray-800 text-gray-400 hover:text-gray-200"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
              {syncing ? "Syncing..." : "Sync with Facebook"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mutate()}
              disabled={isLoading}
              className="text-gray-500"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Scope toggle + filter tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-gray-800/60 overflow-hidden">
            <button
              onClick={() => handleScopeChange("mine")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-200",
                scope === "mine"
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/60"
              )}
            >
              <User className="w-3 h-3" />
              Mine
            </button>
            <button
              onClick={() => handleScopeChange("team")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-200 border-l border-gray-800/60",
                scope === "team"
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/60"
              )}
            >
              <Users className="w-3 h-3" />
              Team
            </button>
          </div>

          <div className="w-px h-5 bg-gray-800/60 hidden sm:block" />

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                  filter === f.key
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 border border-transparent"
                )}
              >
                <f.icon className="w-3 h-3" />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900/30 border border-gray-800/40",
                  isTeam ? "pl-4" : "pl-4"
                )}
              >
                {isTeam && <div className="w-7 h-7 rounded-full bg-gray-800/60 animate-pulse shrink-0" />}
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-2/3 bg-gray-800/50 rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-gray-800/40 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && items.length === 0 && (
          <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-16 text-center">
            <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No history yet</p>
            <p className="text-gray-500 text-sm mt-1">
              {filter !== "all"
                ? "No items match this filter. Try selecting a different one."
                : isTeam
                  ? "Actions from your team will appear here."
                  : "Duplications, conversions, and publishes will appear here."}
            </p>
          </div>
        )}

        {/* Items */}
        {!isLoading && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item, i) => {
              const op = getOperation(item.details);
              const config = OP_CONFIG[op];
              const detail = describeDetail(item, op);
              const draftSource = getDraftSource(item.details);
              const isSuccess = item.status === "COMPLETED";
              const isMetaTarget = item.targetId && !["DRAFT_DUPLICATE", "AI_CREATE", "WIDE_CREATE"].includes(
                item.details?.operation || ""
              ) && !(item.details?.isConversion && item.details?.savedAsDraft);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "group flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-900/30 border border-gray-800/40 hover:bg-gray-900/50 transition-colors animate-fade-in-up",
                    `stagger-${Math.min(i + 1, 6)}`
                  )}
                >
                  {/* Team mode: avatar */}
                  {isTeam && (
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                        config.bg,
                        config.color
                      )}
                      title={getDisplayName(item)}
                    >
                      {getInitials(item)}
                    </div>
                  )}

                  {/* Mine mode: operation icon */}
                  {!isTeam && (
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        config.bg
                      )}
                    >
                      <span className={cn("w-3.5 h-3.5", config.color)}>
                        {op === "DUPLICATE" && <Copy className="w-3.5 h-3.5" />}
                        {op === "PUBLISH" && <Send className="w-3.5 h-3.5" />}
                        {op === "CONVERSION" && <ArrowRightLeft className="w-3.5 h-3.5" />}
                        {op === "DRAFT" && <Layers className="w-3.5 h-3.5" />}
                        {op === "AI_CREATE" && <Sparkles className="w-3.5 h-3.5" />}
                        {op === "WIDE_CREATE" && <Grid3X3 className="w-3.5 h-3.5" />}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 leading-snug">
                      {/* Team mode: show who */}
                      {isTeam && (
                        <span className="font-medium text-gray-200">
                          {getDisplayName(item)}
                          <span className="text-gray-500 font-normal"> · </span>
                        </span>
                      )}
                      <span className={isTeam ? "text-gray-400" : "text-gray-300"}>
                        {config.verb}
                      </span>
                      {detail && (
                        <span className="text-gray-500"> {detail}</span>
                      )}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                          config.bg,
                          config.color
                        )}
                      >
                        {draftSource ? `${draftSource} → Draft` : config.label}
                      </span>

                      <span className="text-[10px] font-mono text-gray-600 bg-gray-800/50 px-1.5 py-0.5 rounded">
                        {item.type}
                      </span>

                      {isSuccess ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-red-400">
                          <XCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}

                      {item.targetId && (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-gray-600">
                          {item.targetId}
                          {isMetaTarget && <ExternalLink className="w-2.5 h-2.5" />}
                        </span>
                      )}

                      {item.details?.adAccountId && (
                        <span className="text-[10px] text-gray-600 font-mono">
                          {item.details.adAccountId}
                        </span>
                      )}

                      <span
                        className="text-[10px] text-gray-600 ml-auto"
                        title={format(new Date(item.createdAt), "yyyy-MM-dd HH:mm:ss")}
                      >
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => setPendingDeleteId(item.id)}
                    className="p-1.5 text-gray-700 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10 opacity-0 group-hover:opacity-100 shrink-0"
                    title="Delete"
                    aria-label="Delete history item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-600">
              {data.total} item{data.total === 1 ? "" : "s"} · page {data.page} of{" "}
              {data.totalPages}
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 w-7 p-0 border-gray-800 text-gray-400"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 w-7 p-0 border-gray-800 text-gray-400"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title="Delete history item?"
        description="This removes the local audit entry. The campaign or ad set on Facebook is not affected."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        isLoading={deleting}
      />
    </DashboardLayout>
  );
}
