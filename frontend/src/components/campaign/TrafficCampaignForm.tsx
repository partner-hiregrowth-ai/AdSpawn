"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Paintbrush,
  Users,
  MonitorPlay,
  SlidersHorizontal,
  CalendarRange,
  Info,
} from "lucide-react";

// ─── Toggle ───────────────────────────────────────────────────────────────────

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

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-gray-900/40 border border-gray-800/60 rounded-xl overflow-hidden", className)}>
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  description,
  hasToggle,
  toggled,
  onToggle,
}: {
  title: string;
  description?: string;
  hasToggle?: boolean;
  toggled?: boolean;
  onToggle?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-800/40">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
        {description && <p className="text-[11px] text-gray-500 leading-relaxed">{description}</p>}
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

// ─── Field Row ────────────────────────────────────────────────────────────────

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
      <Label className="text-xs font-medium text-gray-300 flex items-center gap-1">
        {label}
        {required && <span className="text-blue-400">*</span>}
      </Label>
      {children}
      {hint && (
        <p className="text-[11px] text-gray-500 leading-relaxed flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 shrink-0 text-gray-600" />
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── Static Value Display ─────────────────────────────────────────────────────

function StaticField({ value }: { value: string }) {
  return (
    <div className="h-9 flex items-center px-3 rounded-lg bg-gray-800/30 border border-gray-700/40 text-sm text-gray-400 select-none">
      {value}
    </div>
  );
}

// ─── Currency Input ───────────────────────────────────────────────────────────

function CurrencyInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(() => (value ? (value / 100).toFixed(2) : ""));

  useEffect(() => {
    const numVal = value ? value / 100 : 0;
    setRaw(numVal > 0 ? numVal.toFixed(2) : "");
  }, [value]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
        ฿
      </span>
      <Input
        type="number"
        min={0}
        step={0.01}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          const n = parseFloat(e.target.value);
          if (!isNaN(n) && n >= 0) onChange(Math.round(n * 100));
        }}
        onBlur={() => {
          const n = parseFloat(raw);
          if (!isNaN(n) && n >= 0) setRaw(n.toFixed(2));
        }}
        placeholder={placeholder ?? "0.00"}
        className="pl-7 bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0"
      />
    </div>
  );
}

// ─── A/B Test Type Cards ──────────────────────────────────────────────────────

const AB_TEST_TYPES = [
  {
    value: "creative",
    label: "Creative",
    description: "Test different ad creatives, images, videos or copy",
    icon: <Paintbrush className="w-4 h-4" />,
  },
  {
    value: "audience",
    label: "Audience",
    description: "Test different audience targeting strategies",
    icon: <Users className="w-4 h-4" />,
  },
  {
    value: "placement",
    label: "Placement",
    description: "Test how performance varies across ad placements",
    icon: <MonitorPlay className="w-4 h-4" />,
  },
  {
    value: "custom",
    label: "Custom",
    description: "Build your own test with any variable combination",
    icon: <SlidersHorizontal className="w-4 h-4" />,
  },
] as const;

type ABTestType = "creative" | "audience" | "placement" | "custom";

const AB_METRICS = [
  { value: "cost_per_result", label: "Cost per result (Recommended)" },
  { value: "cpc", label: "CPC" },
  { value: "cost_per_1000_reached", label: "Cost per 1,000 accounts reached" },
  { value: "cost_per_purchase", label: "Cost per purchase" },
  { value: "cost_per_3s_video_play", label: "Cost per 3-second video play" },
  { value: "cost_per_ad_recall_lift", label: "Cost per ad recall lift" },
  { value: "cost_per_add_to_cart", label: "Cost per add to cart" },
  { value: "cost_per_add_to_wishlist", label: "Cost per add to wishlist" },
  { value: "cost_per_app_install", label: "Cost per app install" },
  { value: "cost_per_checkout_initiated", label: "Cost per checkout initiated" },
  { value: "cost_per_content_view", label: "Cost per content view" },
  { value: "cost_per_lead", label: "Cost per lead" },
  { value: "cost_per_mobile_app_d7_retention", label: "Cost per mobile app D7 retention" },
  { value: "cost_per_new_messaging_contact", label: "Cost per new messaging contact" },
  { value: "cost_per_post_engagement", label: "Cost per post engagement" },
  { value: "cost_per_registration_completed", label: "Cost per registration completed" },
  { value: "cost_per_search", label: "Cost per search" },
];

