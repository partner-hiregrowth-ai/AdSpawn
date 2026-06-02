"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useWideCreationStore,
  nodeIdFor,
  type WideCampaignNode,
  type WideAdSetNode,
  type WideAdNode,
} from "@/store/useWideCreationStore";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Layers,
  Image as ImageIcon,
  Plus,
  Trash2,
  Pencil,
  X,
  Settings2,
  RotateCcw,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { TrackingSpecsEditor, type TrackingSpec } from "@/components/meta/TrackingSpecsEditor";
import { CreativeOverrideEditor } from "@/components/wide-create/CreativeOverrideEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// Lightweight override field descriptors per node type. Plain inputs only — this
// is an "advanced" quick-override surface, not the full schema-driven editor.
// Enum values mirror MetaFieldRegistry (the single source of truth); keep them
// in sync if the registry changes.
type OverrideFieldType =
  | "text"
  | "number"
  | "datetime"
  | "select"
  | "multiselect"
  | "boolean"
  | "json"
  | "creativeOverride"
  | "trackingSpecs"
  | "targeting"
  | "promotedObject";
interface OverrideFieldDef {
  key: string;
  label: string;
  type: OverrideFieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  help?: string;
  // When present, the field only renders if this returns true for the current
  // override values (e.g. bid_amount only when a bid-cap strategy is selected).
  showWhen?: (current: Record<string, any>) => boolean;
  // Render across both grid columns (used for JSON / wide textareas).
  fullWidth?: boolean;
}

// Bid-cap strategies that require a bid_amount (mirrors BID_CAP_STRATEGIES in
// MetaFieldRegistry). bid_amount only shows when one of these is chosen.
const BID_CAP_STRATEGY_VALUES = new Set([
  "LOWEST_COST_WITH_BID_CAP",
  "COST_CAP",
  "LOWEST_COST_WITH_MIN_ROAS",
]);
const requiresBidAmount = (current: Record<string, any>) =>
  BID_CAP_STRATEGY_VALUES.has(current.bid_strategy);

const STATUS_OPTIONS = [
  { value: "PAUSED", label: "Paused" },
  { value: "ACTIVE", label: "Active" },
];

const BID_STRATEGY_OPTIONS = [
  { value: "LOWEST_COST_WITHOUT_CAP", label: "Highest Volume" },
  { value: "LOWEST_COST_WITH_BID_CAP", label: "Bid Cap" },
  { value: "COST_CAP", label: "Cost Per Result Goal" },
  { value: "LOWEST_COST_WITH_MIN_ROAS", label: "ROAS Goal" },
];

const SPECIAL_AD_CATEGORY_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "EMPLOYMENT", label: "Employment" },
  { value: "HOUSING", label: "Housing" },
  { value: "ISSUES_ELECTIONS_POLITICS", label: "Issues, Elections & Politics" },
  { value: "FINANCIAL_PRODUCTS_SERVICES", label: "Financial Products & Services" },
  { value: "ONLINE_GAMBLING_AND_GAMING", label: "Online Gambling & Gaming" },
];

const BILLING_EVENT_OPTIONS = [
  { value: "IMPRESSIONS", label: "Impressions" },
  { value: "LINK_CLICKS", label: "Link Clicks" },
  { value: "APP_INSTALLS", label: "App Installs" },
  { value: "THRUPLAY", label: "ThruPlay" },
  { value: "POST_ENGAGEMENT", label: "Post Engagement" },
  { value: "PAGE_LIKES", label: "Page Likes" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "CLICKS", label: "Clicks" },
];

const OPTIMIZATION_GOAL_OPTIONS = [
  { value: "REACH", label: "Reach" },
  { value: "IMPRESSIONS", label: "Impressions" },
  { value: "AD_RECALL_LIFT", label: "Ad Recall Lift" },
  { value: "THRUPLAY", label: "ThruPlay" },
  { value: "LINK_CLICKS", label: "Link Clicks" },
  { value: "LANDING_PAGE_VIEWS", label: "Landing Page Views" },
  { value: "OFFSITE_CONVERSIONS", label: "Conversions" },
  { value: "POST_ENGAGEMENT", label: "Post Engagement" },
  { value: "VIDEO_VIEWS", label: "Video Views" },
  { value: "MESSAGES", label: "Messages" },
  { value: "LEAD_GENERATION", label: "Lead Generation" },
  { value: "QUALITY_LEAD", label: "Quality Lead" },
  { value: "QUALITY_CALL", label: "Quality Call" },
  { value: "VALUE", label: "Value" },
  { value: "CONVERSATIONS", label: "Conversations" },
  { value: "APP_INSTALLS", label: "App Installs" },
  { value: "APP_INSTALLS_AND_OFFSITE_CONVERSIONS", label: "App Installs & Conversions" },
];

