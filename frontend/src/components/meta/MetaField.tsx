"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBudget } from "@/lib/meta-schema";

interface MetaFieldProps {
  label: string;
  value: any;
  onChange?: (value: any) => void;
  type?: "string" | "number" | "enum" | "boolean" | "object";
  options?: { value: string; label: string }[];
  immutable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  isBudget?: boolean;
  className?: string;
}

export function MetaField({
  label, value, onChange, type = "string", options,
  immutable, disabled, placeholder, hint, isBudget, className,
}: MetaFieldProps) {
  const isReadOnly = immutable || disabled;

  if (immutable) {
    const displayValue = type === "enum" && options
      ? options.find(o => o.value === value)?.label || value
      : String(value ?? "—");

    return (
      <div className={cn("space-y-1.5", className)}>
        <Label className="text-xs text-gray-500 flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          {label}
          <span className="text-[9px] text-gray-600 ml-1">(immutable)</span>
        </Label>
        <div className="h-9 flex items-center px-3 rounded-md bg-gray-950/50 border border-gray-800/40 text-sm text-gray-400">
          {displayValue}
        </div>
      </div>
    );
  }

  if (type === "enum" && options) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <Label className="text-xs text-gray-400">{label}</Label>
        <select
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={isReadOnly}
          className={cn(
            "w-full h-9 rounded-md bg-gray-950 border border-gray-800 text-sm text-gray-200 px-2.5 focus:outline-none focus:border-blue-500 transition-colors",
            isReadOnly && "opacity-60 cursor-not-allowed"
          )}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {hint && <p className="text-[10px] text-gray-600">{hint}</p>}
      </div>
    );
  }

  if (type === "number" || isBudget) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <Label className="text-xs text-gray-400">{label}</Label>
        <div className="relative">
          <Input
            type="number"
            min={0}
            step={isBudget ? 100 : 1}
            value={value || ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") { onChange?.(undefined); return; }
              const parsed = Number(raw);
              if (!isNaN(parsed)) onChange?.(parsed);
            }}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            placeholder={placeholder || (isBudget ? "Amount in smallest currency unit" : "")}
            disabled={isReadOnly}
            className={cn(
              "bg-gray-950 border-gray-800 focus:border-blue-500 font-mono text-yellow-400",
              isBudget && "pr-20",
              isReadOnly && "opacity-60 cursor-not-allowed"
            )}
          />
          {isBudget && value && Number(value) > 0 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">
              = {formatBudget(value)}
            </span>
          )}
        </div>
        {hint && <p className="text-[10px] text-gray-600">{hint}</p>}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-gray-400">{label}</Label>
      <Input
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={isReadOnly}
        className={cn(
          "bg-gray-900/50 border-gray-800/60 focus:border-blue-500/50",
          isReadOnly && "opacity-60 cursor-not-allowed"
        )}
      />
      {hint && <p className="text-[10px] text-gray-600">{hint}</p>}
    </div>
  );
}
