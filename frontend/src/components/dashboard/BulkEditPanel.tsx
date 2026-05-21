"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { draftApi } from "@/services/api";
import { cn, extractApiError } from "@/lib/utils";
import { MetaField } from "@/components/meta/MetaField";
import { FieldActionBadge } from "@/components/meta/FieldActionBadge";
import { ValidationBanner } from "@/components/meta/ValidationBanner";
import {
  X,
  Loader2,
  Save,
  AlertTriangle,
  Lock,
  Minus,
  CheckCircle2,
  Layers,
  Settings2,
  Zap,
  ChevronRight,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatBudget } from "@/lib/meta-schema";

interface BulkFieldSchema {
  field: string;
  label: string;
  type: string;
  editable: boolean;
  locked: boolean;
  lockReason?: string;
  required: boolean | "conditional";
  enumValues?: string[];
  enumLabels?: Record<string, string>;
  isBudget?: boolean;
  incompatibleWith?: string[];
  currentValues: { draftId: string; value: any }[];
  commonValue: any;
  isMixed: boolean;
}

interface BulkEditSchemaResult {
  compatible: boolean;
  incompatibleReason?: string;
  entityLevel: string;
  fields: BulkFieldSchema[];
  warnings: string[];
}

interface BulkEditPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDrafts: any[];
  entityLevel?: "campaign" | "adSet" | "ad";
  onSuccess: () => void;
}

type TabId = "settings" | "optimize";

