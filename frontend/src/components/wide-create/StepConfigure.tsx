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
import {
  useWideCreationStore,
  type WideCampaignNode,
  type WideAdSetNode,
  type WideAdNode,
} from "@/store/useWideCreationStore";
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
  RotateCcw,
  Plus,
  Trash2,
  ChevronsUpDown,
  ChevronsDownUp,
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
  const [campaignSchemas, setCampaignSchemas] = useState<Record<string, FormSchema>>({});
  const [adSetSchemas, setAdSetSchemas] = useState<Record<string, FormSchema>>({});
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["campaign", "adset", "schedule", "ad", "naming"]));
  const [editMode, setEditMode] = useState<'all' | 'override'>('all');
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('horizontal');
  const [expandedOverrides, setExpandedOverrides] = useState<Set<string>>(new Set());

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

  const primaryObjective = objectives[0] || "";
  const firstCampaign = store.campaigns[0];
  const firstAdSet = firstCampaign?.adSets[0];
  const campSchema = campaignSchemas[primaryObjective];
  const asSchema = adSetSchemas[primaryObjective];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-800 overflow-hidden">
            <button
              onClick={() => setEditMode('all')}
              className={cn(
                "h-8 px-3 text-xs font-medium transition-colors flex items-center gap-1.5",
                editMode === 'all' ? "bg-blue-500/15 text-blue-400" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
              )}
            >
              <Copy className="w-3 h-3" />
              All
            </button>
            <button
              onClick={() => setEditMode('override')}
              className={cn(
                "h-8 px-3 text-xs font-medium transition-colors flex items-center gap-1.5 border-l border-gray-800",
                editMode === 'override' ? "bg-amber-500/15 text-amber-400" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
              )}
            >
              <Pencil className="w-3 h-3" />
              Override
            </button>
          </div>
        </div>
        {editMode === 'all' && (
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
        )}
      </div>

      {editMode === 'all' ? (
        <div className={cn(
          layout === 'horizontal'
            ? "flex items-stretch gap-4 overflow-x-auto pb-3 snap-x snap-mandatory h-[55vh]"
            : "space-y-4"
        )}>
          <div className={layout === 'horizontal' ? "min-w-[640px] shrink-0 snap-start" : ""}>
            <SectionAccordion id="campaign" title="Campaign Settings" icon={<FolderTree className="w-4 h-4 text-blue-400" />} open={openSections.has("campaign")} onToggle={() => toggleSection("campaign")}>
              {campSchema && firstCampaign ? <CampaignFields schema={campSchema} objectives={objectives} campaign={firstCampaign} /> : <p className="text-xs text-gray-500">No campaign schema available</p>}
            </SectionAccordion>
          </div>
          <div className={layout === 'horizontal' ? "min-w-[360px] shrink-0 snap-start" : ""}>
            <SectionAccordion id="schedule" title="Schedule" icon={<Calendar className="w-4 h-4 text-amber-400" />} open={openSections.has("schedule")} onToggle={() => toggleSection("schedule")}>
              <ScheduleSection objectives={objectives} />
            </SectionAccordion>
          </div>
          <div className={layout === 'horizontal' ? "min-w-[640px] shrink-0 snap-start" : ""}>
            <SectionAccordion id="adset" title="Ad Set Settings" icon={<Layers className="w-4 h-4 text-green-400" />} open={openSections.has("adset")} onToggle={() => toggleSection("adset")}>
              {asSchema && firstAdSet ? <AdSetFields schema={asSchema} objectives={objectives} /> : <p className="text-xs text-gray-500">No ad set schema available</p>}
            </SectionAccordion>
          </div>
          <div className={layout === 'horizontal' ? "min-w-[480px] shrink-0 snap-start" : ""}>
            <SectionAccordion id="ad" title="Ad / Creative" icon={<ImageIcon className="w-4 h-4 text-purple-400" />} open={openSections.has("ad")} onToggle={() => toggleSection("ad")}>
              <AdCreativeSection objectives={objectives} />
            </SectionAccordion>
          </div>
          <div className={layout === 'horizontal' ? "min-w-[360px] shrink-0 snap-start" : ""}>
            <SectionAccordion id="naming" title="Naming Patterns" icon={<Pencil className="w-4 h-4 text-gray-400" />} open={openSections.has("naming")} onToggle={() => toggleSection("naming")}>
              <NamingPatternSection />
            </SectionAccordion>
          </div>
        </div>
      ) : (
        <OverrideTreeView
          campaignSchemas={campaignSchemas}
          adSetSchemas={adSetSchemas}
          expandedIds={expandedOverrides}
          onToggleExpand={(id) => setExpandedOverrides(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
        />
      )}
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
  schema, objectives, campaign,
}: {
  schema: FormSchema; objectives: string[]; campaign: any;
}) {
  const store = useWideCreationStore();
  const defaults = store.getObjectiveDefaults(objectives[0]).campaign;

  const handleChange = (field: string, value: any) => {
    for (const obj of objectives) store.setObjectiveDefault(obj, 'campaign', field, value);
  };

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
                  value={defaults[field.key]}
                  onChange={(v) => handleChange(field.key, v)}
                  allValues={defaults}
                />
              ))}
            </div>
          );
        })}
    </div>
  );
}

