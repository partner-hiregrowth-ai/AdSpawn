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
import { Loader2, Copy, AlertCircle } from "lucide-react";

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Sales",
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_APP_PROMOTION: "App Promotion",
};

const PROMOTED_OBJECT_HINTS: Record<string, { fields: string[]; labels: Record<string, string> }> = {
  OUTCOME_LEADS: { fields: ["page_id"], labels: { page_id: "Facebook Page ID" } },
  OUTCOME_SALES: { fields: ["pixel_id"], labels: { pixel_id: "Pixel ID" } },
  OUTCOME_APP_PROMOTION: { fields: ["application_id"], labels: { application_id: "App ID" } },
};

interface AdSetFormSchema {
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
      objectSchema?: any[];
      min?: number;
      step?: number;
    }>;
  }>;
}

export function StepAdSetConfig() {
  const store = useWideCreationStore();
  const objectives = store.getObjectives();
  const [schemas, setSchemas] = useState<Record<string, AdSetFormSchema>>({});
  const [loading, setLoading] = useState(true);
  const [activeObjective, setActiveObjective] = useState(objectives[0] || "");
  const [applyToAll, setApplyToAll] = useState(true);

  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    setLoading(true);
    const loaded: Record<string, AdSetFormSchema> = {};
    for (const obj of objectives) {
      try {
        const isCBO = !!(store.getCampaignsByObjective(obj)[0]?.fields.daily_budget ||
          store.getCampaignsByObjective(obj)[0]?.fields.lifetime_budget);
        const res = await draftApi.getFormSchema("adSet", { objective: obj, isCBO });
        loaded[obj] = res.data;
      } catch {
        toast.error(`Failed to load ad set schema for ${obj}`);
      }
    }
    setSchemas(loaded);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-8 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading ad set schemas per objective...
        </CardContent>
      </Card>
    );
  }

  const campaigns = store.getCampaignsByObjective(activeObjective);
  const schema = schemas[activeObjective];
  const firstAdSet = campaigns[0]?.adSets[0];
  const promotedHint = PROMOTED_OBJECT_HINTS[activeObjective];

  return (
    <div className="space-y-4">
      {/* Objective tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {objectives.map((obj) => {
          const count = store.getCampaignsByObjective(obj).reduce((s, c) => s + c.adSets.length, 0);
          return (
            <button
              key={obj}
              onClick={() => setActiveObjective(obj)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                obj === activeObjective
                  ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                  : "text-gray-500 hover:text-gray-300 border-gray-700"
              }`}
            >
              {OBJECTIVE_LABELS[obj]}
              <span className="ml-1.5 text-[10px] opacity-70">({count} ad sets)</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Checkbox checked={applyToAll} onCheckedChange={(v) => setApplyToAll(!!v)} />
        <span>Apply to all {OBJECTIVE_LABELS[activeObjective]} ad sets</span>
        <Copy className="w-3 h-3" />
      </div>

      {/* Promoted Object Warning */}
      {promotedHint && (
        <Card className="bg-yellow-950/20 border-yellow-800/30">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-yellow-300 font-medium">
                {OBJECTIVE_LABELS[activeObjective]} requires promoted_object
              </p>
              <div className="mt-2 space-y-2">
                {promotedHint.fields.map((field) => (
                  <div key={field}>
                    <Label className="text-xs text-yellow-200/70">{promotedHint.labels[field]}</Label>
                    <Input
                      value={firstAdSet?.fields.promoted_object?.[field] || ""}
                      onChange={(e) => {
                        const val = { ...firstAdSet?.fields.promoted_object, [field]: e.target.value };
                        if (applyToAll) {
                          store.bulkUpdateAdSetField(activeObjective, "promoted_object", val);
                        } else if (firstAdSet && campaigns[0]) {
                          store.updateAdSetField(campaigns[0].id, firstAdSet.id, "promoted_object", val);
                        }
                      }}
                      placeholder={`Enter ${promotedHint.labels[field]}`}
                      className="bg-gray-800 border-yellow-700/50 mt-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dynamic schema fields */}
      {schema ? (
        <AdSetSchemaForm
          schema={schema}
          objective={activeObjective}
          campaigns={campaigns}
          applyToAll={applyToAll}
        />
      ) : (
        <FallbackAdSetForm
          objective={activeObjective}
          campaigns={campaigns}
          applyToAll={applyToAll}
        />
      )}
    </div>
  );
}

function AdSetSchemaForm({
  schema, objective, campaigns, applyToAll,
}: {
  schema: AdSetFormSchema; objective: string; campaigns: any[]; applyToAll: boolean;
}) {
  const store = useWideCreationStore();
  const firstCampaign = campaigns[0];
  const firstAdSet = firstCampaign?.adSets[0];
  if (!firstAdSet) return null;

  const handleChange = (field: string, value: any) => {
    if (applyToAll) {
      store.bulkUpdateAdSetField(objective, field, value);
    } else {
      store.updateAdSetField(firstCampaign.id, firstAdSet.id, field, value);
    }
  };

  const currentFields = firstAdSet.fields;

  const skipFields = new Set(["name", "campaign_id", "status", "promoted_object"]);

  return (
    <div className="space-y-4">
      {schema.sections.map((section) => {
        const visibleFields = section.fields.filter(f =>
          f.editable && !f.hidden && !skipFields.has(f.key)
        );
        if (visibleFields.length === 0) return null;
        return (
          <Card key={section.id} className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleFields.map((field) => (
                <AdSetDynamicField
                  key={field.key}
                  field={field}
                  value={currentFields[field.key]}
                  onChange={(v) => handleChange(field.key, v)}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function FallbackAdSetForm({
  objective, campaigns, applyToAll,
}: {
  objective: string; campaigns: any[]; applyToAll: boolean;
}) {
  const store = useWideCreationStore();
  const firstCampaign = campaigns[0];
  const firstAdSet = firstCampaign?.adSets[0];
  if (!firstAdSet) return null;

  const handleChange = (field: string, value: any) => {
    if (applyToAll) {
      store.bulkUpdateAdSetField(objective, field, value);
    } else {
      store.updateAdSetField(firstCampaign.id, firstAdSet.id, field, value);
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500">Daily Budget</Label>
            <Input
              type="number"
              value={firstAdSet.fields.daily_budget || ""}
              onChange={(e) => handleChange("daily_budget", e.target.value)}
              className="bg-gray-800 border-gray-700 mt-1"
              placeholder="e.g. 3000"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Billing Event</Label>
            <Select
              value={firstAdSet.fields.billing_event || "IMPRESSIONS"}
              onValueChange={(v) => v && handleChange("billing_event", v)}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IMPRESSIONS">Impressions</SelectItem>
                <SelectItem value="LINK_CLICKS">Link Clicks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdSetDynamicField({
  field, value, onChange,
}: {
  field: any; value: any; onChange: (v: any) => void;
}) {
  switch (field.type) {
    case "enum":
      return (
        <div>
          <Label className="text-xs text-gray-500">{field.label}</Label>
          {field.helpText && <p className="text-[10px] text-gray-600">{field.helpText}</p>}
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
          <Input
            type="number"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            min={field.min}
            step={field.step}
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

    case "boolean":
      return (
        <div className="flex items-center gap-2 py-1">
          <Checkbox checked={!!value} onCheckedChange={(v) => onChange(!!v)} />
          <Label className="text-xs text-gray-400">{field.label}</Label>
        </div>
      );

    default:
      return (
        <div>
          <Label className="text-xs text-gray-500">{field.label}</Label>
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="bg-gray-800 border-gray-700 mt-1"
          />
        </div>
      );
  }
}
