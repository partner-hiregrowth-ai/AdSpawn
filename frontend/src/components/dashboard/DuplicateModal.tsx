"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle,
  Info,
  Loader2,
  Coins,
  Globe,
  Target,
  Copy,
  Layers,
  ChevronDown,
  ChevronRight,
  Zap,
  Lock,
  CheckCircle2,
  Settings2,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { duplicationApi, draftApi } from "@/services/api";
import { NamingTemplateEditor } from "./NamingTemplateEditor";
import { NamingPreview } from "./NamingPreview";
import { cn, extractApiError } from "@/lib/utils";

interface DuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: Array<{ id: string; type: string; name: string }>;
  adAccountId: string;
  onSuccess: () => void;
}

interface OptimizedField {
  field: string;
  label: string;
  action: string;
  reason?: string;
  originalValue?: any;
  newValue: any;
  editable: boolean;
  type: string;
  enumValues?: string[];
  enumLabels?: Record<string, string>;
}

const ACTION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  kept:        { bg: "bg-gray-800/40",    text: "text-gray-400",    label: "Kept" },
  removed:     { bg: "bg-red-500/10",     text: "text-red-400",     label: "Removed" },
  transformed: { bg: "bg-blue-500/10",    text: "text-blue-400",    label: "Changed" },
  locked:      { bg: "bg-gray-800/60",    text: "text-gray-500",    label: "Locked" },
  auto_mapped: { bg: "bg-amber-500/10",   text: "text-amber-400",   label: "Auto-mapped" },
  added:       { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Added" },
};

function FieldActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action] || ACTION_STYLES.kept;
  return (
    <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", style.bg, style.text)}>
      {style.label}
    </span>
  );
}

// Fields controlled by Settings or always-fixed — hidden from optimization view
const HIDDEN_OPTIMIZATION_FIELDS = new Set([
  "name",           // controlled by naming template
  "status",         // always PAUSED (shown in safety notice)
  "daily_budget",   // controlled by budget setting
  "lifetime_budget",// controlled by budget setting
  "spend_cap",      // controlled by budget setting
]);

// Non-editable object fields that just show noise as raw JSON
const NOISE_OBJECT_FIELDS = new Set(["targeting", "promoted_object", "tracking_specs"]);

function shouldShowField(f: OptimizedField, showAllKept: boolean): boolean {
  if (HIDDEN_OPTIMIZATION_FIELDS.has(f.field)) return false;
  if (NOISE_OBJECT_FIELDS.has(f.field) && !f.editable && f.action === "kept") return false;
  if (!showAllKept && f.action === "kept" && !f.editable) return false;
  return true;
}