// ─── Schedule Section ───

function ScheduleSection({ objectives }: { objectives: string[] }) {
  const store = useWideCreationStore();
  const defaults = store.getObjectiveDefaults(objectives[0]).adSet;
  const currentStart = defaults.start_time || "";
  const currentEnd = defaults.end_time || "";

  const [scheduleMode, setScheduleMode] = useState<string>(
    currentStart ? "custom" : "none"
  );

  const handleScheduleChange = (field: string, value: any) => {
    for (const obj of objectives) store.setObjectiveDefault(obj, 'adSet', field, value);
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
  schema, objectives,
}: {
  schema: FormSchema; objectives: string[];
}) {
  const store = useWideCreationStore();
  const defaults = store.getObjectiveDefaults(objectives[0]).adSet;

  const handleChange = (field: string, value: any) => {
    for (const obj of objectives) store.setObjectiveDefault(obj, 'adSet', field, value);
  };

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
                value={defaults[field.key]}
                onChange={(v) => handleChange(field.key, v)}
                allValues={defaults}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Ad Creative Section ───

function AdCreativeSection({ objectives }: { objectives: string[] }) {
  const store = useWideCreationStore();
  const defaults = store.getObjectiveDefaults(objectives[0]).ad;

  const handleChange = (field: string, value: any) => {
    for (const obj of objectives) store.setObjectiveDefault(obj, 'ad', field, value);
  };

  return (
    <div className="space-y-6">
      {/* Default Creative */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Creative</p>
        <CreativeOverrideEditor
          value={defaults.creative ?? store.defaultCreative}
          onChange={(v) => handleChange("creative", v)}
        />
        <p className="text-[10px] text-gray-600">
          Applied to all ads. Override individual ads in Override mode.
        </p>
      </div>

      {/* URL Parameters */}
      <div className="pt-4 border-t border-gray-800/40">
        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">URL Parameters</Label>
        <Input
          value={defaults.url_parameters || ""}
          onChange={(e) => handleChange("url_parameters", e.target.value || undefined)}
          placeholder="utm_source=facebook&utm_medium=paid"
          className="bg-gray-800 border-gray-700 h-9 text-sm"
        />
      </div>
    </div>
  );
}

// ─── Shared Dynamic Field Renderer ───

function DynamicField({
  field, value, onChange, allValues, isOverridden,
}: {
  field: any; value: any; onChange: (v: any) => void; allValues?: Record<string, any>; isOverridden?: boolean;
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

// ─── Override Tree View ───

function OverrideTreeView({
  campaignSchemas, adSetSchemas, expandedIds, onToggleExpand,
}: {
  campaignSchemas: Record<string, FormSchema>;
  adSetSchemas: Record<string, FormSchema>;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  const store = useWideCreationStore();
  const objectives = store.getObjectives();

  const expandAll = () => {
    const allIds = new Set<string>();
    for (const c of store.campaigns) {
      allIds.add(c.id);
      for (const as of c.adSets) {
        allIds.add(as.id);
        for (const ad of as.ads) allIds.add(ad.id);
      }
    }
    // Replace expandedIds entirely by toggling all missing ids
    for (const id of allIds) if (!expandedIds.has(id)) onToggleExpand(id);
  };

  const collapseAll = () => {
    for (const id of expandedIds) onToggleExpand(id);
  };

  if (store.campaigns.length === 0) {
    return <p className="text-xs text-gray-500 py-4 text-center">No campaigns generated yet.</p>;
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500">
            Edit individual campaigns, ad sets, and ads. Unset fields inherit from <span className="text-gray-400 font-medium">All</span> defaults.
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={expandAll} className="flex items-center gap-1 text-[11px] text-blue-400/70 hover:text-blue-400 px-2 py-1 rounded-md hover:bg-blue-500/10 transition-colors">
              <ChevronsUpDown className="w-3 h-3" /> Expand
            </button>
            <button onClick={collapseAll} className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-400 px-2 py-1 rounded-md hover:bg-gray-800 transition-colors">
              <ChevronsDownUp className="w-3 h-3" /> Collapse
            </button>
          </div>
        </div>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {objectives.map((objective) => {
            const campaigns = store.getCampaignsByObjective(objective);
            const color = OBJECTIVE_COLORS[objective] || "text-gray-400";
            const campSchema = campaignSchemas[objective];
            const asSchema = adSetSchemas[objective];
            return (
              <div key={objective} className="space-y-2">
                <div className="flex items-center gap-2 pt-1">
                  <Badge className={`${color} bg-transparent border border-current/30 text-xs font-medium`}>
                    {OBJECTIVE_LABELS[objective] || objective}
                  </Badge>
                  <span className="text-xs text-gray-600">
                    {campaigns.length} campaign{campaigns.length > 1 ? "s" : ""}
                  </span>
                </div>

                {campaigns.map((campaign, ci) => {
                  const campExpanded = expandedIds.has(campaign.id);
                  const hasEdits = Object.keys(campaign.fields).filter(k => k !== "objective").length > 0;
                  return (
                    <div key={campaign.id}>
                      <div className={`rounded-xl border transition-colors shadow-sm ${
                        campExpanded ? "border-blue-500/40 bg-blue-950/20" : "border-blue-500/20 bg-gray-800/60 hover:bg-gray-800/80"
                      }`}>
                        <div className="flex items-center gap-3 py-3 px-4">
                          <button onClick={() => onToggleExpand(campaign.id)} className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
                            {campExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            color.replace("text-", "bg-").replace("400", "500/15")
                          } border border-current/10`}>
                            <FolderTree className={`w-3.5 h-3.5 ${color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-100">
                                {OBJECTIVE_LABELS[objective]} Campaign {ci + 1}
                              </span>
                              {hasEdits && <Badge variant="outline" className="text-[9px] text-amber-300 border-amber-500/25 bg-amber-500/10">edited</Badge>}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {campaign.adSets.length} ad set{campaign.adSets.length !== 1 ? "s" : ""} · {campaign.adSets.reduce((s, as) => s + as.ads.length, 0)} ad{campaign.adSets.reduce((s, as) => s + as.ads.length, 0) !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <button
                            onClick={() => store.addAdSet(campaign.id)}
                            className="p-1 rounded-md text-gray-600 hover:text-gray-300 hover:bg-gray-700/50 transition-colors shrink-0"
                            title="Add Ad Set"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {campExpanded && (
                        <div className="mt-2 ml-2">
                          {campSchema && (
                            <div className="mb-3 p-3 rounded-lg border border-blue-500/20 bg-gray-950/60">
                              <OverrideCampaignFields schema={campSchema} objective={objective} campaign={campaign} />
                            </div>
                          )}

                          <div className="ml-4 border-l-2 border-gray-700/60 pl-4 space-y-2">
                            {campaign.adSets.map((adSet, ai) => {
                              const asExpanded = expandedIds.has(adSet.id);
                              return (
                                <div key={adSet.id}>
                                  <div className={`rounded-lg border transition-colors ${
                                    asExpanded ? "border-green-500/35 bg-green-950/15" : "border-green-500/15 bg-gray-800/35 hover:bg-gray-800/55"
                                  }`}>
                                    <div className="flex items-center gap-2.5 py-2.5 px-3">
                                      <button onClick={() => onToggleExpand(adSet.id)} className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
                                        {asExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                      </button>
                                      <div className="w-6 h-6 rounded-md bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                                        <Layers className="w-3 h-3 text-green-400/80" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs font-semibold text-gray-200">Ad Set {ai + 1}</span>
                                          {Object.keys(adSet.fields).length > 0 && <Badge variant="outline" className="text-[9px] text-amber-300 border-amber-500/25 bg-amber-500/10">edited</Badge>}
                                        </div>
                                        <p className="text-[10px] text-gray-600 mt-0.5">{adSet.ads.length} ad{adSet.ads.length !== 1 ? "s" : ""}</p>
                                      </div>
                                      <button
                                        onClick={() => store.addAd(campaign.id, adSet.id)}
                                        className="p-1 rounded text-gray-600 hover:text-green-400 hover:bg-green-500/10 transition-colors shrink-0"
                                        title="Add Ad"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => store.removeAdSet(campaign.id, adSet.id)}
                                        className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                                        title="Remove ad set"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {asExpanded && (
                                    <div className="mt-2 ml-2">
                                      {asSchema && (
                                        <div className="mb-3 p-3 rounded-lg border border-green-500/20 bg-gray-950/60">
                                          <OverrideAdSetFields schema={asSchema} objective={objective} campaignId={campaign.id} adSet={adSet} />
                                        </div>
                                      )}

                                      <div className="ml-4 border-l-2 border-gray-700/40 pl-3 space-y-1.5">
                                        {adSet.ads.map((ad, adi) => {
                                          const adExpanded = expandedIds.has(ad.id);
                                          return (
                                            <div key={ad.id}>
                                              <div className={`rounded-md border transition-colors ${
                                                adExpanded ? "border-purple-500/30 bg-purple-950/10" : "border-purple-500/10 bg-gray-800/20 hover:bg-gray-800/40"
                                              }`}>
                                                <div className="flex items-center gap-2 py-2 px-3">
                                                  <button onClick={() => onToggleExpand(ad.id)} className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
                                                    {adExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                  </button>
                                                  <div className="w-5 h-5 rounded bg-purple-500/10 border border-purple-500/15 flex items-center justify-center shrink-0">
                                                    <ImageIcon className="w-2.5 h-2.5 text-purple-400" />
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-[11px] font-medium text-gray-400">Ad {adi + 1}</span>
                                                      {Object.keys(ad.fields).length > 0 && <Badge variant="outline" className="text-[9px] text-amber-300 border-amber-500/25 bg-amber-500/10">edited</Badge>}
                                                    </div>
                                                  </div>
                                                  <button
                                                    onClick={() => store.removeAd(campaign.id, adSet.id, ad.id)}
                                                    className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                                                    title="Remove ad"
                                                  >
                                                    <Trash2 className="w-2.5 h-2.5" />
                                                  </button>
                                                </div>
                                              </div>

                                              {adExpanded && (
                                                <div className="mt-2 ml-2 mb-2 p-3 rounded-lg border border-purple-500/20 bg-gray-950/60">
                                                  <OverrideAdFields objective={objective} campaignId={campaign.id} adSetId={adSet.id} ad={ad} />
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function OverrideCampaignFields({
  schema, objective, campaign,
}: {
  schema: FormSchema; objective: string; campaign: WideCampaignNode;
}) {
  const store = useWideCreationStore();
  const defaults = store.getObjectiveDefaults(objective).campaign;
  const mergedFields = { ...defaults, ...campaign.fields };
  const skipFields = new Set(["name", "status", "objective"]);

  const handleChange = (field: string, value: any) => {
    store.updateCampaignField(campaign.id, field, value);
  };

  const handleReset = (field: string) => {
    store.clearEntityOverride(campaign.id, 'campaign', field);
  };

  const visibleFields = schema.sections
    .filter(s => s.id !== "identity")
    .flatMap(s => s.fields.filter(f => f.editable && !f.hidden && !skipFields.has(f.key)));

  if (visibleFields.length === 0) return <p className="text-[10px] text-gray-600">No editable fields</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {visibleFields.map((field) => {
        const isOverridden = field.key in campaign.fields && campaign.fields[field.key] !== undefined;
        return (
          <div key={field.key} className="relative">
            {isOverridden && (
              <button
                onClick={() => handleReset(field.key)}
                className="absolute right-0 top-0 text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 z-10"
                title="Reset to default"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Reset
              </button>
            )}
            <DynamicField
              field={field}
              value={mergedFields[field.key]}
              onChange={(v) => handleChange(field.key, v)}
              allValues={mergedFields}
              isOverridden={isOverridden}
            />
          </div>
        );
      })}
    </div>
  );
}

function OverrideAdSetFields({
  schema, objective, campaignId, adSet,
}: {
  schema: FormSchema; objective: string; campaignId: string; adSet: WideAdSetNode;
}) {
  const store = useWideCreationStore();
  const defaults = store.getObjectiveDefaults(objective).adSet;
  const mergedFields = { ...defaults, ...adSet.fields };
  const skipFields = new Set(["name", "campaign_id", "status", "promoted_object", "start_time", "end_time"]);

  const handleChange = (field: string, value: any) => {
    store.updateAdSetField(campaignId, adSet.id, field, value);
  };

  const handleReset = (field: string) => {
    store.clearEntityOverride(adSet.id, 'adSet', field);
  };

  const visibleFields = schema.sections
    .flatMap(s => s.fields.filter(f => f.editable && !f.hidden && !skipFields.has(f.key)));

  if (visibleFields.length === 0) return <p className="text-[10px] text-gray-600">No editable fields</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {visibleFields.map((field) => {
        const isOverridden = field.key in adSet.fields && adSet.fields[field.key] !== undefined;
        return (
          <div key={field.key} className="relative">
            {isOverridden && (
              <button
                onClick={() => handleReset(field.key)}
                className="absolute right-0 top-0 text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 z-10"
                title="Reset to default"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Reset
              </button>
            )}
            <DynamicField
              field={field}
              value={mergedFields[field.key]}
              onChange={(v) => handleChange(field.key, v)}
              allValues={mergedFields}
              isOverridden={isOverridden}
            />
          </div>
        );
      })}
    </div>
  );
}

function OverrideAdFields({
  objective, campaignId, adSetId, ad,
}: {
  objective: string; campaignId: string; adSetId: string; ad: WideAdNode;
}) {
  const store = useWideCreationStore();
  const defaults = store.getObjectiveDefaults(objective).ad;
  const mergedCreative = ad.fields.creative ?? defaults.creative ?? store.defaultCreative;
  const mergedUrlParams = ad.fields.url_parameters ?? defaults.url_parameters ?? "";

  const handleChange = (field: string, value: any) => {
    store.updateAdField(campaignId, adSetId, ad.id, field, value);
  };

  const handleReset = (field: string) => {
    store.clearEntityOverride(ad.id, 'ad', field);
  };

  const creativeOverridden = "creative" in ad.fields && ad.fields.creative !== undefined;
  const urlOverridden = "url_parameters" in ad.fields && ad.fields.url_parameters !== undefined;

  return (
    <div className="space-y-4">
      <div className="relative">
        {creativeOverridden && (
          <button
            onClick={() => handleReset("creative")}
            className="absolute right-0 top-0 text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 z-10"
            title="Reset to default"
          >
            <RotateCcw className="w-2.5 h-2.5" /> Reset
          </button>
        )}
        <Label className="text-xs text-gray-500">Creative</Label>
        <div className="mt-1">
          <CreativeOverrideEditor
            value={mergedCreative}
            onChange={(v) => handleChange("creative", v)}
          />
        </div>
      </div>
      <div className="relative">
        {urlOverridden && (
          <button
            onClick={() => handleReset("url_parameters")}
            className="absolute right-0 top-0 text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 z-10"
            title="Reset to default"
          >
            <RotateCcw className="w-2.5 h-2.5" /> Reset
          </button>
        )}
        <Label className="text-xs text-gray-500">URL Parameters</Label>
        <Input
          value={mergedUrlParams}
          onChange={(e) => handleChange("url_parameters", e.target.value || undefined)}
          placeholder="utm_source=facebook&utm_medium=paid"
          className="bg-gray-800 border-gray-700 h-9 text-sm mt-1"
        />
      </div>
    </div>
  );
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
