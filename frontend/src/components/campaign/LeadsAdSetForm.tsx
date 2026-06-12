"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Info,
  AlertTriangle,
  Search,
  X,
  MapPin,
  ShieldCheck,
  Settings2,
  ExternalLink,
} from "lucide-react";

// ─── Reusable primitives ──────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-blue-600" : "bg-gray-700"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-md transition-transform duration-200",
          checked ? "translate-x-[18px]" : "translate-x-0"
        )}
      />
    </button>
  );
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-gray-900/40 border border-gray-800/60 rounded-xl overflow-hidden", className)}>
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  hasToggle,
  toggled,
  onToggle,
  badge,
}: {
  title: string;
  hasToggle?: boolean;
  toggled?: boolean;
  onToggle?: (v: boolean) => void;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800/40">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
        {badge}
      </div>
      {hasToggle && onToggle && (
        <Toggle checked={toggled ?? false} onChange={onToggle} />
      )}
    </div>
  );
}

function SectionBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-5 py-4 space-y-4", className)}>
      {children}
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-gray-300">
        {label}
        {required && <span className="text-blue-400 ml-1">*</span>}
      </Label>
      {children}
      {hint && (
        <p className="text-[11px] text-gray-500 flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 shrink-0 text-gray-600" />
          {hint}
        </p>
      )}
    </div>
  );
}

function AdvantageBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
      Advantage+
    </span>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-3.5 rounded-lg bg-amber-500/5 border border-l-2 border-amber-500/30 border-l-amber-500/70">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="text-xs text-amber-200/80 space-y-1.5">{children}</div>
    </div>
  );
}

// Suppress unused warning — WarningBox is available for future use like Engagement form
void WarningBox;

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-3.5 rounded-lg bg-blue-500/5 border border-l-2 border-blue-500/20 border-l-blue-500/60">
      <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
      <div className="text-xs text-blue-200/80 space-y-1.5">{children}</div>
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Collapsible({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {label}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ─── Placement Modal ──────────────────────────────────────────────────────────

const PLACEMENT_OPTIONS = {
  "Apps and sites": [
    "Audience Network native, banner and interstitial",
    "Audience Network rewarded videos",
  ],
  Feeds: ["Facebook Marketplace", "Facebook right column"],
};

function PlacementModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (excluded: string[]) => void;
}) {
  const [specificOnly, setSpecificOnly] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);

  const toggle = (placement: string) => {
    setExcluded((prev) =>
      prev.includes(placement) ? prev.filter((p) => p !== placement) : [...prev, placement]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800/60">
          <h3 className="text-sm font-semibold text-gray-100">Edit placement controls</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={specificOnly}
              onChange={(e) => setSpecificOnly(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30 focus:outline-none"
            />
            <div>
              <div className="text-xs font-medium text-gray-200">
                My business can only advertise on specific placements
              </div>
            </div>
          </label>

          {Object.entries(PLACEMENT_OPTIONS).map(([group, placements]) => (
            <div key={group} className="space-y-2.5">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                {group}
              </div>
              {placements.map((p) => (
                <label key={p} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excluded.includes(p)}
                    onChange={() => toggle(p)}
                    className="w-4 h-4 rounded border border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30 focus:outline-none"
                  />
                  <span className="text-xs text-gray-300">{p}</span>
                </label>
              ))}
            </div>
          ))}
        </div>

        <div className="flex gap-2.5 p-5 border-t border-gray-800/60">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-9 text-xs font-medium rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onSave(excluded); onClose(); }}
            className="flex-1 h-9 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Review changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inventory filter radio options ──────────────────────────────────────────

const INVENTORY_OPTIONS = [
  {
    value: "expanded",
    label: "Expanded inventory",
    description:
      "Show ads on all content that adheres to our Content Monetization Policies so you get the most reach. This filter is applied automatically unless you change it.",
  },
  {
    value: "moderate",
    label: "Moderate inventory",
    description: "Exclude highly sensitive content. This lowers your reach and may increase costs.",
  },
  {
    value: "limited",
    label: "Limited inventory",
    description:
      "Exclude additional sensitive content. This lowers your reach and may increase costs.",
  },
];

function InventoryFilterSubsection({
  title,
  appliesToLabel,
}: {
  title: string;
  appliesToLabel: string;
}) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState("expanded");

  return (
    <div className="border border-gray-800/40 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/20 hover:bg-gray-800/30 transition-colors"
      >
        <span className="text-xs font-medium text-gray-300">{title}</span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-3">
          <p className="text-[11px] text-gray-500">
            <span className="text-gray-600">Applies only to: </span>
            {appliesToLabel}
          </p>

          <div className="space-y-2.5">
            {INVENTORY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  selected === opt.value
                    ? "bg-blue-500/8 border-blue-500/30"
                    : "bg-gray-800/15 border-gray-700/30 hover:border-gray-600/50"
                )}
              >
                <input
                  type="radio"
                  name={`inventory-${title}`}
                  value={opt.value}
                  checked={selected === opt.value}
                  onChange={() => setSelected(opt.value)}
                  className="mt-0.5 w-3.5 h-3.5 accent-blue-500 shrink-0"
                />
                <div className="space-y-0.5 min-w-0">
                  <div
                    className={cn(
                      "text-xs font-semibold",
                      selected === opt.value ? "text-blue-300" : "text-gray-300"
                    )}
                  >
                    {opt.label}
                    {opt.value === "expanded" && (
                      <span className="ml-1.5 text-[10px] text-gray-600 font-normal">(default)</span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 leading-relaxed">{opt.description}</div>
                </div>
              </label>
            ))}
          </div>

          <button
            type="button"
            className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            See examples of excluded content
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function PublisherBlockListsSubsection() {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-gray-800/40 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/20 hover:bg-gray-800/30 transition-colors"
      >
        <span className="text-xs font-medium text-gray-300">Publisher block lists</span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>

      {open && (
        <div className="px-4 py-4">
          <InfoBox>
            <span>You don&apos;t have any publisher block lists. </span>
            <button
              type="button"
              onClick={() => toast.info("Publisher block lists are managed in Meta Business Manager.")}
              className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
            >
              Create a publisher block list
            </button>
            <span className="text-blue-200/50"> or </span>
            <button
              type="button"
              onClick={() => toast.info("Learn more about publisher block lists in Meta Help Centre.")}
              className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
            >
              learn more
            </button>
          </InfoBox>
        </div>
      )}
    </div>
  );
}