export const DuplicateModal = ({
  isOpen,
  onClose,
  selectedItems,
  adAccountId,
  onSuccess,
}: DuplicateModalProps) => {
  const [renamePattern, setRenamePattern] = useState("{{campaign_name}}{{adset_name}}{{ad_name}} - Copy {{iteration_number}}");
  const [numCopies, setNumCopies] = useState(1);
  const [customBudget, setCustomBudget] = useState("40");
  const [country, setCountry] = useState("TH");
  const [angle, setAngle] = useState("UGC");
  const [deep, setDeep] = useState(true);
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [showOptimization, setShowOptimization] = useState(false);
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const [showAllKept, setShowAllKept] = useState(false);

  const hasCampaigns = selectedItems.some((item) => item.type === "CAMPAIGN");
  const isSingleItem = selectedItems.length === 1;

  const previewContext = useMemo(
    () => ({
      country,
      angle,
      budget: customBudget,
      campaign_name: selectedItems.find((i) => i.type === "CAMPAIGN")?.name,
      adset_name: selectedItems.find((i) => i.type === "ADSET")?.name,
      ad_name: selectedItems.find((i) => i.type === "AD")?.name,
    }),
    [country, angle, customBudget, selectedItems]
  );

  // Auto-optimize on open for single items
  useEffect(() => {
    if (isOpen && isSingleItem && !optimizationData && !optimizing) {
      fetchOptimization();
    }
  }, [isOpen, isSingleItem]);

  const fetchOptimization = async () => {
    if (!isSingleItem) return;
    setOptimizing(true);
    try {
      const item = selectedItems[0];
      const resp = await duplicationApi.optimizeDuplicate({
        type: item.type,
        id: item.id,
        overrides,
      });
      setOptimizationData(resp.data);
      setShowOptimization(true);
    } catch (error: any) {
      // Non-blocking — optimization is optional
      console.warn("Optimization failed:", error);
    } finally {
      setOptimizing(false);
    }
  };

  const handleFieldChange = (entityKey: string, field: string, value: any) => {
    setOverrides((prev) => ({
      ...prev,
      [`${entityKey}.${field}`]: value,
    }));

    if (!optimizationData) return;
    const updated = { ...optimizationData };
    const entity = entityKey === "campaign"
      ? updated.campaign
      : updated.adSets?.find((s: any) => s.sourceId === entityKey);
    if (!entity) return;
    const f = entity.fields?.find((fld: any) => fld.field === field);
    if (f) {
      f.newValue = value;
      f.action = "transformed";
    }
    if (entity.payload) entity.payload[field] = value;
    setOptimizationData(updated);
  };

  const handleDuplicate = async () => {
    if (!adAccountId) {
      toast.error("No ad account selected. Pick one from the Dashboard first.");
      return;
    }
    setLoading(true);
    try {
      const resp = await duplicationApi.duplicateBulk({
        items: selectedItems,
        adAccountId,
        options: {
          numCopies,
          renamePattern,
          deep,
          customBudget: customBudget || undefined,
          context: { country, angle },
        },
      });
      const { requested, created, failed, failures } = resp.data || {};
      if (failed && failed > 0) {
        const firstErr = failures?.[0]?.error || "unknown error";
        toast.error(`Created ${created}/${requested} copies. ${failed} failed — first error: ${firstErr}`);
      } else {
        toast.success(`Created ${created} cop${created === 1 ? "y" : "ies"} on Meta (paused).`);
      }
      // Always run onSuccess so the user can see whichever copies did make it.
      onSuccess();
      onClose();
      resetState();
    } catch (error: any) {
      toast.error(extractApiError(error, "Couldn't start the duplicate job. Check your Facebook connection and try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (selectedItems.length === 0) return;
    if (selectedItems.some((i) => i.type !== "CAMPAIGN")) {
      toast.error("Draft system currently only supports Campaigns");
      return;
    }
    setDraftLoading(true);
    try {
      const results = await Promise.allSettled(
        selectedItems.map((item) => draftApi.duplicateToDraft(item.id, numCopies))
      );
      // Each per-item response now has { created, failed, requested } when N>1.
      let totalCreated = 0;
      let totalRequested = 0;
      let firstErr: string | null = null;
      for (const r of results) {
        if (r.status === "fulfilled") {
          const d = r.value.data || {};
          totalCreated += d.created ?? 1;
          totalRequested += d.requested ?? 1;
          if (d.failures?.[0]?.error && !firstErr) firstErr = d.failures[0].error;
        } else {
          totalRequested += numCopies;
          if (!firstErr) {
            firstErr = (r.reason as any)?.response?.data?.error
              || (r.reason as any)?.message
              || "unknown error";
          }
        }
      }
      if (totalCreated === totalRequested) {
        toast.success(`Saved ${totalCreated} draft${totalCreated === 1 ? "" : "s"} to Internal Drafts.`);
        onClose();
        resetState();
      } else {
        toast.error(`${totalCreated}/${totalRequested} drafts created. First error: ${firstErr || "unknown error"}`);
        if (totalCreated > 0) {
          onClose();
          resetState();
        }
      }
    } finally {
      setDraftLoading(false);
    }
  };

  const resetState = () => {
    setOptimizationData(null);
    setOverrides({});
    setShowOptimization(false);
    setSettingsCollapsed(false);
  };

  const isBusy = loading || draftLoading || optimizing;

  // Filter optimization fields: remove duplicates from settings, noise, and optionally "kept" fields
  const filteredCampaignFields = useMemo(() => {
    if (!optimizationData?.campaign?.fields) return [];
    return optimizationData.campaign.fields.filter(
      (f: OptimizedField) => shouldShowField(f, showAllKept)
    );
  }, [optimizationData, showAllKept]);

  const filteredAdSetFields = useMemo(() => {
    if (!optimizationData?.adSets) return [];
    return optimizationData.adSets.map((adSet: any) => ({
      ...adSet,
      fields: (adSet.fields || []).filter(
        (f: OptimizedField) => shouldShowField(f, showAllKept)
      ),
    }));
  }, [optimizationData, showAllKept]);

  const totalHiddenCount = useMemo(() => {
    if (!optimizationData) return 0;
    const allFields = [
      ...(optimizationData.campaign?.fields || []),
      ...(optimizationData.adSets || []).flatMap((s: any) => s.fields || []),
    ];
    const shown = [
      ...filteredCampaignFields,
      ...filteredAdSetFields.flatMap((s: any) => s.fields || []),
    ];
    return allFields.length - shown.length;
  }, [optimizationData, filteredCampaignFields, filteredAdSetFields]);

  const hasOptimizationWarnings = useMemo(() => {
    if (!optimizationData) return false;
    return (
      (optimizationData.campaign?.warnings?.length || 0) > 0 ||
      (optimizationData.campaign?.errors?.length || 0) > 0 ||
      optimizationData.adSets?.some((s: any) => s.warnings?.length > 0 || s.errors?.length > 0)
    );
  }, [optimizationData]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        onClose();
        resetState();
      }}
    >
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800 text-gray-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Copy className="w-5 h-5 text-blue-400" />
            Duplicate Structures
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure and review {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} before creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Safety notice */}
          <div className="bg-amber-900/20 border border-amber-500/30 p-3 rounded-lg flex gap-2.5 text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs">
              New structures will be created as <strong>PAUSED</strong>.
            </p>
          </div>

          {/* ─── Settings Section ─── */}
          <div className="border border-gray-800/60 rounded-lg overflow-hidden">
            <button
              onClick={() => setSettingsCollapsed(!settingsCollapsed)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-800/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-200">Settings</span>
              </div>
              {settingsCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {!settingsCollapsed && (
              <div className="px-3 pb-4 space-y-4 border-t border-gray-800/40 pt-3">
                {/* Naming */}
                <div className="space-y-2">
                  <NamingTemplateEditor
                    onPatternChange={setRenamePattern}
                    initialPattern={renamePattern}
                    type={hasCampaigns ? "CAMPAIGN" : "ALL"}
                  />
                  <NamingPreview pattern={renamePattern} context={previewContext} />
                </div>

                {/* Country + Angle */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="country" className="text-xs flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-blue-400" />
                      Target Country
                    </Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="bg-gray-950 border-gray-800 focus:border-blue-500 h-8 text-sm"
                      placeholder="e.g. TH"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="angle" className="text-xs flex items-center gap-1.5">
                      <Target className="w-3 h-3 text-purple-400" />
                      Marketing Angle
                    </Label>
                    <Input
                      id="angle"
                      value={angle}
                      onChange={(e) => setAngle(e.target.value)}
                      className="bg-gray-950 border-gray-800 focus:border-blue-500 h-8 text-sm"
                      placeholder="e.g. UGC, Promo"
                    />
                  </div>
                </div>

                {/* Copies + Budget */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="copies" className="text-xs">Number of Copies</Label>
                    <Input
                      id="copies"
                      type="number"
                      min={1}
                      max={50}
                      value={numCopies}
                      onChange={(e) => setNumCopies(parseInt(e.target.value) || 1)}
                      className="bg-gray-950 border-gray-800 focus:border-blue-500 h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="budget" className="text-xs flex items-center gap-1.5">
                      <Coins className="w-3 h-3 text-yellow-500" />
                      Daily Budget (THB)
                    </Label>
                    <Input
                      id="budget"
                      type="number"
                      min={0}
                      step={0.01}
                      value={customBudget}
                      onChange={(e) => setCustomBudget(e.target.value)}
                      className="bg-gray-950 border-gray-800 focus:border-blue-500 text-yellow-400 font-mono h-8 text-sm"
                    />
                  </div>
                </div>

                {/* Deep duplication */}
                {hasCampaigns && (
                  <div className="flex items-center space-x-2 bg-gray-950/50 p-2.5 rounded-lg border border-gray-800/60">
                    <Checkbox
                      id="deep"
                      checked={deep}
                      onCheckedChange={(checked) => setDeep(!!checked)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="deep" className="text-xs font-medium leading-none cursor-pointer">
                        Deep Duplication
                      </label>
                      <p className="text-[10px] text-gray-500">
                        Include all Ad Sets and Ads within selected Campaigns.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Optimization Section ─── */}
          {isSingleItem && (
            <div className="border border-gray-800/60 rounded-lg overflow-hidden">
              <button
                onClick={() => {
                  if (!optimizationData && !optimizing) fetchOptimization();
                  setShowOptimization(!showOptimization);
                }}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-800/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-gray-200">Meta Field Optimization</span>
                  {optimizing && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                  {optimizationData && !optimizing && (
                    <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-medium">
                      Ready
                    </span>
                  )}
                  {hasOptimizationWarnings && (
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                  )}
                </div>
                {showOptimization ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {showOptimization && (
                <div className="px-3 pb-4 border-t border-gray-800/40 pt-3 space-y-3 max-h-[40vh] overflow-y-auto">
                  {optimizing ? (
                    <div className="flex items-center justify-center py-6 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span className="text-xs text-gray-500">Analyzing fields...</span>
                    </div>
                  ) : !optimizationData ? (
                    <div className="text-center py-6">
                      <p className="text-xs text-gray-500">Failed to load optimization data</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 text-xs"
                        onClick={fetchOptimization}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Toggle for hidden fields */}
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-gray-500">
                          Showing editable & changed fields only.
                        </p>
                        {totalHiddenCount > 0 && (
                          <button
                            onClick={() => setShowAllKept(!showAllKept)}
                            className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2"
                          >
                            {showAllKept ? "Hide kept fields" : `Show ${totalHiddenCount} hidden`}
                          </button>
                        )}
                      </div>

                      {/* Campaign fields */}
                      {filteredCampaignFields.length > 0 && (
                        <FieldGroup
                          title="Campaign"
                          icon={<Zap className="w-3.5 h-3.5 text-blue-400" />}
                          fields={filteredCampaignFields}
                          warnings={optimizationData.campaign?.warnings}
                          errors={optimizationData.campaign?.errors}
                          onFieldChange={(field, value) => handleFieldChange("campaign", field, value)}
                        />
                      )}

                      {/* Ad Set fields */}
                      {filteredAdSetFields.map((adSet: any) => {
                        if (adSet.fields.length === 0) return null;
                        return (
                          <FieldGroup
                            key={adSet.sourceId}
                            title={adSet.sourceName || "Ad Set"}
                            icon={<Layers className="w-3.5 h-3.5 text-purple-400" />}
                            fields={adSet.fields}
                            warnings={adSet.warnings}
                            errors={adSet.errors}
                            onFieldChange={(field, value) => handleFieldChange(adSet.sourceId, field, value)}
                          />
                        );
                      })}

                      {filteredCampaignFields.length === 0 &&
                        filteredAdSetFields.every((a: any) => a.fields.length === 0) && (
                        <div className="text-center py-4">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
                          <p className="text-xs text-gray-400">All fields are optimal — no changes needed.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => { onClose(); resetState(); }}
            disabled={isBusy}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isBusy}
            className="border-blue-600 text-blue-400 hover:bg-blue-600/10 w-full sm:w-auto gap-2"
          >
            {draftLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
            Save as Draft
          </Button>
          <Button
            onClick={handleDuplicate}
            disabled={isBusy}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Duplicating...
              </>
            ) : (
              "Confirm Duplication"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Field Group ───

function FieldGroup({
  title,
  icon,
  fields,
  warnings,
  errors,
  onFieldChange,
}: {
  title: string;
  icon: React.ReactNode;
  fields: OptimizedField[];
  warnings?: string[];
  errors?: string[];
  onFieldChange: (field: string, value: any) => void;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
        {icon}
        {title}
      </h4>
      {errors?.map((e, i) => (
        <p key={`e-${i}`} className="text-[10px] text-red-400 mb-1 flex items-center gap-1">
          <AlertTriangle className="w-2.5 h-2.5" /> {e}
        </p>
      ))}
      {warnings?.map((w, i) => (
        <p key={`w-${i}`} className="text-[10px] text-amber-400 mb-1 flex items-center gap-1">
          <Info className="w-2.5 h-2.5" /> {w}
        </p>
      ))}
      <div className="space-y-1.5">
        {fields.map((f) => (
          <OptimizedFieldRow key={f.field} field={f} onChangeValue={onFieldChange} />
        ))}
      </div>
    </div>
  );
}

// ─── Object Summary (avoids raw JSON dumps) ───

function ObjectSummary({ value }: { value: any }) {
  if (!value || typeof value !== "object") {
    return <span className="text-[11px] text-gray-600">—</span>;
  }

  const keys = Object.keys(value);
  if (keys.length === 0) {
    return <span className="text-[11px] text-gray-600">Empty</span>;
  }

  // Show key-value pairs for simple objects
  const displayPairs = keys.slice(0, 3).map((k) => {
    const v = value[k];
    const display =
      typeof v === "string" || typeof v === "number"
        ? String(v)
        : Array.isArray(v)
        ? `[${v.length}]`
        : "{...}";
    return `${k}: ${display}`;
  });

  return (
    <div className="text-[10px] text-gray-500 font-mono bg-gray-950/50 rounded px-2 py-1 truncate">
      {displayPairs.join(", ")}
      {keys.length > 3 && <span className="text-gray-600"> +{keys.length - 3} more</span>}
    </div>
  );
}

// ─── Optimized Field Row ───

function OptimizedFieldRow({
  field,
  onChangeValue,
}: {
  field: OptimizedField;
  onChangeValue: (field: string, value: any) => void;
}) {
  const isObject = field.type === "object";
  const isRemoved = field.action === "removed";
  const isLocked = field.action === "locked";

  return (
    <div
      className={cn(
        "p-2.5 rounded-lg border transition-all",
        isRemoved
          ? "border-red-500/20 bg-red-500/5 opacity-60"
          : isLocked
          ? "border-gray-800/40 bg-gray-900/30 opacity-70"
          : field.action === "auto_mapped"
          ? "border-amber-500/15 bg-amber-500/5"
          : field.action === "transformed"
          ? "border-blue-500/15 bg-blue-500/5"
          : "border-gray-800/30 bg-gray-900/20"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {isLocked && <Lock className="w-3 h-3 text-gray-600" />}
          <span className="text-[11px] font-medium text-gray-300">{field.label}</span>
          <span className="text-[9px] text-gray-600 font-mono">{field.field}</span>
        </div>
        <FieldActionBadge action={field.action} />
      </div>

      {field.reason && (
        <p className="text-[9px] text-gray-600 mb-1.5">{field.reason}</p>
      )}

      {!isRemoved && (
        <div>
          {field.editable && field.type === "enum" && field.enumValues ? (
            <select
              value={field.newValue || ""}
              onChange={(e) => onChangeValue(field.field, e.target.value)}
              className="w-full h-7 rounded-md bg-gray-950 border border-gray-800 text-[11px] text-gray-200 px-2 focus:outline-none focus:border-blue-500"
            >
              {field.enumValues.map((v) => (
                <option key={v} value={v}>
                  {field.enumLabels?.[v] || v}
                </option>
              ))}
            </select>
          ) : field.editable && field.type === "number" ? (
            <Input
              type="number"
              value={field.newValue || ""}
              onChange={(e) => onChangeValue(field.field, e.target.value)}
              className="h-7 bg-gray-950 border-gray-800 text-[11px] font-mono text-yellow-400"
            />
          ) : field.editable && field.type === "string" ? (
            <Input
              value={field.newValue || ""}
              onChange={(e) => onChangeValue(field.field, e.target.value)}
              className="h-7 bg-gray-950 border-gray-800 text-[11px]"
            />
          ) : isObject ? (
            <ObjectSummary value={field.newValue} />
          ) : (
            <div className="text-[11px] text-gray-500 font-mono truncate">
              {String(field.newValue ?? "—")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
