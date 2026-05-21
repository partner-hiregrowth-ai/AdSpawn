"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBudget } from "@/lib/meta-schema";

// ─── Types mirroring backend MetaFormSchemaEngine ───

export type SchemaFieldType =
  | "string"
  | "number"
  | "enum"
  | "boolean"
  | "date"
  | "datetime"
  | "currency"
  | "object"
  | "array"
  | "multiEnum";

export interface EnumOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface DependencyRule {
  field: string;
  condition: "equals" | "notEquals" | "in" | "notIn" | "exists" | "notExists";
  value?: any;
  values?: any[];
  effect: "show" | "hide" | "require" | "disable" | "updateOptions";
  optionsMap?: Record<string, EnumOption[]>;
}

export interface ValidationRule {
  type: "required" | "min" | "max" | "pattern" | "custom";
  value?: any;
  message: string;
}

export interface FieldSchema {
  key: string;
  label: string;
  type: SchemaFieldType;
  required: boolean;
  editable: boolean;
  hidden?: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
  options?: EnumOption[];
  min?: number;
  max?: number;
  step?: number;
  currencyCode?: string;
  currencyMultiplier?: number;
  objectSchema?: FieldSchema[];
  arrayItemSchema?: FieldSchema;
  minItems?: number;
  maxItems?: number;
  dependsOn?: DependencyRule[];
  invalidates?: string[];
  incompatibleWith?: string[];
  validation?: ValidationRule[];
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  fields: FieldSchema[];
}

// ─── Context for dependency resolution ───

interface FieldRenderContext {
  allValues: Record<string, any>;
  parentPath?: string;
  onFieldChange: (path: string, value: any) => void;
  onFieldInvalidate?: (field: string) => void;
  compact?: boolean;
}

// ─── Dependency evaluation ───