function ContentTypeExclusionsSubsection() {
  const [open, setOpen] = useState(true);
  const [excludeLiveVideos, setExcludeLiveVideos] = useState(false);

  return (
    <div className="border border-gray-800/40 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/20 hover:bg-gray-800/30 transition-colors"
      >
        <span className="text-xs font-medium text-gray-300">Content type exclusions</span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          <p className="text-[11px] text-gray-500">
            <span className="text-gray-600">Applies only to: </span>
            Facebook in-stream reels and Ads on Facebook Reels
          </p>

          {/* Exclude live videos */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Exclude live videos
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeLiveVideos}
                onChange={(e) => setExcludeLiveVideos(e.target.checked)}
                className="w-4 h-4 rounded border border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30 focus:outline-none"
              />
              <span className="text-xs text-gray-300">Facebook in-stream reels ads</span>
            </label>
          </div>

          {/* Exclude nonpartner-publishers */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Exclude nonpartner-publishers
            </div>
            <label className="flex items-center gap-2.5 cursor-not-allowed opacity-50">
              <input
                type="checkbox"
                disabled
                className="w-4 h-4 rounded border border-gray-600 bg-gray-800 text-blue-500 cursor-not-allowed"
              />
              <span className="text-xs text-gray-400">
                Facebook in-stream reels and Ads on Facebook Reels
              </span>
              <button
                type="button"
                title="This option requires additional account eligibility."
                className="text-gray-600 hover:text-gray-400 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("This option requires account eligibility for nonpartner-publisher exclusions.");
                }}
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function BrandSafetySection() {
  return (
    <SectionCard>
      <SectionHeader title="Brand safety and suitability" />
      <SectionBody>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-300">Inventory filters</Label>
          <div className="space-y-2 mt-2">
            <InventoryFilterSubsection
              title="In-content ads"
              appliesToLabel="Facebook in-stream reels and Ads on Facebook Reels"
            />
            <InventoryFilterSubsection
              title="Audience Network ads"
              appliesToLabel="Audience Network"
            />
          </div>
        </div>

        <PublisherBlockListsSubsection />
        <ContentTypeExclusionsSubsection />
      </SectionBody>
    </SectionCard>
  );
}

// ─── Leads constants ──────────────────────────────────────────────────────────

const LEADS_CONVERSION_LOCATIONS = [
  { value: "WEBSITE", label: "Website", default: true },
  { value: "ON_AD", label: "Instant Form" },
  { value: "MESSENGER", label: "Messenger" },
  { value: "INSTAGRAM_DIRECT", label: "Instagram DM" },
  { value: "WHATSAPP", label: "WhatsApp" },
] as const;

type LeadsConversionLocationValue = typeof LEADS_CONVERSION_LOCATIONS[number]["value"];

const LEADS_CONVERSION_LOCATION_LABELS: Record<string, string> = Object.fromEntries(
  LEADS_CONVERSION_LOCATIONS.map((l) => [l.value, l.label])
);

const LEADS_PERFORMANCE_GOALS = [
  { value: "LEAD_GENERATION", label: "Maximize number of leads", recommended: true },
  { value: "OFFSITE_CONVERSIONS", label: "Maximize number of conversions" },
  { value: "LINK_CLICKS", label: "Maximize number of link clicks" },
  { value: "QUALITY_LEAD", label: "Maximize quality leads" },
] as const;

const LEADS_PERFORMANCE_GOAL_LABELS: Record<string, string> = Object.fromEntries(
  LEADS_PERFORMANCE_GOALS.map((g) => [g.value, g.label])
);

const LEADS_BILLING_EVENTS = [
  { value: "IMPRESSIONS", label: "Impressions", default: true },
  { value: "LINK_CLICKS", label: "Link clicks" },
] as const;

const LEADS_BILLING_EVENT_LABELS: Record<string, string> = Object.fromEntries(
  LEADS_BILLING_EVENTS.map((b) => [b.value, b.label])
);

// ─── Searchable dropdown ──────────────────────────────────────────────────────

function SearchableDropdown({
  placeholder,
  options,
  value,
  onChange,
  footer,
  groupLabel,
}: {
  placeholder: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  footer?: React.ReactNode;
  groupLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between h-9 px-3 rounded-lg bg-gray-800/30 border border-gray-700/40 text-sm text-gray-200 hover:border-gray-600/60 transition-colors"
      >
        <span className={value ? "text-gray-200" : "text-gray-600"}>{value || placeholder}</span>
        <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-gray-900 border border-gray-700/60 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-800/60">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 h-8 bg-gray-800/50 border border-gray-700/40 rounded-md text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {groupLabel && filtered.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-800/40 bg-gray-900/60">
                {groupLabel}
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-600">No results</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs transition-colors",
                    opt === value
                      ? "bg-blue-500/10 text-blue-300"
                      : "text-gray-300 hover:bg-gray-800/60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {groupLabel && <div className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />}
                    {opt}
                  </div>
                </button>
              ))
            )}
          </div>
          {footer && <div className="border-t border-gray-800/60">{footer}</div>}
        </div>
      )}
    </div>
  );
}

