"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight, ChevronDown, Megaphone, Layers, Image as ImageIcon,
  Copy, Search, Loader2, Edit2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { InlineEditor } from "@/components/explorer/InlineEditor";
import { OBJECTIVE_LABELS } from "@/lib/meta-schema";
import { Campaign, AdSet, Ad } from "@/types";

type SortKey = 'name' | 'status' | 'objective' | 'budget' | 'created_time';

const SORT_LABELS: Record<string, string> = {
  'name:asc': 'Name A→Z',
  'name:desc': 'Name Z→A',
  'status:asc': 'Status',
  'objective:asc': 'Objective',
  'budget:desc': 'Budget ↓',
  'budget:asc': 'Budget ↑',
  'created_time:desc': 'Newest First',
  'created_time:asc': 'Oldest First',
};
type SortDir = 'asc' | 'desc';

interface CampaignTreeProps {
  panelOpen: boolean;
  loading: boolean;
  filteredCampaigns: Campaign[];
  expandedCampaigns: Set<string>;
  expandedAdSets: Set<string>;
  adSets: Record<string, AdSet[]>;
  ads: Record<string, Ad[]>;
  selectedItems: Map<string, { id: string; type: string; name: string }>;
  setSelectedItems: (items: Map<string, { id: string; type: string; name: string }>) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  debouncedSearch: string;
  sortKey: SortKey;
  sortDir: SortDir;
  setSortKey: (k: SortKey) => void;
  setSortDir: (d: SortDir) => void;
  editingId: string | null;
  editValue: string;
  setEditingId: (id: string | null) => void;
  setEditValue: (v: string) => void;
  updating: boolean;
  handleSelection: (id: string, type: string, name: string) => void;
  handleSelectAll: () => void;
  handleUpdateName: (id: string, type: 'CAMPAIGN' | 'ADSET' | 'AD', resolvedName: string) => void;
  toggleCampaign: (id: string) => void;
  toggleAdSet: (id: string) => void;
}

