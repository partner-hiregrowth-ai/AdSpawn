"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { draftApi, profileApi } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import {
  Save, Send, ShieldCheck, AlertTriangle, FileText, Layers,
  Megaphone, Loader2, ArrowLeft, Trash2, CheckCircle2, CircleHelp,
  Zap, ZapOff, Info, Share2, X, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn, extractApiError } from "@/lib/utils";
import Link from "next/link";
import { MetaForm } from "@/components/meta/MetaForm";
import { AwarenessCampaignForm } from "@/components/campaign/AwarenessCampaignForm";
import { AwarenessAdSetForm } from "@/components/campaign/AwarenessAdSetForm";
import { AwarenessAdForm } from "@/components/campaign/AwarenessAdForm";
import { TrafficCampaignForm } from "@/components/campaign/TrafficCampaignForm";
import { TrafficAdSetForm } from "@/components/campaign/TrafficAdSetForm";
import { TrafficAdForm } from "@/components/campaign/TrafficAdForm";
import { EngagementCampaignForm } from "@/components/campaign/EngagementCampaignForm";
import { EngagementAdSetForm } from "@/components/campaign/EngagementAdSetForm";
import { EngagementAdForm } from "@/components/campaign/EngagementAdForm";
import { LeadsCampaignForm } from "@/components/campaign/LeadsCampaignForm";
import { LeadsAdSetForm } from "@/components/campaign/LeadsAdSetForm";
import { LeadsAdForm } from "@/components/campaign/LeadsAdForm";
import { OBJECTIVE_LABELS } from "@/lib/meta-schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FIELD_LABELS: Record<string, string> = {
  bid_amount: "Bid amount", daily_budget: "Daily budget", lifetime_budget: "Lifetime budget",
  optimization_goal: "Optimization goal", billing_event: "Billing event", name: "Name",
  status: "Status", start_time: "Start time", end_time: "End time", targeting: "Targeting",
  promoted_object: "Promoted object", attribution_spec: "Attribution spec",
  destination_type: "Destination type", pixel_id: "Pixel ID", page_id: "Page ID",
  objective: "Objective", budget_remaining: "Budget remaining", budget_rebalance_flag: "Budget rebalance",
  is_adset_budget_sharing_enabled: "Adset budget sharing", special_ad_categories: "Special ad categories",
  custom_event_type: "Custom event type", application_id: "Application ID",
  adset_budget_optimization: "Adset budget optimization", spend_cap: "Spend cap",
};

const friendlyField = (field: string) => FIELD_LABELS[field] ?? field.replace(/_/g, " ");

function toDateTimeLocal(v: string | undefined): string {
  if (!v) return "";
  const s = String(v);
  if (s.includes("T")) return s.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;
  return s.slice(0, 16);
}

// Flatten the validation response into (errors, warnings) counts for header / toast.
function countIssues(v: any): { errors: number; warnings: number } {
  if (!v) return { errors: 0, warnings: 0 };
  const all = [
    ...(v.campaignErrors || []),
    ...Object.values(v.adSetErrors || {}).flat(),
    ...Object.values(v.adErrors || {}).flat(),
  ] as { severity: string }[];
  return {
    errors: all.filter(e => e.severity === "error").length,
    warnings: all.filter(e => e.severity === "warning").length,
  };
}