const DESTINATION_TYPE_OPTIONS = [
  { value: "WEBSITE", label: "Website" },
  { value: "APP", label: "App" },
  { value: "MESSENGER", label: "Messenger" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "INSTAGRAM_DIRECT", label: "Instagram DM" },
  { value: "ON_AD", label: "Instant Form" },
  { value: "ON_POST", label: "On Post" },
  { value: "ON_VIDEO", label: "On Video" },
  { value: "ON_PAGE", label: "On Page" },
  { value: "ON_EVENT", label: "On Event" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "SHOP_AUTOMATIC", label: "Shop" },
  { value: "UNDEFINED", label: "Default (Unset)" },
];

const CAMPAIGN_OVERRIDE_FIELDS: OverrideFieldDef[] = [
  { key: "name", label: "Name", type: "text", placeholder: "Override generated name" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS, help: "Publish forces PAUSED; this is a stored preference" },
  { key: "special_ad_categories", label: "Special Ad Categories", type: "multiselect", options: SPECIAL_AD_CATEGORY_OPTIONS, help: "Declare regulated categories" },
  {
    key: "buying_type", label: "Buying Type", type: "select",
    options: [
      { value: "AUCTION", label: "Auction" },
      { value: "RESERVED", label: "Reach & Frequency" },
    ],
  },
  { key: "daily_budget", label: "Daily Budget (cents)", type: "number", placeholder: "e.g. 5000", help: "Sets campaign-level (CBO) budget" },
  { key: "lifetime_budget", label: "Lifetime Budget (cents)", type: "number", placeholder: "e.g. 100000" },
  { key: "bid_strategy", label: "Bid Strategy", type: "select", options: BID_STRATEGY_OPTIONS },
  { key: "bid_amount", label: "Bid Amount (cents)", type: "number", placeholder: "e.g. 200", help: "Required for bid-cap strategies", showWhen: requiresBidAmount },
];

const ADSET_OVERRIDE_FIELDS: OverrideFieldDef[] = [
  { key: "name", label: "Name", type: "text", placeholder: "Override generated name" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS, help: "Publish forces PAUSED; this is a stored preference" },
  { key: "optimization_goal", label: "Optimization Goal", type: "select", options: OPTIMIZATION_GOAL_OPTIONS },
  { key: "destination_type", label: "Destination Type", type: "select", options: DESTINATION_TYPE_OPTIONS },
  { key: "billing_event", label: "Billing Event", type: "select", options: BILLING_EVENT_OPTIONS },
  { key: "daily_budget", label: "Daily Budget (cents)", type: "number", placeholder: "e.g. 5000", help: "Ignored under CBO campaigns" },
  { key: "lifetime_budget", label: "Lifetime Budget (cents)", type: "number", placeholder: "e.g. 100000", help: "Ignored under CBO campaigns" },
  { key: "bid_strategy", label: "Bid Strategy", type: "select", options: BID_STRATEGY_OPTIONS },
  { key: "bid_amount", label: "Bid Amount (cents)", type: "number", placeholder: "e.g. 200", help: "Required for bid-cap strategies", showWhen: requiresBidAmount },
  { key: "start_time", label: "Start Time", type: "datetime" },
  { key: "end_time", label: "End Time", type: "datetime" },
  { key: "is_dynamic_creative", label: "Dynamic Creative", type: "boolean", help: "Enable Dynamic Creative for this ad set" },
  { key: "targeting", label: "Targeting", type: "targeting", fullWidth: true },
  { key: "promoted_object", label: "Promoted Object", type: "promotedObject", fullWidth: true },
];

