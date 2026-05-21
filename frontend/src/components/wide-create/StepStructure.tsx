"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWideCreationStore } from "@/store/useWideCreationStore";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Layers,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Sales",
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_APP_PROMOTION: "App Promotion",
};

const OBJECTIVE_COLORS: Record<string, string> = {
  OUTCOME_TRAFFIC: "text-blue-400",
  OUTCOME_LEADS: "text-green-400",
  OUTCOME_SALES: "text-orange-400",
  OUTCOME_AWARENESS: "text-purple-400",
  OUTCOME_ENGAGEMENT: "text-pink-400",
  OUTCOME_APP_PROMOTION: "text-cyan-400",
};

export function StepStructure() {
  const store = useWideCreationStore();
  const objectives = store.getObjectives();

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300">
            Generated Structure Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-4">
            Review the generated tree. You can add/remove ad sets and ads before configuring fields.
          </p>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {objectives.map((objective) => {
              const campaigns = store.getCampaignsByObjective(objective);
              return (
                <div key={objective} className="space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`${OBJECTIVE_COLORS[objective]} bg-transparent border border-current/30 text-xs`}>
                      {OBJECTIVE_LABELS[objective] || objective}
                    </Badge>
                    <span className="text-xs text-gray-600">
                      {campaigns.length} campaign{campaigns.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {campaigns.map((campaign, ci) => (
                    <CampaignNode key={campaign.id} campaign={campaign} index={ci} objective={objective} />
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CampaignNode({ campaign, index, objective }: { campaign: any; index: number; objective: string }) {
  const store = useWideCreationStore();
  const expanded = store.expandedIds.has(campaign.id);
  const color = OBJECTIVE_COLORS[objective] || "text-gray-400";

  return (
    <div className="ml-2">
      <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/50">
        <button
          onClick={() => store.toggleExpand(campaign.id)}
          className="text-gray-500"
          aria-label={expanded ? "Collapse campaign" : "Expand campaign"}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <FolderTree className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs text-gray-300">
          {OBJECTIVE_LABELS[objective]} Campaign {index + 1}
        </span>
        <span className="text-[10px] text-gray-600">
          ({campaign.adSets.length} ad sets, {campaign.adSets.reduce((s: number, as: any) => s + as.ads.length, 0)} ads)
        </span>
        <div className="flex-1" />
        <button
          onClick={() => store.addAdSet(campaign.id)}
          className="text-gray-600 hover:text-gray-400 p-0.5"
          title="Add Ad Set"
          aria-label="Add ad set"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="ml-6 border-l border-gray-800 pl-2 space-y-0.5">
          {campaign.adSets.map((adSet: any, ai: number) => (
            <div key={adSet.id}>
              <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-800/30">
                <Layers className="w-3 h-3 text-green-400/70" />
                <span className="text-[11px] text-gray-400">Ad Set {ai + 1}</span>
                <span className="text-[10px] text-gray-600">({adSet.ads.length} ads)</span>
                <div className="flex-1" />
                <button
                  onClick={() => store.addAd(campaign.id, adSet.id)}
                  className="text-gray-600 hover:text-gray-400 p-0.5"
                  title="Add Ad"
                  aria-label="Add ad"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => store.removeAdSet(campaign.id, adSet.id)}
                  className="text-red-500/30 hover:text-red-400 p-0.5"
                  title="Remove"
                  aria-label="Remove ad set"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
              <div className="ml-5 space-y-0.5">
                {adSet.ads.map((ad: any, adi: number) => (
                  <div key={ad.id} className="flex items-center gap-2 py-0.5 px-2 text-[10px] text-gray-500">
                    <FileText className="w-2.5 h-2.5 text-purple-400/50" />
                    <span>Ad {adi + 1}</span>
                    <div className="flex-1" />
                    <button
                      onClick={() => store.removeAd(campaign.id, adSet.id, ad.id)}
                      className="text-red-500/20 hover:text-red-400 p-0.5"
                      aria-label="Remove ad"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