export function CampaignTree({
  panelOpen, loading, filteredCampaigns,
  expandedCampaigns, expandedAdSets, adSets, ads,
  selectedItems, setSelectedItems,
  searchQuery, setSearchQuery, debouncedSearch,
  sortKey, sortDir, setSortKey, setSortDir,
  editingId, editValue, setEditingId, setEditValue, updating,
  handleSelection, handleSelectAll, handleUpdateName,
  toggleCampaign, toggleAdSet,
}: CampaignTreeProps) {
  return (
    <div className={cn(
      "bg-gray-900/30 border border-gray-800/60 rounded-xl overflow-hidden flex flex-col",
      panelOpen ? "flex-1 min-w-0" : "w-full"
    )}>
      <div className="p-3 border-b border-gray-800/60 flex flex-col gap-1.5 bg-gray-900/50">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input type="text" placeholder="Search campaigns, ad sets, ads..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-950/50 border border-gray-800/60 rounded-lg py-2 pl-9 pr-8 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-gray-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 p-0.5">
                <span className="sr-only">Clear search</span>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <Select
            value={`${sortKey}:${sortDir}`}
            onValueChange={(v) => { if (!v) return; const parts = v.split(':'); setSortKey(parts[0] as SortKey); setSortDir((parts[1] || 'asc') as SortDir); }}
          >
            <SelectTrigger className="h-9 w-40 shrink-0 bg-blue-500/10 border-blue-500/20 text-blue-400 text-xs focus:ring-0">
              <SelectValue>{SORT_LABELS[`${sortKey}:${sortDir}`] || `${sortKey}:${sortDir}`}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              <SelectItem value="name:asc" className="text-xs text-gray-300">Name A→Z</SelectItem>
              <SelectItem value="name:desc" className="text-xs text-gray-300">Name Z→A</SelectItem>
              <SelectItem value="status:asc" className="text-xs text-gray-300">Status</SelectItem>
              <SelectItem value="objective:asc" className="text-xs text-gray-300">Objective</SelectItem>
              <SelectItem value="budget:desc" className="text-xs text-gray-300">Budget ↓</SelectItem>
              <SelectItem value="budget:asc" className="text-xs text-gray-300">Budget ↑</SelectItem>
              <SelectItem value="created_time:desc" className="text-xs text-gray-300">Newest First</SelectItem>
              <SelectItem value="created_time:asc" className="text-xs text-gray-300">Oldest First</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-300 text-xs h-8 shrink-0" onClick={handleSelectAll}>
            Select All
          </Button>
          {selectedItems.size > 0 && (
            <>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-500/15 text-blue-400">
                {selectedItems.size} selected
              </span>
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-400 text-xs h-8 shrink-0" onClick={() => setSelectedItems(new Map())}>
                Clear
              </Button>
            </>
          )}
        </div>
        {debouncedSearch && (
          <p className="text-[11px] text-gray-500 pl-1">
            Searches within expanded campaigns only — expand a campaign to include its ad sets and ads.
          </p>
        )}
      </div>

      <div className="overflow-auto flex-1">
        {loading ? (
          <div className="divide-y divide-gray-800/40">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-4 w-4 bg-gray-800/60 rounded animate-pulse" />
                <div className="h-3 w-3 bg-gray-800/60 rounded animate-pulse" />
                <div className="h-4 flex-1 bg-gray-800/60 rounded animate-pulse" style={{ maxWidth: `${40 + (i * 7) % 30}%` }} />
                <div className="h-4 w-16 bg-gray-800/60 rounded animate-pulse" />
                <div className="h-4 w-12 bg-gray-800/60 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm text-gray-400 font-medium">
              {debouncedSearch ? `No campaigns match "${debouncedSearch}"` : "No campaigns in this account"}
            </p>
            <p className="text-xs text-gray-500 mt-1.5">
              {debouncedSearch
                ? "Try clearing the search or switching ad accounts."
                : "Create a campaign in Meta Ads Manager — it will appear here when you refresh."}
            </p>
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
                      <InlineEditor id={campaign.id} type="CAMPAIGN"
                        context={{ campaign_name: campaign.name, objective: OBJECTIVE_LABELS[campaign.objective] || campaign.objective }}
                        editValue={editValue} onEditValueChange={setEditValue}
                        onSave={handleUpdateName} onCancel={() => setEditingId(null)} updating={updating} />
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
                        <button
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(campaign.id); toast.success('ID copied'); }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all shrink-0"
                          title={`Copy ID: ${campaign.id}`}>
                          <Copy className="w-3 h-3 text-gray-500" />
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
                      <div className="p-3 text-xs text-gray-500">No ad sets</div>
                    ) : (debouncedSearch
                      ? adSets[campaign.id].filter(as => {
                          const q = debouncedSearch.toLowerCase();
                          return as.name.toLowerCase().includes(q) ||
                            (ads[as.id] || []).some((ad: any) => ad.name.toLowerCase().includes(q));
                        })
                      : adSets[campaign.id]
                    ).map((adset) => (
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
                              <InlineEditor id={adset.id} type="ADSET"
                                context={{ adset_name: adset.name, campaign_name: campaign.name }}
                                editValue={editValue} onEditValueChange={setEditValue}
                                onSave={handleUpdateName} onCancel={() => setEditingId(null)} updating={updating} />
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-gray-300 truncate">{adset.name}</p>
                                <button onClick={(e) => { e.stopPropagation(); setEditingId(adset.id); setEditValue(adset.name); }}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all shrink-0">
                                  <Edit2 className="w-2.5 h-2.5 text-gray-500" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(adset.id); toast.success('ID copied'); }}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all shrink-0"
                                  title={`Copy ID: ${adset.id}`}>
                                  <Copy className="w-2.5 h-2.5 text-gray-500" />
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
                              <div className="p-2 pl-4 text-xs text-gray-500">No ads</div>
                            ) : (debouncedSearch
                              ? ads[adset.id].filter((ad: any) => ad.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
                              : ads[adset.id]
                            ).map((ad) => (
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
                                    <InlineEditor id={ad.id} type="AD"
                                      context={{ ad_name: ad.name, adset_name: adset.name }}
                                      editValue={editValue} onEditValueChange={setEditValue}
                                      onSave={handleUpdateName} onCancel={() => setEditingId(null)} updating={updating} />
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm text-gray-400 truncate">{ad.name}</p>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingId(ad.id); setEditValue(ad.name); }}
                                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all shrink-0">
                                          <Edit2 className="w-2.5 h-2.5 text-gray-600" />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(ad.id); toast.success('ID copied'); }}
                                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all shrink-0"
                                          title={`Copy ID: ${ad.id}`}>
                                          <Copy className="w-2.5 h-2.5 text-gray-600" />
                                        </button>
                                      </div>
                                      {ad.creative?.id && (
                                        <p
                                          className="text-[10px] text-gray-700 font-mono mt-0.5 cursor-pointer hover:text-blue-400 transition-colors"
                                          title="Click to copy creative_id"
                                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(ad.creative.id); toast.success('creative_id copied'); }}
                                        >
                                          ID: {ad.creative.id}
                                        </p>
                                      )}
                                    </>
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
  );
}
