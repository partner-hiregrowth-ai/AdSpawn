"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { adAccountApi, duplicationApi, draftApi } from "@/services/api";
import { Campaign, AdSet, Ad } from "@/types";
import { OptimizedField } from "@/lib/meta-schema";
import {
  RefreshCw, FolderTree, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { toast } from "sonner";
import { cn, extractApiError } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CampaignTree } from "@/components/explorer/CampaignTree";
import { ActionPanel } from "@/components/explorer/ActionPanel";

type PanelMode = 'duplicate' | 'convert';

// ─── Main page ───

export default function ExplorerPage() {
  const { selectedAccount, adAccounts } = useAppStore();
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
  const [renamePattern, setRenamePattern] = useState("{{campaign_name}}{{adset_name}}{{ad_name}} - Copy {{iteration_number}}");
  const [numCopies, setNumCopies] = useState(1);

  const [country, setCountry] = useState("TH");
  const [angle, setAngle] = useState("UGC");
  const [deep, setDeep] = useState(true);

  // Convert settings
  const [targetObjective, setTargetObjective] = useState("OUTCOME_TRAFFIC");
  const [convertName, setConvertName] = useState("");
  const [destAccountId, setDestAccountId] = useState<string | null>(null);

  // Optimization state (shared)
  const [optimizing, setOptimizing] = useState(false);
  interface LocalOptData {
    campaign?: { sourceId?: string; fields?: OptimizedField[]; payload?: Record<string, unknown> };
    adSets?: { sourceId?: string; fields?: OptimizedField[]; payload?: Record<string, unknown> }[];
  }
  const [optimizationData, setOptimizationData] = useState<LocalOptData | null>(null);
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});

  // Action state
  const [duplicating, setDuplicating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'activate' | 'pause' | null>(null);
  const [sortKey, setSortKey] = useState<'name' | 'status' | 'objective' | 'budget' | 'created_time'>('created_time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const selectedItemsList = useMemo(() => Array.from(selectedItems.values()), [selectedItems]);
  const hasCampaigns = selectedItemsList.some((item) => item.type === "CAMPAIGN");
  const isSingleItem = selectedItemsList.length === 1;
  const canConvert = isSingleItem && selectedItemsList[0]?.type === "CAMPAIGN";

  const previewContext = useMemo(() => ({
    country, angle,
    campaign_name: selectedItemsList.find((i) => i.type === "CAMPAIGN")?.name,
    adset_name: selectedItemsList.find((i) => i.type === "ADSET")?.name,
    ad_name: selectedItemsList.find((i) => i.type === "AD")?.name,
  }), [country, angle, selectedItemsList]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedAccount) {
      setAdSets({});
      setAds({});
      setExpandedCampaigns(new Set());
      setExpandedAdSets(new Set());
      setSelectedItems(new Map());
      setDestAccountId(selectedAccount.id);
      fetchCampaigns();
    }
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

  // Snapshot adSets/ads refs so this effect only re-fires when the search term itself changes.
  // Without this, expanding a campaign mutates adSets and re-triggers the expansion sweep needlessly.
  const adSetsRef = useRef(adSets);
  const adsRef = useRef(ads);
  adSetsRef.current = adSets;
  adsRef.current = ads;
  useEffect(() => {
    if (!debouncedSearch) return;
    const q = debouncedSearch.toLowerCase();
    const toExpandC = new Set<string>();
    const toExpandAS = new Set<string>();
    for (const [cid, asList] of Object.entries(adSetsRef.current)) {
      for (const as of asList) {
        if (as.name.toLowerCase().includes(q)) toExpandC.add(cid);
        if ((adsRef.current[as.id] || []).some((ad) => ad.name.toLowerCase().includes(q))) {
          toExpandC.add(cid);
          toExpandAS.add(as.id);
        }
      }
    }
    if (toExpandC.size) setExpandedCampaigns(prev => new Set([...prev, ...toExpandC]));
    if (toExpandAS.size) setExpandedAdSets(prev => new Set([...prev, ...toExpandAS]));
  }, [debouncedSearch]);


  const filteredCampaigns = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const filtered = !q ? campaigns : campaigns.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.objective.toLowerCase().includes(q) ||
      (adSets[c.id] || []).some(as =>
        as.name.toLowerCase().includes(q) ||
        (ads[as.id] || []).some(ad => ad.name.toLowerCase().includes(q))
      )
    );
    return [...filtered].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'status': va = a.status; vb = b.status; break;
        case 'objective': va = a.objective; vb = b.objective; break;
        case 'budget':
          va = parseFloat(a.daily_budget || a.lifetime_budget || '0');
          vb = parseFloat(b.daily_budget || b.lifetime_budget || '0');
          break;
        case 'created_time':
          va = a.created_time || '';
          vb = b.created_time || '';
          break;
        default: va = a.name.toLowerCase(); vb = b.name.toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [campaigns, adSets, ads, debouncedSearch, sortKey, sortDir]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const response = await adAccountApi.getCampaigns(selectedAccount!.id);
      setCampaigns(response.data);
    } catch (err: unknown) { toast.error(extractApiError(err, "Failed to fetch campaigns")); }
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

  const handleUpdateName = useCallback(async (id: string, type: 'CAMPAIGN' | 'ADSET' | 'AD', resolvedName: string) => {
    if (!resolvedName.trim()) return;
    if (type === 'CAMPAIGN') setCampaigns(prev => prev.map(c => c.id === id ? { ...c, name: resolvedName } : c));
    else if (type === 'ADSET') setAdSets(prev => { const n = { ...prev }; for (const k in n) n[k] = n[k].map(as => as.id === id ? { ...as, name: resolvedName } : as); return n; });
    else if (type === 'AD') setAds(prev => { const n = { ...prev }; for (const k in n) n[k] = n[k].map(ad => ad.id === id ? { ...ad, name: resolvedName } : ad); return n; });
    setEditingId(null);
    setUpdating(true);
    try { await adAccountApi.updateName(id, resolvedName); toast.success("Name updated"); }
    catch (err: any) { toast.error(extractApiError(err, "Couldn't rename. The name may be invalid or the item no longer exists.")); }
    finally { setUpdating(false); }
  }, []);

  const toggleCampaign = useCallback(async (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignId)) { newExpanded.delete(campaignId); }
    else {
      newExpanded.add(campaignId);
      if (!adSets[campaignId]) {
        try { const r = await adAccountApi.getAdSets(campaignId); setAdSets(prev => ({ ...prev, [campaignId]: r.data })); }
        catch (err: any) { toast.error(extractApiError(err, "Failed to fetch ad sets")); }
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
        catch (err: any) { toast.error(extractApiError(err, "Failed to fetch ads")); }
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
    resetOptimization();
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
    } catch (err: unknown) { toast.error(extractApiError(err, "Failed to analyze fields")); }
    finally { setOptimizing(false); }
  };

  const handleFieldChange = (entityKey: string, field: string, value: unknown) => {
    setOverrides(prev => ({ ...prev, [`${entityKey}.${field}`]: value }));
    if (!optimizationData) return;
    const updated = { ...optimizationData };
    const entity = entityKey === "campaign" ? updated.campaign : updated.adSets?.find((s) => s.sourceId === entityKey);
    if (!entity) return;
    const f = entity.fields?.find((fld) => fld.field === field);
    if (f) { f.newValue = value; f.action = "transformed"; }
    if (entity.payload) entity.payload[field] = value;
    setOptimizationData(updated);
  };

  const handleDuplicate = async () => {
    const targetAccId = destAccountId || selectedAccount?.id;
    if (!targetAccId) { toast.error("No destination account selected. Pick one above."); return; }
    setDuplicating(true);
    try {
      const resp = await duplicationApi.duplicateBulk({
        items: selectedItemsList, adAccountId: targetAccId,
        options: { numCopies, renamePattern, deep, context: { country, angle } },
      });
      const { requested, created, failed, failures } = resp.data || {};
      if (failed && failed > 0) {
        const firstErr = failures?.[0]?.error || "unknown error";
        toast.error(`Created ${created}/${requested} copies. ${failed} failed — first error: ${firstErr}`);
      } else {
        toast.success(`Created ${created} cop${created === 1 ? "y" : "ies"} on Meta (paused).`);
      }
      setSelectedItems(new Map());
      setPanelOpen(false);
      resetOptimization();
      fetchCampaigns();
    } catch (err: unknown) { toast.error(extractApiError(err, "Couldn't start the duplicate job. Check your Facebook connection and try again.")); }
    finally { setDuplicating(false); }
  };

  const handleSaveDraft = async () => {
    if (selectedItemsList.some(i => i.type !== "CAMPAIGN")) { toast.error("Draft system only supports Campaigns"); return; }
    setSavingDraft(true);
    try {
      const results = await Promise.allSettled(
        selectedItemsList.map(item => draftApi.duplicateToDraft(item.id, numCopies))
      );
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
            const reason = r.reason as { response?: { data?: { error?: string } }; message?: string };
          firstErr = reason?.response?.data?.error
              || reason?.message
              || "unknown error";
          }
        }
      }
      if (totalCreated === totalRequested) {
        toast.success(`Saved ${totalCreated} draft${totalCreated === 1 ? "" : "s"} to Internal Drafts.`);
        setSelectedItems(new Map());
        setPanelOpen(false);
        resetOptimization();
      } else {
        toast.error(`${totalCreated}/${totalRequested} drafts created. First error: ${firstErr || "unknown error"}`);
        if (totalCreated > 0) {
          setSelectedItems(new Map());
          setPanelOpen(false);
          resetOptimization();
        }
      }
    }
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
    } catch (err: unknown) { toast.error(extractApiError(err, "Failed to analyze conversion")); }
    finally { setOptimizing(false); }
  };

  const handleConvert = async (mode: "draft" | "publish") => {
    const targetAccId = destAccountId || selectedAccount?.id;
    if (!targetAccId) { toast.error("No destination account selected"); return; }
    setConverting(true);
    try {
      await duplicationApi.convertObjective({
        items: selectedItemsList, targetObjective,
        newName: convertName, adAccountId: targetAccId,
        saveAsDraft: mode === "draft",
      });
      toast.success(mode === "draft" ? "Saved as draft!" : "Converted successfully!");
      setSelectedItems(new Map());
      setPanelOpen(false);
      resetOptimization();
      fetchCampaigns();
    } catch (err: unknown) { toast.error(extractApiError(err, "Failed to convert")); }
    finally { setConverting(false); }
  };

  const selectionLabel = useMemo(() => {
    const counts = {
      CAMPAIGN: selectedItemsList.filter(i => i.type === 'CAMPAIGN').length,
      ADSET: selectedItemsList.filter(i => i.type === 'ADSET').length,
      AD: selectedItemsList.filter(i => i.type === 'AD').length,
    };
    return [
      counts.CAMPAIGN > 0 && `${counts.CAMPAIGN} campaign${counts.CAMPAIGN > 1 ? 's' : ''}`,
      counts.ADSET > 0 && `${counts.ADSET} ad set${counts.ADSET > 1 ? 's' : ''}`,
      counts.AD > 0 && `${counts.AD} ad${counts.AD > 1 ? 's' : ''}`,
    ].filter(Boolean).join(', ');
  }, [selectedItemsList]);

  const handleBulkDelete = async () => {
    const allIds = selectedItemsList.map(i => i.id);
    if (allIds.length === 0) return;
    const hasCampaign = selectedItemsList.some(i => i.type === 'CAMPAIGN');
    const hasAdSet = selectedItemsList.some(i => i.type === 'ADSET');
    const hasAd = selectedItemsList.some(i => i.type === 'AD');
    setDeleting(true);
    try {
      const response = await adAccountApi.bulkDelete(allIds);
      const results: { id: string; success: boolean }[] = response.data.results;
      const successIds = new Set(results.filter((r) => r.success).map((r) => r.id));
      toast.success(`${response.data.deleted} item${response.data.deleted !== 1 ? 's' : ''} deleted`);

      setSelectedItems(new Map());
      setPanelOpen(false);

      if (hasCampaign) fetchCampaigns();
      if (hasAdSet) {
        setAdSets(prev => {
          const next = { ...prev };
          for (const key in next) next[key] = next[key].filter(as => !successIds.has(as.id));
          return next;
        });
      }
      if (hasAd) {
        setAds(prev => {
          const next = { ...prev };
          for (const key in next) next[key] = next[key].filter(ad => !successIds.has(ad.id));
          return next;
        });
      }
    } catch (err: unknown) { toast.error(extractApiError(err, "Delete failed")); }
    finally { setDeleting(false); setConfirmAction(null); }
  };

  const handleBulkActivate = async () => {
    const allIds = selectedItemsList.map(i => i.id);
    if (allIds.length === 0) return;
    setActivating(true);
    try {
      const response = await adAccountApi.bulkActivate(allIds);
      const activateResults: { id: string; success: boolean }[] = response.data.results;
      const successIds = new Set(activateResults.filter((r) => r.success).map((r) => r.id));
      toast.success(`${response.data.activated} item${response.data.activated !== 1 ? 's' : ''} activated`);

      setSelectedItems(new Map());
      setPanelOpen(false);

      setCampaigns(prev => prev.map(c => successIds.has(c.id) ? { ...c, status: 'ACTIVE' } : c));
      setAdSets(prev => {
        const next = { ...prev };
        for (const key in next) next[key] = next[key].map(as => successIds.has(as.id) ? { ...as, status: 'ACTIVE' } : as);
        return next;
      });
      setAds(prev => {
        const next = { ...prev };
        for (const key in next) next[key] = next[key].map(ad => successIds.has(ad.id) ? { ...ad, status: 'ACTIVE' } : ad);
        return next;
      });
    } catch (err: unknown) { toast.error(extractApiError(err, "Activate failed")); }
    finally { setActivating(false); setConfirmAction(null); }
  };

  const handleBulkPause = async () => {
    const allIds = selectedItemsList.map(i => i.id);
    if (allIds.length === 0) return;
    setPausing(true);
    try {
      const response = await adAccountApi.bulkPause(allIds);
      const pauseResults: { id: string; success: boolean }[] = response.data.results;
      const successIds = new Set(pauseResults.filter((r) => r.success).map((r) => r.id));
      toast.success(`${response.data.paused} item${response.data.paused !== 1 ? 's' : ''} paused`);

      setSelectedItems(new Map());
      setPanelOpen(false);

      setCampaigns(prev => prev.map(c => successIds.has(c.id) ? { ...c, status: 'PAUSED' } : c));
      setAdSets(prev => {
        const next = { ...prev };
        for (const key in next) next[key] = next[key].map(as => successIds.has(as.id) ? { ...as, status: 'PAUSED' } : as);
        return next;
      });
      setAds(prev => {
        const next = { ...prev };
        for (const key in next) next[key] = next[key].map(ad => successIds.has(ad.id) ? { ...ad, status: 'PAUSED' } : ad);
        return next;
      });
    } catch (err: unknown) { toast.error(extractApiError(err, "Pause failed")); }
    finally { setPausing(false); setConfirmAction(null); }
  };

  const handleSelectAll = () => {
    const newSelected = new Map<string, { id: string; type: string; name: string }>();
    filteredCampaigns.forEach(c => newSelected.set(c.id, { id: c.id, type: 'CAMPAIGN', name: c.name }));
    Object.values(adSets).flat().forEach(as => newSelected.set(as.id, { id: as.id, type: 'ADSET', name: as.name }));
    Object.values(ads).flat().forEach(ad => newSelected.set(ad.id, { id: ad.id, type: 'AD', name: ad.name }));
    setSelectedItems(newSelected);
  };

  const isBusy = duplicating || savingDraft || optimizing || converting || deleting || activating || pausing;

  // ─── Inline editor ───

  const allOptFields: OptimizedField[] = optimizationData ? [
    ...(optimizationData.campaign?.fields || []),
    ...(optimizationData.adSets || []).flatMap((s) => s.fields || []),
  ] : [];

  // ─── Render ───

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:h-full">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-gray-100">Campaign Explorer</h2>
            <p className="text-gray-500 mt-1 text-sm">Browse and select structures to duplicate or convert.</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
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
          <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-8 sm:p-16 text-center">
            <FolderTree className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No account selected</p>
            <p className="text-gray-500 text-sm mt-1">Select an ad account from the dashboard first.</p>
            <Button variant="link" size="sm" className="text-blue-400 mt-3" onClick={() => window.location.href = '/dashboard'}>
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row flex-1 gap-4 min-h-0 lg:overflow-hidden">
            <CampaignTree
              panelOpen={panelOpen} loading={loading}
              filteredCampaigns={filteredCampaigns}
              expandedCampaigns={expandedCampaigns} expandedAdSets={expandedAdSets}
              adSets={adSets} ads={ads}
              selectedItems={selectedItems} setSelectedItems={setSelectedItems}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery} debouncedSearch={debouncedSearch}
              sortKey={sortKey} sortDir={sortDir} setSortKey={setSortKey} setSortDir={setSortDir}
              editingId={editingId} editValue={editValue} setEditingId={setEditingId} setEditValue={setEditValue} updating={updating}
              handleSelection={handleSelection} handleSelectAll={handleSelectAll}
              handleUpdateName={handleUpdateName} toggleCampaign={toggleCampaign} toggleAdSet={toggleAdSet}
            />

            {panelOpen && selectedItems.size > 0 && (
              <ActionPanel
                selectedItems={selectedItems} selectedItemsList={selectedItemsList}
                panelMode={panelMode} setPanelMode={setPanelMode} setPanelOpen={setPanelOpen}
                canConvert={canConvert} isBusy={isBusy} isSingleItem={isSingleItem} hasCampaigns={hasCampaigns}
                setConfirmAction={setConfirmAction}
                activating={activating} pausing={pausing} deleting={deleting}
                duplicating={duplicating} savingDraft={savingDraft} converting={converting} optimizing={optimizing}
                optimizationData={optimizationData} allOptFields={allOptFields} handleFieldChange={handleFieldChange}
                renamePattern={renamePattern} setRenamePattern={setRenamePattern} previewContext={previewContext}
                country={country} setCountry={setCountry} angle={angle} setAngle={setAngle}
                numCopies={numCopies} setNumCopies={setNumCopies}
                destAccountId={destAccountId} setDestAccountId={setDestAccountId}
                adAccounts={adAccounts} selectedAccount={selectedAccount}
                deep={deep} setDeep={setDeep}
                handleAnalyzeForDuplicate={handleAnalyzeForDuplicate} handleAnalyzeForConvert={handleAnalyzeForConvert}
                handleDuplicate={handleDuplicate} handleSaveDraft={handleSaveDraft} handleConvert={handleConvert}
                resetOptimization={resetOptimization}
                targetObjective={targetObjective} setTargetObjective={setTargetObjective}
                convertName={convertName} setConvertName={setConvertName}
              />
            )}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmAction === 'delete'}
        onOpenChange={() => setConfirmAction(null)}
        title="Delete from Meta"
        description={`Delete ${selectionLabel} from Meta? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleBulkDelete}
        isLoading={deleting}
      />
      <ConfirmDialog
        open={confirmAction === 'activate'}
        onOpenChange={() => setConfirmAction(null)}
        title="Activate on Meta"
        description={`Set ${selectionLabel} to ACTIVE on Meta? They will start running immediately.`}
        confirmLabel="Activate"
        variant="warning"
        onConfirm={handleBulkActivate}
        isLoading={activating}
      />
      <ConfirmDialog
        open={confirmAction === 'pause'}
        onOpenChange={() => setConfirmAction(null)}
        title="Pause on Meta"
        description={`Pause ${selectionLabel} on Meta?`}
        confirmLabel="Pause"
        onConfirm={handleBulkPause}
        isLoading={pausing}
      />
    </DashboardLayout>
  );
}