// Suppress unused import warning — SearchableDropdown is available for the audience section
void SearchableDropdown;

// ─── Main Component ───────────────────────────────────────────────────────────

interface LeadsAdSetFormProps {
  initialValues: Record<string, any>;
  campaignBudget?: number;
  onChange: (values: Record<string, any>) => void;
}

export function LeadsAdSetForm({
  initialValues,
  campaignBudget,
  onChange,
}: LeadsAdSetFormProps) {
  const [name, setName] = useState<string>(initialValues.name ?? "New Leads Ad Set");

  // Section 2: Leads
  const [conversionLocation, setConversionLocation] = useState<LeadsConversionLocationValue>(
    (initialValues.destination_type as LeadsConversionLocationValue) ?? "WEBSITE"
  );
  const [performanceGoal, setPerformanceGoal] = useState(
    initialValues.optimization_goal ?? "LEAD_GENERATION"
  );
  const [billingEvent, setBillingEvent] = useState(
    initialValues.billing_event ?? "IMPRESSIONS"
  );
  const [pageId, setPageId] = useState<string>(
    initialValues.promoted_object?.page_id ?? ""
  );
  const [pageIdTouched, setPageIdTouched] = useState(false);

  // Section 3: Dynamic creative
  const [dynamicCreative, setDynamicCreative] = useState(!!initialValues.is_dynamic_creative);
  const dynamicCreativeRef = useRef(dynamicCreative);
  dynamicCreativeRef.current = dynamicCreative;

  // Section 4: Budget & schedule
  const [hasEndDate, setHasEndDate] = useState(!!(initialValues.end_time));
  const [startDate, setStartDate] = useState(
    initialValues.start_time
      ? initialValues.start_time.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(
    initialValues.start_time ? initialValues.start_time.slice(11, 16) : "11:31"
  );
  const [endDate, setEndDate] = useState(
    initialValues.end_time ? initialValues.end_time.slice(0, 10) : ""
  );
  const [endTime, setEndTime] = useState(
    initialValues.end_time ? initialValues.end_time.slice(11, 16) : ""
  );

  // Section 7: Placements
  const [showPlacementModal, setShowPlacementModal] = useState(false);
  const [excludedPlacements, setExcludedPlacements] = useState<string[]>([]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const isInternalChange = useRef(false);

  const emit = useCallback(
    (overrides: Record<string, any> = {}) => {
      isInternalChange.current = true;
      const effectiveLoc = (overrides.conversionLocation ?? conversionLocation) as LeadsConversionLocationValue;
      const effectiveGoal = overrides.performanceGoal ?? performanceGoal;
      const effectiveBilling = overrides.billingEvent ?? billingEvent;
      const effectivePageId = overrides.pageId !== undefined ? overrides.pageId : pageId;

      const values: Record<string, any> = {
        ...initialValues,
        name: overrides.name ?? name,
        optimization_goal: effectiveGoal,
        billing_event: effectiveBilling,
        destination_type: effectiveLoc,
      };

      // promoted_object with page_id is REQUIRED for OUTCOME_LEADS
      if (effectivePageId && effectivePageId.trim()) {
        values.promoted_object = { page_id: effectivePageId.trim() };
      } else {
        delete values.promoted_object;
      }

      const sd = overrides.startDate ?? startDate;
      const st = overrides.startTime ?? startTime;
      if (sd) values.start_time = `${sd}T${st}`;

      const useEnd = overrides.hasEndDate ?? hasEndDate;
      if (useEnd) {
        const ed = overrides.endDate ?? endDate;
        const et = overrides.endTime ?? endTime;
        if (ed) values.end_time = `${ed}T${et}`;
      } else {
        delete values.end_time;
      }

      // Dynamic Creative is a real ad set flag on Meta — publish requires it on
      // both the ad set and its ads, so it must round-trip through draft data.
      const effDynamicCreative =
        "dynamicCreative" in overrides ? overrides.dynamicCreative : dynamicCreativeRef.current;
      if (effDynamicCreative) {
        values.is_dynamic_creative = true;
      } else {
        delete values.is_dynamic_creative;
      }

      onChangeRef.current(values);
    },
    [initialValues, name, conversionLocation, performanceGoal, billingEvent, pageId, startDate, startTime, hasEndDate, endDate, endTime]
  );

  const prevInitialRef = useRef(initialValues);
  useEffect(() => {
    if (initialValues === prevInitialRef.current) return;
    prevInitialRef.current = initialValues;

    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    setName(initialValues.name ?? "New Leads Ad Set");
    if (initialValues.destination_type) {
      setConversionLocation(initialValues.destination_type as LeadsConversionLocationValue);
    }
    if (initialValues.optimization_goal) setPerformanceGoal(initialValues.optimization_goal);
    setDynamicCreative(!!initialValues.is_dynamic_creative);
    if (initialValues.billing_event) setBillingEvent(initialValues.billing_event);
    setPageId(initialValues.promoted_object?.page_id ?? "");
    if (initialValues.start_time) {
      setStartDate(initialValues.start_time.slice(0, 10));
      setStartTime(initialValues.start_time.slice(11, 16));
    }
    if (initialValues.end_time) {
      setHasEndDate(true);
      setEndDate(initialValues.end_time.slice(0, 10));
      setEndTime(initialValues.end_time.slice(11, 16));
    }
  }, [initialValues]);

  const budgetDisplay = campaignBudget
    ? `฿${(campaignBudget / 100).toFixed(2)}`
    : "฿750.00";

  const pageIdHasError = pageIdTouched && !pageId.trim();

  return (
    <div className="space-y-4">

      {/* ── 1. Ad set name ── */}
      <SectionCard>
        <SectionHeader title="Ad set" />
        <SectionBody>
          <FieldRow label="Ad set name" required>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); emit({ name: e.target.value }); }}
              placeholder="New Leads Ad Set"
              className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0"
            />
          </FieldRow>
        </SectionBody>
      </SectionCard>

      {/* ── 2. Leads ── */}
      <SectionCard>
        <SectionHeader title="Leads" />
        <SectionBody>
          {/* Conversion location */}
          <FieldRow label="Conversion location">
            <Select
              value={conversionLocation}
              onValueChange={(v) => {
                if (!v) return;
                const loc = v as LeadsConversionLocationValue;
                setConversionLocation(loc);
                emit({ conversionLocation: loc });
              }}
            >
              <SelectTrigger className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                <span className="truncate">
                  {LEADS_CONVERSION_LOCATION_LABELS[conversionLocation] ?? conversionLocation}
                </span>
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                {LEADS_CONVERSION_LOCATIONS.map((loc) => (
                  <SelectItem key={loc.value} value={loc.value} className="text-xs text-gray-300">
                    {loc.label}
                    {"default" in loc && loc.default && (
                      <span className="ml-1.5 text-[10px] text-gray-600">(default)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Performance goal */}
          <FieldRow label="Performance goal">
            <Select
              value={performanceGoal}
              onValueChange={(v) => {
                if (!v) return;
                setPerformanceGoal(v);
                // Meta only accepts a non-IMPRESSIONS billing event when it
                // matches the optimization goal — reset it if it no longer does.
                if (billingEvent !== "IMPRESSIONS" && billingEvent !== v) {
                  setBillingEvent("IMPRESSIONS");
                  emit({ performanceGoal: v, billingEvent: "IMPRESSIONS" });
                } else {
                  emit({ performanceGoal: v });
                }
              }}
            >
              <SelectTrigger className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                <span className="truncate">
                  {LEADS_PERFORMANCE_GOAL_LABELS[performanceGoal] ?? performanceGoal}
                </span>
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                {LEADS_PERFORMANCE_GOALS.map((g) => (
                  <SelectItem key={g.value} value={g.value} className="text-xs text-gray-300">
                    {g.label}
                    {"recommended" in g && g.recommended && (
                      <span className="ml-1.5 text-[10px] text-blue-400">(recommended)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Billing event */}
          <FieldRow label="Billing event">
            <Select
              value={billingEvent}
              onValueChange={(v) => {
                if (!v) return;
                setBillingEvent(v);
                emit({ billingEvent: v });
              }}
            >
              <SelectTrigger className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                <span className="truncate">
                  {LEADS_BILLING_EVENT_LABELS[billingEvent] ?? billingEvent}
                </span>
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                {LEADS_BILLING_EVENTS.filter(
                  (b) => b.value === "IMPRESSIONS" || b.value === performanceGoal
                ).map((b) => (
                  <SelectItem key={b.value} value={b.value} className="text-xs text-gray-300">
                    {b.label}
                    {"default" in b && b.default && (
                      <span className="ml-1.5 text-[10px] text-gray-600">(default)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Facebook Page ID — REQUIRED for OUTCOME_LEADS */}
          <FieldRow label="Facebook Page ID *" required>
            <Input
              value={pageId}
              onChange={(e) => {
                setPageId(e.target.value);
                emit({ pageId: e.target.value });
              }}
              onBlur={() => setPageIdTouched(true)}
              placeholder="Enter Page ID"
              className={cn(
                "bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:ring-0 transition-colors",
                pageIdHasError
                  ? "border-red-500/70 focus:border-red-500"
                  : "focus:border-blue-500/50"
              )}
            />
            {pageIdHasError && (
              <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                A Facebook Page ID is required for Lead campaigns.
              </p>
            )}
          </FieldRow>
        </SectionBody>
      </SectionCard>

      {/* ── 3. Dynamic creative ── */}
      <SectionCard>
        <SectionHeader
          title="Dynamic creative"
          hasToggle
          toggled={dynamicCreative}
          onToggle={(v) => {
            setDynamicCreative(v);
            emit({ dynamicCreative: v });
          }}
        />
        <SectionBody className="!py-3">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            We&apos;ll automatically create combinations of your media and text that your audience
            is likely to respond to.
          </p>
        </SectionBody>
      </SectionCard>

      {/* ── 4. Budget & schedule ── */}
      <SectionCard>
        <SectionHeader title="Budget & schedule" />
        <SectionBody>
          {/* Campaign budget info */}
          <InfoBox>
            Your campaign budget automatically distributes your daily budget of{" "}
            <span className="font-semibold text-blue-300">{budgetDisplay}</span> across ad sets.
          </InfoBox>

          <div className="flex items-center justify-between py-1">
            <Label className="text-xs text-gray-400">Ad set spending limits</Label>
            <span className="text-sm text-gray-600">None added</span>
          </div>

          <div className="space-y-3 pt-1">
            <Label className="text-xs font-medium text-gray-300">Schedule</Label>

            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Start date">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); emit({ startDate: e.target.value }); }}
                  className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50 focus:ring-0"
                />
              </FieldRow>
              <FieldRow label="Start time">
                <div className="relative">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => { setStartTime(e.target.value); emit({ startTime: e.target.value }); }}
                    className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50 focus:ring-0"
                  />
                  <span className="absolute right-9 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 pointer-events-none">
                    GMT+7
                  </span>
                </div>
              </FieldRow>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hasEndDate}
                onChange={(e) => {
                  setHasEndDate(e.target.checked);
                  emit({ hasEndDate: e.target.checked });
                }}
                className="w-4 h-4 rounded border border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30 focus:outline-none"
              />
              <span className="text-xs text-gray-300">Set an end date</span>
            </label>

            {hasEndDate && (
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="End date">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); emit({ endDate: e.target.value }); }}
                    className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50 focus:ring-0"
                  />
                </FieldRow>
                <FieldRow label="End time">
                  <div className="relative">
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => { setEndTime(e.target.value); emit({ endTime: e.target.value }); }}
                      className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50 focus:ring-0"
                    />
                    <span className="absolute right-9 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 pointer-events-none">
                      GMT+7
                    </span>
                  </div>
                </FieldRow>
              </div>
            )}
          </div>
        </SectionBody>
      </SectionCard>

      {/* ── 5. Audience ── */}
      <SectionCard>
        <SectionHeader
          title="Audience"
          badge={<AdvantageBadge />}
        />
        <SectionBody>
          <button
            type="button"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Use a saved audience
          </button>

          {/* Controls */}
          <div className="border border-gray-800/40 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-800/20 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 text-gray-500" />
                Controls
              </span>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <Info className="w-3.5 h-3.5 shrink-0 text-gray-600" />
                No advertising settings set
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <div className="text-xs text-gray-400">
                  <span className="text-gray-500 mr-1">Inclusion:</span> Thailand
                </div>
              </div>
              <Collapsible label="Show more controls">
                <div className="mt-3 space-y-3 pl-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Age</Label>
                      <div className="flex items-center gap-1.5">
                        <Input type="number" defaultValue={18} min={13} max={65}
                          className="w-16 h-8 bg-gray-800/30 border-gray-700/40 text-xs text-gray-200 focus:border-blue-500/50 focus:ring-0 text-center px-2" />
                        <span className="text-xs text-gray-500">–</span>
                        <Input type="number" defaultValue={65} min={13} max={65}
                          className="w-16 h-8 bg-gray-800/30 border-gray-700/40 text-xs text-gray-200 focus:border-blue-500/50 focus:ring-0 text-center px-2" />
                        <span className="text-xs text-gray-500">+</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Gender</Label>
                      <div className="flex gap-1.5">
                        {["All", "Men", "Women"].map((g) => (
                          <button key={g} type="button"
                            className="flex-1 h-8 text-xs rounded-md border border-gray-700/40 bg-gray-800/30 text-gray-400 hover:border-gray-600 hover:text-gray-200 transition-colors first:bg-blue-500/10 first:border-blue-500/30 first:text-blue-300">
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400">Languages</Label>
                    <Input placeholder="Add language" className="h-8 bg-gray-800/30 border-gray-700/40 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400">Detailed targeting</Label>
                    <Input placeholder="Add demographics, interests or behaviors" className="h-8 bg-gray-800/30 border-gray-700/40 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0" />
                  </div>
                </div>
              </Collapsible>
            </div>
          </div>

          {/* Suggest an audience */}
          <div className="border border-gray-800/40 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-800/20">
              <span className="text-xs font-medium text-gray-300">Suggest an audience</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Based on your custom audience, age range, gender and detailed targeting.
              </p>
              <Collapsible label="Show settings">
                <div className="mt-3 space-y-3 pl-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400">Custom audience</Label>
                    <Input placeholder="Search custom audiences" className="h-8 bg-gray-800/30 border-gray-700/40 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Age range</Label>
                      <div className="flex items-center gap-1.5">
                        <Input type="number" defaultValue={18} min={13} max={65}
                          className="w-16 h-8 bg-gray-800/30 border-gray-700/40 text-xs text-gray-200 focus:border-blue-500/50 focus:ring-0 text-center px-2" />
                        <span className="text-xs text-gray-500">–</span>
                        <Input type="number" defaultValue={65} min={13} max={65}
                          className="w-16 h-8 bg-gray-800/30 border-gray-700/40 text-xs text-gray-200 focus:border-blue-500/50 focus:ring-0 text-center px-2" />
                        <span className="text-xs text-gray-500">+</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Gender</Label>
                      <div className="flex gap-1.5">
                        {["All", "Men", "Women"].map((g) => (
                          <button key={g} type="button"
                            className="flex-1 h-8 text-xs rounded-md border border-gray-700/40 bg-gray-800/30 text-gray-400 hover:border-gray-600 hover:text-gray-200 transition-colors first:bg-blue-500/10 first:border-blue-500/30 first:text-blue-300">
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400">Detailed targeting</Label>
                    <Input placeholder="Add demographics, interests or behaviors" className="h-8 bg-gray-800/30 border-gray-700/40 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0" />
                    <p className="text-[11px] text-gray-600">Narrow your audience based on interests, demographics or behaviors.</p>
                  </div>
                </div>
              </Collapsible>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              className="text-[11px] text-gray-400 hover:text-gray-300 transition-colors"
            >
              Further limit the reach of your ads
            </button>
            <button
              type="button"
              className="h-7 px-3 text-xs font-medium rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800/40 transition-colors"
            >
              Save audience
            </button>
          </div>
        </SectionBody>
      </SectionCard>

      {/* ── 6. Ad transparency ── */}
      <SectionCard>
        <SectionHeader title="Ad transparency" />
        <SectionBody>
          <InfoBox>
            <div className="font-semibold text-blue-300">Build trust with your audience by completing verification</div>
            <p className="text-blue-200/60 mt-0.5">Verification helps people know who is behind the ads they see.</p>
            <a
              href="https://business.facebook.com/accountquality"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Start verification
              <ExternalLink className="w-3 h-3" />
            </a>
          </InfoBox>
        </SectionBody>
      </SectionCard>

      {/* ── 7. Placements ── */}
      <SectionCard>
        <SectionHeader
          title="Placements"
          badge={<AdvantageBadge />}
        />
        <SectionBody>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            We&apos;ll automatically show ads in the places where people are likely to respond.
          </p>

          {/* Account controls */}
          <Collapsible label="Account controls" defaultOpen>
            <div className="mt-2 border border-gray-800/40 rounded-lg overflow-hidden">
              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    <span className="text-gray-500">Excluded placements: </span>
                    {excludedPlacements.length === 0
                      ? "None"
                      : excludedPlacements.join(", ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPlacementModal(true)}
                  className="h-7 px-3 text-xs font-medium rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800/40 transition-colors"
                >
                  Edit placement controls
                </button>
              </div>
            </div>
          </Collapsible>
        </SectionBody>
      </SectionCard>

      {/* ── 8. Brand safety and suitability ── */}
      <BrandSafetySection />

      {/* Placement modal */}
      {showPlacementModal && (
        <PlacementModal
          onClose={() => setShowPlacementModal(false)}
          onSave={(excl) => setExcludedPlacements(excl)}
        />
      )}
    </div>
  );
}
