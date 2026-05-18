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
import { Loader2, Copy } from "lucide-react";

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Sales",
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_APP_PROMOTION: "App Promotion",
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
      options?: Array<{ value: string; label: string }>;
      defaultValue?: any;
      helpText?: string;
      incompatibleWith?: string[];
      min?: number;
      step?: number;
    }>;
  }>;
}

export function StepCampaignConfig() {
  const store = useWideCreationStore();
  const objectives = store.getObjectives();
  const [schemas, setSchemas] = useState<Record<string, FormSchema>>({});
  const [loading, setLoading] = useState(true);
  const [activeObjective, setActiveObjective] = useState(objectives[0] || "");
  const [applyToAll, setApplyToAll] = useState(true);

  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    setLoading(true);
    const loaded: Record<string, FormSchema> = {};
    for (const obj of objectives) {
      try {
        const res = await draftApi.getFormSchema("campaign", { objective: obj });
        loaded[obj] = res.data;
      } catch {
        toast.error(`Failed to load campaign schema for ${obj}`);
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
          Loading form schemas per objective...
        </CardContent>
      </Card>
    );
  }

  const campaigns = store.getCampaignsByObjective(activeObjective);
  const schema = schemas[activeObjective];

  return (
    <div className="space-y-4">
      {/* Objective tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {objectives.map((obj) => (
          <button
            key={obj}
            onClick={() => setActiveObjective(obj)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              obj === activeObjective
                ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                : "text-gray-500 hover:text-gray-300 border-gray-700 hover:border-gray-600"
            }`}
          >
            {OBJECTIVE_LABELS[obj] || obj}
            <span className="ml-1.5 text-[10px] opacity-70">
              ({store.getCampaignsByObjective(obj).length})
            </span>
          </button>
        ))}
      </div>

      {/* Apply to all toggle */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Checkbox
          checked={applyToAll}
          onCheckedChange={(v) => setApplyToAll(!!v)}
        />
        <span>Apply changes to all {OBJECTIVE_LABELS[activeObjective]} campaigns</span>
        <Copy className="w-3 h-3" />
      </div>

      {/* Schema-driven form */}
      {schema ? (
        <SchemaForm
          schema={schema}
          objective={activeObjective}
          campaigns={campaigns}
          applyToAll={applyToAll}
        />
      ) : (
        <FallbackCampaignForm
          objective={activeObjective}
          campaigns={campaigns}
          applyToAll={applyToAll}
        />
      )}
    </div>
  );
}

function SchemaForm({
  schema, objective, campaigns, applyToAll,
}: {
  schema: FormSchema; objective: string; campaigns: any[]; applyToAll: boolean;
}) {
  const store = useWideCreationStore();
  const firstCampaign = campaigns[0];
  if (!firstCampaign) return null;

  const handleFieldChange = (field: string, value: any) => {
    if (applyToAll) {
      store.bulkUpdateCampaignField(objective, field, value);
    } else {
      store.updateCampaignField(firstCampaign.id, field, value);
    }
  };

  const currentFields = firstCampaign.fields;

  return (
    <div className="space-y-4">
      {schema.sections
        .filter(s => s.id !== 'identity') // Name handled by naming pattern
        .map((section) => (
          <Card key={section.id} className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.fields
                .filter(f => f.editable && !f.hidden && f.key !== 'status')
                .map((field) => (
                  <DynamicField
                    key={field.key}
                    field={field}
                    value={currentFields[field.key]}
                    onChange={(v) => handleFieldChange(field.key, v)}
                    allValues={currentFields}
                  />
                ))}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

function FallbackCampaignForm({
  objective, campaigns, applyToAll,
}: {
  objective: string; campaigns: any[]; applyToAll: boolean;
}) {
  const store = useWideCreationStore();
  const firstCampaign = campaigns[0];
  if (!firstCampaign) return null;

  const handleChange = (field: string, value: any) => {
    if (applyToAll) {
      store.bulkUpdateCampaignField(objective, field, value);
    } else {
      store.updateCampaignField(firstCampaign.id, field, value);
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-300">
          Campaign Settings — {OBJECTIVE_LABELS[objective]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500">Daily Budget</Label>
            <Input
              type="number"
              value={firstCampaign.fields.daily_budget || ""}
              onChange={(e) => handleChange("daily_budget", e.target.value)}
              placeholder="e.g. 5000"
              className="bg-gray-800 border-gray-700 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Bid Strategy</Label>
            <Select
              value={firstCampaign.fields.bid_strategy || "LOWEST_COST_WITHOUT_CAP"}
              onValueChange={(v) => v && handleChange("bid_strategy", v)}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOWEST_COST_WITHOUT_CAP">Highest Volume</SelectItem>
                <SelectItem value="COST_CAP">Cost Cap</SelectItem>
                <SelectItem value="LOWEST_COST_WITH_BID_CAP">Bid Cap</SelectItem>
                <SelectItem value="LOWEST_COST_WITH_MIN_ROAS">ROAS Goal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DynamicField({
  field, value, onChange, allValues,
}: {
  field: any; value: any; onChange: (v: any) => void; allValues: Record<string, any>;
}) {
  // Check incompatibility
  if (field.incompatibleWith) {
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
              {field.options?.map((opt: any) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
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
          <Checkbox
            checked={!!value}
            onCheckedChange={(v) => onChange(!!v)}
          />
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
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

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