const SPECIAL_AD_CATEGORIES = [
  { value: "CREDIT", label: "Financial products & services" },
  { value: "EMPLOYMENT", label: "Employment" },
  { value: "HOUSING", label: "Housing" },
  { value: "ISSUES_ELECTIONS_POLITICS", label: "Social issues, elections or politics" },
];

const BID_STRATEGIES = [
  { value: "LOWEST_COST_WITHOUT_CAP", label: "Highest volume" },
  { value: "LOWEST_COST_WITH_BID_CAP", label: "Bid cap" },
  { value: "COST_CAP", label: "Cost cap" },
];

const INCREASE_TYPES = [
  { value: "value", label: "By value amount (฿)" },
  { value: "percentage", label: "By percentage (%)" },
];

// ─── Main Form ────────────────────────────────────────────────────────────────

interface TrafficCampaignFormProps {
  initialValues: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}

export function TrafficCampaignForm({ initialValues, onChange }: TrafficCampaignFormProps) {
  // ── Local state derived from initialValues ──
  const [name, setName] = useState<string>(initialValues.name ?? "New Traffic Campaign");

  const hasBudgetInit = !!(initialValues.daily_budget || initialValues.lifetime_budget);
  const [isCBO, setIsCBO] = useState(hasBudgetInit);
  const [budgetType, setBudgetType] = useState<"daily_budget" | "lifetime_budget">(
    initialValues.lifetime_budget ? "lifetime_budget" : "daily_budget"
  );
  const [budgetAmount, setBudgetAmount] = useState<number>(
    initialValues.daily_budget ?? initialValues.lifetime_budget ?? 15000
  );
  const [bidStrategy, setBidStrategy] = useState<string>(
    initialValues.bid_strategy ?? "LOWEST_COST_WITHOUT_CAP"
  );
  const [bidAmount, setBidAmount] = useState<number>(
    Number(initialValues.bid_amount) || 0
  );
  const bidAmountRef = useRef(bidAmount);
  bidAmountRef.current = bidAmount;

  const [hasBudgetSchedule, setHasBudgetSchedule] = useState(
    !!(initialValues.start_time || initialValues.end_time)
  );
  const [startDate, setStartDate] = useState<string>(
    initialValues.start_time ? initialValues.start_time.slice(0, 10) : ""
  );
  const [endDate, setEndDate] = useState<string>(
    initialValues.end_time ? initialValues.end_time.slice(0, 10) : ""
  );
  const [startTime, setStartTime] = useState<string>(
    initialValues.start_time ? initialValues.start_time.slice(11, 16) : "00:00"
  );
  const [endTime, setEndTime] = useState<string>(
    initialValues.end_time ? initialValues.end_time.slice(11, 16) : "23:59"
  );
  const [increaseType, setIncreaseType] = useState<string>("value");
  const [increaseAmount, setIncreaseAmount] = useState<number>(3750);

  const [hasAbTest, setHasAbTest] = useState(false);
  const [abTestType, setAbTestType] = useState<ABTestType>("creative");
  const [abTestDuration, setAbTestDuration] = useState(7);
  const [abTestMetric, setAbTestMetric] = useState("cost_per_result");

  const [specialCategories, setSpecialCategories] = useState<string[]>(
    Array.isArray(initialValues.special_ad_categories) ? initialValues.special_ad_categories : []
  );

  // ── Sync from parent — but NOT when the change originated from this component ──
  const isInternalChange = useRef(false);
  const prevInitialRef = useRef(initialValues);
  useEffect(() => {
    if (initialValues === prevInitialRef.current) return;
    prevInitialRef.current = initialValues;

    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    setName(initialValues.name ?? "New Traffic Campaign");
    const hasBudget = !!(initialValues.daily_budget || initialValues.lifetime_budget);
    setIsCBO(hasBudget);
    setBudgetType(initialValues.lifetime_budget ? "lifetime_budget" : "daily_budget");
    setBudgetAmount(initialValues.daily_budget ?? initialValues.lifetime_budget ?? 15000);
    setBidStrategy(initialValues.bid_strategy ?? "LOWEST_COST_WITHOUT_CAP");
    setBidAmount(Number(initialValues.bid_amount) || 0);
    const hasSchedule = !!(initialValues.start_time || initialValues.end_time);
    setHasBudgetSchedule(hasSchedule);
    if (initialValues.start_time) {
      setStartDate(initialValues.start_time.slice(0, 10));
      setStartTime(initialValues.start_time.slice(11, 16));
    }
    if (initialValues.end_time) {
      setEndDate(initialValues.end_time.slice(0, 10));
      setEndTime(initialValues.end_time.slice(11, 16));
    }
    setSpecialCategories(
      Array.isArray(initialValues.special_ad_categories) ? initialValues.special_ad_categories : []
    );
  }, [initialValues]);

  // ── Propagate changes up ──
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emit = useCallback(
    (overrides: Record<string, any> = {}) => {
      isInternalChange.current = true;
      const values: Record<string, any> = {
        ...initialValues,
        name,
        objective: "OUTCOME_TRAFFIC",
        buying_type: "AUCTION",
        bid_strategy: bidStrategy,
        special_ad_categories: specialCategories,
        ...overrides,
      };

      // Budget — use override value if explicitly provided (handles toggle-off: false)
      const effectiveCBO = "isCBO" in overrides ? overrides.isCBO : isCBO;
      delete values.daily_budget;
      delete values.lifetime_budget;
      if (effectiveCBO) {
        const amount = overrides.budgetAmount ?? budgetAmount;
        const type = overrides.budgetType ?? budgetType;
        values[type] = amount;
      }

      // Schedule — same override-aware pattern
      const effectiveSchedule = "hasBudgetSchedule" in overrides ? overrides.hasBudgetSchedule : hasBudgetSchedule;
      if (effectiveSchedule) {
        if (startDate || overrides.startDate) {
          const d = overrides.startDate ?? startDate;
          const t = overrides.startTime ?? startTime;
          values.start_time = `${d}T${t}`;
        }
        if (endDate || overrides.endDate) {
          const d = overrides.endDate ?? endDate;
          const t = overrides.endTime ?? endTime;
          values.end_time = `${d}T${t}`;
        }
      } else {
        delete values.start_time;
        delete values.end_time;
      }

      // Clean internal-only keys
      delete values.isCBO;
      delete values.budgetAmount;
      delete values.budgetType;
      delete values.hasBudgetSchedule;
      delete values.startDate;
      delete values.endDate;
      delete values.startTime;
      delete values.endTime;
      delete values.increaseType;
      delete values.increaseAmount;

      // Cap bid strategies require bid_amount (smallest currency unit) — Meta
      // rejects COST_CAP / BID_CAP campaigns without it.
      const effBidStrategy = values.bid_strategy;
      const effBidAmount = "bidAmount" in overrides ? overrides.bidAmount : bidAmountRef.current;
      if ((effBidStrategy === "COST_CAP" || effBidStrategy === "LOWEST_COST_WITH_BID_CAP") && effBidAmount > 0) {
        values.bid_amount = effBidAmount;
      } else {
        delete values.bid_amount;
      }
      delete values.bidAmount;

      onChangeRef.current(values);
    },
    [
      initialValues,
      name,
      bidStrategy,
      specialCategories,
      isCBO,
      budgetAmount,
      budgetType,
      hasBudgetSchedule,
      startDate,
      endDate,
      startTime,
      endTime,
    ]
  );

  // Budget daily average hint
  const dailyAvg = budgetType === "daily_budget"
    ? budgetAmount / 100
    : budgetType === "lifetime_budget" && endDate && startDate
      ? budgetAmount / 100 / Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
      : null;

  const toggleSpecialCategory = useCallback(
    (value: string, checked: boolean) => {
      const next = checked
        ? [...specialCategories, value]
        : specialCategories.filter((v) => v !== value);
      setSpecialCategories(next);
      emit({ special_ad_categories: next });
    },
    [specialCategories, emit]
  );

  return (
    <div className="space-y-4">

      {/* ── Section 1: Campaign Info ── */}
      <SectionCard>
        <SectionHeader title="Campaign" />
        <SectionBody className="space-y-4">
          <FieldRow label="Campaign name" required>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                emit({ name: e.target.value });
              }}
              placeholder="New Traffic Campaign"
              className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0"
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Buying type">
              <StaticField value="Auction" />
            </FieldRow>
            <FieldRow label="Campaign objective">
              <StaticField value="Traffic" />
            </FieldRow>
          </div>
        </SectionBody>
      </SectionCard>

      {/* ── Section 2: Advantage+ Campaign Budget ── */}
      <SectionCard>
        <SectionHeader
          title="Advantage+ campaign budget"
          description="Let Meta automatically distribute budget across ad sets to maximise results."
          hasToggle
          toggled={isCBO}
          onToggle={(v) => {
            setIsCBO(v);
            emit({ isCBO: v });
          }}
        />

        {isCBO && (
          <SectionBody>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Budget type">
                <Select
                  value={budgetType}
                  onValueChange={(v) => {
                    if (!v) return;
                    const t = v as "daily_budget" | "lifetime_budget";
                    setBudgetType(t);
                    emit({ budgetType: t });
                  }}
                >
                  <SelectTrigger className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-800">
                    <SelectItem value="daily_budget" className="text-xs text-gray-300">Daily budget</SelectItem>
                    <SelectItem value="lifetime_budget" className="text-xs text-gray-300">Lifetime budget</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow
                label="Amount"
                hint={
                  dailyAvg !== null
                    ? `Daily average ≈ ฿${dailyAvg.toFixed(2)} · max daily ≈ ฿${(dailyAvg * 1.25).toFixed(2)} · max weekly ≈ ฿${(dailyAvg * 7).toFixed(2)}`
                    : undefined
                }
              >
                <CurrencyInput
                  value={budgetAmount}
                  onChange={(v) => {
                    setBudgetAmount(v);
                    emit({ budgetAmount: v });
                  }}
                />
              </FieldRow>
            </div>

            <FieldRow label="Campaign bid strategy">
              <Select
                value={bidStrategy}
                onValueChange={(v) => {
                  if (!v) return;
                  setBidStrategy(v);
                  emit({ bid_strategy: v });
                }}
              >
                <SelectTrigger className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800">
                  {BID_STRATEGIES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs text-gray-300">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            {(bidStrategy === "COST_CAP" || bidStrategy === "LOWEST_COST_WITH_BID_CAP") && (
              <FieldRow
                label={bidStrategy === "COST_CAP" ? "Cost per result goal" : "Bid cap"}
                hint="Meta requires an amount for this bid strategy — your target cost or maximum bid per result."
              >
                <CurrencyInput
                  value={bidAmount}
                  onChange={(v) => {
                    setBidAmount(v);
                    emit({ bidAmount: v });
                  }}
                />
              </FieldRow>
            )}

            {/* Budget scheduling */}
            <div className="border border-gray-800/40 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-800/20">
                <div className="flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-medium text-gray-300">Budget scheduling</span>
                </div>
                <Toggle
                  checked={hasBudgetSchedule}
                  onChange={(v) => {
                    setHasBudgetSchedule(v);
                    emit({ hasBudgetSchedule: v });
                  }}
                />
              </div>

              {hasBudgetSchedule && (
                <div className="px-4 py-4 space-y-4 border-t border-gray-800/40">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Start date">
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          emit({ startDate: e.target.value });
                        }}
                        className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50 focus:ring-0"
                      />
                    </FieldRow>
                    <FieldRow label="End date">
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          emit({ endDate: e.target.value });
                        }}
                        className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50 focus:ring-0"
                      />
                    </FieldRow>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Start time">
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          emit({ startTime: e.target.value });
                        }}
                        className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50 focus:ring-0"
                      />
                    </FieldRow>
                    <FieldRow label="End time">
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => {
                          setEndTime(e.target.value);
                          emit({ endTime: e.target.value });
                        }}
                        className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50 focus:ring-0"
                      />
                    </FieldRow>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Increase type">
                      <Select
                        value={increaseType}
                        onValueChange={(v) => { if (v) setIncreaseType(v); }}
                      >
                        <SelectTrigger className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-800">
                          {INCREASE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value} className="text-xs text-gray-300">
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldRow>
                    <FieldRow
                      label={increaseType === "percentage" ? "Increase %" : "Increase amount"}
                      hint={
                        increaseType === "value" && budgetAmount
                          ? `New daily average ≈ ฿${((budgetAmount + increaseAmount) / 100).toFixed(2)}`
                          : undefined
                      }
                    >
                      {increaseType === "percentage" ? (
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={increaseAmount}
                            onChange={(e) => setIncreaseAmount(Number(e.target.value))}
                            className="pr-7 bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50 focus:ring-0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                            %
                          </span>
                        </div>
                      ) : (
                        <CurrencyInput
                          value={increaseAmount}
                          onChange={(v) => setIncreaseAmount(v)}
                          placeholder="37.50"
                        />
                      )}
                    </FieldRow>
                  </div>
                </div>
              )}
            </div>
          </SectionBody>
        )}
      </SectionCard>

      {/* ── Section 3: A/B Test ── */}
      <SectionCard>
        <SectionHeader
          title="A/B test"
          description="Compare two versions of your campaign to see which performs better."
          hasToggle
          toggled={hasAbTest}
          onToggle={setHasAbTest}
        />

        {hasAbTest && (
          <SectionBody>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-400">What would you like to test?</Label>
              <div className="grid grid-cols-2 gap-2">
                {AB_TEST_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setAbTestType(t.value)}
                    style={abTestType === t.value ? { border: "1.5px solid #0866ff", background: "rgba(8,102,255,0.08)" } : { border: "1.5px solid rgba(75,85,99,0.4)" }}
                    className={cn(
                      "w-full text-left p-3.5 rounded-lg transition-all",
                      abTestType === t.value
                        ? "shadow-sm"
                        : "hover:border-gray-500/60 hover:bg-gray-800/40"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                          abTestType === t.value
                            ? "bg-blue-500/30 text-blue-300"
                            : "bg-gray-700/50 text-gray-400"
                        )}
                      >
                        {t.icon}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "text-xs font-semibold mb-0.5",
                            abTestType === t.value ? "text-blue-200" : "text-gray-300"
                          )}
                        >
                          {t.label}
                        </div>
                        <div className="text-[11px] text-gray-500 leading-relaxed">
                          {t.description}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Test duration (days)">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={abTestDuration}
                  onChange={(e) => setAbTestDuration(Number(e.target.value))}
                  className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50 focus:ring-0"
                />
              </FieldRow>

              <FieldRow label="Performance metric">
                <Select value={abTestMetric} onValueChange={(v) => { if (v) setAbTestMetric(v); }}>
                  <SelectTrigger className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                    <span className="truncate">
                      {AB_METRICS.find((m) => m.value === abTestMetric)?.label ?? abTestMetric}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-800 max-h-64">
                    {AB_METRICS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs text-gray-300">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
            </div>
          </SectionBody>
        )}
      </SectionCard>

      {/* ── Section 4: Special Ad Categories ── */}
      <SectionCard>
        <SectionHeader
          title="Special ad categories"
          description="Required if your ads relate to credit, employment, housing, or social issues."
        />
        <SectionBody>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            {SPECIAL_AD_CATEGORIES.map((cat) => {
              const checked = specialCategories.includes(cat.value);
              return (
                <label
                  key={cat.value}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleSpecialCategory(cat.value, e.target.checked)}
                    className={cn(
                      "w-4 h-4 rounded border transition-colors cursor-pointer",
                      "border-gray-600 bg-gray-800/50 text-blue-500",
                      "checked:bg-blue-600 checked:border-blue-600",
                      "focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-0",
                      "focus:outline-none"
                    )}
                  />
                  <span className="text-xs text-gray-300 group-hover:text-gray-200 transition-colors select-none">
                    {cat.label}
                  </span>
                </label>
              );
            })}
          </div>
        </SectionBody>
      </SectionCard>
    </div>
  );
}