function evaluateCondition(
  value: any,
  dep: DependencyRule,
): boolean {
  switch (dep.condition) {
    case "equals":
      return value === dep.value;
    case "notEquals":
      return value !== dep.value;
    case "in":
      if (Array.isArray(value)) {
        return dep.values?.some((v) => value.includes(v)) || false;
      }
      return dep.values?.includes(value) || false;
    case "notIn":
      return !dep.values?.includes(value);
    case "exists":
      return value !== undefined && value !== null && value !== "";
    case "notExists":
      return value === undefined || value === null || value === "";
    default:
      return true;
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

function resolveFieldState(
  field: FieldSchema,
  allValues: Record<string, any>,
): { visible: boolean; required: boolean; disabled: boolean; dynamicOptions?: EnumOption[] } {
  let visible = !field.hidden;
  let required = field.required;
  let disabled = !field.editable;
  let dynamicOptions: EnumOption[] | undefined;

  if (field.dependsOn) {
    for (const dep of field.dependsOn) {
      const depValue = getNestedValue(allValues, dep.field);
      const conditionMet = evaluateCondition(depValue, dep);

      switch (dep.effect) {
        case "show":
          if (!conditionMet) visible = false;
          break;
        case "hide":
          if (conditionMet) visible = false;
          break;
        case "require":
          if (conditionMet) required = true;
          break;
        case "disable":
          if (conditionMet) disabled = true;
          break;
        case "updateOptions":
          if (dep.optionsMap && depValue && dep.optionsMap[depValue]) {
            dynamicOptions = dep.optionsMap[depValue];
          }
          break;
      }
    }
  }

  if (field.incompatibleWith) {
    for (const incompField of field.incompatibleWith) {
      const incompValue = getNestedValue(allValues, incompField);
      if (incompValue !== undefined && incompValue !== null && incompValue !== "" && incompValue !== 0) {
        disabled = true;
        break;
      }
    }
  }

  return { visible, required, disabled, dynamicOptions };
}

// ─── Section Renderer ───

export function FormSectionRenderer({
  section,
  values,
  onChange,
  onInvalidate,
  compact,
}: {
  section: FormSection;
  values: Record<string, any>;
  onChange: (path: string, value: any) => void;
  onInvalidate?: (field: string) => void;
  compact?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(section.defaultCollapsed ?? false);
  const hasVisibleFields = section.fields.some(
    (f) => resolveFieldState(f, values).visible,
  );

  if (!hasVisibleFields) return null;

  return (
    <div className="border border-gray-800/50 rounded-lg overflow-hidden">
      {section.collapsible ? (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-800/20 transition-colors"
        >
          <div>
            <span className="text-xs font-semibold text-gray-200">{section.title}</span>
            {section.description && (
              <span className="text-[10px] text-gray-500 ml-2">{section.description}</span>
            )}
          </div>
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          )}
        </button>
      ) : (
        <div className="px-3 pt-3 pb-1">
          <span className="text-xs font-semibold text-gray-200">{section.title}</span>
          {section.description && (
            <span className="text-[10px] text-gray-500 ml-2">{section.description}</span>
          )}
        </div>
      )}

      {!collapsed && (
        <div className={cn("px-3 pb-3 space-y-3", section.collapsible && "border-t border-gray-800/40 pt-3")}>
          {section.fields.map((field) => (
            <SchemaFieldRenderer
              key={field.key}
              field={field}
              value={values[field.key]}
              context={{
                allValues: values,
                onFieldChange: onChange,
                onFieldInvalidate: onInvalidate,
                compact,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Recursive Field Renderer ───

export function SchemaFieldRenderer({
  field,
  value,
  context,
}: {
  field: FieldSchema;
  value: any;
  context: FieldRenderContext;
}) {
  const { allValues, onFieldChange, onFieldInvalidate, compact } = context;
  const state = resolveFieldState(field, allValues);

  if (!state.visible) return null;

  const path = context.parentPath ? `${context.parentPath}.${field.key}` : field.key;
  const isDisabled = state.disabled;

  const handleChange = useCallback(
    (newValue: any) => {
      onFieldChange(path, newValue);
      if (field.invalidates && onFieldInvalidate) {
        field.invalidates.forEach((f) => onFieldInvalidate(f));
      }
    },
    [path, field.invalidates, onFieldChange, onFieldInvalidate],
  );

  // Immutable / locked display
  if (isDisabled && field.type !== "object" && field.type !== "array") {
    return (
      <ImmutableField
        field={field}
        value={value}
        options={state.dynamicOptions || field.options}
        compact={compact}
      />
    );
  }

  switch (field.type) {
    case "string":
      return <StringField field={field} value={value} onChange={handleChange} compact={compact} />;
    case "number":
      return <NumberField field={field} value={value} onChange={handleChange} compact={compact} />;
    case "currency":
      return <CurrencyField field={field} value={value} onChange={handleChange} compact={compact} />;
    case "enum":
      return (
        <EnumField
          field={field}
          value={value}
          onChange={handleChange}
          options={state.dynamicOptions || field.options || []}
          compact={compact}
        />
      );
    case "multiEnum":
      return (
        <MultiEnumField
          field={field}
          value={value}
          onChange={handleChange}
          options={state.dynamicOptions || field.options || []}
          compact={compact}
        />
      );
    case "boolean":
      return <BooleanField field={field} value={value} onChange={handleChange} compact={compact} />;
    case "date":
    case "datetime":
      return <DateTimeField field={field} value={value} onChange={handleChange} compact={compact} />;
    case "object":
      return (
        <ObjectField
          field={field}
          value={value}
          context={context}
          path={path}
        />
      );
    case "array":
      return (
        <ArrayField
          field={field}
          value={value}
          context={context}
          path={path}
        />
      );
    default:
      return null;
  }
}

// ─── Primitive Fields ───

function FieldLabel({ field, compact }: { field: FieldSchema; compact?: boolean }) {
  return (
    <Label className={cn("flex items-center gap-1.5", compact ? "text-[10px]" : "text-xs", "text-gray-400")}>
      {field.label}
      {field.required && <span className="text-red-400">*</span>}
      {field.helpText && (
        <span className="group relative">
          <HelpCircle className="w-3 h-3 text-gray-600 cursor-help" />
          <span className="absolute left-0 bottom-full mb-1 hidden group-hover:block bg-gray-800 border border-gray-700 text-[10px] text-gray-300 px-2 py-1.5 rounded shadow-lg z-50 w-[250px]">
            {field.helpText}
          </span>
        </span>
      )}
    </Label>
  );
}

function ImmutableField({
  field,
  value,
  options,
  compact,
}: {
  field: FieldSchema;
  value: any;
  options?: EnumOption[];
  compact?: boolean;
}) {
  const displayValue =
    field.type === "enum" && options
      ? options.find((o) => o.value === value)?.label || value
      : field.type === "currency" && value
      ? formatBudget(value)
      : String(value ?? "—");

  return (
    <div className="space-y-1">
      <Label className={cn("flex items-center gap-1.5", compact ? "text-[10px]" : "text-xs", "text-gray-500")}>
        <Lock className="w-3 h-3" />
        {field.label}
      </Label>
      <div className="h-8 flex items-center px-3 rounded-md bg-gray-950/50 border border-gray-800/40 text-xs text-gray-400">
        {displayValue}
      </div>
    </div>
  );
}

function StringField({
  field,
  value,
  onChange,
  compact,
}: {
  field: FieldSchema;
  value: any;
  onChange: (v: any) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel field={field} compact={compact} />
      <Input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={cn(
          "bg-gray-950 border-gray-800 focus:border-blue-500 text-gray-200",
          compact ? "h-7 text-[11px]" : "h-8 text-sm",
        )}
      />
    </div>
  );
}

function NumberField({
  field,
  value,
  onChange,
  compact,
}: {
  field: FieldSchema;
  value: any;
  onChange: (v: any) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel field={field} compact={compact} />
      <Input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step || 1}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        placeholder={field.placeholder}
        className={cn(
          "bg-gray-950 border-gray-800 focus:border-blue-500 font-mono text-gray-200",
          compact ? "h-7 text-[11px]" : "h-8 text-sm",
        )}
      />
    </div>
  );
}

function CurrencyField({
  field,
  value,
  onChange,
  compact,
}: {
  field: FieldSchema;
  value: any;
  onChange: (v: any) => void;
  compact?: boolean;
}) {
  const multiplier = field.currencyMultiplier || 100;

  return (
    <div className="space-y-1">
      <FieldLabel field={field} compact={compact} />
      <div className="relative">
        <Input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step || multiplier}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={field.placeholder || "Amount in smallest unit"}
          className={cn(
            "bg-gray-950 border-gray-800 focus:border-blue-500 font-mono text-yellow-400 pr-20",
            compact ? "h-7 text-[11px]" : "h-8 text-sm",
          )}
        />
        {value && Number(value) > 0 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">
            = {(Number(value) / multiplier).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

function EnumField({
  field,
  value,
  onChange,
  options,
  compact,
}: {
  field: FieldSchema;
  value: any;
  onChange: (v: any) => void;
  options: EnumOption[];
  compact?: boolean;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel field={field} compact={compact} />
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={cn(
          "w-full rounded-md bg-gray-950 border border-gray-800 text-gray-200 px-2.5 focus:outline-none focus:border-blue-500 transition-colors",
          compact ? "h-7 text-[11px]" : "h-8 text-sm",
        )}
      >
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
            {o.disabled && o.disabledReason ? ` (${o.disabledReason})` : ""}
          </option>
        ))}
      </select>
      {value && options.find((o) => o.value === value)?.description && (
        <p className="text-[10px] text-gray-600">
          {options.find((o) => o.value === value)?.description}
        </p>
      )}
    </div>
  );
}

function MultiEnumField({
  field,
  value,
  onChange,
  options,
  compact,
}: {
  field: FieldSchema;
  value: any;
  onChange: (v: any) => void;
  options: EnumOption[];
  compact?: boolean;
}) {
  const selected: string[] = Array.isArray(value) ? value : value ? [value] : [];

  const toggle = (optVal: string) => {
    const next = selected.includes(optVal)
      ? selected.filter((v) => v !== optVal)
      : [...selected, optVal];
    onChange(next.length > 0 ? next : undefined);
  };

  return (
    <div className="space-y-1.5">
      <FieldLabel field={field} compact={compact} />
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const isActive = selected.includes(o.value);
          return (
            <button
              key={o.value}
              onClick={() => toggle(o.value)}
              disabled={o.disabled}
              className={cn(
                "px-2 py-1 rounded-md border text-[10px] font-medium transition-colors",
                isActive
                  ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                  : "bg-gray-900/50 border-gray-800/60 text-gray-500 hover:text-gray-300 hover:border-gray-700",
                o.disabled && "opacity-40 cursor-not-allowed",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BooleanField({
  field,
  value,
  onChange,
  compact,
}: {
  field: FieldSchema;
  value: any;
  onChange: (v: any) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Checkbox
        checked={!!value}
        onCheckedChange={(checked) => onChange(!!checked)}
        className="shrink-0"
      />
      <div className="space-y-0">
        <label className={cn("font-medium cursor-pointer", compact ? "text-[11px]" : "text-xs", "text-gray-300")}>
          {field.label}
        </label>
        {field.helpText && (
          <p className="text-[10px] text-gray-600">{field.helpText}</p>
        )}
      </div>
    </div>
  );
}

function parseDateTimeParts(v: any): { date: string; hour: string; minute: string } {
  if (!v) return { date: "", hour: "", minute: "" };
  const s = String(v);
  const match = s.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return { date: "", hour: "", minute: "" };
  return { date: match[1], hour: match[2] || "00", minute: match[3] || "00" };
}

function DateTimeField({
  field,
  value,
  onChange,
  compact,
}: {
  field: FieldSchema;
  value: any;
  onChange: (v: any) => void;
  compact?: boolean;
}) {
  if (field.type === "date") {
    const displayValue = value ? String(value).slice(0, 10) : "";
    return (
      <div className="space-y-1">
        <FieldLabel field={field} compact={compact} />
        <Input
          type="date"
          value={displayValue}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={cn(
            "bg-gray-950 border-gray-800 focus:border-blue-500 text-gray-200",
            compact ? "h-7 text-[11px]" : "h-8 text-sm",
          )}
        />
      </div>
    );
  }

  const parts = parseDateTimeParts(value);
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  const update = (date: string, hour: string, minute: string) => {
    if (!date) { onChange(undefined); return; }
    onChange(`${date}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`);
  };

  return (
    <div className="space-y-1">
      <FieldLabel field={field} compact={compact} />
      <div className="flex gap-1.5">
        <Input
          type="date"
          value={parts.date}
          onChange={(e) => update(e.target.value, parts.hour, parts.minute)}
          className={cn(
            "bg-gray-950 border-gray-800 focus:border-blue-500 text-gray-200 flex-1",
            compact ? "h-7 text-[11px]" : "h-8 text-sm",
          )}
        />
        <select
          value={parts.hour}
          onChange={(e) => update(parts.date, e.target.value, parts.minute)}
          className={cn(
            "w-14 rounded-md bg-gray-950 border border-gray-800 text-gray-200 px-1 focus:border-blue-500",
            compact ? "h-7 text-[11px]" : "h-8 text-sm",
          )}
        >
          {hours.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-gray-500 self-center text-xs">:</span>
        <select
          value={minutes.includes(parts.minute) ? parts.minute : "00"}
          onChange={(e) => update(parts.date, parts.hour, e.target.value)}
          className={cn(
            "w-14 rounded-md bg-gray-950 border border-gray-800 text-gray-200 px-1 focus:border-blue-500",
            compact ? "h-7 text-[11px]" : "h-8 text-sm",
          )}
        >
          {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Composite Fields ───

function ObjectField({
  field,
  value,
  context,
  path,
}: {
  field: FieldSchema;
  value: any;
  context: FieldRenderContext;
  path: string;
}) {
  // Depth = number of dots in the path. Keep the top two levels open by default;
  // collapse deeper sections unless the user already has values in them.
  const depth = path ? path.split(".").length - 1 : 0;
  const hasContent = value && typeof value === "object" && Object.keys(value).length > 0;
  const [expanded, setExpanded] = useState(depth < 2 || hasContent);
  const objectValue = value || {};

  if (!field.objectSchema || field.objectSchema.length === 0) {
    // No sub-schema — show raw JSON summary
    return (
      <div className="space-y-1">
        <FieldLabel field={field} compact={context.compact} />
        <div className="text-[10px] text-gray-500 font-mono bg-gray-950/50 rounded-md px-2.5 py-1.5 border border-gray-800/40 truncate">
          {value ? JSON.stringify(value).slice(0, 100) : "—"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 group"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-600" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-600" />
        )}
        <span className={cn("text-xs font-medium text-gray-300 group-hover:text-gray-100")}>
          {field.label}
        </span>
        {field.required && <span className="text-red-400 text-[10px]">*</span>}
        {!expanded && value && (
          <span className="text-[10px] text-gray-600 font-mono ml-2">
            {Object.keys(objectValue).length} fields
          </span>
        )}
      </button>

      {expanded && (
        <div className="ml-3 pl-3 border-l border-gray-800/40 space-y-2.5 pt-1">
          {field.objectSchema.map((subField) => (
            <SchemaFieldRenderer
              key={subField.key}
              field={subField}
              value={objectValue[subField.key]}
              context={{
                ...context,
                parentPath: path,
                allValues: objectValue,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ArrayField({
  field,
  value,
  context,
  path,
}: {
  field: FieldSchema;
  value: any;
  context: FieldRenderContext;
  path: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const items: any[] = Array.isArray(value) ? value : [];
  const canAdd = field.maxItems === undefined || items.length < field.maxItems;
  const canRemove = field.minItems === undefined || items.length > field.minItems;

  const handleAddItem = () => {
    if (!canAdd) return;
    const newItem = field.arrayItemSchema?.type === "object" ? {} : "";
    context.onFieldChange(path, [...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (!canRemove) return;
    const next = items.filter((_, i) => i !== index);
    context.onFieldChange(path, next.length > 0 ? next : undefined);
  };

  const handleItemChange = (index: number, newValue: any) => {
    const next = [...items];
    next[index] = newValue;
    context.onFieldChange(path, next);
  };

  // Use stable identifiers (id, key) when available so deleting a middle item doesn't bleed
  // state into siblings. Fall back to index — using user-editable fields (name, free-text value)
  // would re-mount the input on every keystroke and steal focus.
  const itemKey = (item: any, index: number): string => {
    if (item && typeof item === "object") {
      const stable = item.id ?? item.key;
      if (stable !== undefined && stable !== null) return String(stable);
    }
    return String(index);
  };

  if (!field.arrayItemSchema) {
    return (
      <div className="space-y-1">
        <FieldLabel field={field} compact={context.compact} />
        <div className="text-[10px] text-gray-500 font-mono">
          [{items.length} items]
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 group"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-600" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-600" />
        )}
        <span className="text-xs font-medium text-gray-300 group-hover:text-gray-100">
          {field.label}
        </span>
        {field.required && <span className="text-red-400 text-[10px]">*</span>}
        <span className="text-[10px] text-gray-600 ml-1">
          [{items.length}]
        </span>
      </button>

      {field.helpText && (
        <p className="text-[10px] text-gray-600 ml-5">{field.helpText}</p>
      )}

      {expanded && (
        <div className="ml-3 pl-3 border-l border-gray-800/40 space-y-2">
          {items.map((item, index) => (
            <div key={`${path}.${itemKey(item, index)}`} className="relative group/item">
              <div className="flex items-start gap-1.5">
                <span className="text-[9px] text-gray-700 font-mono mt-2 w-4 shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  {field.arrayItemSchema!.type === "object" && field.arrayItemSchema!.objectSchema ? (
                    <div className="bg-gray-900/30 border border-gray-800/30 rounded-md p-2 space-y-2">
                      {field.arrayItemSchema!.objectSchema.map((subField) => (
                        <SchemaFieldRenderer
                          key={subField.key}
                          field={subField}
                          value={item?.[subField.key]}
                          context={{
                            ...context,
                            parentPath: `${path}.${index}`,
                            allValues: item || {},
                            onFieldChange: (subPath, newVal) => {
                              const key = subPath.split(".").pop()!;
                              handleItemChange(index, { ...item, [key]: newVal });
                            },
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <Input
                      value={typeof item === "string" ? item : JSON.stringify(item)}
                      onChange={(e) => handleItemChange(index, e.target.value)}
                      placeholder={field.arrayItemSchema!.placeholder}
                      className="h-7 bg-gray-950 border-gray-800 text-[11px] focus:border-blue-500"
                    />
                  )}
                </div>
                {canRemove && field.editable && (
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="mt-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3 text-gray-600 hover:text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {canAdd && field.editable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddItem}
              className="h-6 text-[10px] text-gray-500 hover:text-blue-400 gap-1 px-2"
            >
              <Plus className="w-3 h-3" />
              Add {field.arrayItemSchema.label || "item"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
