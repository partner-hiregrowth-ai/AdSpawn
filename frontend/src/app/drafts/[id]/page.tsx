"use client";

import { useEffect, useState, useRef, use } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { draftApi } from "@/services/api";
import {
  Save, Send, ShieldCheck, AlertTriangle, FileText, Layers,
  Megaphone, Loader2, ArrowLeft, Trash2, CheckCircle2, CircleHelp,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn, extractApiError } from "@/lib/utils";
import Link from "next/link";
import { MetaForm } from "@/components/meta/MetaForm";
import { OBJECTIVE_LABELS } from "@/lib/meta-schema";

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
function ValidationIssuesPanel({ issues }: { issues: { field: string; message: string; severity: string }[] }) {
  const errors = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");
  if (errors.length === 0 && warnings.length === 0) return null;
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
                <span><span className="font-mono text-red-300/70">{err.field}</span> — {err.message}</span>
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
                <span><span className="font-mono text-amber-300/70">{err.field}</span> — {err.message}</span>
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
        <CheckCircle2 className="w-3 h-3" /> Ready to publish
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

export default function DraftEditorPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [draft, setDraft] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<{ type: "CAMPAIGN" | "ADSET" | "AD"; id: string } | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  // In-memory edits keyed by `${type}:${id}`. Switching nodes preserves edits;
  // they are only persisted when the user clicks Save.
  const [editCache, setEditCache] = useState<Map<string, any>>(new Map());
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
      // Modern browsers display their own generic message; setting returnValue
      // is required for the prompt to fire.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Switching node now PRESERVES the previous node's edits in the cache (no auto-save).
  // When you come back, your in-progress edits are restored.
  const handleSelectNode = (type: "CAMPAIGN" | "ADSET" | "AD", item: any) => {
    setSelectedNode({ type, id: item.id });
    const cached = editCache.get(nodeKey(type, item.id));
    setEditData(cached ?? item);
  };

  // Single helper: update local view AND stash in cache so it survives node switches.
  const commitEdit = (next: any) => {
    setEditData(next);
    if (!currentKey) return;
    setEditCache((prev) => {
      const m = new Map(prev);
      m.set(currentKey, next);
      return m;
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
      router.push("/drafts");
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

  if (isLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div></DashboardLayout>;
  }
  if (!draft) {
    return <DashboardLayout><div className="text-center py-16 text-gray-500">Draft not found</div></DashboardLayout>;
  }

  const statusColor =
    draft.status === "READY" ? "text-emerald-400 bg-emerald-500/15" :
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
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <ValidationBadge
              isValidating={isValidating}
              isDirty={isDirty}
              results={validationResults}
            />
            {(draft.status === "FAILED" || hasMetaId) && draft.status !== "PUBLISHED" && (
              <Button variant="outline" size="sm" className="gap-1.5 border-red-800 text-red-400 hover:bg-red-500/10"
                onClick={handleCleanup} disabled={isCleaning}>
                {isCleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Cleanup Meta
              </Button>
            )}
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
                <span className="text-sm font-medium truncate text-gray-200">{draft.name}</span>
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
                      <span className="text-xs font-medium truncate text-gray-300">{adSet.name}</span>
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
                          <span className="text-[11px] truncate text-gray-400">{ad.name}</span>
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
              <div className="space-y-5 max-w-2xl">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-800/50 text-gray-500 uppercase tracking-wide">
                      {selectedNode?.type}
                    </span>
                    {editData.metaId && <span className="text-[10px] text-gray-600 font-mono">Meta: {editData.metaId}</span>}
                  </div>
                  <Button size="sm" className="gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200"
                    onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                  </Button>
                </div>

                {editData.validationErrors && editData.validationErrors.length > 0 && (
                  <ValidationIssuesPanel issues={editData.validationErrors} />
                )}

                <Tabs defaultValue="form" className="w-full">
                  <TabsList className="bg-gray-900/50 border border-gray-800/60 h-9 w-full">
                    <TabsTrigger value="form" className="text-xs flex-1">Form</TabsTrigger>
                    <TabsTrigger value="summary" className="text-xs flex-1">Summary</TabsTrigger>
                    <TabsTrigger value="json" className="text-xs flex-1">Raw JSON</TabsTrigger>
                  </TabsList>

                  <TabsContent value="form" keepMounted className="mt-4">
                    <MetaForm
                      entityType={
                        selectedNode?.type === "CAMPAIGN" ? "campaign" :
                        selectedNode?.type === "ADSET" ? "adSet" : "ad"
                      }
                      initialValues={editData.data || {}}
                      context={{
                        objective: campaignObjective,
                        buyingType: editData.data?.buying_type || "AUCTION",
                        isCBO,
                      }}
                      adAccountId={adAccountId}
                      onChange={(values) => commitEdit({ ...editData, data: values })}
                    />
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
