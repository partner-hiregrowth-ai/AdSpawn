"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { adAccountApi } from "@/services/api";
import { Campaign, AdSet, Ad } from "@/types";
import {
  ChevronRight,
  ChevronDown,
  Megaphone,
  Layers,
  Image as ImageIcon,
  Copy,
  Search,
  Loader2,
  RefreshCw,
  Edit2,
  Check,
  X,
  FolderTree
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { DuplicateModal } from "@/components/dashboard/DuplicateModal";
import { ObjectiveConversionModal } from "@/components/dashboard/ObjectiveConversionModal";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

export default function ExplorerPage() {
  const { selectedAccount } = useAppStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
  const [adSets, setAdSets] = useState<Record<string, AdSet[]>>({});
  const [ads, setAds] = useState<Record<string, Ad[]>>({});
  const [selectedItems, setSelectedItems] = useState<Map<string, { id: string, type: string, name: string }>>(new Map());
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [updating, setUpdating] = useState(false);

  const selectedItemsList = useMemo(() => Array.from(selectedItems.values()), [selectedItems]);
  const canConvertObjective = selectedItemsList.length === 1 && selectedItemsList[0].type === 'CAMPAIGN';

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedAccount) {
      fetchCampaigns();
    }
  }, [selectedAccount]);

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
    } catch (error) {
      toast.error("Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  };

  const handleFullRefresh = async () => {
    setAdSets({});
    setAds({});
    setExpandedCampaigns(new Set());
    setExpandedAdSets(new Set());
    setSelectedItems(new Map());
    setSearchQuery("");
    setEditingId(null);
    await fetchCampaigns();
    toast.success("Explorer refreshed");
  };

  const handleUpdateName = useCallback(async (id: string, type: 'CAMPAIGN' | 'ADSET' | 'AD') => {
    if (!editValue.trim()) return;
    const previousValue = editValue;

    // Optimistic update
    if (type === 'CAMPAIGN') {
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, name: editValue } : c));
    } else if (type === 'ADSET') {
      setAdSets(prev => {
        const newState = { ...prev };
        for (const campaignId in newState) {
          newState[campaignId] = newState[campaignId].map(as => as.id === id ? { ...as, name: editValue } : as);
        }
        return newState;
      });
    } else if (type === 'AD') {
      setAds(prev => {
        const newState = { ...prev };
        for (const adsetId in newState) {
          newState[adsetId] = newState[adsetId].map(ad => ad.id === id ? { ...ad, name: editValue } : ad);
        }
        return newState;
      });
    }
    setEditingId(null);

    setUpdating(true);
    try {
      await adAccountApi.updateName(id, editValue);
      toast.success("Name updated");
    } catch (error) {
      toast.error("Failed to update name");
      // Revert optimistic update
      if (type === 'CAMPAIGN') {
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, name: previousValue } : c));
      }
    } finally {
      setUpdating(false);
    }
  }, [editValue]);

  const toggleCampaign = useCallback(async (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId);
    } else {
      newExpanded.add(campaignId);
      if (!adSets[campaignId]) {
        try {
          const response = await adAccountApi.getAdSets(campaignId);
          setAdSets(prev => ({ ...prev, [campaignId]: response.data }));
        } catch (error) {
          toast.error("Failed to fetch ad sets");
        }
      }
    }
    setExpandedCampaigns(newExpanded);
  }, [expandedCampaigns, adSets]);

  const toggleAdSet = useCallback(async (adSetId: string) => {
    const newExpanded = new Set(expandedAdSets);
    if (newExpanded.has(adSetId)) {
      newExpanded.delete(adSetId);
    } else {
      newExpanded.add(adSetId);
      if (!ads[adSetId]) {
        try {
          const response = await adAccountApi.getAds(adSetId);
          setAds(prev => ({ ...prev, [adSetId]: response.data }));
        } catch (error) {
          toast.error("Failed to fetch ads");
        }
      }
    }
    setExpandedAdSets(newExpanded);
  }, [expandedAdSets, ads]);

  const handleSelection = useCallback((id: string, type: string, name: string) => {
    setSelectedItems(prev => {
      const newSelected = new Map(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.set(id, { id, type, name });
      }
      return newSelected;
    });
  }, []);

  const InlineEditor = ({ id, type }: { id: string, type: 'CAMPAIGN' | 'ADSET' | 'AD' }) => (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        className="h-7 bg-gray-950 border-gray-700 text-sm focus:border-blue-500"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleUpdateName(id, type);
          if (e.key === 'Escape') setEditingId(null);
        }}
      />
      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10" onClick={() => handleUpdateName(id, type)} disabled={updating}>
        {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:bg-gray-800" onClick={() => setEditingId(null)} disabled={updating}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">Campaign Explorer</h2>
            <p className="text-gray-500 mt-1 text-sm">Browse and select structures to duplicate.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-gray-800 text-gray-400 hover:text-gray-200"
              onClick={handleFullRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
              onClick={() => setIsConversionModalOpen(true)}
              disabled={!canConvertObjective}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Convert Objective
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
              onClick={() => setIsDuplicateModalOpen(true)}
              disabled={selectedItems.size === 0}
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate ({selectedItems.size})
            </Button>
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
          <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl overflow-hidden">
            {/* Search bar */}
            <div className="p-3 border-b border-gray-800/60 flex items-center gap-3 bg-gray-900/50">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-950/50 border border-gray-800/60 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-gray-700"
                />
              </div>
              {searchQuery && (
                <Button variant="ghost" size="sm" className="text-gray-500 text-xs h-8" onClick={() => setSearchQuery("")}>
                  Clear
                </Button>
              )}
            </div>

            {/* Tree */}
            <div className="overflow-auto max-h-[calc(100vh-260px)]">
              {loading ? (
                <div className="p-16 flex flex-col items-center justify-center text-gray-500 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <p className="text-sm">Loading campaigns...</p>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="p-16 text-center text-gray-600 text-sm">
                  {debouncedSearch ? `No results for "${debouncedSearch}"` : "No campaigns found in this account."}
                </div>
              ) : (
                <div className="divide-y divide-gray-800/40">
                  {filteredCampaigns.map((campaign) => (
                    <div key={campaign.id}>
                      {/* Campaign Row */}
                      <div className={cn(
                        "flex items-center gap-3 px-4 py-3 hover:bg-gray-800/30 transition-colors group",
                        selectedItems.has(campaign.id) && "bg-blue-500/5"
                      )}>
                        <Checkbox
                          checked={selectedItems.has(campaign.id)}
                          onCheckedChange={() => handleSelection(campaign.id, 'CAMPAIGN', campaign.name)}
                        />
                        <button
                          onClick={() => toggleCampaign(campaign.id)}
                          className="text-gray-600 hover:text-gray-300 transition-colors"
                        >
                          {expandedCampaigns.has(campaign.id)
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />
                          }
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
                                <p className="text-[11px] text-gray-600">{campaign.objective}</p>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingId(campaign.id); setEditValue(campaign.name); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all shrink-0"
                              >
                                <Edit2 className="w-3 h-3 text-gray-500" />
                              </button>
                            </div>
                          )}
                        </div>
                        <StatusBadge status={campaign.status} />
                      </div>

                      {/* Ad Sets */}
                      {expandedCampaigns.has(campaign.id) && (
                        <div className="ml-[52px] border-l border-gray-800/40">
                          {!adSets[campaign.id] ? (
                            <div className="p-3 flex items-center gap-2 text-gray-600">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span className="text-xs">Loading...</span>
                            </div>
                          ) : adSets[campaign.id].length === 0 ? (
                            <div className="p-3 text-xs text-gray-700">No ad sets</div>
                          ) : adSets[campaign.id].map((adset) => (
                            <div key={adset.id}>
                              <div className={cn(
                                "flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/20 transition-colors group",
                                selectedItems.has(adset.id) && "bg-blue-500/5"
                              )}>
                                <Checkbox
                                  checked={selectedItems.has(adset.id)}
                                  onCheckedChange={() => handleSelection(adset.id, 'ADSET', adset.name)}
                                />
                                <button
                                  onClick={() => toggleAdSet(adset.id)}
                                  className="text-gray-600 hover:text-gray-300 transition-colors"
                                >
                                  {expandedAdSets.has(adset.id)
                                    ? <ChevronDown className="w-3.5 h-3.5" />
                                    : <ChevronRight className="w-3.5 h-3.5" />
                                  }
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
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setEditingId(adset.id); setEditValue(adset.name); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all shrink-0"
                                      >
                                        <Edit2 className="w-2.5 h-2.5 text-gray-500" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <StatusBadge status={adset.status} />
                              </div>

                              {/* Ads */}
                              {expandedAdSets.has(adset.id) && (
                                <div className="ml-[48px] border-l border-gray-800/30">
                                  {!ads[adset.id] ? (
                                    <div className="p-2 pl-4 flex items-center gap-2 text-gray-600">
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span className="text-xs">Loading...</span>
                                    </div>
                                  ) : ads[adset.id].length === 0 ? (
                                    <div className="p-2 pl-4 text-xs text-gray-700">No ads</div>
                                  ) : ads[adset.id].map((ad) => (
                                    <div key={ad.id} className={cn(
                                      "flex items-center gap-3 py-2 pl-4 pr-4 hover:bg-gray-800/15 transition-colors group",
                                      selectedItems.has(ad.id) && "bg-blue-500/5"
                                    )}>
                                      <Checkbox
                                        checked={selectedItems.has(ad.id)}
                                        onCheckedChange={() => handleSelection(ad.id, 'AD', ad.name)}
                                      />
                                      <div className="w-5 h-5 rounded bg-pink-500/10 flex items-center justify-center shrink-0">
                                        <ImageIcon className="w-2.5 h-2.5 text-pink-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        {editingId === ad.id ? (
                                          <InlineEditor id={ad.id} type="AD" />
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm text-gray-400 truncate">{ad.name}</p>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setEditingId(ad.id); setEditValue(ad.name); }}
                                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all shrink-0"
                                            >
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
        )}
      </div>

      <DuplicateModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        selectedItems={selectedItemsList}
        adAccountId={selectedAccount?.id || ""}
        onSuccess={() => {
          setSelectedItems(new Map());
          fetchCampaigns();
        }}
      />

      <ObjectiveConversionModal
        isOpen={isConversionModalOpen}
        onClose={() => setIsConversionModalOpen(false)}
        selectedItems={selectedItemsList}
        adAccountId={selectedAccount?.id || ""}
        onSuccess={() => {
          setSelectedItems(new Map());
          fetchCampaigns();
        }}
      />
    </DashboardLayout>
  );
}
