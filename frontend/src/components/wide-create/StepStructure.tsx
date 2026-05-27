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
  FileText,
  Plus,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { TrackingSpecsEditor, type TrackingSpec } from "@/components/meta/TrackingSpecsEditor";
import { CreativeOverrideEditor } from "@/components/wide-create/CreativeOverrideEditor";

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
          <CardTitle className="text-sm font-medium text-gray-300">
            Generated Structure Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-4">
            Review the generated tree. Add/remove ad sets and ads, or click the{" "}
            <Pencil className="w-3 h-3 inline -mt-0.5 text-gray-400" /> icon on any node to set
            optional per-item field overrides. Overrides take precedence over the bulk settings
            you configure in the next step.
          </p>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
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
    <div className="ml-1">
      <div className="flex items-center gap-2 py-2.5 px-3 rounded-md bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50">
        <button
          onClick={() => store.toggleExpand(campaign.id)}
          className="text-gray-400"
          aria-label={expanded ? "Collapse campaign" : "Expand campaign"}
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <FolderTree className={`w-4 h-4 ${color}`} />
        <span className="text-sm font-medium text-gray-200">
          {OBJECTIVE_LABELS[objective]} Campaign {index + 1}
        </span>
        <OverrideIndicator active={hasOverride} />
        <span className="text-xs text-gray-500">
          {campaign.adSets.length} ad sets · {campaign.adSets.reduce((s: number, as) => s + as.ads.length, 0)} ads
        </span>
        <div className="flex-1" />
        <EditButton active={editing || hasOverride} onClick={() => setEditing((v) => !v)} />
        <button
          onClick={() => store.addAdSet(campaign.id)}
          className="text-gray-600 hover:text-gray-400 p-0.5"
          title="Add Ad Set"
          aria-label="Add ad set"
        >
          <Plus className="w-3 h-3" />
        </button>
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
        <div className="ml-4 mt-1 border-l-2 border-gray-700 pl-3 space-y-1.5">
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
      <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-gray-800/30 hover:bg-gray-800/60 border border-gray-700/30">
        <Layers className="w-3.5 h-3.5 text-green-400/80" />
        <span className="text-xs font-medium text-gray-300">Ad Set {ai + 1}</span>
        <OverrideIndicator active={hasOverride} />
        <span className="text-[11px] text-gray-500">{adSet.ads.length} ads</span>
        <div className="flex-1" />
        <EditButton active={editing || hasOverride} onClick={() => setEditing((v) => !v)} size="sm" />
        <button
          onClick={() => store.addAd(campaignId, adSet.id)}
          className="text-gray-600 hover:text-gray-400 p-0.5"
          title="Add Ad"
          aria-label="Add ad"
        >
          <Plus className="w-3 h-3" />
        </button>
        <button
          onClick={() => store.removeAdSet(campaignId, adSet.id)}
          className="text-red-500/30 hover:text-red-400 p-0.5"
          title="Remove"
          aria-label="Remove ad set"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {editing && (
        <OverridePanel
          nodeId={nodeId}
          fields={ADSET_OVERRIDE_FIELDS}
          accent="border-green-500/30"
          onClose={() => setEditing(false)}
        />
      )}

      <div className="ml-4 mt-1 border-l-2 border-gray-700/50 pl-3 space-y-1">
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
      <div className="flex items-center gap-2 py-1.5 px-3 rounded-md hover:bg-gray-800/40 border border-gray-700/20">
        <FileText className="w-3 h-3 text-purple-400/70" />
        <span className="text-[11px] text-gray-400">Ad {adi + 1}</span>
        <OverrideIndicator active={hasOverride} />
        <div className="flex-1" />
        <EditButton active={editing || hasOverride} onClick={() => setEditing((v) => !v)} size="sm" />
        <button
          onClick={() => store.removeAd(campaignId, adSetId, ad.id)}
          className="text-red-500/30 hover:text-red-400 p-0.5"
          aria-label="Remove ad"
        >
          <Trash2 className="w-3 h-3" />
        </button>
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
  const dim = size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3";
  return (
    <button
      onClick={onClick}
      className={`p-0.5 ${active ? "text-blue-400" : "text-gray-600 hover:text-gray-400"}`}
      title="Edit field overrides"
      aria-label="Edit field overrides"
    >
      <Pencil className={dim} />
    </button>
  );
}

function OverrideIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] text-amber-400"
      title="Has per-item overrides"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
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
  const hasAny = Object.keys(current).length > 0;

  const update = (key: string, value: any) => {
    store.setNodeOverride(nodeId, { ...current, [key]: value });
  };

  return (
    <div className={`ml-6 mt-1 mb-2 rounded-lg bg-gray-800/40 border ${accent} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          Per-item overrides
        </span>
        <div className="flex items-center gap-2">
          {hasAny && (
            <button
              onClick={() => store.clearNodeOverride(nodeId)}
              className="text-[10px] text-red-400/70 hover:text-red-400"
            >
              Clear overrides
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300"
            aria-label="Close override editor"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
      <p className="text-[10px] text-gray-600 mt-2">
        Leave a field blank to use the bulk setting from the Configure step.
      </p>
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
        <Label className="text-[10px] text-gray-500">{def.label}</Label>
        <div className="mt-1">
          <TrackingSpecsEditor
            value={value as TrackingSpec[] | undefined}
            onChange={onChange}
          />
        </div>
        {def.help && <p className="text-[9px] text-gray-600 mt-1">{def.help}</p>}
      </div>
    );
  }

  if (def.type === "boolean") {
    // Tri-state select: blank = use bulk default, true/false stored explicitly.
    // (A plain checkbox can't express "no override", and `false` is meaningful.)
    return (
      <div>
        <Label className="text-[10px] text-gray-500">{def.label}</Label>
        <select
          value={value === true ? "true" : value === false ? "false" : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : e.target.value === "true")
          }
          className="w-full mt-1 rounded-md bg-gray-800 border border-gray-700 text-xs text-gray-200 px-2 py-1.5"
        >
          <option value="">Use bulk default</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
        {def.help && <p className="text-[9px] text-gray-600 mt-0.5">{def.help}</p>}
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
        <Label className="text-[10px] text-gray-500">{def.label}</Label>
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
        {def.help && <p className="text-[9px] text-gray-600 mt-0.5">{def.help}</p>}
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <div>
        <Label className="text-[10px] text-gray-500">{def.label}</Label>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full mt-1 rounded-md bg-gray-800 border border-gray-700 text-xs text-gray-200 px-2 py-1.5"
        >
          <option value="">Use bulk default</option>
          {def.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {def.help && <p className="text-[9px] text-gray-600 mt-0.5">{def.help}</p>}
      </div>
    );
  }

  if (def.type === "creativeOverride") {
    return (
      <div>
        <Label className="text-[10px] text-gray-500">{def.label}</Label>
        <div className="mt-1">
          <CreativeOverrideEditor value={value} onChange={onChange} />
        </div>
        {def.help && <p className="text-[9px] text-gray-600 mt-1">{def.help}</p>}
      </div>
    );
  }

  if (def.type === "targeting") {
    return (
      <div>
        <Label className="text-[10px] text-gray-500">{def.label}</Label>
        <div className="mt-1">
          <TargetingEditor value={value} onChange={onChange} />
        </div>
      </div>
    );
  }

  if (def.type === "promotedObject") {
    return (
      <div>
        <Label className="text-[10px] text-gray-500">{def.label}</Label>
        <div className="mt-1">
          <PromotedObjectEditor value={value} onChange={onChange} />
        </div>
      </div>
    );
  }

  if (def.type === "datetime") {
    return (
      <div>
        <Label className="text-[10px] text-gray-500">{def.label}</Label>
        <Input
          type="datetime-local"
          value={value ? String(value).slice(0, 16) : ""}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}:00` : undefined)}
          className="bg-gray-800 border-gray-700 mt-1 h-8 text-xs"
        />
        {def.help && <p className="text-[9px] text-gray-600 mt-0.5">{def.help}</p>}
      </div>
    );
  }

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
      <div className="flex flex-wrap gap-1 mb-1">
        {selected.map((code) => {
          const country = COUNTRIES.find((c) => c.code === code);
          return (
            <span key={code} className="inline-flex items-center gap-0.5 rounded bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 text-[10px] text-blue-300">
              <span className="font-mono opacity-70">{code}</span>
              {country && <span className="opacity-80"> {country.name}</span>}
              <button type="button" onMouseDown={() => remove(code)} className="ml-0.5 text-blue-400/60 hover:text-blue-300">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          );
        })}
      </div>
      <div className="relative">
        <Input
          type="text"
          value={search}
          placeholder="Search country…"
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="bg-gray-800 border-gray-700 h-6 text-[11px]"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 w-full mt-0.5 rounded-md border border-gray-700 bg-gray-900 shadow-lg max-h-44 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onMouseDown={() => { add(c.code); setOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800 text-left"
              >
                <span className="font-mono text-[10px] text-gray-500 w-6 shrink-0">{c.code}</span>
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
    <div className="rounded-md border border-gray-700/60 bg-gray-800/40 p-2 space-y-2">
      {/* Countries */}
      <div>
        <Label className="text-[9px] text-gray-500">Countries</Label>
        <div className="mt-0.5">
          <CountryPicker
            selected={countries}
            onChange={(newCountries) =>
              emit({ geo_locations: { ...targeting.geo_locations, countries: newCountries } })
            }
          />
        </div>
      </div>

      {/* Age */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-[9px] text-gray-500">Age Min</Label>
          <Input
            type="number"
            min={13}
            max={65}
            value={ageMin}
            placeholder="18"
            onChange={(e) => setAge("age_min", e.target.value)}
            className="bg-gray-800 border-gray-700 h-6 text-[11px] mt-0.5"
          />
        </div>
        <div className="flex-1">
          <Label className="text-[9px] text-gray-500">Age Max</Label>
          <Input
            type="number"
            min={13}
            max={65}
            value={ageMax}
            placeholder="65"
            onChange={(e) => setAge("age_max", e.target.value)}
            className="bg-gray-800 border-gray-700 h-6 text-[11px] mt-0.5"
          />
        </div>
      </div>

      {/* Gender */}
      <div>
        <Label className="text-[9px] text-gray-500">Gender</Label>
        <div className="flex gap-1 mt-0.5">
          {GENDER_OPTIONS.map((opt) => {
            const isActive = opt.value === 0 ? genders.length === 0 : genders.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGender(opt.value)}
                className={`flex-1 rounded-md border px-2 py-1 text-[10px] transition-colors ${
                  isActive
                    ? "border-blue-500 bg-blue-500/20 text-blue-300"
                    : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
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
          className="text-[9px] text-red-400/60 hover:text-red-400"
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
    <div className="rounded-md border border-gray-700/60 bg-gray-800/40 p-2 space-y-2">
      <div>
        <Label className="text-[9px] text-gray-500">Type</Label>
        <select
          value={poType}
          onChange={(e) => changeType(e.target.value)}
          className="w-full mt-0.5 rounded-md bg-gray-800 border border-gray-700 text-xs text-gray-200 px-2 py-1.5"
        >
          {PROMOTED_OBJECT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {poType === "page" && (
        <div>
          <Label className="text-[9px] text-gray-500">Page ID</Label>
          <Input
            type="text"
            value={po.page_id ?? ""}
            placeholder="e.g. 1064753226727354"
            onChange={(e) => setField("page_id", e.target.value)}
            className="bg-gray-800 border-gray-700 h-7 text-[11px] mt-0.5"
          />
        </div>
      )}

      {poType === "pixel" && (
        <>
          <div>
            <Label className="text-[9px] text-gray-500">Pixel ID</Label>
            <Input
              type="text"
              value={po.pixel_id ?? ""}
              placeholder="e.g. 123456789"
              onChange={(e) => setField("pixel_id", e.target.value)}
              className="bg-gray-800 border-gray-700 h-7 text-[11px] mt-0.5"
            />
          </div>
          <div>
            <Label className="text-[9px] text-gray-500">Custom Event Type</Label>
            <select
              value={po.custom_event_type ?? "PURCHASE"}
              onChange={(e) => setField("custom_event_type", e.target.value)}
              className="w-full mt-0.5 rounded-md bg-gray-800 border border-gray-700 text-xs text-gray-200 px-2 py-1.5"
            >
              {CUSTOM_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {poType === "app" && (
        <div>
          <Label className="text-[9px] text-gray-500">Application ID</Label>
          <Input
            type="text"
            value={po.application_id ?? ""}
            placeholder="e.g. 987654321"
            onChange={(e) => setField("application_id", e.target.value)}
            className="bg-gray-800 border-gray-700 h-7 text-[11px] mt-0.5"
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