// Reusable inline panel — splits issues by severity so the user can act on errors first.
// Info-level notices (e.g. "start time is in the past") are surfaced calmly so they don't
// read as problems the user must fix.
function ValidationIssuesPanel({ issues }: { issues: { field: string; message: string; severity: string }[] }) {
  const errors = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");
  const infos = issues.filter(i => i.severity === "info");
  if (errors.length === 0 && warnings.length === 0 && infos.length === 0) return null;
  return (
    <div className="space-y-2" id="validation-issues">
      {errors.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 p-3.5 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{errors.length} error{errors.length === 1 ? "" : "s"} — fix before publishing</span>
          </div>
          <ul className="text-[11px] text-red-200/90 space-y-1.5">
            {errors.map((err, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-red-500/60 shrink-0">•</span>
                <span><span className="font-semibold text-red-300/80 capitalize">{friendlyField(err.field)}</span> — {err.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 p-3.5 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{warnings.length} warning{warnings.length === 1 ? "" : "s"}</span>
          </div>
          <ul className="text-[11px] text-amber-200/90 space-y-1.5">
            {warnings.map((err, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-amber-500/60 shrink-0">•</span>
                <span><span className="font-semibold text-amber-300/80 capitalize">{friendlyField(err.field)}</span> — {err.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {infos.length > 0 && (
        <div className="bg-blue-500/5 border border-blue-500/20 p-3.5 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-blue-400">
            <Info className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{infos.length} note{infos.length === 1 ? "" : "s"}</span>
          </div>
          <ul className="text-[11px] text-blue-200/90 space-y-1.5">
            {infos.map((err, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-blue-500/60 shrink-0">•</span>
                <span><span className="font-semibold text-blue-300/80 capitalize">{friendlyField(err.field)}</span> — {err.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Tiny status pill so the user always knows where they stand without scrolling.
function ValidationBadge({
  isValidating,
  isDirty,
  results,
}: {
  isValidating: boolean;
  isDirty: boolean;
  results: any;
}) {
  if (isValidating) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/30">
        <Loader2 className="w-3 h-3 animate-spin" /> Validating…
      </span>
    );
  }
  if (isDirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30"
        title="You have unsaved edits. Save to re-validate.">
        <AlertTriangle className="w-3 h-3" /> Unsaved edits
      </span>
    );
  }
  if (!results) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-gray-800/60 text-gray-500 border border-gray-700/40">
        <CircleHelp className="w-3 h-3" /> Not validated
      </span>
    );
  }
  const totals = countIssues(results);
  if (results.isValid) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
        <CheckCircle2 className="w-3 h-3" /> Validated
        {totals.warnings > 0 && <span className="text-amber-300/80">· {totals.warnings} warning{totals.warnings === 1 ? "" : "s"}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-red-500/10 text-red-300 border border-red-500/30">
      <AlertTriangle className="w-3 h-3" />
      {totals.errors} error{totals.errors === 1 ? "" : "s"}
      {totals.warnings > 0 && <span className="text-amber-300/80">· {totals.warnings} warning{totals.warnings === 1 ? "" : "s"}</span>}
    </span>
  );
}

// Shows a compact red/amber count bubble on a sidebar tree item when that entity
// has validation errors. Only renders when errors exist (null-safe).
function EntityErrorDot({ errors }: { errors?: { severity: string }[] }) {
  if (!errors?.length) return null;
  const errCount = errors.filter(e => e.severity === "error").length;
  const warnCount = errors.filter(e => e.severity === "warning").length;
  if (errCount > 0) {
    return (
      <span className="ml-auto shrink-0 min-w-[16px] h-4 rounded-full bg-red-500/80 text-white text-[9px] font-bold flex items-center justify-center px-1">
        {errCount}
      </span>
    );
  }
  if (warnCount > 0) {
    return (
      <span className="ml-auto shrink-0 min-w-[16px] h-4 rounded-full bg-amber-500/70 text-white text-[9px] font-bold flex items-center justify-center px-1">
        {warnCount}
      </span>
    );
  }
  return null;
}

export default function DraftEditorPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const setDraftName = useAppStore((s) => s.setDraftName);
  const [draft, setDraft] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<{ type: "CAMPAIGN" | "ADSET" | "AD"; id: string } | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const draftStorageKey = `adspawn-draft-edits:${params.id}`;
  const [editCache, _setEditCache] = useState<Map<string, any>>(() => {
    if (typeof window === 'undefined') return new Map();
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.cache) {
          return new Map(Object.entries(parsed.cache));
        }
      }
    } catch {}
    return new Map();
  });
  const setEditCache = useCallback((updater: Map<string, any> | ((prev: Map<string, any>) => Map<string, any>)) => {
    _setEditCache((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next.size > 0) {
        localStorage.setItem(draftStorageKey, JSON.stringify({ cache: Object.fromEntries(next) }));
      } else {
        localStorage.removeItem(draftStorageKey);
      }
      return next;
    });
  }, [draftStorageKey]);
  const editCacheRef = useRef(editCache);
  editCacheRef.current = editCache;
  const nodeKey = (type: string, id: string) => `${type}:${id}`;
  const currentKey = selectedNode ? nodeKey(selectedNode.type, selectedNode.id) : null;
  const isDirty = editCache.size > 0;

  const campaignObjective: string = draft?.data?.objective || draft?.objective || "";
  const isCBO = !!(draft?.data?.daily_budget || draft?.data?.lifetime_budget);

  const fetchDraft = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await draftApi.getCampaign(params.id);
      setDraft(response.data);
      if (!silent) setDraftName(response.data.name);
      // Helper: prefer the cached (unsaved) version of a node over the server's value.
      const restore = (key: string, serverItem: any) => {
        const cached = editCacheRef.current.get(key);
        setEditData(cached ?? serverItem);
      };
      if (!selectedNode) {
        setSelectedNode({ type: "CAMPAIGN", id: response.data.id });
        restore(nodeKey("CAMPAIGN", response.data.id), response.data);
      } else {
        const d = response.data;
        if (selectedNode.type === "CAMPAIGN") restore(nodeKey("CAMPAIGN", selectedNode.id), d);
        else if (selectedNode.type === "ADSET") {
          const found = d.adSets?.find((s: any) => s.id === selectedNode.id);
          if (found) restore(nodeKey("ADSET", selectedNode.id), found);
        } else if (selectedNode.type === "AD") {
          for (const s of d.adSets || []) {
            const found = s.ads?.find((a: any) => a.id === selectedNode.id);
            if (found) { restore(nodeKey("AD", selectedNode.id), found); break; }
          }
        }
      }
    } catch (err: any) { toast.error(extractApiError(err, "Couldn't load this draft. It may have been deleted, or your session expired.")); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchDraft(); }, [params.id]);
  useEffect(() => () => { setDraftName(null); }, []);

  // Auto-validate when the draft first opens so the user immediately sees
  // any issues without having to click "Validate". Skipped while loading and
  // while the user has unsaved edits (server only knows about saved state).
  const [hasAutoValidated, setHasAutoValidated] = useState(false);
  useEffect(() => {
    if (!draft || isLoading || hasAutoValidated || isDirty) return;
    setHasAutoValidated(true);
    runValidation({ silent: true });
  }, [draft, isLoading, hasAutoValidated, isDirty]);

  // Warn when navigating/refreshing/closing with unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Auto-save after 3s of inactivity whenever there are pending edits.
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isAutoSaveEnabled || !isDirty || isSaving) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [editCache, isDirty, isAutoSaveEnabled]);

  // Switching node now PRESERVES the previous node's edits in the cache (no auto-save).
  // When you come back, your in-progress edits are restored.
  const handleSelectNode = (type: "CAMPAIGN" | "ADSET" | "AD", item: any) => {
    setSelectedNode({ type, id: item.id });
    const cached = editCache.get(nodeKey(type, item.id));
    setEditData(cached ?? item);
  };

  // Single helper: update local view AND stash in cache so it survives node switches.
  const commitEdit = (values: any) => {
    setEditData((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev, data: values };
      // Use the key derived from the entity we are actually editing
      const key = nodeKey(
        next.adSets ? "CAMPAIGN" : (next.ads ? "ADSET" : "AD"),
        next.id
      );
      setEditCache((prevCache) => {
        const m = new Map(prevCache);
        m.set(key, next);
        return m;
      });
      return next;
    });
  };

  const handleSave = async () => {
    // Snapshot all pending edits — including the one currently visible.
    const pending = new Map(editCache);
    if (currentKey && editData) pending.set(currentKey, editData);
    if (pending.size === 0) return;

    setIsSaving(true);
    try {
      for (const [key, data] of pending) {
        const sep = key.indexOf(":");
        const type = key.slice(0, sep);
        const id = key.slice(sep + 1);
        if (type === "CAMPAIGN") await draftApi.updateCampaign(id, data);
        else if (type === "ADSET") await draftApi.updateAdSet(id, data);
        else if (type === "AD") await draftApi.updateAd(id, data);
      }
      toast.success(pending.size > 1 ? `Saved ${pending.size} changes` : "Changes saved");
      const emptyCache = new Map();
      setEditCache(emptyCache);
      editCacheRef.current = emptyCache;
      await fetchDraft(true);
      // Re-validate silently against the freshly saved state so the badge stays current.
      runValidation({ silent: true });
    } catch (err: any) {
      toast.error(extractApiError(err, "Failed to save changes. Please check your edits and try again."));
    }
    finally { setIsSaving(false); }
  };

  // Single validation runner used by manual click, auto-on-load, and post-save.
  // silent: don't toast on success/failure — used by background re-validations.
  const runValidation = async ({ silent = false }: { silent?: boolean } = {}) => {
    setIsValidating(true);
    try {
      const response = await draftApi.validateDraft(params.id);
      setValidationResults(response.data);
      if (!silent) {
        if (response.data.isValid) {
          toast.success("Validation passed — you're ready to publish.");
        } else {
          const totals = countIssues(response.data);
          toast.error(`Found ${totals.errors} error${totals.errors === 1 ? "" : "s"}${totals.warnings > 0 ? ` and ${totals.warnings} warning${totals.warnings === 1 ? "" : "s"}` : ""}. See details below.`);
          // Scroll the issues panel into view so the user doesn't have to hunt.
          requestAnimationFrame(() => {
            document.getElementById("validation-issues")?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }
      }
      // Always refresh so the per-entity validationErrors render inline.
      await fetchDraft(true);
    } catch (err: any) {
      if (!silent) toast.error(extractApiError(err, "Couldn't validate this draft right now. Try again in a moment."));
    }
    finally { setIsValidating(false); }
  };

  const handleValidate = async () => {
    if (isDirty) {
      toast.error("You have unsaved edits. Save them first so validation runs against the latest values.");
      return;
    }
    await runValidation();
  };

  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  const handlePublish = () => {
    if (isDirty) {
      toast.error("You have unsaved edits. Save them first so the published campaign reflects the latest values.");
      return;
    }
    if (validationResults && !validationResults.isValid) {
      toast.error("Fix the validation issues listed below before publishing.");
      return;
    }
    setShowPublishConfirm(true);
  };

  const confirmPublish = async () => {
    setShowPublishConfirm(false);
    setIsPublishing(true);
    try {
      await draftApi.publishDraft(params.id);
      toast.success("Published! Your campaign is live on Meta (paused, ready for review).");
      await fetchDraft(true);
    } catch (err: any) {
      toast.error(extractApiError(err, "Publishing failed. Check the error details and try again."));
    }
    finally { setIsPublishing(false); }
  };

  const handleCleanup = () => setShowCleanupConfirm(true);

  const confirmCleanup = async () => {
    setShowCleanupConfirm(false);
    setIsCleaning(true);
    try {
      const response = await draftApi.cleanupMetaObjects(params.id);
      toast.success(`Deleted ${response.data.deleted.length} Meta object${response.data.deleted.length === 1 ? "" : "s"}. Draft reset — you can publish again from scratch.`);
      await fetchDraft(true);
      runValidation({ silent: true });
    } catch (err: any) {
      toast.error(extractApiError(err, "Cleanup failed. The previously created Meta objects may still exist."));
    }
    finally { setIsCleaning(false); }
  };

  const hasMetaId = !!draft?.metaId || draft?.adSets?.some((s: any) => !!s.metaId);

  const currentProfileId = useAppStore.getState().profile?.id;
  const [showShareModal, setShowShareModal] = useState(false);
  const [shares, setShares] = useState<any[]>([]);
  const [teamProfiles, setTeamProfiles] = useState<any[]>([]);
  const [shareTargetIds, setShareTargetIds] = useState<string[]>([]);
  const [sharePermission, setSharePermission] = useState("view");
  const [isSharing, setIsSharing] = useState(false);
  const [loadingShares, setLoadingShares] = useState(false);

  const openShareModal = async () => {
    setShowShareModal(true);
    setLoadingShares(true);
    try {
      const [sharesRes, profilesRes] = await Promise.all([
        draftApi.getDraftShares(params.id),
        profileApi.list(),
      ]);
      setShares(sharesRes.data);
      setTeamProfiles(profilesRes.data);
    } catch {
      toast.error("Failed to load sharing info");
    } finally {
      setLoadingShares(false);
    }
  };

  const handleShare = async () => {
    if (shareTargetIds.length === 0) return;
    setIsSharing(true);
    try {
      await Promise.all(
        shareTargetIds.map(id => draftApi.shareDraft(params.id, id, sharePermission))
      );
      toast.success(`Shared with ${shareTargetIds.length} profile${shareTargetIds.length > 1 ? 's' : ''}`);
      const res = await draftApi.getDraftShares(params.id);
      setShares(res.data);
      setShareTargetIds([]);
      setSharePermission("view");
    } catch (err: any) {
      toast.error(extractApiError(err, "Failed to share draft"));
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      await draftApi.revokeDraftShare(params.id, shareId);
      setShares(s => s.filter(x => x.id !== shareId));
      toast.success("Share revoked");
    } catch (err: any) {
      toast.error(extractApiError(err, "Failed to revoke share"));
    }
  };

  const unsharableProfiles = teamProfiles.filter(
    p => p.id !== currentProfileId && !shares.some(s => s.sharedWithProfileId === p.id)
  );

  if (isLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div></DashboardLayout>;
  }
  if (!draft) {
    return <DashboardLayout><div className="text-center py-16 text-gray-500">Draft not found</div></DashboardLayout>;
  }

  const statusColor =
    draft.status === "VALIDATED" ? "text-emerald-400 bg-emerald-500/15" :
    draft.status === "PUBLISHED" ? "text-emerald-500 bg-emerald-500/10" :
    draft.status === "FAILED" ? "text-red-400 bg-red-500/15" :
    "text-gray-400 bg-gray-800/50";

  const adAccountId = draft?.adAccountId || editData?.adAccountId;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between pb-4 border-b border-gray-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/drafts">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-300 shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-100 truncate">{draft.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusColor)}>{draft.status}</span>
                <span className="text-xs text-gray-600">{OBJECTIVE_LABELS[campaignObjective] || campaignObjective}</span>
                {draft.metaId && <span className="text-[10px] text-gray-600 font-mono hidden sm:inline">Meta: {draft.metaId}</span>}
                <ValidationBadge
                  isValidating={isValidating}
                  isDirty={isDirty}
                  results={validationResults}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {draft.status !== "PUBLISHING" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 border-red-900/60 text-red-400 hover:bg-red-500/10 hover:border-red-700 bg-red-500/5 min-w-[120px]"
                  onClick={handleCleanup} disabled={isCleaning} title="Delete objects on Meta and reset draft">
                  {isCleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Cleanup Meta
                </Button>
                <div className="w-px h-5 bg-gray-800 hidden sm:block" />
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 border-gray-800",
                isAutoSaveEnabled ? "text-blue-400 bg-blue-500/5" : "text-gray-500"
              )}
              onClick={() => setIsAutoSaveEnabled(!isAutoSaveEnabled)}
              title={isAutoSaveEnabled ? "Auto-save is ON" : "Auto-save is OFF"}
            >
              {isAutoSaveEnabled ? <Zap className="w-3.5 h-3.5" /> : <ZapOff className="w-3.5 h-3.5" />}
              Auto-save
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 border-gray-800 text-gray-400"
              onClick={openShareModal}>
              <Share2 className="w-3.5 h-3.5" /> Share
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 border-gray-800 text-gray-400"
              onClick={handleValidate} disabled={isValidating || isDirty}
              title={isDirty ? "Save your edits first" : "Re-run validation"}>
              <ShieldCheck className={cn("w-3.5 h-3.5", isValidating && "animate-spin")} /> Validate
            </Button>
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
              onClick={handlePublish}
              disabled={isPublishing || draft.status === "PUBLISHING" || draft.status === "PUBLISHED" || isDirty || (!!validationResults && !validationResults.isValid)}
              title={
                isDirty ? "Save your edits first" :
                (validationResults && !validationResults.isValid) ? "Fix validation issues first" :
                "Publish this draft to Meta"
              }>
              <Send className="w-3.5 h-3.5" /> {isPublishing ? "Publishing..." : "Publish to Meta"}
            </Button>
          </div>
        </div>

        <ConfirmDialog
          open={showPublishConfirm}
          onOpenChange={(open) => { if (!open) setShowPublishConfirm(false); }}
          title="Publish this draft to Meta?"
          description={`This creates real campaigns, ad sets, and ads on your Meta Ads account "${draft.adAccountId}". Everything will be created as PAUSED — nothing will spend until you activate it on Meta.`}
          confirmLabel="Publish now"
          variant="warning"
          onConfirm={confirmPublish}
          isLoading={isPublishing}
        />
        <ConfirmDialog
          open={showCleanupConfirm}
          onOpenChange={(open) => { if (!open) setShowCleanupConfirm(false); }}
          title="Delete previously published Meta objects?"
          description="This permanently deletes the campaigns, ad sets, and ads that this draft created on Meta during earlier publish attempts. Your local draft stays intact, and you can publish again from a clean slate."
          confirmLabel="Delete on Meta"
          variant="danger"
          onConfirm={confirmCleanup}
          isLoading={isCleaning}
        />

        {showShareModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl animate-fade-in-up">
              <div className="flex items-center justify-between p-5 border-b border-gray-800/60">
                <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-blue-400" /> Share draft with profiles
                </h3>
                <button onClick={() => setShowShareModal(false)} className="text-gray-600 hover:text-gray-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {loadingShares ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <>
                    {unsharableProfiles.length > 0 && (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs text-gray-400">Select profiles to share with</label>
                          <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-800/60 rounded-lg p-2 bg-gray-950/30">
                            {unsharableProfiles.map(p => (
                              <label key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-gray-800/40 cursor-pointer transition-colors">
                                <input
                                  type="checkbox"
                                  checked={shareTargetIds.includes(p.id)}
                                  onChange={(e) => {
                                    setShareTargetIds(prev =>
                                      e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id)
                                    );
                                  }}
                                  className="rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500/30 w-3.5 h-3.5"
                                />
                                <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                  <span className="text-[9px] font-bold text-blue-400">{p.name[0].toUpperCase()}</span>
                                </div>
                                <span className="text-xs text-gray-300">{p.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={sharePermission} onValueChange={(v) => { if (v) setSharePermission(v); }}>
                            <SelectTrigger className="w-28 h-9 bg-gray-950/50 border-gray-800 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-800">
                              <SelectItem value="view" className="text-xs text-gray-300">View</SelectItem>
                              <SelectItem value="edit" className="text-xs text-gray-300">Edit</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="h-9 flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleShare} disabled={isSharing || shareTargetIds.length === 0}>
                            {isSharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                              <span className="flex items-center gap-1.5">
                                <UserPlus className="w-3.5 h-3.5" />
                                Share{shareTargetIds.length > 0 ? ` (${shareTargetIds.length})` : ''}
                              </span>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {shares.length > 0 ? (
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Shared with</label>
                        <div className="space-y-1.5">
                          {shares.map(share => (
                            <div key={share.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/30 border border-gray-800/60">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-blue-400">
                                    {(share.sharedWith?.name || '?')[0].toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-300 truncate">{share.sharedWith?.name}</span>
                                <span className={cn(
                                  "text-[10px] font-medium px-1.5 py-0.5 rounded",
                                  share.permission === 'edit' ? "bg-blue-500/10 text-blue-400" : "bg-gray-800 text-gray-500"
                                )}>
                                  {share.permission}
                                </span>
                              </div>
                              <button onClick={() => handleRevokeShare(share.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-xs text-gray-600">Not shared with any profile yet.</p>
                      </div>
                    )}

                    {unsharableProfiles.length === 0 && shares.length > 0 && (
                      <p className="text-[11px] text-gray-600 text-center">All profiles already have access.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row flex-1 gap-5 overflow-hidden">
          <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-800/40 overflow-y-auto pr-0 md:pr-3 max-h-48 md:max-h-none pb-3 md:pb-0">
            <div className="space-y-3">
              <button
                className={cn(
                  "w-full p-2.5 rounded-lg flex items-center gap-2.5 transition-all text-left",
                  selectedNode?.type === "CAMPAIGN" ? "bg-blue-500/10 border border-blue-500/30" : "hover:bg-gray-800/40"
                )}
                onClick={() => handleSelectNode("CAMPAIGN", draft)}>
                <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Megaphone className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-sm font-medium truncate text-gray-200 flex-1">{draft.name}</span>
                <EntityErrorDot errors={validationResults?.campaignErrors} />
              </button>

              <div className="pl-5 space-y-2 border-l border-gray-800/40 ml-3.5">
                {draft.adSets?.map((adSet: any) => (
                  <div key={adSet.id} className="space-y-1.5">
                    <button
                      className={cn(
                        "w-full p-2 rounded-lg flex items-center gap-2.5 transition-all text-left",
                        selectedNode?.type === "ADSET" && selectedNode.id === adSet.id ? "bg-blue-500/10 border border-blue-500/30" : "hover:bg-gray-800/40"
                      )}
                      onClick={() => handleSelectNode("ADSET", adSet)}>
                      <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Layers className="w-3 h-3 text-purple-400" />
                      </div>
                      <span className="text-xs font-medium truncate text-gray-300 flex-1">{adSet.name}</span>
                      <EntityErrorDot errors={validationResults?.adSetErrors?.[adSet.id]} />
                    </button>

                    <div className="pl-5 space-y-1 border-l border-gray-800/30 ml-3">
                      {adSet.ads?.map((ad: any) => (
                        <button key={ad.id}
                          className={cn(
                            "w-full p-1.5 rounded-lg flex items-center gap-2 transition-all text-left",
                            selectedNode?.type === "AD" && selectedNode.id === ad.id ? "bg-blue-500/10 border border-blue-500/30" : "hover:bg-gray-800/40"
                          )}
                          onClick={() => handleSelectNode("AD", ad)}>
                          <div className="w-5 h-5 rounded bg-green-500/10 flex items-center justify-center shrink-0">
                            <FileText className="w-2.5 h-2.5 text-green-400" />
                          </div>
                          <span className="text-[11px] truncate text-gray-400 flex-1">{ad.name}</span>
                          <EntityErrorDot errors={validationResults?.adErrors?.[ad.id]} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-w-0">
            {editData ? (
              <div className="space-y-4 max-w-2xl">
                {/* Top bar: level pill + save */}
                <div className="flex items-center justify-between gap-3 py-1">
                  <div className="flex items-center gap-2.5">
                    <span className={cn(
                      "text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-widest",
                      selectedNode?.type === "CAMPAIGN" ? "bg-blue-500/15 text-blue-300 border border-blue-500/30" :
                      selectedNode?.type === "ADSET"    ? "bg-purple-500/15 text-purple-300 border border-purple-500/30" :
                                                          "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    )}>
                      {selectedNode?.type}
                    </span>
                    {editData.metaId && (
                      <span className="text-[10px] text-gray-600 font-mono bg-gray-800/40 px-2 py-0.5 rounded">
                        Meta: {editData.metaId}
                      </span>
                    )}
                  </div>
                  <Button size="sm" className="gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200"
                    onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isSaving ? "Saving…" : "Save"}
                  </Button>
                </div>

                {editData.validationErrors && editData.validationErrors.length > 0 && (
                  <ValidationIssuesPanel issues={editData.validationErrors} />
                )}

                <Tabs defaultValue="form" className="w-full">
                  <TabsList className="bg-gray-800/50 border border-gray-700/50 h-9 w-full p-0.5 gap-0.5">
                    <TabsTrigger value="form" className="text-xs flex-1 data-active:bg-white/10 data-active:text-white text-gray-500 hover:text-gray-300">Form</TabsTrigger>
                    <TabsTrigger value="summary" className="text-xs flex-1 data-active:bg-white/10 data-active:text-white text-gray-500 hover:text-gray-300">Summary</TabsTrigger>
                    <TabsTrigger value="json" className="text-xs flex-1 data-active:bg-white/10 data-active:text-white text-gray-500 hover:text-gray-300">Raw JSON</TabsTrigger>
                  </TabsList>

                  <TabsContent value="form" keepMounted className="mt-4">
                    {selectedNode?.type === "CAMPAIGN" && campaignObjective === "OUTCOME_AWARENESS" ? (
                      <AwarenessCampaignForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : selectedNode?.type === "ADSET" && campaignObjective === "OUTCOME_AWARENESS" ? (
                      <AwarenessAdSetForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        campaignBudget={
                          isCBO
                            ? (draft?.data?.daily_budget ?? draft?.data?.lifetime_budget)
                            : undefined
                        }
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : selectedNode?.type === "AD" && campaignObjective === "OUTCOME_AWARENESS" ? (
                      <AwarenessAdForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : selectedNode?.type === "CAMPAIGN" && campaignObjective === "OUTCOME_TRAFFIC" ? (
                      <TrafficCampaignForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : selectedNode?.type === "ADSET" && campaignObjective === "OUTCOME_TRAFFIC" ? (
                      <TrafficAdSetForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        campaignBudget={
                          isCBO
                            ? (draft?.data?.daily_budget ?? draft?.data?.lifetime_budget)
                            : undefined
                        }
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : selectedNode?.type === "AD" && campaignObjective === "OUTCOME_TRAFFIC" ? (
                      <TrafficAdForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : selectedNode?.type === "CAMPAIGN" && campaignObjective === "OUTCOME_ENGAGEMENT" ? (
                      <EngagementCampaignForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : selectedNode?.type === "ADSET" && campaignObjective === "OUTCOME_ENGAGEMENT" ? (
                      <EngagementAdSetForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        campaignBudget={
                          isCBO
                            ? (draft?.data?.daily_budget ?? draft?.data?.lifetime_budget)
                            : undefined
                        }
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : selectedNode?.type === "AD" && campaignObjective === "OUTCOME_ENGAGEMENT" ? (
                      <EngagementAdForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : selectedNode?.type === "CAMPAIGN" && campaignObjective === "OUTCOME_LEADS" ? (
                      <LeadsCampaignForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : selectedNode?.type === "ADSET" && campaignObjective === "OUTCOME_LEADS" ? (
                      <LeadsAdSetForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        campaignBudget={
                          isCBO
                            ? (draft?.data?.daily_budget ?? draft?.data?.lifetime_budget)
                            : undefined
                        }
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : selectedNode?.type === "AD" && campaignObjective === "OUTCOME_LEADS" ? (
                      <LeadsAdForm
                        key={selectedNode?.id}
                        initialValues={editData.data || {}}
                        onChange={(values) => commitEdit(values)}
                      />
                    ) : (
                      <MetaForm
                        key={selectedNode?.id}
                        entityType={
                          selectedNode?.type === "CAMPAIGN" ? "campaign" :
                          selectedNode?.type === "ADSET" ? "adSet" : "ad"
                        }
                        initialValues={editData.data || {}}
                        context={{
                          objective: campaignObjective,
                          buyingType: editData.data?.buying_type || "AUCTION",
                          isCBO,
                          hasMetaId: !!editData.metaId,
                        }}
                        adAccountId={adAccountId}
                        onChange={(values) => commitEdit(values)}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="summary" className="mt-4">
                    <Card className="bg-gray-900/30 border-gray-800/60">
                      <CardContent className="pt-5">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-gray-800/30">
                            <span className="text-xs text-gray-500">Type</span>
                            <span className="text-xs font-medium text-gray-300">{selectedNode?.type}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-800/30">
                            <span className="text-xs text-gray-500">Name</span>
                            <span className="text-xs font-medium text-gray-300">{editData.name}</span>
                          </div>
                          {Object.entries(editData.data || {}).map(([key, value]: [string, any]) => {
                            if (key === "name") return null;
                            if (typeof value === "string" || typeof value === "number") {
                              return (
                                <div key={key} className="flex justify-between items-center py-2 border-b border-gray-800/30">
                                  <span className="text-xs text-gray-500 capitalize">{key.replace(/_/g, " ")}</span>
                                  <span className="text-xs font-medium truncate max-w-[280px] text-gray-300">{String(value)}</span>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="json" className="mt-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Raw Data (read-only view of payload)</Label>
                      <textarea
                        className="w-full h-96 bg-gray-900/50 border border-gray-800/60 rounded-lg p-4 font-mono text-xs text-gray-300 focus:outline-none focus:border-blue-500/50 transition-colors"
                        value={JSON.stringify(editData.data, null, 2)} readOnly />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                Select an item from the tree to edit
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