const AD_OVERRIDE_FIELDS: OverrideFieldDef[] = [
  { key: "name", label: "Name", type: "text", placeholder: "Override generated name" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS, help: "Publish forces PAUSED; this is a stored preference" },
  // Stored as `creative: {...}` to match the shape the backend reads
  // (WideCreationService applies resolvedAdFields.creative directly). Supports
  // creative_id, object_story_spec (inline), and asset_feed_spec (Dynamic Creative).
  { key: "creative", label: "Creative", type: "creativeOverride", fullWidth: true, help: "Override the creative for this ad — reuse an existing creative_id, or define an inline / dynamic creative" },
  { key: "url_parameters", label: "URL Parameters", type: "text", placeholder: "utm_source=fb&utm_medium=paid", help: "Appended to the destination URL" },
  { key: "tracking_specs", label: "Tracking Specs", type: "trackingSpecs", fullWidth: true, help: "Bind action types to objects (page / pixel / conversion)" },
];

export function StepStructure() {
  const store = useWideCreationStore();
  const objectives = store.getObjectives();

  // Map each campaign id to its global index so node overrides line up with the
  // position-based ids the store/template use (see nodeIdFor).
  const globalIndexById = new Map<string, number>();
  store.campaigns.forEach((c, i) => globalIndexById.set(c.id, i));

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-200">
              Structure Tree
            </CardTitle>
            <div className="flex items-center gap-1">
              <button
                onClick={store.expandAll}
                className="flex items-center gap-1 text-[11px] text-blue-400/70 hover:text-blue-400 px-2 py-1 rounded-md hover:bg-blue-500/10 transition-colors"
                title="Expand all campaigns"
              >
                <ChevronsUpDown className="w-3 h-3" />
                Expand all
              </button>
              <button
                onClick={store.collapseAll}
                className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-400 px-2 py-1 rounded-md hover:bg-gray-800 transition-colors"
                title="Collapse all"
              >
                <ChevronsDownUp className="w-3 h-3" />
                Collapse
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Add / remove nodes, or click <span className="text-gray-400 font-medium">Override</span> on any row to set per-item field overrides — they take precedence over the bulk Configure step.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-5 max-h-[640px] overflow-y-auto pr-1">
            {objectives.map((objective) => {
              const campaigns = store.getCampaignsByObjective(objective);
              return (
                <div key={objective} className="space-y-2">
                  <div className="flex items-center gap-2 pt-1">
                    <Badge className={`${OBJECTIVE_COLORS[objective]} bg-transparent border border-current/30 text-xs font-medium`}>
                      {OBJECTIVE_LABELS[objective] || objective}
                    </Badge>
                    <span className="text-xs text-gray-600">
                      {campaigns.length} campaign{campaigns.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {campaigns.map((campaign, ci) => (
                    <CampaignNode
                      key={campaign.id}
                      campaign={campaign}
                      index={ci}
                      globalIndex={globalIndexById.get(campaign.id) ?? ci}
                      objective={objective}
                    />
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

function CampaignNode({
  campaign, index, globalIndex, objective,
}: {
  campaign: WideCampaignNode; index: number; globalIndex: number; objective: string;
}) {
  const store = useWideCreationStore();
  const expanded = store.expandedIds.has(campaign.id);
  const color = OBJECTIVE_COLORS[objective] || "text-gray-400";
  const [editing, setEditing] = useState(false);

  const nodeId = nodeIdFor(globalIndex);
  const hasOverride = !!store.nodeOverrides[nodeId];

  return (
    <div>
      <div className={`rounded-xl border transition-colors shadow-sm ${
        editing
          ? "border-blue-500/40 bg-blue-950/20"
          : "border-blue-500/20 bg-gray-800/60 hover:bg-gray-800/80"
      }`}>
        <div className="flex items-center gap-3 py-3 px-4">
          <button
            onClick={() => store.toggleExpand(campaign.id)}
            className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            color.replace("text-", "bg-").replace("400", "500/15")
          } border border-current/10`}>
            <FolderTree className={`w-3.5 h-3.5 ${color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-100">
                {OBJECTIVE_LABELS[objective]} Campaign {index + 1}
              </span>
              <OverrideIndicator active={hasOverride} />
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {campaign.adSets.length} ad set{campaign.adSets.length !== 1 ? "s" : ""} &middot;{" "}
              {campaign.adSets.reduce((s: number, as) => s + as.ads.length, 0)} ad{campaign.adSets.reduce((s: number, as) => s + as.ads.length, 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <EditButton active={editing || hasOverride} onClick={() => setEditing((v) => !v)} />
            <button
              onClick={() => store.addAdSet(campaign.id)}
              className="p-1 rounded-md text-gray-600 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
              title="Add Ad Set"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <OverridePanel
          nodeId={nodeId}
          fields={CAMPAIGN_OVERRIDE_FIELDS}
          accent="border-blue-500/30"
          onClose={() => setEditing(false)}
        />
      )}

      {expanded && (
        <div className="ml-5 mt-2 border-l-2 border-gray-700/60 pl-4 space-y-2">
          {campaign.adSets.map((adSet, ai) => (
            <AdSetNode
              key={adSet.id}
              campaignId={campaign.id}
              adSet={adSet}
              ai={ai}
              ci={globalIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdSetNode({
  campaignId, adSet, ai, ci,
}: {
  campaignId: string; adSet: WideAdSetNode; ai: number; ci: number;
}) {
  const store = useWideCreationStore();
  const [editing, setEditing] = useState(false);
  const nodeId = nodeIdFor(ci, ai);
  const hasOverride = !!store.nodeOverrides[nodeId];

  return (
    <div>
      <div className={`rounded-lg border transition-colors ${
        editing
          ? "border-green-500/35 bg-green-950/15"
          : "border-green-500/15 bg-gray-800/35 hover:bg-gray-800/55"
      }`}>
        <div className="flex items-center gap-2.5 py-2.5 px-3">
          <div className="w-6 h-6 rounded-md bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
            <Layers className="w-3 h-3 text-green-400/80" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-gray-200">Ad Set {ai + 1}</span>
              <OverrideIndicator active={hasOverride} />
            </div>
            <p className="text-[10px] text-gray-600 mt-0.5">
              {adSet.ads.length} ad{adSet.ads.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <EditButton active={editing || hasOverride} onClick={() => setEditing((v) => !v)} size="sm" />
            <button
              onClick={() => store.addAd(campaignId, adSet.id)}
              className="p-1 rounded text-gray-600 hover:text-green-400 hover:bg-green-500/10 transition-colors"
              title="Add Ad"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => store.removeAdSet(campaignId, adSet.id)}
              className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Remove ad set"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <OverridePanel
          nodeId={nodeId}
          fields={ADSET_OVERRIDE_FIELDS}
          accent="border-green-500/30"
          onClose={() => setEditing(false)}
        />
      )}

      <div className="ml-4 mt-1.5 border-l-2 border-gray-700/40 pl-3 space-y-1">
        {adSet.ads.map((ad, adi) => (
          <AdNode
            key={ad.id}
            campaignId={campaignId}
            adSetId={adSet.id}
            ad={ad}
            adi={adi}
            ai={ai}
            ci={ci}
          />
        ))}
      </div>
    </div>
  );
}

function AdNode({
  campaignId, adSetId, ad, adi, ai, ci,
}: {
  campaignId: string; adSetId: string; ad: WideAdNode; adi: number; ai: number; ci: number;
}) {
  const store = useWideCreationStore();
  const [editing, setEditing] = useState(false);
  const nodeId = nodeIdFor(ci, ai, adi);
  const hasOverride = !!store.nodeOverrides[nodeId];

  return (
    <div>
      <div className={`rounded-md border transition-colors ${
        editing
          ? "border-purple-500/30 bg-purple-950/10"
          : "border-purple-500/10 bg-gray-800/20 hover:bg-gray-800/40"
      }`}>
        <div className="flex items-center gap-2 py-2 px-3">
          <div className="w-5 h-5 rounded bg-purple-500/10 border border-purple-500/15 flex items-center justify-center shrink-0">
            <ImageIcon className="w-2.5 h-2.5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-gray-400">Ad {adi + 1}</span>
              <OverrideIndicator active={hasOverride} />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <EditButton active={editing || hasOverride} onClick={() => setEditing((v) => !v)} size="sm" />
            <button
              onClick={() => store.removeAd(campaignId, adSetId, ad.id)}
              className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              aria-label="Remove ad"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <OverridePanel
          nodeId={nodeId}
          fields={AD_OVERRIDE_FIELDS}
          accent="border-purple-500/30"
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ─── Shared override UI ───

function EditButton({
  active, onClick, size = "md",
}: {
  active: boolean; onClick: () => void; size?: "sm" | "md";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md font-medium transition-all border ${
        active
          ? "bg-blue-500/15 text-blue-300 border-blue-500/30 px-2 py-1 text-[10px]"
          : size === "md"
          ? "text-gray-600 hover:text-gray-300 hover:bg-gray-700/50 border-transparent px-2 py-1 text-[10px]"
          : "text-gray-700 hover:text-gray-400 hover:bg-gray-700/40 border-transparent px-1.5 py-0.5 text-[10px]"
      }`}
      title="Per-item field overrides"
    >
      <Pencil className={size === "md" ? "w-2.5 h-2.5" : "w-2 h-2"} />
      {size === "md" && !active && "Override"}
    </button>
  );
}

function OverrideIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25 px-1.5 py-0.5 rounded-full">
      <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
      edited
    </span>
  );
}

function OverridePanel({
  nodeId, fields, accent, onClose,
}: {
  nodeId: string; fields: OverrideFieldDef[]; accent: string; onClose: () => void;
}) {
  const store = useWideCreationStore();
  const current = store.nodeOverrides[nodeId] || {};
  const activeCount = Object.keys(current).length;

  const update = (key: string, value: any) => {
    store.setNodeOverride(nodeId, { ...current, [key]: value });
  };

  return (
    <div className={`mt-2 mb-2 ml-2 rounded-xl border ${accent} bg-gray-950/80 shadow-xl shadow-black/30`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-200">Per-item Overrides</span>
          {activeCount > 0 && (
            <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25 px-1.5 py-0.5 rounded-full">
              {activeCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeCount > 0 && (
            <button
              onClick={() => store.clearNodeOverride(nodeId)}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-400 px-2 py-1 rounded-md hover:bg-red-500/10 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields
            .filter((field) => !field.showWhen || field.showWhen(current))
            .map((field) => (
              <div key={field.key} className={field.fullWidth ? "sm:col-span-2" : undefined}>
                <OverrideField
                  def={field}
                  value={current[field.key]}
                  onChange={(v) => update(field.key, v)}
                />
              </div>
            ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-4 pt-3 border-t border-gray-800/40">
          Leave any field blank to inherit the bulk setting from the Configure step.
        </p>
      </div>
    </div>
  );
}

function OverrideField({
  def, value, onChange,
}: {
  def: OverrideFieldDef; value: any; onChange: (v: any) => void;
}) {
  if (def.type === "json") {
    return <JsonOverrideField def={def} value={value} onChange={onChange} />;
  }

  if (def.type === "trackingSpecs") {
    return (
      <div>
        <Label className="text-xs font-medium text-gray-400">{def.label}</Label>
        <div className="mt-1">
          <TrackingSpecsEditor
            value={value as TrackingSpec[] | undefined}
            onChange={onChange}
          />
        </div>
        {def.help && <p className="text-[10px] text-gray-500 mt-1">{def.help}</p>}
      </div>
    );
  }

  if (def.type === "boolean") {
    // Tri-state select: blank = use bulk default, true/false stored explicitly.
    // (A plain checkbox can't express "no override", and `false` is meaningful.)
    return (
      <div>
        <Label className="text-xs font-medium text-gray-400">{def.label}</Label>
        <Select
          value={value === true ? "true" : value === false ? "false" : "__default__"}
          onValueChange={(v) => onChange(v === "__default__" ? undefined : v === "true")}
        >
          <SelectTrigger className="bg-gray-800 border-gray-700 mt-1 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800">
            <SelectItem value="__default__" className="text-xs text-gray-500">Use bulk default</SelectItem>
            <SelectItem value="true" className="text-xs text-gray-200">Yes</SelectItem>
            <SelectItem value="false" className="text-xs text-gray-200">No</SelectItem>
          </SelectContent>
        </Select>
        {def.help && <p className="text-[10px] text-gray-500 mt-1">{def.help}</p>}
      </div>
    );
  }

  if (def.type === "multiselect") {
    const selected: string[] = Array.isArray(value) ? value : [];
    const toggle = (optValue: string) => {
      const next = selected.includes(optValue)
        ? selected.filter((v) => v !== optValue)
        : [...selected, optValue];
      // Empty array would persist as an override (setNodeOverride only strips
      // ''/null/undefined), so collapse it to undefined → use bulk default.
      onChange(next.length === 0 ? undefined : next);
    };
    return (
      <div>
        <Label className="text-xs font-medium text-gray-400">{def.label}</Label>
        <div className="mt-1 flex flex-wrap gap-1">
          {def.options?.map((opt) => {
            const active = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={`rounded-md border px-2 py-1 text-[10px] transition-colors ${
                  active
                    ? "border-blue-500 bg-blue-500/20 text-blue-300"
                    : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {def.help && <p className="text-[10px] text-gray-500 mt-1">{def.help}</p>}
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <div>
        <Label className="text-xs font-medium text-gray-400">{def.label}</Label>
        <Select
          value={value ?? "__default__"}
          onValueChange={(v) => onChange(v === "__default__" ? undefined : v)}
        >
          <SelectTrigger className="bg-gray-800 border-gray-700 mt-1 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800">
            <SelectItem value="__default__" className="text-xs text-gray-500">Use bulk default</SelectItem>
            {def.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs text-gray-200">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {def.help && <p className="text-[10px] text-gray-500 mt-1">{def.help}</p>}
      </div>
    );
  }

  if (def.type === "creativeOverride") {
    return (
      <div>
        <Label className="text-xs font-medium text-gray-400">{def.label}</Label>
        <div className="mt-1">
          <CreativeOverrideEditor value={value} onChange={onChange} />
        </div>
        {def.help && <p className="text-[10px] text-gray-500 mt-1">{def.help}</p>}
      </div>
    );
  }

  if (def.type === "targeting") {
    return (
      <div>
        <Label className="text-xs font-medium text-gray-400">{def.label}</Label>
        <div className="mt-1">
          <TargetingEditor value={value} onChange={onChange} />
        </div>
      </div>
    );
  }

  if (def.type === "promotedObject") {
    return (
      <div>
        <Label className="text-xs font-medium text-gray-400">{def.label}</Label>
        <div className="mt-1">
          <PromotedObjectEditor value={value} onChange={onChange} />
        </div>
      </div>
    );
  }

  if (def.type === "datetime") {
    return (
      <div>
        <Label className="text-xs font-medium text-gray-400">{def.label}</Label>
        <Input
          type="datetime-local"
          value={value ? String(value).slice(0, 16) : ""}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}:00` : undefined)}
          className="bg-gray-800 border-gray-700 mt-1 h-9 text-sm"
        />
        {def.help && <p className="text-[10px] text-gray-500 mt-1">{def.help}</p>}
      </div>
    );
  }

  const isBudgetField = def.type === "number" && def.key.includes("budget");
  const budgetDollars = isBudgetField && value ? (Number(value) / 100).toFixed(2) : null;
  return (
    <div>
      <Label className="text-[10px] text-gray-500">{def.label}</Label>
      <Input
        type={def.type === "number" ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        placeholder={def.placeholder}
        className="bg-gray-800 border-gray-700 mt-1 h-8 text-xs"
      />
      {budgetDollars && (
        <p className="text-[10px] text-blue-400/80 mt-0.5">= ${budgetDollars}</p>
      )}
      {def.help && <p className="text-[9px] text-gray-600 mt-0.5">{def.help}</p>}
    </div>
  );
}

// ─── Targeting editor ───

const GENDER_OPTIONS = [
  { value: 0, label: "All" },
  { value: 1, label: "Male" },
  { value: 2, label: "Female" },
];

const COUNTRIES = [
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" }, { code: "AU", name: "Australia" },
  { code: "TH", name: "Thailand" }, { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" }, { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" }, { code: "VN", name: "Vietnam" },
  { code: "JP", name: "Japan" }, { code: "KR", name: "South Korea" },
  { code: "TW", name: "Taiwan" }, { code: "HK", name: "Hong Kong" },
  { code: "IN", name: "India" }, { code: "CN", name: "China" },
  { code: "DE", name: "Germany" }, { code: "FR", name: "France" },
  { code: "IT", name: "Italy" }, { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" }, { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" }, { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" }, { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" }, { code: "BE", name: "Belgium" },
  { code: "PT", name: "Portugal" }, { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czech Republic" }, { code: "GR", name: "Greece" },
  { code: "TR", name: "Turkey" }, { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" }, { code: "IL", name: "Israel" },
  { code: "AE", name: "UAE" }, { code: "SA", name: "Saudi Arabia" },
  { code: "EG", name: "Egypt" }, { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" }, { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" }, { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" }, { code: "CL", name: "Chile" },
  { code: "PE", name: "Peru" }, { code: "NZ", name: "New Zealand" },
];

function CountryPicker({ selected, onChange }: { selected: string[]; onChange: (c: string[]) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = COUNTRIES.filter(
    (c) =>
      !selected.includes(c.code) &&
      (search === "" ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())),
  ).slice(0, 8);

  const add = (code: string) => {
    onChange([...selected, code]);
    setSearch("");
  };
  const remove = (code: string) => onChange(selected.filter((c) => c !== code));

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map((code) => {
            const country = COUNTRIES.find((c) => c.code === code);
            return (
              <span key={code} className="inline-flex items-center gap-1 rounded-lg bg-blue-500/15 border border-blue-500/25 px-2 py-1 text-[11px] text-blue-300 font-medium">
                <span className="font-mono opacity-70">{code}</span>
                {country && <span className="opacity-70 hidden sm:inline"> {country.name}</span>}
                <button type="button" onMouseDown={() => remove(code)} className="ml-0.5 text-blue-400/50 hover:text-blue-200 transition-colors">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Input
          type="text"
          value={search}
          placeholder="Search country…"
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 250)}
          className="bg-gray-800 border-gray-700 h-8 text-xs"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 w-full mt-1 rounded-lg border border-gray-700 bg-gray-900 shadow-xl max-h-48 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onMouseDown={() => { add(c.code); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 text-left transition-colors"
              >
                <span className="font-mono text-[10px] text-gray-500 w-7 shrink-0">{c.code}</span>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TargetingEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const targeting = value && typeof value === "object" ? value : {};
  const countries: string[] = targeting.geo_locations?.countries ?? [];
  const ageMin: string = targeting.age_min != null ? String(targeting.age_min) : "";
  const ageMax: string = targeting.age_max != null ? String(targeting.age_max) : "";
  const genders: number[] = targeting.genders ?? [];

  const emit = (patch: Partial<typeof targeting>) => {
    const next = { ...targeting, ...patch };
    if ((next.geo_locations?.countries ?? []).length === 0) delete next.geo_locations;
    if (next.age_min == null) delete next.age_min;
    if (next.age_max == null) delete next.age_max;
    if ((next.genders ?? []).length === 0) delete next.genders;
    onChange(Object.keys(next).length === 0 ? undefined : next);
  };

  const setAge = (field: "age_min" | "age_max", raw: string) => {
    const n = raw === "" ? undefined : Number(raw);
    emit({ [field]: n });
  };

  const setGender = (g: number) => {
    if (g === 0) {
      emit({ genders: [] });
    } else {
      const next = genders.includes(g) ? genders.filter((x) => x !== g) : [...genders, g];
      emit({ genders: next });
    }
  };

  return (
    <div className="rounded-lg border border-gray-700/60 bg-gray-800/30 p-3 space-y-3">
      {/* Countries */}
      <div>
        <Label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Countries</Label>
        <div className="mt-1.5">
          <CountryPicker
            selected={countries}
            onChange={(newCountries) =>
              emit({ geo_locations: { ...targeting.geo_locations, countries: newCountries } })
            }
          />
        </div>
      </div>

      {/* Age */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Age Min</Label>
          <Input
            type="number"
            min={13}
            max={65}
            value={ageMin}
            placeholder="18"
            onChange={(e) => setAge("age_min", e.target.value)}
            className="bg-gray-800 border-gray-700 h-8 text-xs mt-1"
          />
        </div>
        <div className="flex-1">
          <Label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Age Max</Label>
          <Input
            type="number"
            min={13}
            max={65}
            value={ageMax}
            placeholder="65"
            onChange={(e) => setAge("age_max", e.target.value)}
            className="bg-gray-800 border-gray-700 h-8 text-xs mt-1"
          />
        </div>
      </div>

      {/* Gender */}
      <div>
        <Label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Gender</Label>
        <div className="flex gap-1.5 mt-1.5">
          {GENDER_OPTIONS.map((opt) => {
            const isActive = opt.value === 0 ? genders.length === 0 : genders.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGender(opt.value)}
                className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-blue-500/60 bg-blue-500/20 text-blue-300"
                    : "border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
        >
          Clear targeting
        </button>
      )}
    </div>
  );
}

// ─── Promoted object editor ───

const PROMOTED_OBJECT_TYPES = [
  { value: "none", label: "None" },
  { value: "page", label: "Page" },
  { value: "pixel", label: "Pixel" },
  { value: "app", label: "App" },
];

const CUSTOM_EVENT_TYPES = [
  "PURCHASE", "ADD_TO_CART", "INITIATE_CHECKOUT", "LEAD",
  "COMPLETE_REGISTRATION", "VIEW_CONTENT", "SEARCH",
  "SUBSCRIBE", "START_TRIAL", "CONTACT",
];

function detectPoType(value: any): string {
  if (!value || typeof value !== "object") return "none";
  if ("page_id" in value) return "page";
  if ("pixel_id" in value) return "pixel";
  if ("application_id" in value) return "app";
  return "none";
}

function PromotedObjectEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const poType = detectPoType(value);
  const po = value && typeof value === "object" ? value : {};

  const changeType = (next: string) => {
    if (next === "none") { onChange(undefined); return; }
    if (next === "page") onChange({ page_id: "" });
    if (next === "pixel") onChange({ pixel_id: "", custom_event_type: "PURCHASE" });
    if (next === "app") onChange({ application_id: "" });
  };

  const setField = (field: string, val: string) => {
    const next = { ...po };
    if (val) next[field] = val;
    else delete next[field];
    onChange(Object.keys(next).length === 0 ? undefined : next);
  };

  return (
    <div className="rounded-lg border border-gray-700/60 bg-gray-800/30 p-3 space-y-3">
      <div>
        <Label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Type</Label>
        <Select value={poType} onValueChange={(v) => v && changeType(v)}>
          <SelectTrigger className="bg-gray-800 border-gray-700 mt-1.5 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800">
            {PROMOTED_OBJECT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs text-gray-200">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {poType === "page" && (
        <div>
          <Label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Page ID</Label>
          <Input
            type="text"
            value={po.page_id ?? ""}
            placeholder="e.g. 1064753226727354"
            onChange={(e) => setField("page_id", e.target.value)}
            className="bg-gray-800 border-gray-700 h-8 text-xs mt-1.5"
          />
        </div>
      )}

      {poType === "pixel" && (
        <>
          <div>
            <Label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Pixel ID</Label>
            <Input
              type="text"
              value={po.pixel_id ?? ""}
              placeholder="e.g. 123456789"
              onChange={(e) => setField("pixel_id", e.target.value)}
              className="bg-gray-800 border-gray-700 h-8 text-xs mt-1.5"
            />
          </div>
          <div>
            <Label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Custom Event Type</Label>
            <Select value={po.custom_event_type ?? "PURCHASE"} onValueChange={(v) => setField("custom_event_type", v)}>
              <SelectTrigger className="bg-gray-800 border-gray-700 mt-1.5 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                {CUSTOM_EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs text-gray-200">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {poType === "app" && (
        <div>
          <Label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Application ID</Label>
          <Input
            type="text"
            value={po.application_id ?? ""}
            placeholder="e.g. 987654321"
            onChange={(e) => setField("application_id", e.target.value)}
            className="bg-gray-800 border-gray-700 h-8 text-xs mt-1.5"
          />
        </div>
      )}
    </div>
  );
}

// JSON override fields (targeting, promoted_object, tracking_specs) store a
// parsed object, but the textarea needs to hold in-progress (possibly invalid)
// text. Local string state owns the keystrokes; we only push a parsed object up
// when it's valid, and clear the override (undefined) when the textarea empties.
function JsonOverrideField({
  def, value, onChange,
}: {
  def: OverrideFieldDef; value: any; onChange: (v: any) => void;
}) {
  // Serialize the stored object for comparison so we can re-sync local text when
  // the value changes externally (e.g. "Clear overrides") without clobbering
  // what the user is typing.
  const serialized = value === undefined ? "" : JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialized);
  const [lastSynced, setLastSynced] = useState(serialized);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (serialized !== lastSynced) {
      setText(serialized);
      setLastSynced(serialized);
      setError(null);
    }
  }, [serialized, lastSynced]);

  const handleChange = (raw: string) => {
    setText(raw);
    const trimmed = raw.trim();
    if (trimmed === "") {
      setError(null);
      setLastSynced("");
      onChange(undefined);
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      setError(null);
      setLastSynced(JSON.stringify(parsed, null, 2));
      onChange(parsed);
    } catch {
      // Keep the text so the user can fix it; don't push invalid JSON upstream.
      setError("Invalid JSON");
    }
  };

  return (
    <div>
      <Label className="text-[10px] text-gray-500">{def.label}</Label>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={def.placeholder}
        rows={4}
        spellCheck={false}
        className="w-full mt-1 rounded-md bg-gray-800 border border-gray-700 text-[11px] font-mono text-gray-200 px-2 py-1.5 resize-y"
      />
      <div className="flex items-center justify-between mt-0.5">
        {def.help && <p className="text-[9px] text-gray-600">{def.help}</p>}
        {error && <p className="text-[9px] text-red-400">{error}</p>}
      </div>
    </div>
  );
}


