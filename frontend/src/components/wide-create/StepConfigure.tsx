"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWideCreationStore } from "@/store/useWideCreationStore";
import { draftApi } from "@/services/api";
import { CreativeOverrideEditor } from "./CreativeOverrideEditor";
import {
  Loader2,
  Copy,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Layers,
  FolderTree,
  Image as ImageIcon,
  Calendar,
  Clock,
  Pencil,
  Info,
  Columns,
  Rows3,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const OBJECTIVE_BG_COLORS: Record<string, string> = {
  OUTCOME_TRAFFIC: "bg-blue-600/20 border-blue-500/30",
  OUTCOME_LEADS: "bg-green-600/20 border-green-500/30",
  OUTCOME_SALES: "bg-orange-600/20 border-orange-500/30",
  OUTCOME_AWARENESS: "bg-purple-600/20 border-purple-500/30",
  OUTCOME_ENGAGEMENT: "bg-pink-600/20 border-pink-500/30",
  OUTCOME_APP_PROMOTION: "bg-cyan-600/20 border-cyan-500/30",
};

const PROMOTED_OBJECT_HINTS: Record<string, { fields: string[]; labels: Record<string, string> }> = {
  OUTCOME_LEADS: { fields: ["page_id"], labels: { page_id: "Facebook Page ID" } },
  OUTCOME_SALES: { fields: ["pixel_id", "custom_event_type"], labels: { pixel_id: "Pixel ID", custom_event_type: "Event Type (e.g. PURCHASE)" } },
  OUTCOME_APP_PROMOTION: { fields: ["application_id", "object_store_url"], labels: { application_id: "App ID", object_store_url: "App Store URL" } },
};

interface FormSchema {
  sections: Array<{
    id: string;
    title: string;
    fields: Array<{
      key: string;
      label: string;
      type: string;
      required: boolean;
      editable: boolean;
      hidden?: boolean;
      options?: Array<{ value: string; label: string; disabled?: boolean }>;
      defaultValue?: any;
      helpText?: string;
      incompatibleWith?: string[];
      objectSchema?: any[];
      min?: number;
      step?: number;
    }>;
  }>;
}

const SCHEDULE_PRESETS = [
  { label: "No schedule", value: "none" },
  { label: "Start today", value: "today" },
  { label: "Start tomorrow", value: "tomorrow" },
  { label: "Custom", value: "custom" },
];

function getPresetDates(preset: string): { start?: string; end?: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const toISO = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  switch (preset) {
    case "today": return { start: toISO(now) };
    case "tomorrow": return { start: toISO(tomorrow) };
    default: return {};
  }
}

export function StepConfigure() {
  const store = useWideCreationStore();
  const objectives = store.getObjectives();
  const [activeObjective, setActiveObjective] = useState(objectives[0] || "");
  const [campaignSchemas, setCampaignSchemas] = useState<Record<string, FormSchema>>({});
  const [adSetSchemas, setAdSetSchemas] = useState<Record<string, FormSchema>>({});
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["campaign", "adset", "schedule"]));
  const [applyToAll, setApplyToAll] = useState(true);
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('horizontal');

  useEffect(() => {
    loadAllSchemas();
  }, []);

  const loadAllSchemas = async () => {
    setLoading(true);
    const campSchemas: Record<string, FormSchema> = {};
    const asSchemas: Record<string, FormSchema> = {};
    const promises = objectives.flatMap((obj) => {
      const isCBO = !!(store.getCampaignsByObjective(obj)[0]?.fields.daily_budget ||
        store.getCampaignsByObjective(obj)[0]?.fields.lifetime_budget);
      return [
        draftApi.getFormSchema("campaign", { objective: obj }).then(r => { campSchemas[obj] = r.data; }).catch(() => {}),
        draftApi.getFormSchema("adSet", { objective: obj, isCBO }).then(r => { asSchemas[obj] = r.data; }).catch(() => {}),
      ];
    });
    await Promise.all(promises);
    setCampaignSchemas(campSchemas);
    setAdSetSchemas(asSchemas);
    setLoading(false);
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-8 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading form schemas...
        </CardContent>
      </Card>
    );
  }

  const campaigns = store.getCampaignsByObjective(activeObjective);
  const firstCampaign = campaigns[0];
  const firstAdSet = firstCampaign?.adSets[0];
  const firstAd = firstAdSet?.ads[0];
  const campSchema = campaignSchemas[activeObjective];
  const asSchema = adSetSchemas[activeObjective];
  const promotedHint = PROMOTED_OBJECT_HINTS[activeObjective];

  return (
    <div className="space-y-4">
      {/* Objective tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {objectives.map((obj) => {
          const cCount = store.getCampaignsByObjective(obj).length;
          const asCount = store.getCampaignsByObjective(obj).reduce((s, c) => s + c.adSets.length, 0);
          const isActive = obj === activeObjective;
          return (
            <button
              key={obj}
              onClick={() => setActiveObjective(obj)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                isActive
                  ? `${OBJECTIVE_BG_COLORS[obj]} ${OBJECTIVE_COLORS[obj]}`
                  : "text-gray-500 hover:text-gray-300 border-gray-700"
              }`}
            >
              {OBJECTIVE_LABELS[obj]}
              <span className="ml-1.5 text-[10px] opacity-70">({cCount}C / {asCount}AS)</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Checkbox checked={applyToAll} onCheckedChange={(v) => setApplyToAll(!!v)} />
          <span>Apply changes to all {OBJECTIVE_LABELS[activeObjective]} entities</span>
          <Copy className="w-3 h-3" />
        </div>
        <div className="ml-auto flex items-center rounded-lg border border-gray-800 overflow-hidden shrink-0">
          <button
            onClick={() => setLayout('vertical')}
            className={cn(
              "h-8 w-8 flex items-center justify-center transition-colors",
              layout === 'vertical' ? "bg-blue-500/15 text-blue-400" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
            )}
            title="Vertical layout"
          >
            <Rows3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setLayout('horizontal'); setOpenSections(new Set(["campaign", "adset", "schedule", "ad", "naming"])); }}
            className={cn(
              "h-8 w-8 flex items-center justify-center transition-colors border-l border-gray-800",
              layout === 'horizontal' ? "bg-blue-500/15 text-blue-400" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
            )}
            title="Horizontal layout"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className={cn(
        layout === 'horizontal'
          ? "flex items-stretch gap-4 overflow-x-auto pb-3 snap-x snap-mandatory h-[55vh]"
          : "space-y-4"
      )}>
        {/* ── Campaign Settings ── */}
        <div className={layout === 'horizontal' ? "min-w-[640px] shrink-0 snap-start" : ""}>
          <SectionAccordion
            id="campaign"
            title="Campaign Settings"
            icon={<FolderTree className={`w-4 h-4 ${OBJECTIVE_COLORS[activeObjective]}`} />}
            open={openSections.has("campaign")}
            onToggle={() => toggleSection("campaign")}
          >
            {campSchema && firstCampaign ? (
              <CampaignFields
                schema={campSchema}
                objective={activeObjective}
                campaign={firstCampaign}
                applyToAll={applyToAll}
              />
            ) : (
              <p className="text-xs text-gray-500">No campaign schema available</p>
            )}
          </SectionAccordion>
        </div>

        {/* ── Schedule ── */}
        <div className={layout === 'horizontal' ? "min-w-[360px] shrink-0 snap-start" : ""}>
          <SectionAccordion
            id="schedule"
            title="Schedule"
            icon={<Calendar className="w-4 h-4 text-amber-400" />}
            open={openSections.has("schedule")}
            onToggle={() => toggleSection("schedule")}
          >
            <ScheduleSection
              objective={activeObjective}
              applyToAll={applyToAll}
            />
          </SectionAccordion>
        </div>

        {/* ── Ad Set Settings ── */}
        <div className={layout === 'horizontal' ? "min-w-[640px] shrink-0 snap-start" : ""}>
          <SectionAccordion
            id="adset"
            title="Ad Set Settings"
            icon={<Layers className="w-4 h-4 text-green-400" />}
            open={openSections.has("adset")}
            onToggle={() => toggleSection("adset")}
          >
            {/* Promoted Object */}
            {promotedHint && (
              <div className="mb-4 p-3 rounded-lg bg-yellow-950/20 border border-yellow-800/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-yellow-300 font-medium mb-2">
                      {OBJECTIVE_LABELS[activeObjective]} requires promoted object
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {promotedHint.fields.map((field) => (
                        <div key={field}>
                          <Label className="text-xs text-yellow-200/70">{promotedHint.labels[field]}</Label>
                          <Input
                            value={firstAdSet?.fields.promoted_object?.[field] || ""}
                            onChange={(e) => {
                              const val = { ...firstAdSet?.fields.promoted_object, [field]: e.target.value };
                              if (applyToAll) {
                                store.bulkUpdateAdSetField(activeObjective, "promoted_object", val);
                              } else if (firstAdSet && firstCampaign) {
                                store.updateAdSetField(firstCampaign.id, firstAdSet.id, "promoted_object", val);
                              }
                            }}
                            placeholder={promotedHint.labels[field]}
                            className="bg-gray-800 border-yellow-700/50 mt-1 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {asSchema && firstAdSet ? (
              <AdSetFields
                schema={asSchema}
                objective={activeObjective}
                campaigns={campaigns}
                applyToAll={applyToAll}
              />
            ) : (
              <p className="text-xs text-gray-500">No ad set schema available</p>
            )}
          </SectionAccordion>
        </div>

        {/* ── Ad / Creative Settings ── */}
        <div className={layout === 'horizontal' ? "min-w-[480px] shrink-0 snap-start" : ""}>
          <SectionAccordion
            id="ad"
            title="Ad / Creative"
            icon={<ImageIcon className="w-4 h-4 text-purple-400" />}
            open={openSections.has("ad")}
            onToggle={() => toggleSection("ad")}
          >
            <AdCreativeSection
              objective={activeObjective}
              applyToAll={applyToAll}
            />
          </SectionAccordion>
        </div>

        {/* ── Naming Patterns ── */}
        <div className={layout === 'horizontal' ? "min-w-[360px] shrink-0 snap-start" : ""}>
          <SectionAccordion
            id="naming"
            title="Naming Patterns"
            icon={<Pencil className="w-4 h-4 text-gray-400" />}
            open={openSections.has("naming")}
            onToggle={() => toggleSection("naming")}
          >
            <NamingPatternSection />
          </SectionAccordion>
        </div>
      </div>
    </div>
  );
}

// ─── Naming Pattern Section ───

function NamingPatternSection() {
  const store = useWideCreationStore();
  const { namingPattern } = store;
  const [showVars, setShowVars] = useState(false);

  const LEVELS: { key: 'campaign' | 'adSet' | 'ad'; label: string; placeholder: string }[] = [
    { key: 'campaign', label: 'Campaign', placeholder: '{objective} Campaign {index:02d}' },
    { key: 'adSet', label: 'Ad Set', placeholder: '{parent} - AdSet {index:02d}' },
    { key: 'ad', label: 'Ad', placeholder: '{parent} - Ad {index:02d}' },
  ];

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowVars((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-blue-400/70 hover:text-blue-400 transition-colors"
      >
        <Info className="w-3 h-3" />
        {showVars ? "Hide" : "Show"} available variables
      </button>
      {showVars && (
        <div className="p-2.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-[11px] text-gray-400 space-y-1">
          <p className="font-medium text-gray-300 mb-1.5">Template variables</p>
          {[
            ["{objective}", "Objective label — e.g. Traffic, Leads"],
            ["{index}", "1-based position number"],
            ["{index:02d}", "Zero-padded — e.g. 01, 02"],
            ["{parent}", "Inherits parent entity name"],
          ].map(([v, desc]) => (
            <div key={v} className="flex gap-2">
              <span className="font-mono text-blue-400/80 w-28 shrink-0">{v}</span>
              <span className="text-gray-500">{desc}</span>
            </div>
          ))}
        </div>
      )}
      {LEVELS.map(({ key, label, placeholder }) => (
        <div key={key}>
          <Label className="text-xs text-gray-500">{label} Name</Label>
          <Input
            value={namingPattern[key]}
            onChange={(e) => store.setNamingPattern(key, e.target.value)}
            placeholder={placeholder}
            className="bg-gray-800 border-gray-700 mt-1 font-mono text-sm"
          />
        </div>
      ))}
    </div>
  );
}

// ─── Accordion Section ───

function SectionAccordion({
  id, title, icon, open, onToggle, children,
}: {
  id: string; title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <Card className="bg-gray-900 border-gray-800 h-full flex flex-col">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-4 text-left hover:bg-gray-800/30 transition-colors shrink-0"
      >
        {icon}
        <span className="text-sm font-medium text-gray-200 flex-1">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <CardContent className="pt-0 pb-4 px-4 flex-1 overflow-y-auto">{children}</CardContent>}
    </Card>
  );
}

// ─── Campaign Fields ───

function CampaignFields({
  schema, objective, campaign, applyToAll,
}: {
  schema: FormSchema; objective: string; campaign: any; applyToAll: boolean;
}) {
  const store = useWideCreationStore();
  const handleChange = (field: string, value: any) => {
    if (applyToAll) {
      store.bulkUpdateCampaignField(objective, field, value);
    } else {
      store.updateCampaignField(campaign.id, field, value);
    }
  };
  const currentFields = campaign.fields;
  const skipFields = new Set(["name", "status", "objective"]);

  return (
    <div className="space-y-3">
      {schema.sections
        .filter(s => s.id !== "identity")
        .map((section) => {
          const visibleFields = section.fields.filter(
            f => f.editable && !f.hidden && !skipFields.has(f.key)
          );
          if (visibleFields.length === 0) return null;
          return (
            <div key={section.id} className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{section.title}</p>
              {visibleFields.map((field) => (
                <DynamicField
                  key={field.key}
                  field={field}
                  value={currentFields[field.key]}
                  onChange={(v) => handleChange(field.key, v)}
                  allValues={currentFields}
                />
              ))}
            </div>
          );
        })}
    </div>
  );
}

// ─── Schedule Section ───

function ScheduleSection({ objective, applyToAll }: { objective: string; applyToAll: boolean }) {
  const store = useWideCreationStore();
  const campaigns = store.getCampaignsByObjective(objective);
  const firstAdSet = campaigns[0]?.adSets[0];
  const currentStart = firstAdSet?.fields.start_time || "";
  const currentEnd = firstAdSet?.fields.end_time || "";

  const [scheduleMode, setScheduleMode] = useState<string>(
    currentStart ? "custom" : "none"
  );

  const handleScheduleChange = (field: string, value: any) => {
    if (applyToAll) {
      store.bulkUpdateAdSetField(objective, field, value);
    } else if (firstAdSet && campaigns[0]) {
      store.updateAdSetField(campaigns[0].id, firstAdSet.id, field, value);
    }
  };

  const handlePreset = (preset: string) => {
    setScheduleMode(preset);
    if (preset === "none") {
      handleScheduleChange("start_time", undefined);
      handleScheduleChange("end_time", undefined);
    } else if (preset === "custom") {
      // keep existing values
    } else {
      const dates = getPresetDates(preset);
      if (dates.start) handleScheduleChange("start_time", dates.start + ":00");
      handleScheduleChange("end_time", undefined);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {SCHEDULE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePreset(preset.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              scheduleMode === preset.value
                ? "bg-amber-600/20 text-amber-400 border-amber-500/30"
                : "text-gray-500 hover:text-gray-300 border-gray-700"
            }`}
          >
            {preset.value === "none" ? <Clock className="w-3 h-3 inline mr-1" /> : <Calendar className="w-3 h-3 inline mr-1" />}
            {preset.label}
          </button>
        ))}
      </div>

      {scheduleMode !== "none" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
          <div>
            <Label className="text-xs text-gray-400">Start Date & Time</Label>
            <Input
              type="datetime-local"
              value={currentStart ? currentStart.slice(0, 16) : ""}
              onChange={(e) => handleScheduleChange("start_time", e.target.value ? `${e.target.value}:00` : undefined)}
              className="bg-gray-800 border-gray-700 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-400">End Date & Time <span className="text-gray-600">(optional)</span></Label>
            <Input
              type="datetime-local"
              value={currentEnd ? currentEnd.slice(0, 16) : ""}
              onChange={(e) => handleScheduleChange("end_time", e.target.value ? `${e.target.value}:00` : undefined)}
              className="bg-gray-800 border-gray-700 mt-1"
            />
            <p className="text-[10px] text-gray-600 mt-1">Required when using Lifetime Budget</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ad Set Fields ───

function AdSetFields({
  schema, objective, campaigns, applyToAll,
}: {
  schema: FormSchema; objective: string; campaigns: any[]; applyToAll: boolean;
}) {
  const store = useWideCreationStore();
  const firstAdSet = campaigns[0]?.adSets[0];
  if (!firstAdSet) return null;

  const handleChange = (field: string, value: any) => {
    if (applyToAll) {
      store.bulkUpdateAdSetField(objective, field, value);
    } else {
      store.updateAdSetField(campaigns[0].id, firstAdSet.id, field, value);
    }
  };

  const currentFields = firstAdSet.fields;
  const skipFields = new Set(["name", "campaign_id", "status", "promoted_object", "start_time", "end_time"]);

  return (
    <div className="space-y-3">
      {schema.sections.map((section) => {
        const visibleFields = section.fields.filter(
          f => f.editable && !f.hidden && !skipFields.has(f.key)
        );
        if (visibleFields.length === 0) return null;
        return (
          <div key={section.id} className="space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{section.title}</p>
            {visibleFields.map((field) => (
              <DynamicField
                key={field.key}
                field={field}
                value={currentFields[field.key]}
                onChange={(v) => handleChange(field.key, v)}
                allValues={currentFields}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Ad Creative Section ───

function AdCreativeSection({ objective, applyToAll }: { objective: string; applyToAll: boolean }) {
  const store = useWideCreationStore();
  const campaigns = store.getCampaignsByObjective(objective);
  const firstAd = campaigns[0]?.adSets[0]?.ads[0];

  const handleBulkAdChange = (field: string, value: any) => {
    if (applyToAll) {
      store.bulkUpdateAdField(objective, field, value);
    } else if (firstAd && campaigns[0]?.adSets[0]) {
      store.updateAdField(campaigns[0].id, campaigns[0].adSets[0].id, firstAd.id, field, value);
    }
  };

  return (
    <div className="space-y-6">
      {/* Default Creative */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Default Creative</p>
          <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/30">Global</Badge>
        </div>
        <CreativeOverrideEditor
          value={store.defaultCreative}
          onChange={store.setDefaultCreative}
        />
        <p className="text-[10px] text-gray-600">
          Applied to every ad that doesn't have an objective-level or item-level override.
        </p>
      </div>

      {/* Per-objective creative override */}
      <div className="space-y-3 pt-4 border-t border-gray-800/40">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {OBJECTIVE_LABELS[objective]} Override
          </p>
          <Badge variant="outline" className={`text-[10px] ${OBJECTIVE_COLORS[objective]} border-current/30`}>
            Objective
          </Badge>
        </div>
        <CreativeOverrideEditor
          value={firstAd?.fields.creative}
          onChange={(v) => handleBulkAdChange("creative", v)}
        />
        <p className="text-[10px] text-gray-600">
          Overrides the global default for all {OBJECTIVE_LABELS[objective]} ads.
        </p>
      </div>

      {/* URL Parameters */}
      <div className="pt-4 border-t border-gray-800/40">
        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">URL Parameters</Label>
        <Input
          value={firstAd?.fields.url_parameters || ""}
          onChange={(e) => handleBulkAdChange("url_parameters", e.target.value || undefined)}
          placeholder="utm_source=facebook&utm_medium=paid"
          className="bg-gray-800 border-gray-700 h-9 text-sm"
        />
      </div>
    </div>
  );
}

// ─── Shared Dynamic Field Renderer ───

function DynamicField({
  field, value, onChange, allValues,
}: {
  field: any; value: any; onChange: (v: any) => void; allValues?: Record<string, any>;
}) {
  if (field.incompatibleWith && allValues) {
    for (const incomp of field.incompatibleWith) {
      if (allValues[incomp]) return null;
    }
  }

  switch (field.type) {
    case "enum":
      return (
        <div>
          <Label className="text-xs text-gray-500">{field.label}</Label>
          {field.helpText && <p className="text-[10px] text-gray-600 mt-0.5">{field.helpText}</p>}
          <Select value={value || ""} onValueChange={(v) => v && onChange(v)}>
            <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.filter((o: any) => !o.disabled).map((opt: any) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "currency":
    case "number":
      return (
        <div>
          <Label className="text-xs text-gray-500">{field.label}</Label>
          {field.helpText && <p className="text-[10px] text-gray-600 mt-0.5">{field.helpText}</p>}
          <Input
            type="number"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            min={field.min}
            step={field.step}
            placeholder={field.label}
            className="bg-gray-800 border-gray-700 mt-1"
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2 py-1">
          <Checkbox checked={!!value} onCheckedChange={(v) => onChange(!!v)} />
          <Label className="text-xs text-gray-400">{field.label}</Label>
          {field.helpText && <span className="text-[10px] text-gray-600 ml-2">{field.helpText}</span>}
        </div>
      );

    case "multiEnum":
      return (
        <div>
          <Label className="text-xs text-gray-500">{field.label}</Label>
          <Select value={(value && value[0]) || ""} onValueChange={(v) => v && onChange([v])}>
            <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt: any) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "datetime":
      return (
        <div>
          <Label className="text-xs text-gray-500">{field.label}</Label>
          {field.helpText && <p className="text-[10px] text-gray-600">{field.helpText}</p>}
          <Input
            type="datetime-local"
            value={value ? value.slice(0, 16) : ""}
            onChange={(e) => onChange(e.target.value ? `${e.target.value}:00` : undefined)}
            className="bg-gray-800 border-gray-700 mt-1"
          />
        </div>
      );

    case "object":
      if (field.key === "targeting") {
        return (
          <div>
            <Label className="text-xs text-gray-500">{field.label}</Label>
            <p className="text-[10px] text-gray-600">Configure in draft editor after generation</p>
          </div>
        );
      }
      return null;

    default:
      return (
        <div>
          <Label className="text-xs text-gray-500">{field.label}</Label>
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.label}
            className="bg-gray-800 border-gray-700 mt-1"
          />
        </div>
      );
  }
}

// ─── Helpers ───

function getNestedValue(obj: any, path: string[]): any {
  let current = obj;
  for (const key of path) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

function setNestedValue(obj: any, path: string[], value: any): any {
  if (path.length === 1) return { ...obj, [path[0]]: value };
  return { ...obj, [path[0]]: setNestedValue(obj?.[path[0]] || {}, path.slice(1), value) };
}
