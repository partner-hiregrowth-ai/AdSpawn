"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/store/useAppStore";
import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { adAccountApi, duplicationApi, draftApi } from "@/services/api";
import { Campaign, AdSet, Ad } from "@/types";
import {
  ChevronRight, ChevronDown, Megaphone, Layers, Image as ImageIcon,
  Copy, Search, Loader2, RefreshCw, Edit2, Check, X, FolderTree,
  Globe, Target, Coins, Zap, AlertTriangle, Info, ArrowRightLeft,
  PanelRightClose, PanelRightOpen, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NamingTemplateEditor } from "@/components/dashboard/NamingTemplateEditor";
import { NamingPreview } from "@/components/dashboard/NamingPreview";
import { MetaField } from "@/components/meta/MetaField";
import { OptimizedFieldRow } from "@/components/meta/OptimizedFieldRow";
import { FieldSummaryBadges } from "@/components/meta/FieldActionBadge";
import { ValidationBanner } from "@/components/meta/ValidationBanner";
import {
  OBJECTIVES, OBJECTIVE_LABELS, BID_STRATEGIES,
  VALID_OPTIMIZATION_GOALS, VALID_DESTINATION_TYPES,
  type OptimizedField,
} from "@/lib/meta-schema";

// ─── Small helpers ───