export function BulkEditPanel({
  isOpen,
  onClose,
  selectedDrafts,
  entityLevel = "campaign",
  onSuccess,
}: BulkEditPanelProps) {
  const [schema, setSchema] = useState<BulkEditSchemaResult | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("settings");

  // Track which fields are enabled for editing
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  // Track edited values
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  // Validation result
  const [validationResult, setValidationResult] = useState<any>(null);

  const draftIds = useMemo(() => selectedDrafts.map((d) => d.id), [selectedDrafts]);

  // Fetch schema when panel opens
  useEffect(() => {
    if (!isOpen || selectedDrafts.length === 0) return;

    setLoadingSchema(true);
    setEnabledFields(new Set());
    setEditValues({});
    setValidationResult(null);

    draftApi
      .bulkEditSchema(draftIds, entityLevel)
      .then((res) => {
        setSchema(res.data);
        // Initialize edit values from common values
        const initial: Record<string, any> = {};
        for (const field of res.data.fields) {
          if (field.editable) {
            initial[field.field] = field.commonValue ?? "";
          }
        }
        setEditValues(initial);
      })
      .catch((err) => {
        toast.error(extractApiError(err, "Couldn't compute what fields can be edited together. The selected items may have incompatible types."));
        console.error(err);
      })
      .finally(() => setLoadingSchema(false));
  }, [isOpen, draftIds, entityLevel, selectedDrafts.length]);

  const toggleField = useCallback((field: string) => {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
    setValidationResult(null);
  }, []);

  const setFieldValue = useCallback((field: string, value: any) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
    setValidationResult(null);
  }, []);

  const activeUpdates = useMemo(() => {
    const updates: Record<string, any> = {};
    for (const field of enabledFields) {
      updates[field] = editValues[field];
    }
    return updates;
  }, [enabledFields, editValues]);

  const handleValidate = async () => {
    if (enabledFields.size === 0) return;
    setValidating(true);
    try {
      const res = await draftApi.bulkEditValidate(draftIds, activeUpdates, entityLevel);
      setValidationResult(res.data);
      if (res.data.valid) {
        toast.success("Validation passed");
      }
    } catch (err: any) {
      toast.error("Validation request failed");
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (enabledFields.size === 0) {
      toast.error("No fields selected");
      return;
    }

    setSaving(true);
    try {
      const res = await draftApi.bulkEditApply(draftIds, activeUpdates, entityLevel);
      toast.success(`Updated ${res.data.updated} ${entityLevel}${res.data.updated !== 1 ? "s" : ""}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.perEntityErrors) {
        setValidationResult(data);
        toast.error("Validation failed — check errors below");
      } else {
        toast.error(data?.error || "Bulk edit failed");
      }
    } finally {
      setSaving(false);
    }
  };

  // Categorize fields
  const editableFields = useMemo(
    () => schema?.fields.filter((f) => f.editable) || [],
    [schema]
  );
  const lockedFields = useMemo(
    () => schema?.fields.filter((f) => f.locked) || [],
    [schema]
  );

  const settingsFields = useMemo(
    () => editableFields.filter((f) => !f.isBudget),
    [editableFields]
  );
  const budgetFields = useMemo(
    () => editableFields.filter((f) => f.isBudget),
    [editableFields]
  );

  // Incompatibility warnings
  const incompatWarnings = useMemo(() => {
    const warns: string[] = [];
    if (enabledFields.has("daily_budget") && enabledFields.has("lifetime_budget")) {
      warns.push("Daily Budget and Lifetime Budget are mutually exclusive.");
    }
    return warns;
  }, [enabledFields]);

  const levelLabel =
    entityLevel === "campaign" ? "Campaign" : entityLevel === "adSet" ? "Ad Set" : "Ad";

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel - slides from right */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[520px] max-w-[90vw] bg-gray-950 border-l border-gray-800 z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl shadow-black/50",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-100">
                Bulk Edit {selectedDrafts.length} {levelLabel}
                {selectedDrafts.length !== 1 ? "s" : ""}
              </h2>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Type-safe editing based on Meta field compatibility
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800/60">
          <TabButton
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
            icon={<Settings2 className="w-3.5 h-3.5" />}
            label="Fields & Settings"
          />
          <TabButton
            active={activeTab === "optimize"}
            onClick={() => setActiveTab("optimize")}
            icon={<Zap className="w-3.5 h-3.5" />}
            label="Optimize & Validate"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loadingSchema ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <p className="text-xs text-gray-500">Computing compatible fields...</p>
            </div>
          ) : !schema ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <p className="text-xs text-gray-400">Failed to load schema</p>
            </div>
          ) : !schema.compatible ? (
            <div className="p-6">
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-300">Incompatible Selection</p>
                  <p className="text-xs text-red-400/80 mt-1">{schema.incompatibleReason}</p>
                </div>
              </div>
            </div>
          ) : activeTab === "settings" ? (
            <SettingsTab
              settingsFields={settingsFields}
              budgetFields={budgetFields}
              lockedFields={lockedFields}
              enabledFields={enabledFields}
              editValues={editValues}
              toggleField={toggleField}
              setFieldValue={setFieldValue}
              warnings={schema.warnings}
              incompatWarnings={incompatWarnings}
            />
          ) : (
            <OptimizeTab
              schema={schema}
              enabledFields={enabledFields}
              activeUpdates={activeUpdates}
              validationResult={validationResult}
              validating={validating}
              onValidate={handleValidate}
              selectedDrafts={selectedDrafts}
              lockedFields={lockedFields}
            />
          )}
        </div>

        {/* Footer */}
        {schema?.compatible && (
          <div className="border-t border-gray-800/60 px-5 py-3 bg-gray-900/30 flex items-center justify-between gap-3">
            <div className="text-[10px] text-gray-600">
              {enabledFields.size === 0
                ? "Select fields to edit"
                : `${enabledFields.size} field${enabledFields.size !== 1 ? "s" : ""} selected`}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={saving}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || enabledFields.size === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 min-w-[120px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Apply to {selectedDrafts.length}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Tab Button ───

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all border-b-2",
        active
          ? "text-blue-400 border-blue-400 bg-blue-500/5"
          : "text-gray-500 border-transparent hover:text-gray-300 hover:bg-gray-800/30"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Settings Tab ───

function SettingsTab({
  settingsFields,
  budgetFields,
  lockedFields,
  enabledFields,
  editValues,
  toggleField,
  setFieldValue,
  warnings,
  incompatWarnings,
}: {
  settingsFields: BulkFieldSchema[];
  budgetFields: BulkFieldSchema[];
  lockedFields: BulkFieldSchema[];
  enabledFields: Set<string>;
  editValues: Record<string, any>;
  toggleField: (field: string) => void;
  setFieldValue: (field: string, value: any) => void;
  warnings: string[];
  incompatWarnings: string[];
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Schema warnings */}
      {warnings.length > 0 && (
        <ValidationBanner warnings={warnings} />
      )}

      {/* Editable fields */}
      {settingsFields.length > 0 && (
        <FieldSection title="Editable Fields">
          {settingsFields.map((field) => (
            <EditableFieldRow
              key={field.field}
              field={field}
              enabled={enabledFields.has(field.field)}
              value={editValues[field.field]}
              onToggle={() => toggleField(field.field)}
              onChange={(v) => setFieldValue(field.field, v)}
            />
          ))}
        </FieldSection>
      )}

      {/* Budget fields */}
      {budgetFields.length > 0 && (
        <FieldSection title="Budget & Bidding">
          {budgetFields.map((field) => (
            <EditableFieldRow
              key={field.field}
              field={field}
              enabled={enabledFields.has(field.field)}
              value={editValues[field.field]}
              onToggle={() => toggleField(field.field)}
              onChange={(v) => setFieldValue(field.field, v)}
            />
          ))}
        </FieldSection>
      )}

      {incompatWarnings.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-500/30 p-3 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {incompatWarnings.map((w, i) => (
              <p key={i} className="text-[11px] text-amber-300">{w}</p>
            ))}
          </div>
        </div>
      )}

      {/* Locked fields */}
      {lockedFields.length > 0 && (
        <FieldSection title="Locked Fields" icon={<Lock className="w-3 h-3 text-gray-600" />}>
          {lockedFields.map((field) => (
            <LockedFieldRow key={field.field} field={field} />
          ))}
        </FieldSection>
      )}
    </div>
  );
}

// ─── Optimize Tab ───

function OptimizeTab({
  schema,
  enabledFields,
  activeUpdates,
  validationResult,
  validating,
  onValidate,
  selectedDrafts,
  lockedFields,
}: {
  schema: BulkEditSchemaResult;
  enabledFields: Set<string>;
  activeUpdates: Record<string, any>;
  validationResult: any;
  validating: boolean;
  onValidate: () => void;
  selectedDrafts: any[];
  lockedFields: BulkFieldSchema[];
}) {
  const fieldCount = enabledFields.size;

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="bg-gray-900/50 border border-gray-800/60 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-gray-200">Pre-Publish Validation</span>
        </div>
        <p className="text-[11px] text-gray-500">
          Validates each entity individually against Meta Marketing API rules before applying changes.
        </p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-800/40 rounded-md p-2">
            <div className="text-lg font-bold text-gray-200">{selectedDrafts.length}</div>
            <div className="text-[9px] text-gray-600 uppercase tracking-wider">Entities</div>
          </div>
          <div className="bg-gray-800/40 rounded-md p-2">
            <div className="text-lg font-bold text-blue-400">{fieldCount}</div>
            <div className="text-[9px] text-gray-600 uppercase tracking-wider">Fields</div>
          </div>
          <div className="bg-gray-800/40 rounded-md p-2">
            <div className="text-lg font-bold text-gray-200">{lockedFields.length}</div>
            <div className="text-[9px] text-gray-600 uppercase tracking-wider">Locked</div>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={onValidate}
          disabled={validating || fieldCount === 0}
          className="w-full text-xs gap-2 border-gray-700 hover:border-blue-500/50"
        >
          {validating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Validate Changes
            </>
          )}
        </Button>
      </div>

      {/* Active changes preview */}
      {fieldCount > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Changes to Apply
          </h4>
          {Object.entries(activeUpdates).map(([field, value]) => {
            const fieldSchema = schema.fields.find((f) => f.field === field);
            if (!fieldSchema) return null;
            const displayValue =
              fieldSchema.type === "enum" && fieldSchema.enumLabels
                ? fieldSchema.enumLabels[value] || value
                : fieldSchema.isBudget && value
                ? formatBudget(value)
                : String(value || "—");

            return (
              <div
                key={field}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-blue-500/5 border border-blue-500/20"
              >
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-blue-400" />
                  <span className="text-[11px] text-gray-300">{fieldSchema.label}</span>
                </div>
                <span className="text-[11px] font-mono text-blue-300">{displayValue}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Validation results */}
      {validationResult && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Validation Result
          </h4>
          {validationResult.valid ? (
            <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-300">
                All {selectedDrafts.length} entities pass validation
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {validationResult.globalErrors?.map((e: string, i: number) => (
                <div
                  key={`ge-${i}`}
                  className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-lg p-3"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-red-300">{e}</span>
                </div>
              ))}
              {validationResult.globalWarnings?.map((w: string, i: number) => (
                <div
                  key={`gw-${i}`}
                  className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-amber-300">{w}</span>
                </div>
              ))}
              {Object.entries(validationResult.perEntityErrors || {}).map(
                ([draftId, errors]: [string, any]) => {
                  const draft = selectedDrafts.find((d) => d.id === draftId);
                  return (
                    <div
                      key={draftId}
                      className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 space-y-1.5"
                    >
                      <p className="text-[10px] font-medium text-red-300 truncate">
                        {draft?.name || draftId.slice(0, 8)}
                      </p>
                      {errors.map((e: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 pl-2">
                          <span className="text-[10px] text-gray-600 font-mono">{e.field}</span>
                          <span className="text-[10px] text-red-400">{e.message}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}

      {fieldCount === 0 && (
        <div className="text-center py-8">
          <Settings2 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-gray-500">
            Enable fields in the Settings tab to preview and validate changes
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Field Section ───

function FieldSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {title}
        </span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ─── Editable Field Row ───

function EditableFieldRow({
  field,
  enabled,
  value,
  onToggle,
  onChange,
}: {
  field: BulkFieldSchema;
  enabled: boolean;
  value: any;
  onToggle: () => void;
  onChange: (value: any) => void;
}) {
  const displayCurrentValue = () => {
    if (field.isMixed) {
      return (
        <span className="flex items-center gap-1 text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">
          <Minus className="w-2.5 h-2.5" />
          Mixed
        </span>
      );
    }
    if (field.type === "enum" && field.enumLabels && field.commonValue) {
      return (
        <span className="text-[10px] text-gray-500">
          {field.enumLabels[field.commonValue] || field.commonValue}
        </span>
      );
    }
    if (field.isBudget && field.commonValue) {
      return (
        <span className="text-[10px] text-gray-500 font-mono">
          {formatBudget(field.commonValue)}
        </span>
      );
    }
    if (field.commonValue) {
      return <span className="text-[10px] text-gray-500 truncate max-w-[140px]">{String(field.commonValue)}</span>;
    }
    return <span className="text-[10px] text-gray-600">—</span>;
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all",
        enabled
          ? "border-blue-500/30 bg-blue-500/5"
          : "border-gray-800/50 bg-gray-900/20 hover:border-gray-700/60"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Checkbox checked={enabled} onCheckedChange={onToggle} />
          <Label className="text-xs font-medium text-gray-300 cursor-pointer" onClick={onToggle}>
            {field.label}
          </Label>
          <span className="text-[9px] text-gray-700 font-mono">{field.field}</span>
        </div>
        {!enabled && displayCurrentValue()}
      </div>

      {enabled && (
        <div className="mt-2.5 pl-7">
          {field.type === "enum" && field.enumValues ? (
            <select
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-8 rounded-md bg-gray-950 border border-gray-800 text-xs text-gray-200 px-2.5 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">Select...</option>
              {field.enumValues.map((v) => (
                <option key={v} value={v}>
                  {field.enumLabels?.[v] || v}
                </option>
              ))}
            </select>
          ) : field.isBudget || field.type === "number" ? (
            <div className="relative">
              <input
                type="number"
                min={0}
                step={field.isBudget ? 100 : 1}
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder={field.isBudget ? "Amount in smallest currency unit" : ""}
                className="w-full h-8 rounded-md bg-gray-950 border border-gray-800 text-xs text-yellow-400 font-mono px-2.5 focus:outline-none focus:border-blue-500 transition-colors pr-20"
              />
              {field.isBudget && value && Number(value) > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">
                  = {formatBudget(value)}
                </span>
              )}
            </div>
          ) : (
            <input
              type="text"
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-8 rounded-md bg-gray-950 border border-gray-800 text-xs text-gray-200 px-2.5 focus:outline-none focus:border-blue-500 transition-colors"
            />
          )}
          {field.incompatibleWith && field.incompatibleWith.length > 0 && (
            <p className="text-[9px] text-gray-600 mt-1">
              Mutually exclusive with: {field.incompatibleWith.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Locked Field Row ───

function LockedFieldRow({ field }: { field: BulkFieldSchema }) {
  return (
    <div className="rounded-lg border border-gray-800/30 bg-gray-900/10 p-2.5 opacity-60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="w-3 h-3 text-gray-600" />
          <span className="text-[11px] text-gray-500">{field.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {field.isMixed ? (
            <span className="text-[9px] text-amber-500/60 bg-amber-500/5 px-1.5 py-0.5 rounded">Mixed</span>
          ) : field.commonValue ? (
            <span className="text-[10px] text-gray-600 font-mono truncate max-w-[120px]">
              {field.enumLabels?.[field.commonValue] || String(field.commonValue)}
            </span>
          ) : null}
          {field.lockReason && (
            <span className="text-[9px] text-red-400/60 bg-red-500/5 px-1.5 py-0.5 rounded truncate max-w-[160px]">
              {field.lockReason}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
