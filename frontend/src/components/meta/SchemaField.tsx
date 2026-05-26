"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  X,
  Search,
  Upload,
  Loader2,
} from "lucide-react";
import { cn, extractApiError } from "@/lib/utils";
import { formatBudget } from "@/lib/meta-schema";
import { uploadApi } from "@/services/api";
import { toast } from "sonner";

// ─── Types mirroring backend MetaFormSchemaEngine ───

export type SchemaFieldType =
  | "string"
  | "textarea"
  | "number"
  | "enum"
  | "boolean"
  | "date"
  | "datetime"
  | "currency"
  | "object"
  | "array"
  | "multiEnum"
  | "tags"
  | "time"
  | "upload";

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
  searchable?: boolean;
  rows?: number;
  tagSuggestions?: string[];
  visibleWhen?: { field: string; equals?: any; notEquals?: any };
  meta?: { uploadType?: "image" | "video" };
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
  adAccountId?: string;
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

  // incompatibleWith is now handled in handleChange (auto-clear) instead of disabling

  if (field.visibleWhen) {
    const depValue = getNestedValue(allValues, field.visibleWhen.field);
    if (field.visibleWhen.equals !== undefined) {
      const eq = field.visibleWhen.equals;
      if (Array.isArray(eq) && Array.isArray(depValue)) {
        visible = JSON.stringify(depValue.sort()) !== JSON.stringify(eq.sort()) ? false : visible;
      } else if (depValue !== eq) {
        visible = false;
      }
    }
    if (field.visibleWhen.notEquals !== undefined) {
      const neq = field.visibleWhen.notEquals;
      if (Array.isArray(neq) && Array.isArray(depValue)) {
        if (JSON.stringify(depValue.sort()) === JSON.stringify(neq.sort())) visible = false;
      } else if (depValue === neq) {
        visible = false;
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
  adAccountId,
}: {
  section: FormSection;
  values: Record<string, any>;
  onChange: (path: string, value: any) => void;
  onInvalidate?: (field: string) => void;
  compact?: boolean;
  adAccountId?: string;
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
                adAccountId,
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
      if (field.incompatibleWith && newValue !== undefined && newValue !== null && newValue !== "" && newValue !== 0) {
        for (const incompField of field.incompatibleWith) {
          const incompPath = context.parentPath ? `${context.parentPath}.${incompField}` : incompField;
          onFieldChange(incompPath, undefined);
        }
      }
      if (field.invalidates && onFieldInvalidate) {
        field.invalidates.forEach((f) => onFieldInvalidate(f));
      }
    },
    [path, field.incompatibleWith, field.invalidates, onFieldChange, onFieldInvalidate, context.parentPath],
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
    case "textarea":
      return <TextareaField field={field} value={value} onChange={handleChange} compact={compact} />;
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
    case "time":
      return <TimeField field={field} value={value} onChange={handleChange} compact={compact} />;
    case "tags":
      return <TagsField field={field} value={value} onChange={handleChange} compact={compact} />;
    case "upload":
      return <UploadField field={field} value={value} onChange={handleChange} adAccountId={context.adAccountId} />;
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

function FieldLabel({ field, compact, showHelp }: { field: FieldSchema; compact?: boolean; showHelp?: boolean }) {
  return (
    <div className="space-y-0.5">
      <Label className={cn("flex items-center gap-1.5", compact ? "text-[10px]" : "text-xs", "text-gray-400")}>
        {field.label}
        {field.required && <span className="text-red-400">*</span>}
        {field.helpText && !showHelp && (
          <span className="group relative">
            <HelpCircle className="w-3 h-3 text-gray-600 cursor-help" />
            <span className="absolute left-0 bottom-full mb-1 hidden group-hover:block bg-gray-800 border border-gray-700 text-[10px] text-gray-300 px-2 py-1.5 rounded shadow-lg z-50 w-[250px] whitespace-normal">
              {field.helpText}
            </span>
          </span>
        )}
      </Label>
      {field.helpText && showHelp && (
        <p className="text-[10px] text-gray-600 leading-tight">{field.helpText}</p>
      )}
    </div>
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
      : field.type === "tags" && Array.isArray(value)
      ? value.join(", ") || "—"
      : field.type === "boolean"
      ? (value ? "Yes" : "No")
      : field.type === "time" && typeof value === "number"
      ? `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
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
        onKeyDown={(e) => {
          if (["e", "E", "+", "-"].includes(e.key) && !field.min?.toString().includes("-")) {
            e.preventDefault();
          }
        }}
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
  return (
    <div className="space-y-1">
      <FieldLabel field={field} compact={compact} />
      <Input
        type="number"
        min={field.min}
        max={field.max}
        step={1}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") { onChange(undefined); return; }
          const parsed = parseInt(raw, 10);
          if (!isNaN(parsed)) onChange(parsed);
        }}
        onKeyDown={(e) => {
          if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
        }}
        placeholder={field.placeholder || "e.g. 500 = $5.00"}
        className={cn(
          "bg-gray-950 border-gray-800 focus:border-blue-500 font-mono text-yellow-400",
          compact ? "h-7 text-[11px]" : "h-8 text-sm",
        )}
      />
      {field.helpText && <p className="text-[10px] text-gray-600">{field.helpText}</p>}
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
  const useSearch = field.searchable || options.length > 8;
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  if (useSearch) {
    const filtered = query
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.value.toLowerCase().includes(query.toLowerCase()),
        )
      : options;
    const selectedLabel = options.find((o) => o.value === value)?.label;

    return (
      <div className="space-y-1" ref={containerRef}>
        <FieldLabel field={field} compact={compact} />
        <div className="relative">
          <button
            type="button"
            onClick={() => { setSearchOpen(!searchOpen); setQuery(""); }}
            className={cn(
              "w-full rounded-md bg-gray-950 border border-gray-800 text-left px-2.5 flex items-center justify-between transition-colors hover:border-gray-700",
              searchOpen && "border-blue-500",
              compact ? "h-7 text-[11px]" : "h-8 text-sm",
            )}
          >
            <span className={value ? "text-gray-200" : "text-gray-500"}>
              {selectedLabel || "— Select —"}
            </span>
            <ChevronDown className={cn("w-3 h-3 text-gray-500 transition-transform", searchOpen && "rotate-180")} />
          </button>
          {searchOpen && (
            <div className="absolute z-50 w-full mt-1 rounded-md bg-gray-900 border border-gray-700 shadow-xl overflow-hidden">
              <div className="p-1.5 border-b border-gray-800">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full h-7 pl-7 pr-2 rounded bg-gray-950 border border-gray-800 text-xs text-gray-200 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {!field.required && (
                  <button
                    type="button"
                    onClick={() => { onChange(undefined); setSearchOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-800/60 transition-colors",
                      !value ? "text-blue-400" : "text-gray-500",
                    )}
                  >
                    — Clear —
                  </button>
                )}
                {filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    disabled={o.disabled}
                    onClick={() => { onChange(o.value); setSearchOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-800/60 transition-colors",
                      o.value === value && "bg-blue-500/10 text-blue-400",
                      o.disabled && "opacity-40 cursor-not-allowed",
                      !o.disabled && o.value !== value && "text-gray-300",
                    )}
                  >
                    <span>{o.label}</span>
                    {o.description && <span className="block text-[10px] text-gray-500 mt-0.5">{o.description}</span>}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-3 py-2 text-[10px] text-gray-600">No options match "{query}"</div>
                )}
              </div>
            </div>
          )}
        </div>
        {value && options.find((o) => o.value === value)?.description && (
          <p className="text-[10px] text-gray-600">
            {options.find((o) => o.value === value)?.description}
          </p>
        )}
      </div>
    );
  }

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
  const isSearchable = field.searchable || options.length > 12;

  const toggle = (optVal: string) => {
    if (optVal === '__all__') {
      onChange(selected.includes('__all__') ? undefined : ['__all__']);
      return;
    }
    const without = selected.filter((v) => v !== '__all__' && v !== optVal);
    const next = selected.includes(optVal) ? without : [...without, optVal];
    onChange(next.length > 0 ? next : undefined);
  };

  if (isSearchable) {
    return (
      <SearchableMultiEnum
        field={field}
        selected={selected}
        toggle={toggle}
        options={options}
        compact={compact}
      />
    );
  }

  const optionValues = new Set(options.map((o) => o.value));
  const unknownSelected = selected.filter((v) => !optionValues.has(v));

  return (
    <div className="space-y-1.5">
      <FieldLabel field={field} compact={compact} />
      <div className="flex flex-wrap gap-1.5">
        {unknownSelected.map((v) => (
          <button
            key={v}
            onClick={() => toggle(v)}
            className="px-2 py-1 rounded-md border text-[10px] font-medium transition-colors bg-red-500/15 border-red-500/40 text-red-300"
          >
            {v} ×
          </button>
        ))}
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

function SearchableMultiEnum({
  field,
  selected,
  toggle,
  options,
  compact,
}: {
  field: FieldSchema;
  selected: string[];
  toggle: (v: string) => void;
  options: EnumOption[];
  compact?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = options.filter(
    (o) =>
      !selected.includes(o.value) &&
      o.label.toLowerCase().includes(search.toLowerCase()),
  );
  const optionMap = new Map(options.map((o) => [o.value, o]));
  const selectedItems = selected.map((v) => optionMap.get(v) || { value: v, label: v });

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <FieldLabel field={field} compact={compact} />
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedItems.map((o) => (
            <span
              key={o.value}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium",
                optionMap.has(o.value)
                  ? "bg-blue-500/15 border border-blue-500/40 text-blue-300"
                  : "bg-red-500/15 border border-red-500/40 text-red-300",
              )}
            >
              {o.label}
              <button
                onClick={() => toggle(o.value)}
                className={cn(
                  "ml-0.5",
                  optionMap.has(o.value) ? "text-blue-400 hover:text-blue-200" : "text-red-400 hover:text-red-200",
                )}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={`Search ${field.label?.toLowerCase() || "options"}...`}
          className="w-full px-2.5 py-1.5 bg-gray-900/50 border border-gray-800/60 rounded-md text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-gray-900 border border-gray-700 rounded-md shadow-xl">
            {filtered.slice(0, 50).map((o) => (
              <button
                key={o.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  toggle(o.value);
                  setSearch("");
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                {o.label}
              </button>
            ))}
            {filtered.length > 50 && (
              <div className="px-2.5 py-1.5 text-[10px] text-gray-600">
                {filtered.length - 50} more — type to narrow
              </div>
            )}
          </div>
        )}
        {open && filtered.length === 0 && search && (
          <div className="absolute z-20 mt-1 w-full bg-gray-900 border border-gray-700 rounded-md shadow-xl p-2 text-xs text-gray-500">
            No matches
          </div>
        )}
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
  const isOn = !!value;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="space-y-0 min-w-0">
        <label className={cn("font-medium cursor-pointer", compact ? "text-[11px]" : "text-xs", "text-gray-300")}>
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {field.helpText && (
          <p className="text-[10px] text-gray-600">{field.helpText}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        onClick={() => onChange(!isOn)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          isOn ? "bg-blue-600" : "bg-gray-700",
        )}
      >
        <span className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          isOn ? "translate-x-4" : "translate-x-0",
        )} />
      </button>
    </div>
  );
}

function parseDateTimeParts(v: any): { date: string; time: string } {
  if (!v) return { date: "", time: "00:00" };
  const s = String(v);
  const match = s.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  if (!match) return { date: "", time: "00:00" };
  return { date: match[1], time: match[2] || "00:00" };
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

  const update = (date: string, time: string) => {
    if (!date) { onChange(undefined); return; }
    onChange(`${date}T${time || "00:00"}:00`);
  };

  return (
    <div className="space-y-1">
      <FieldLabel field={field} compact={compact} />
      <div className="flex gap-1.5">
        <Input
          type="date"
          value={parts.date}
          onChange={(e) => update(e.target.value, parts.time)}
          className={cn(
            "bg-gray-950 border-gray-800 focus:border-blue-500 text-gray-200 flex-1",
            compact ? "h-7 text-[11px]" : "h-8 text-sm",
          )}
        />
        <Input
          type="time"
          value={parts.time}
          onChange={(e) => update(parts.date, e.target.value)}
          className={cn(
            "bg-gray-950 border-gray-800 focus:border-blue-500 text-gray-200 w-[120px]",
            compact ? "h-7 text-[11px]" : "h-8 text-sm",
          )}
        />
      </div>
    </div>
  );
}

function TextareaField({
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
  const charCount = (value || "").length;
  const maxLen = field.max;
  return (
    <div className="space-y-1">
      <FieldLabel field={field} compact={compact} />
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={field.placeholder}
        rows={field.rows || 3}
        className={cn(
          "w-full rounded-md bg-gray-950 border border-gray-800 focus:border-blue-500 text-gray-200 px-2.5 py-2 resize-y outline-none transition-colors",
          compact ? "text-[11px]" : "text-sm",
        )}
      />
      <div className="flex justify-between">
        {field.helpText && <p className="text-[10px] text-gray-600">{field.helpText}</p>}
        {maxLen ? (
          <span className={cn("text-[10px] font-mono ml-auto", charCount > maxLen ? "text-red-400" : "text-gray-600")}>
            {charCount}/{maxLen}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TagsField({
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
  const tags: string[] = Array.isArray(value) ? value : value ? [value] : [];
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestions = field.tagSuggestions || [];
  const filteredSuggestions = inputValue
    ? suggestions.filter(
        (s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s),
      )
    : suggestions.filter((s) => !tags.includes(s));

  useEffect(() => {
    if (!showSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSuggestions]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toUpperCase();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInputValue("");
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag);
    onChange(next.length > 0 ? next : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      if (inputValue.trim()) addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      <FieldLabel field={field} compact={compact} />
      <div
        className={cn(
          "min-h-[2rem] rounded-md bg-gray-950 border border-gray-800 focus-within:border-blue-500 px-2 py-1.5 flex flex-wrap gap-1.5 items-center transition-colors cursor-text",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-[11px] font-medium text-blue-300"
          >
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[60px]">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setShowSuggestions(true); }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={tags.length === 0 ? (field.placeholder || "Type and press Enter...") : ""}
            className="w-full bg-transparent text-[11px] text-gray-200 outline-none placeholder:text-gray-600"
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 top-full mt-1 w-48 max-h-40 overflow-y-auto rounded-md bg-gray-900 border border-gray-700 shadow-xl py-1">
              {filteredSuggestions.slice(0, 20).map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(s)}
                  className="w-full text-left px-3 py-1 text-[11px] text-gray-300 hover:bg-gray-800/60 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {field.helpText && <p className="text-[10px] text-gray-600">{field.helpText}</p>}
    </div>
  );
}

function TimeField({
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
  const totalMinutes = typeof value === "number" ? value : 0;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = [0, 15, 30, 45];

  const formatTime = (h: number, m: number) => {
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  };

  return (
    <div className="space-y-1">
      <FieldLabel field={field} compact={compact} />
      <div className="flex items-center gap-2">
        <select
          value={hours}
          onChange={(e) => onChange(Number(e.target.value) * 60 + mins)}
          className={cn(
            "rounded-md bg-gray-950 border border-gray-800 text-gray-200 px-2 focus:border-blue-500 focus:outline-none transition-colors",
            compact ? "h-7 text-[11px]" : "h-8 text-sm",
          )}
        >
          {hourOptions.map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}
            </option>
          ))}
        </select>
        <span className="text-gray-500 text-xs">:</span>
        <select
          value={minuteOptions.includes(mins) ? mins : 0}
          onChange={(e) => onChange(hours * 60 + Number(e.target.value))}
          className={cn(
            "rounded-md bg-gray-950 border border-gray-800 text-gray-200 px-2 focus:border-blue-500 focus:outline-none transition-colors",
            compact ? "h-7 text-[11px]" : "h-8 text-sm",
          )}
        >
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-gray-500 ml-1">{formatTime(hours, mins)}</span>
      </div>
      {field.helpText && <p className="text-[10px] text-gray-600">{field.helpText}</p>}
    </div>
  );
}

function UploadField({
  field,
  value,
  onChange,
  adAccountId,
}: {
  field: FieldSchema;
  value: any;
  onChange: (v: any) => void;
  adAccountId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const uploadType = field.meta?.uploadType ?? "image";
  const accept = uploadType === "image"
    ? "image/jpeg,image/png,image/gif,image/webp"
    : "video/mp4,video/quicktime,video/x-msvideo,video/webm";
  const disabled = !adAccountId || uploading;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adAccountId) return;
    setUploading(true);
    try {
      const resp = uploadType === "image"
        ? await uploadApi.uploadImage(file, adAccountId)
        : await uploadApi.uploadVideo(file, adAccountId);
      onChange(uploadType === "image" ? resp.data.hash : resp.data.videoId);
      toast.success(`${uploadType === "image" ? "Image" : "Video"} uploaded`);
    } catch (err: any) {
      toast.error(extractApiError(err, `${uploadType} upload failed`));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <FieldLabel field={field} />
      {value && <p className="text-[10px] text-gray-500 font-mono truncate">{value}</p>}
      <label className={cn(
        "inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border cursor-pointer",
        disabled
          ? "text-gray-600 border-gray-800 cursor-not-allowed"
          : "text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300",
      )}>
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {uploading ? "Uploading..." : `Upload ${uploadType}`}
        <input type="file" accept={accept} onChange={handleUpload} className="hidden" disabled={disabled} />
      </label>
      {field.helpText && <p className="text-[10px] text-gray-600">{field.helpText}</p>}
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

  // Key array items by index only. We must NOT key off item content (id, key, name, etc.):
  // for Meta targeting arrays those fields ARE user-editable inputs — regions/cities/zips edit
  // `key`, detailed targeting/custom audiences edit `id`. Deriving the React key from them means
  // typing a single character changes the key, which unmounts/remounts the row and steals focus.
  // Items here are only ever appended or removed (never reordered) via the Add/Remove buttons, and
  // every input is fully controlled by `value` from props, so index keys reconcile correctly.
  const itemKey = (_item: any, index: number): string => String(index);

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