const StatusBadge = memo(({ status }: { status: string }) => (
  <span className={cn(
    "text-[10px] font-semibold px-2 py-0.5 rounded-full",
    status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400' :
    status === 'PAUSED' ? 'bg-amber-500/15 text-amber-400' :
    'bg-gray-800 text-gray-500'
  )}>
    {status === 'ACTIVE' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 pulse-dot" />}
    {status}
  </span>
));
StatusBadge.displayName = 'StatusBadge';

type PanelMode = 'duplicate' | 'convert';

// ─── Main page ───

export default function ExplorerPage() {
  const { selectedAccount } = useAppStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
  const [adSets, setAdSets] = useState<Record<string, AdSet[]>>({});
  const [ads, setAds] = useState<Record<string, Ad[]>>({});
  const [selectedItems, setSelectedItems] = useState<Map<string, { id: string; type: string; name: string }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [updating, setUpdating] = useState(false);

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('duplicate');

  // Duplicate settings
  const [renamePattern, setRenamePattern] = useState("{{campaign_name}}{{adset_name}}{{ad_name}} - Copy");
  const [numCopies, setNumCopies] = useState(1);
  const [customBudget, setCustomBudget] = useState("40");
  const [country, setCountry] = useState("TH");
  const [angle, setAngle] = useState("UGC");
  const [deep, setDeep] = useState(true);

  // Convert settings
  const [targetObjective, setTargetObjective] = useState("OUTCOME_TRAFFIC");
  const [convertName, setConvertName] = useState("");

  // Optimization state (shared)
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [overrides, setOverrides] = useState<Record<string, any>>({});

  // Action state
  const [duplicating, setDuplicating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedItemsList = useMemo(() => Array.from(selectedItems.values()), [selectedItems]);
  const hasCampaigns = selectedItemsList.some((item) => item.type === "CAMPAIGN");
  const isSingleItem = selectedItemsList.length === 1;
  const canConvert = isSingleItem && selectedItemsList[0]?.type === "CAMPAIGN";

  const previewContext = useMemo(() => ({
    country, angle, budget: customBudget,
    campaign_name: selectedItemsList.find((i) => i.type === "CAMPAIGN")?.name,
    adset_name: selectedItemsList.find((i) => i.type === "ADSET")?.name,
    ad_name: selectedItemsList.find((i) => i.type === "AD")?.name,
  }), [country, angle, customBudget, selectedItemsList]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedAccount) fetchCampaigns();
  }, [selectedAccount]);

  useEffect(() => {
    if (selectedItemsList.length > 0 && !panelOpen) setPanelOpen(true);
    if (selectedItemsList.length === 0) {
      setPanelOpen(false);
      resetOptimization();
    }
  }, [selectedItemsList.length]);

  useEffect(() => {
    if (selectedItemsList.length === 1) {
      setConvertName(`${selectedItemsList[0].name} - Converted`);
    }
  }, [selectedItemsList]);

  const filteredCampaigns = useMemo(() =>
    campaigns.filter(c =>
      c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      c.objective.toLowerCase().includes(debouncedSearch.toLowerCase())
    ), [campaigns, debouncedSearch]
  );

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const response = await adAccountApi.getCampaigns(selectedAccount!.id);
      setCampaigns(response.data);
    } catch { toast.error("Failed to fetch campaigns"); }
    finally { setLoading(false); }
  };

  const handleFullRefresh = async () => {
    setAdSets({}); setAds({});
    setExpandedCampaigns(new Set()); setExpandedAdSets(new Set());
    setSelectedItems(new Map());
    setSearchQuery(""); setEditingId(null);
    await fetchCampaigns();
    toast.success("Explorer refreshed");
  };

  const handleUpdateName = useCallback(async (id: string, type: 'CAMPAIGN' | 'ADSET' | 'AD') => {
    if (!editValue.trim()) return;
    const previousValue = editValue;
    if (type === 'CAMPAIGN') setCampaigns(prev => prev.map(c => c.id === id ? { ...c, name: editValue } : c));
    else if (type === 'ADSET') setAdSets(prev => { const n = { ...prev }; for (const k in n) n[k] = n[k].map(as => as.id === id ? { ...as, name: editValue } : as); return n; });
    else if (type === 'AD') setAds(prev => { const n = { ...prev }; for (const k in n) n[k] = n[k].map(ad => ad.id === id ? { ...ad, name: editValue } : ad); return n; });
    setEditingId(null);
    setUpdating(true);
    try { await adAccountApi.updateName(id, editValue); toast.success("Name updated"); }
    catch { toast.error("Failed to update name"); if (type === 'CAMPAIGN') setCampaigns(prev => prev.map(c => c.id === id ? { ...c, name: previousValue } : c)); }
    finally { setUpdating(false); }
  }, [editValue]);

  const toggleCampaign = useCallback(async (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignId)) { newExpanded.delete(campaignId); }
    else {
      newExpanded.add(campaignId);
      if (!adSets[campaignId]) {
        try { const r = await adAccountApi.getAdSets(campaignId); setAdSets(prev => ({ ...prev, [campaignId]: r.data })); }
        catch { toast.error("Failed to fetch ad sets"); }
      }
    }
    setExpandedCampaigns(newExpanded);
  }, [expandedCampaigns, adSets]);

  const toggleAdSet = useCallback(async (adSetId: string) => {
    const newExpanded = new Set(expandedAdSets);
    if (newExpanded.has(adSetId)) { newExpanded.delete(adSetId); }
    else {
      newExpanded.add(adSetId);
      if (!ads[adSetId]) {
        try { const r = await adAccountApi.getAds(adSetId); setAds(prev => ({ ...prev, [adSetId]: r.data })); }
        catch { toast.error("Failed to fetch ads"); }
      }
    }
    setExpandedAdSets(newExpanded);
  }, [expandedAdSets, ads]);

  const handleSelection = useCallback((id: string, type: string, name: string) => {
    setSelectedItems(prev => {
      const newSelected = new Map(prev);
      if (newSelected.has(id)) newSelected.delete(id);
      else newSelected.set(id, { id, type, name });
      return newSelected;
    });
  }, []);

  const resetOptimization = () => {
    setOptimizationData(null);
    setOverrides({});
  };

  // ─── Duplicate actions ───

  const handleAnalyzeForDuplicate = async () => {
    if (!isSingleItem) return;
    setOptimizing(true);
    try {
      const item = selectedItemsList[0];
      const resp = await duplicationApi.optimizeDuplicate({ type: item.type, id: item.id, overrides });
      setOptimizationData(resp.data);
    } catch (err: any) { toast.error(err.response?.data?.message || "Failed to analyze fields"); }
    finally { setOptimizing(false); }
  };

  const handleFieldChange = (entityKey: string, field: string, value: any) => {
    setOverrides(prev => ({ ...prev, [`${entityKey}.${field}`]: value }));
    if (!optimizationData) return;
    const updated = { ...optimizationData };
    const entity = entityKey === "campaign" ? updated.campaign : updated.adSets?.find((s: any) => s.sourceId === entityKey);
    if (!entity) return;
    const f = entity.fields?.find((fld: any) => fld.field === field);
    if (f) { f.newValue = value; f.action = "transformed"; }
    if (entity.payload) entity.payload[field] = value;
    setOptimizationData(updated);
  };

  const handleDuplicate = async () => {
    if (!selectedAccount?.id) { toast.error("No ad account selected"); return; }
    setDuplicating(true);
    try {
      await duplicationApi.duplicateBulk({
        items: selectedItemsList, adAccountId: selectedAccount.id,
        options: { numCopies, renamePattern, deep, customBudget: customBudget || undefined, context: { country, angle } },
      });
      toast.success(`Duplicated ${selectedItemsList.length * numCopies} items!`);
      setSelectedItems(new Map());
      setPanelOpen(false);
      resetOptimization();
      fetchCampaigns();
    } catch (err: any) { toast.error(err.response?.data?.message || "Failed to duplicate"); }
    finally { setDuplicating(false); }
  };

  const handleSaveDraft = async () => {
    if (selectedItemsList.some(i => i.type !== "CAMPAIGN")) { toast.error("Draft system only supports Campaigns"); return; }
    setSavingDraft(true);
    try {
      await Promise.all(selectedItemsList.map(item => draftApi.duplicateToDraft(item.id)));
      toast.success("Saved to Internal Drafts!");
      setSelectedItems(new Map());
      setPanelOpen(false);
      resetOptimization();
    } catch { toast.error("Failed to save draft"); }
    finally { setSavingDraft(false); }
  };

  // ─── Convert actions ───

  const handleAnalyzeForConvert = async () => {
    if (!isSingleItem) return;
    setOptimizing(true);
    try {
      const item = selectedItemsList[0];
      const resp = await duplicationApi.optimizeConversion({
        type: item.type, id: item.id, targetObjective, newName: convertName,
      });
      setOptimizationData(resp.data);
    } catch (err: any) { toast.error(err.response?.data?.message || "Failed to analyze conversion"); }
    finally { setOptimizing(false); }
  };

  const handleConvert = async (mode: "draft" | "publish") => {
    if (!selectedAccount?.id) return;
    setConverting(true);
    try {
      await duplicationApi.convertObjective({
        items: selectedItemsList, targetObjective,
        newName: convertName, adAccountId: selectedAccount.id,
        saveAsDraft: mode === "draft",
      });
      toast.success(mode === "draft" ? "Saved as draft!" : "Converted successfully!");
      setSelectedItems(new Map());
      setPanelOpen(false);
      resetOptimization();
      fetchCampaigns();
    } catch (err: any) { toast.error(err.response?.data?.message || "Failed to convert"); }
    finally { setConverting(false); }
  };

  const handleBulkDelete = async () => {
    const campaignIds = selectedItemsList.filter(i => i.type === 'CAMPAIGN').map(i => i.id);
    if (campaignIds.length === 0) {
      toast.error("Select campaigns to delete");
      return;
    }
    if (!confirm(`Delete ${campaignIds.length} campaign${campaignIds.length > 1 ? 's' : ''} from Meta? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const response = await adAccountApi.bulkDelete(campaignIds);
      toast.success(`${response.data.deleted} campaign${response.data.deleted !== 1 ? 's' : ''} deleted`);
      setSelectedItems(new Map());
      setPanelOpen(false);
      fetchCampaigns();
    } catch (err: any) { toast.error(err.response?.data?.message || "Delete failed"); }
    finally { setDeleting(false); }
  };

  const isBusy = duplicating || savingDraft || optimizing || converting || deleting;

  // ─── Inline editor ───

  const InlineEditor = ({ id, type }: { id: string; type: 'CAMPAIGN' | 'ADSET' | 'AD' }) => (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        className="h-7 bg-gray-950 border-gray-700 text-sm focus:border-blue-500"
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateName(id, type); if (e.key === 'Escape') setEditingId(null); }}
      />
      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10" onClick={() => handleUpdateName(id, type)} disabled={updating}>
        {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:bg-gray-800" onClick={() => setEditingId(null)} disabled={updating}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );

  // ─── Optimization fields display ───

  const allOptFields = optimizationData ? [
    ...(optimizationData.campaign?.fields || []),
    ...(optimizationData.adSets || []).flatMap((s: any) => s.fields || []),
  ] : [];

  const renderOptimizationSection = () => {
    if (!optimizationData) return null;
    const campaign = optimizationData.campaign;
    const adSetsList = optimizationData.adSets || [];

    return (
      <div className="space-y-4">
        <FieldSummaryBadges fields={allOptFields} />

        {panelMode === 'convert' && optimizationData.sourceObjective && (
          <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-lg flex gap-2 items-start">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-300">
              Converting from <strong>{OBJECTIVE_LABELS[optimizationData.sourceObjective] || optimizationData.sourceObjective}</strong> to{" "}
              <strong>{OBJECTIVE_LABELS[optimizationData.targetObjective] || optimizationData.targetObjective}</strong>.
              Edit any editable field before confirming.
            </p>
          </div>
        )}

        {campaign && (
          <div>
            <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-blue-400" /> Campaign Fields
            </h4>
            <ValidationBanner warnings={campaign.warnings} errors={campaign.errors} />
            <div className="space-y-1.5 mt-2">
              {campaign.fields?.map((f: OptimizedField) => (
                <OptimizedFieldRow key={f.field} field={f} compact
                  onChangeValue={(field, value) => handleFieldChange("campaign", field, value)} />
              ))}
            </div>
          </div>
        )}

        {adSetsList.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-purple-400" /> Ad Set Fields
              {optimizationData.totalAdSets > adSetsList.length && (
                <span className="text-[10px] text-gray-500">(showing {adSetsList.length} of {optimizationData.totalAdSets})</span>
              )}
            </h4>
            {adSetsList.map((adSet: any) => (
              <div key={adSet.sourceId} className="mb-3">
                <p className="text-[11px] text-gray-400 mb-1.5 font-medium">{adSet.sourceName}</p>
                <ValidationBanner warnings={adSet.warnings} errors={adSet.errors} />
                <div className="space-y-1.5 mt-1">
                  {adSet.fields?.map((f: OptimizedField) => (
                    <OptimizedFieldRow key={f.field} field={f} compact
                      onChangeValue={(field, value) => handleFieldChange(adSet.sourceId, field, value)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Panel: Duplicate tab ───

  const renderDuplicatePanel = () => (
    <div className="space-y-5">
      {/* Safety notice */}
      <div className="bg-amber-900/20 border border-amber-500/30 p-3 rounded-lg flex gap-2.5 text-amber-200">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="text-[11px]">New structures will be created as <strong>PAUSED</strong>.</p>
      </div>

      {/* Naming */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Naming</h3>
        <div className="space-y-3">
          <NamingTemplateEditor onPatternChange={setRenamePattern} initialPattern={renamePattern} type={hasCampaigns ? "CAMPAIGN" : "ALL"} />
          <NamingPreview pattern={renamePattern} context={previewContext} />
        </div>
      </section>

      {/* Settings */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Settings</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetaField label="Target Country" value={country} onChange={setCountry} placeholder="e.g. TH" />
          <MetaField label="Marketing Angle" value={angle} onChange={setAngle} placeholder="e.g. UGC" />
          <MetaField label="Copies" value={numCopies} type="number" onChange={(v: string) => setNumCopies(parseInt(v) || 1)} />
          <MetaField label="Daily Budget (THB)" value={customBudget} type="number" isBudget onChange={setCustomBudget} />
        </div>

        {hasCampaigns && (
          <div className="flex items-center space-x-2 bg-gray-950 p-3 rounded-lg border border-gray-800 mt-3">
            <Checkbox id="deep" checked={deep} onCheckedChange={(checked) => setDeep(!!checked)} />
            <div className="grid gap-1 leading-none">
              <label htmlFor="deep" className="text-xs font-medium">Deep Duplication</label>
              <p className="text-[10px] text-gray-500">Include all Ad Sets and Ads.</p>
            </div>
          </div>
        )}
      </section>

      {/* Optimization */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Field Optimization</h3>
          {isSingleItem && !optimizationData && (
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5 border-gray-700 text-gray-300"
              onClick={handleAnalyzeForDuplicate} disabled={optimizing}>
              {optimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Analyze Fields
            </Button>
          )}
        </div>

        {!isSingleItem && (
          <p className="text-[11px] text-gray-600">Field optimization is available for single-item duplicates.</p>
        )}

        {optimizationData && renderOptimizationSection()}
        {optimizing && (
          <div className="flex items-center gap-2 text-gray-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Analyzing fields...</span>
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="pt-3 border-t border-gray-800/40 space-y-2">
        <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2" onClick={handleDuplicate} disabled={isBusy}>
          {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
          {duplicating ? "Duplicating..." : "Duplicate Now"}
        </Button>
        <Button variant="outline" className="w-full border-blue-600/30 text-blue-400 hover:bg-blue-600/10 gap-2"
          onClick={handleSaveDraft} disabled={isBusy}>
          {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
          Save as Draft
        </Button>
      </section>
    </div>
  );

  // ─── Panel: Convert tab ───

  const renderConvertPanel = () => (
    <div className="space-y-5">
      <div className="bg-amber-900/20 border border-amber-500/30 p-3 rounded-lg flex gap-2.5 text-amber-200">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="text-[11px]">
          Incompatible fields will be automatically removed or remapped. New items will be <strong>PAUSED</strong>.
        </p>
      </div>

      {/* Objective selection */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Target Objective</h3>
        <div className="grid grid-cols-2 gap-2">
          {OBJECTIVES.map((obj) => (
            <button key={obj.value} onClick={() => { setTargetObjective(obj.value); resetOptimization(); }}
              className={cn(
                "p-3 rounded-lg border-2 text-left transition-all",
                targetObjective === obj.value
                  ? "border-blue-600 bg-blue-600/10"
                  : "border-gray-800 bg-gray-950 hover:border-gray-700"
              )}>
              <div className="text-xs font-bold text-gray-100">{obj.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{obj.description}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Name */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Configuration</h3>
        <MetaField label="New Campaign Name" value={convertName} onChange={setConvertName} placeholder="Enter new name..." />
      </section>

      {/* Optimization */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Field Optimization</h3>
          {!optimizationData && (
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5 border-gray-700 text-gray-300"
              onClick={handleAnalyzeForConvert} disabled={optimizing}>
              {optimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Analyze & Optimize
            </Button>
          )}
        </div>

        {optimizationData && renderOptimizationSection()}
        {optimizing && (
          <div className="flex items-center gap-2 text-gray-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Analyzing conversion...</span>
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="pt-3 border-t border-gray-800/40 space-y-2">
        <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
          onClick={() => handleConvert("publish")} disabled={isBusy || !optimizationData}>
          {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
          {converting ? "Converting..." : "Convert & Publish"}
        </Button>
        <Button variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 gap-2"
          onClick={() => handleConvert("draft")} disabled={isBusy || !optimizationData}>
          <Layers className="w-4 h-4" /> Save as Draft
        </Button>
      </section>
    </div>
  );

  // ─── Render ───

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">Campaign Explorer</h2>
            <p className="text-gray-500 mt-1 text-sm">Browse and select structures to duplicate or convert.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 border-gray-800 text-gray-400 hover:text-gray-200"
              onClick={handleFullRefresh} disabled={loading}>
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
            </Button>
            {selectedItems.size > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 border-gray-700 text-gray-400"
                onClick={() => setPanelOpen(!panelOpen)}>
                {panelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
                {panelOpen ? "Hide" : "Show"} Panel
              </Button>
            )}
          </div>
        </div>

        {!selectedAccount ? (
          <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-16 text-center">
            <FolderTree className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No account selected</p>
            <p className="text-gray-600 text-sm mt-1">Select an ad account from the dashboard first.</p>
            <Button variant="link" size="sm" className="text-blue-400 mt-3" onClick={() => window.location.href = '/dashboard'}>
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 gap-4 overflow-hidden">
            {/* ─── Left: Campaign tree ─── */}
            <div className={cn(
              "bg-gray-900/30 border border-gray-800/60 rounded-xl overflow-hidden flex flex-col transition-all",
              panelOpen ? "flex-1 min-w-0" : "w-full"
            )}>
              <div className="p-3 border-b border-gray-800/60 flex items-center gap-3 bg-gray-900/50">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input type="text" placeholder="Search campaigns..."
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-950/50 border border-gray-800/60 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-gray-700"
                  />
                </div>
                {searchQuery && (
                  <Button variant="ghost" size="sm" className="text-gray-500 text-xs h-8" onClick={() => setSearchQuery("")}>Clear</Button>
                )}
                {selectedItems.size > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-500/15 text-blue-400">
                    {selectedItems.size} selected
                  </span>
                )}
              </div>

              <div className="overflow-auto flex-1">
                {loading ? (
                  <div className="p-16 flex flex-col items-center justify-center text-gray-500 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" /><p className="text-sm">Loading campaigns...</p>
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <div className="p-16 text-center text-gray-600 text-sm">
                    {debouncedSearch ? `No results for "${debouncedSearch}"` : "No campaigns found in this account."}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800/40">
                    {filteredCampaigns.map((campaign) => (
                      <div key={campaign.id}>
                        <div className={cn(
                          "flex items-center gap-3 px-4 py-3 hover:bg-gray-800/30 transition-colors group",
                          selectedItems.has(campaign.id) && "bg-blue-500/5"
                        )}>
                          <Checkbox checked={selectedItems.has(campaign.id)}
                            onCheckedChange={() => handleSelection(campaign.id, 'CAMPAIGN', campaign.name)} />
                          <button onClick={() => toggleCampaign(campaign.id)} className="text-gray-600 hover:text-gray-300 transition-colors">
                            {expandedCampaigns.has(campaign.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Megaphone className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {editingId === campaign.id ? (
                              <InlineEditor id={campaign.id} type="CAMPAIGN" />
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-gray-200 truncate">{campaign.name}</p>
                                  <p className="text-[11px] text-gray-600">{OBJECTIVE_LABELS[campaign.objective] || campaign.objective}</p>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setEditingId(campaign.id); setEditValue(campaign.name); }}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all shrink-0">
                                  <Edit2 className="w-3 h-3 text-gray-500" />
                                </button>
                              </div>
                            )}
                          </div>
                          <StatusBadge status={campaign.status} />
                        </div>

                        {expandedCampaigns.has(campaign.id) && (
                          <div className="ml-[52px] border-l border-gray-800/40">
                            {!adSets[campaign.id] ? (
                              <div className="p-3 flex items-center gap-2 text-gray-600"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-xs">Loading...</span></div>
                            ) : adSets[campaign.id].length === 0 ? (
                              <div className="p-3 text-xs text-gray-700">No ad sets</div>
                            ) : adSets[campaign.id].map((adset) => (
                              <div key={adset.id}>
                                <div className={cn(
                                  "flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/20 transition-colors group",
                                  selectedItems.has(adset.id) && "bg-blue-500/5"
                                )}>
                                  <Checkbox checked={selectedItems.has(adset.id)}
                                    onCheckedChange={() => handleSelection(adset.id, 'ADSET', adset.name)} />
                                  <button onClick={() => toggleAdSet(adset.id)} className="text-gray-600 hover:text-gray-300 transition-colors">
                                    {expandedAdSets.has(adset.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </button>
                                  <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0">
                                    <Layers className="w-3 h-3 text-purple-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    {editingId === adset.id ? (
                                      <InlineEditor id={adset.id} type="ADSET" />
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm text-gray-300 truncate">{adset.name}</p>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingId(adset.id); setEditValue(adset.name); }}
                                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all shrink-0">
                                          <Edit2 className="w-2.5 h-2.5 text-gray-500" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <StatusBadge status={adset.status} />
                                </div>

                                {expandedAdSets.has(adset.id) && (
                                  <div className="ml-[48px] border-l border-gray-800/30">
                                    {!ads[adset.id] ? (
                                      <div className="p-2 pl-4 flex items-center gap-2 text-gray-600"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-xs">Loading...</span></div>
                                    ) : ads[adset.id].length === 0 ? (
                                      <div className="p-2 pl-4 text-xs text-gray-700">No ads</div>
                                    ) : ads[adset.id].map((ad) => (
                                      <div key={ad.id} className={cn(
                                        "flex items-center gap-3 py-2 pl-4 pr-4 hover:bg-gray-800/15 transition-colors group",
                                        selectedItems.has(ad.id) && "bg-blue-500/5"
                                      )}>
                                        <Checkbox checked={selectedItems.has(ad.id)}
                                          onCheckedChange={() => handleSelection(ad.id, 'AD', ad.name)} />
                                        <div className="w-5 h-5 rounded bg-pink-500/10 flex items-center justify-center shrink-0">
                                          <ImageIcon className="w-2.5 h-2.5 text-pink-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          {editingId === ad.id ? (
                                            <InlineEditor id={ad.id} type="AD" />
                                          ) : (
                                            <div className="flex items-center gap-2">
                                              <p className="text-sm text-gray-400 truncate">{ad.name}</p>
                                              <button onClick={(e) => { e.stopPropagation(); setEditingId(ad.id); setEditValue(ad.name); }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all shrink-0">
                                                <Edit2 className="w-2.5 h-2.5 text-gray-600" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                        <StatusBadge status={ad.status} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Right: Action panel ─── */}
            {panelOpen && selectedItems.size > 0 && (
              <div className="w-[420px] shrink-0 bg-gray-900/30 border border-gray-800/60 rounded-xl flex flex-col overflow-hidden">
                {/* Panel header */}
                <div className="p-3 border-b border-gray-800/60 bg-gray-900/50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                      {selectedItems.size} item{selectedItems.size > 1 ? "s" : ""}
                    </span>
                    <div className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-300"
                      onClick={() => setPanelOpen(false)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {/* Mode tabs */}
                  <div className="flex gap-1 bg-gray-950/50 rounded-lg p-0.5">
                    <button
                      onClick={() => { setPanelMode('duplicate'); resetOptimization(); }}
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5",
                        panelMode === 'duplicate' ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                      )}>
                      <Copy className="w-3 h-3" /> Duplicate
                    </button>
                    <button
                      onClick={() => { setPanelMode('convert'); resetOptimization(); }}
                      disabled={!canConvert}
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5",
                        panelMode === 'convert' ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-300",
                        !canConvert && "opacity-40 cursor-not-allowed"
                      )}>
                      <ArrowRightLeft className="w-3 h-3" /> Convert
                    </button>
                  </div>
                </div>

                {/* Delete button */}
                {selectedItemsList.some(i => i.type === 'CAMPAIGN') && (
                  <div className="px-4 pt-2">
                    <Button variant="outline" size="sm"
                      className="w-full border-red-800/50 text-red-400 hover:bg-red-600/10 hover:text-red-300 gap-2 h-8 text-xs"
                      onClick={handleBulkDelete} disabled={isBusy}>
                      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete {selectedItemsList.filter(i => i.type === 'CAMPAIGN').length} from Meta
                    </Button>
                  </div>
                )}

                {/* Panel body */}
                <div className="flex-1 overflow-y-auto p-4">
                  {panelMode === 'duplicate' && renderDuplicatePanel()}
                  {panelMode === 'convert' && renderConvertPanel()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
