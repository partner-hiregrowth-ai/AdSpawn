"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Pencil, Minus } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { draftApi } from "@/services/api";
import { cn } from "@/lib/utils";

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDrafts: any[];
  onSuccess: () => void;
}

const OBJECTIVES = [
  "OUTCOME_AWARENESS",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_SALES",
  "OUTCOME_TRAFFIC",
  "OUTCOME_APP_PROMOTION",
];

const BID_STRATEGIES = [
  "LOWEST_COST_WITHOUT_CAP",
  "LOWEST_COST_WITH_BID_CAP",
  "COST_CAP",
  "LOWEST_COST_WITH_MIN_ROAS",
];

type FieldState = { common: boolean; value: any };

function computeCommonValue(drafts: any[], accessor: (d: any) => any): FieldState {
  const values = drafts.map(accessor);
  const first = values[0];
  const allSame = values.every((v) => JSON.stringify(v) === JSON.stringify(first));
  return { common: allSame, value: allSame ? first : undefined };
}

export const BulkEditModal = ({
  isOpen,
  onClose,
  selectedDrafts,
  onSuccess,
}: BulkEditModalProps) => {
  const [saving, setSaving] = useState(false);

  const fields = useMemo(() => ({
    objective: computeCommonValue(selectedDrafts, (d) => d.objective),
    daily_budget: computeCommonValue(selectedDrafts, (d) => d.data?.daily_budget),
    bid_strategy: computeCommonValue(selectedDrafts, (d) => d.data?.bid_strategy),
    buying_type: computeCommonValue(selectedDrafts, (d) => d.data?.buying_type),
    special_ad_categories: computeCommonValue(
      selectedDrafts,
      (d) => JSON.stringify(d.data?.special_ad_categories || [])
    ),
  }), [selectedDrafts]);

  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, any>>({
    objective: fields.objective.value || "",
    daily_budget: fields.daily_budget.value || "",
    bid_strategy: fields.bid_strategy.value || "",
    buying_type: fields.buying_type.value || "",
  });

  const toggleField = (field: string) => {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const setFieldValue = (field: string, value: any) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (enabledFields.size === 0) {
      toast.error("No fields selected to update");
      return;
    }

    setSaving(true);
    try {
      const updates: { objective?: string; data?: Record<string, any> } = {};

      if (enabledFields.has("objective")) {
        updates.objective = editValues.objective;
      }

      const dataUpdates: Record<string, any> = {};
      if (enabledFields.has("daily_budget")) dataUpdates.daily_budget = editValues.daily_budget;
      if (enabledFields.has("bid_strategy")) dataUpdates.bid_strategy = editValues.bid_strategy;
      if (enabledFields.has("buying_type")) dataUpdates.buying_type = editValues.buying_type;

      if (Object.keys(dataUpdates).length > 0) {
        updates.data = dataUpdates;
      }

      const ids = selectedDrafts.map((d) => d.id);
      const response = await draftApi.bulkUpdateCampaigns(ids, updates);
      toast.success(`Updated ${response.data.updated} campaign${response.data.updated !== 1 ? "s" : ""}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Bulk update failed");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (
    key: string,
    label: string,
    fieldState: FieldState,
    input: React.ReactNode
  ) => {
    const enabled = enabledFields.has(key);
    return (
      <div
        key={key}
        className={cn(
          "rounded-lg border p-3 transition-all",
          enabled
            ? "border-blue-500/30 bg-blue-500/5"
            : "border-gray-800/60 bg-gray-900/30"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={enabled}
              onCheckedChange={() => toggleField(key)}
            />
            <Label className="text-xs font-medium text-gray-300">{label}</Label>
          </div>
          {!fieldState.common && !enabled && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">
              <Minus className="w-2.5 h-2.5" />
              Mixed
            </span>
          )}
          {fieldState.common && !enabled && (
            <span className="text-[11px] text-gray-500 font-mono truncate max-w-[200px]">
              {String(fieldState.value || "—")}
            </span>
          )}
        </div>
        {enabled && <div className="mt-2">{input}</div>}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto bg-gray-900 border-gray-800 text-gray-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Pencil className="w-5 h-5 text-blue-400" />
            Bulk Edit ({selectedDrafts.length} campaigns)
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Check the fields you want to update across all selected campaigns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          {renderField(
            "objective",
            "Objective",
            fields.objective,
            <select
              value={editValues.objective}
              onChange={(e) => setFieldValue("objective", e.target.value)}
              className="w-full h-9 rounded-md bg-gray-950 border border-gray-800 text-sm text-gray-200 px-2.5 focus:outline-none focus:border-blue-500"
            >
              <option value="">Select objective...</option>
              {OBJECTIVES.map((obj) => (
                <option key={obj} value={obj}>
                  {obj.replace("OUTCOME_", "")}
                </option>
              ))}
            </select>
          )}

          {renderField(
            "daily_budget",
            "Daily Budget",
            fields.daily_budget,
            <Input
              type="number"
              min={0}
              step={1}
              value={editValues.daily_budget}
              onChange={(e) => setFieldValue("daily_budget", e.target.value)}
              placeholder="e.g. 4000 (in cents)"
              className="bg-gray-950 border-gray-800 focus:border-blue-500 font-mono text-yellow-400"
            />
          )}

          {renderField(
            "bid_strategy",
            "Bid Strategy",
            fields.bid_strategy,
            <select
              value={editValues.bid_strategy}
              onChange={(e) => setFieldValue("bid_strategy", e.target.value)}
              className="w-full h-9 rounded-md bg-gray-950 border border-gray-800 text-sm text-gray-200 px-2.5 focus:outline-none focus:border-blue-500"
            >
              <option value="">Select bid strategy...</option>
              {BID_STRATEGIES.map((bs) => (
                <option key={bs} value={bs}>
                  {bs.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}

          {renderField(
            "buying_type",
            "Buying Type",
            fields.buying_type,
            <Input
              value={editValues.buying_type}
              onChange={(e) => setFieldValue("buying_type", e.target.value)}
              placeholder="e.g. AUCTION, RESERVED"
              className="bg-gray-950 border-gray-800 focus:border-blue-500"
            />
          )}

          {fields.special_ad_categories && (
            <div className="rounded-lg border border-gray-800/60 bg-gray-900/30 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-500">Special Ad Categories</Label>
                {fields.special_ad_categories.common ? (
                  <span className="text-[11px] text-gray-500 font-mono">
                    {fields.special_ad_categories.value === "[]"
                      ? "None"
                      : fields.special_ad_categories.value}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <Minus className="w-2.5 h-2.5" />
                    Mixed
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-600 mt-1">
                Edit individually in the draft editor.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || enabledFields.size === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              `Update ${selectedDrafts.length} Campaigns`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
