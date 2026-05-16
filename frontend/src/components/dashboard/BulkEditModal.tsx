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
import { Loader2, Pencil, Minus, AlertTriangle } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { draftApi } from "@/services/api";
import { cn } from "@/lib/utils";

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDrafts: any[];
  onSuccess: () => void;
}

const OBJECTIVES: { value: string; label: string }[] = [
  { value: "OUTCOME_AWARENESS", label: "Awareness" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement" },
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_SALES", label: "Sales" },
  { value: "OUTCOME_APP_PROMOTION", label: "App Promotion" },
];

const BID_STRATEGIES: { value: string; label: string }[] = [
  { value: "LOWEST_COST_WITHOUT_CAP", label: "Highest Volume" },
  { value: "LOWEST_COST_WITH_BID_CAP", label: "Bid Cap" },
  { value: "COST_CAP", label: "Cost Per Result Goal" },
  { value: "LOWEST_COST_WITH_MIN_ROAS", label: "ROAS Goal" },
];

const BUYING_TYPES: { value: string; label: string }[] = [
  { value: "AUCTION", label: "Auction" },
  { value: "RESERVED", label: "Reserved (Reach & Frequency)" },
];

const SPECIAL_AD_CATEGORIES: { value: string; label: string }[] = [
  { value: "CREDIT", label: "Credit" },
  { value: "EMPLOYMENT", label: "Employment" },
  { value: "HOUSING", label: "Housing" },
  { value: "ISSUES_ELECTIONS_POLITICS", label: "Issues, Elections or Politics" },
  { value: "FINANCIAL_PRODUCTS_SERVICES", label: "Financial Products & Services" },
  { value: "ONLINE_GAMBLING_AND_GAMING", label: "Online Gambling & Gaming" },
];

type FieldState = { common: boolean; value: any };

function computeCommonValue(drafts: any[], accessor: (d: any) => any): FieldState {
  const values = drafts.map(accessor);
  const first = values[0];
  const allSame = values.every((v) => JSON.stringify(v) === JSON.stringify(first));
  return { common: allSame, value: allSame ? first : undefined };
}

function formatBudgetDisplay(cents: string | number | undefined): string {
  if (!cents) return "—";
  const num = typeof cents === "string" ? parseInt(cents, 10) : cents;
  if (isNaN(num)) return String(cents);
  return `${(num / 100).toFixed(2)}`;
}

function displayEnum(value: string | undefined, options: { value: string; label: string }[]): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label || value;
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
    bid_strategy: computeCommonValue(selectedDrafts, (d) => d.data?.bid_strategy),
    buying_type: computeCommonValue(selectedDrafts, (d) => d.data?.buying_type),
    daily_budget: computeCommonValue(selectedDrafts, (d) => d.data?.daily_budget),
    lifetime_budget: computeCommonValue(selectedDrafts, (d) => d.data?.lifetime_budget),
    spend_cap: computeCommonValue(selectedDrafts, (d) => d.data?.spend_cap),
    special_ad_categories: computeCommonValue(
      selectedDrafts,
      (d) => JSON.stringify((d.data?.special_ad_categories || []).sort())
    ),
  }), [selectedDrafts]);

  const initialCategories = useMemo(() => {
    if (!fields.special_ad_categories.common) return [];
    try {
      const parsed = JSON.parse(fields.special_ad_categories.value || "[]");
      return Array.isArray(parsed) ? parsed.filter((c: string) => c !== "NONE") : [];
    } catch { return []; }
  }, [fields.special_ad_categories]);

  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, any>>({
    objective: fields.objective.value || "",
    bid_strategy: fields.bid_strategy.value || "",
    buying_type: fields.buying_type.value || "",
    daily_budget: fields.daily_budget.value || "",
    lifetime_budget: fields.lifetime_budget.value || "",
    spend_cap: fields.spend_cap.value || "",
    special_ad_categories: initialCategories,
  });

  const toggleField = useCallback((field: string) => {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }, []);

  const setFieldValue = useCallback((field: string, value: any) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setEditValues((prev) => {
      const current: string[] = prev.special_ad_categories || [];
      const next = current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat];
      return { ...prev, special_ad_categories: next };
    });
  }, []);

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
      if (enabledFields.has("bid_strategy")) dataUpdates.bid_strategy = editValues.bid_strategy;
      if (enabledFields.has("buying_type")) dataUpdates.buying_type = editValues.buying_type;
      if (enabledFields.has("daily_budget")) dataUpdates.daily_budget = editValues.daily_budget;
      if (enabledFields.has("lifetime_budget")) dataUpdates.lifetime_budget = editValues.lifetime_budget;
      if (enabledFields.has("spend_cap")) dataUpdates.spend_cap = editValues.spend_cap;
      if (enabledFields.has("special_ad_categories")) {
        dataUpdates.special_ad_categories =
          editValues.special_ad_categories.length === 0
            ? ["NONE"]
            : editValues.special_ad_categories;
      }

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

  const MixedBadge = () => (
    <span className="flex items-center gap-1 text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
      <Minus className="w-2.5 h-2.5" />
      Mixed
    </span>
  );

  const renderDropdownField = (
    key: string,
    label: string,
    fieldState: FieldState,
    options: { value: string; label: string }[],
    hint?: string
  ) => {
    const enabled = enabledFields.has(key);
    return (
      <div
        className={cn(
          "rounded-lg border p-3 transition-all",
          enabled ? "border-blue-500/30 bg-blue-500/5" : "border-gray-800/60 bg-gray-900/30"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox checked={enabled} onCheckedChange={() => toggleField(key)} />
            <Label className="text-xs font-medium text-gray-300">{label}</Label>
          </div>
          {!enabled && (
            fieldState.common ? (
              <span className="text-[11px] text-gray-500 truncate max-w-[200px]">
                {displayEnum(fieldState.value, options)}
              </span>
            ) : <MixedBadge />
          )}
        </div>
        {enabled && (
          <div className="mt-2.5">
            <select
              value={editValues[key]}
              onChange={(e) => setFieldValue(key, e.target.value)}
              className="w-full h-9 rounded-md bg-gray-950 border border-gray-800 text-sm text-gray-200 px-2.5 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">Select {label.toLowerCase()}...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {hint && <p className="text-[10px] text-gray-600 mt-1.5">{hint}</p>}
          </div>
        )}
      </div>
    );
  };

  const renderBudgetField = (
    key: string,
    label: string,
    fieldState: FieldState,
    hint?: string
  ) => {
    const enabled = enabledFields.has(key);
    return (
      <div
        className={cn(
          "rounded-lg border p-3 transition-all",
          enabled ? "border-blue-500/30 bg-blue-500/5" : "border-gray-800/60 bg-gray-900/30"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox checked={enabled} onCheckedChange={() => toggleField(key)} />
            <Label className="text-xs font-medium text-gray-300">{label}</Label>
          </div>
          {!enabled && (
            fieldState.common ? (
              <span className="text-[11px] text-gray-500 font-mono">
                {fieldState.value ? formatBudgetDisplay(fieldState.value) : "—"}
              </span>
            ) : <MixedBadge />
          )}
        </div>
        {enabled && (
          <div className="mt-2.5">
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={100}
                value={editValues[key]}
                onChange={(e) => setFieldValue(key, e.target.value)}
                placeholder="Amount in smallest currency unit"
                className="bg-gray-950 border-gray-800 focus:border-blue-500 font-mono text-yellow-400 pr-20"
              />
              {editValues[key] && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">
                  = {formatBudgetDisplay(editValues[key])}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5">
              {hint || "Value in smallest currency unit (e.g. 5000 = 50.00)"}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderCategoriesField = () => {
    const enabled = enabledFields.has("special_ad_categories");
    const fieldState = fields.special_ad_categories;
    const currentCategories: string[] = editValues.special_ad_categories || [];

    const displayValue = () => {
      if (!fieldState.common) return <MixedBadge />;
      const parsed = JSON.parse(fieldState.value || "[]");
      const cats = Array.isArray(parsed) ? parsed.filter((c: string) => c !== "NONE") : [];
      if (cats.length === 0) return <span className="text-[11px] text-gray-500">None</span>;
      return (
        <div className="flex gap-1 flex-wrap justify-end">
          {cats.map((c: string) => (
            <span key={c} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
              {SPECIAL_AD_CATEGORIES.find((o) => o.value === c)?.label || c}
            </span>
          ))}
        </div>
      );
    };

    return (
      <div
        className={cn(
          "rounded-lg border p-3 transition-all",
          enabled ? "border-blue-500/30 bg-blue-500/5" : "border-gray-800/60 bg-gray-900/30"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox checked={enabled} onCheckedChange={() => toggleField("special_ad_categories")} />
            <Label className="text-xs font-medium text-gray-300">Special Ad Categories</Label>
          </div>
          {!enabled && displayValue()}
        </div>
        {enabled && (
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">
                {currentCategories.length === 0
                  ? "No categories selected (None)"
                  : `${currentCategories.length} selected`}
              </span>
              {currentCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFieldValue("special_ad_categories", [])}
                  className="text-[10px] text-red-400 hover:text-red-300 underline underline-offset-2"
                >
                  Clear All
                </button>
              )}
            </div>
            {SPECIAL_AD_CATEGORIES.map((cat) => (
              <label
                key={cat.value}
                className={cn(
                  "flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors border",
                  currentCategories.includes(cat.value)
                    ? "bg-blue-500/10 border-blue-500/20"
                    : "border-transparent hover:bg-gray-800/40"
                )}
              >
                <Checkbox
                  checked={currentCategories.includes(cat.value)}
                  onCheckedChange={() => toggleCategory(cat.value)}
                />
                <span className="text-xs text-gray-300">{cat.label}</span>
              </label>
            ))}
            <p className="text-[10px] text-gray-600 mt-1">
              Leave all unchecked for no special category. Restricts targeting options.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto bg-gray-900 border-gray-800 text-gray-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Pencil className="w-5 h-5 text-blue-400" />
            Bulk Edit ({selectedDrafts.length} campaigns)
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Check the fields you want to update across all selected campaigns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 py-3">
          {renderDropdownField("objective", "Objective", fields.objective, OBJECTIVES,
            "Cannot be changed after publishing to Meta."
          )}

          {renderDropdownField("bid_strategy", "Bid Strategy", fields.bid_strategy, BID_STRATEGIES)}

          {renderDropdownField("buying_type", "Buying Type", fields.buying_type, BUYING_TYPES,
            "Cannot be changed after publishing to Meta."
          )}

          <div className="pt-1 pb-0.5">
            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Budget & Spend</span>
          </div>

          {renderBudgetField("daily_budget", "Daily Budget", fields.daily_budget,
            "Mutually exclusive with Lifetime Budget at campaign level."
          )}

          {renderBudgetField("lifetime_budget", "Lifetime Budget", fields.lifetime_budget,
            "Mutually exclusive with Daily Budget. Requires end date on ad sets."
          )}

          {renderBudgetField("spend_cap", "Campaign Spend Cap", fields.spend_cap,
            "Total campaign spending limit. Set 0 to remove."
          )}

          <div className="pt-1 pb-0.5">
            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Restrictions</span>
          </div>

          {renderCategoriesField()}
        </div>

        {enabledFields.has("daily_budget") && enabledFields.has("lifetime_budget") && (
          <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-500/30 p-3 rounded-lg text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Daily Budget and Lifetime Budget are mutually exclusive. Only set one.</span>
          </div>
        )}

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
