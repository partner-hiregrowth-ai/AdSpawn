"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { analyticsApi } from "@/services/api";
import { AccountAnalytics } from "@/types";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  Eye,
  MousePointerClick,
  Percent,
  TrendingUp,
  BarChart3,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DatePreset = "today" | "yesterday" | "last_7d" | "last_14d" | "last_30d";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "7 days" },
  { value: "last_14d", label: "14 days" },
  { value: "last_30d", label: "30 days" },
];

function formatCurrency(value: string | number, currency?: string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatNumber(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercent(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0.00%";
  return `${num.toFixed(2)}%`;
}

function shortObjective(obj: string) {
  return obj.replace("OUTCOME_", "");
}

const BAR_COLORS = [
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
];

export default function AnalyticsPage() {
  const { selectedAccount } = useAppStore();
  const [datePreset, setDatePreset] = useState<DatePreset>("last_7d");

  const { data, isLoading, error, mutate } = useSWR<AccountAnalytics>(
    selectedAccount ? [`analytics`, selectedAccount.id, datePreset] : null,
    () =>
      analyticsApi
        .getAccountAnalytics(selectedAccount!.id, { datePreset })
        .then((r) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  const chartData = useMemo(() => {
    if (!data?.timeSeries) return [];
    return data.timeSeries.map((point) => ({
      date: new Date(point.date_start).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      spend: parseFloat(point.spend) || 0,
      impressions: parseInt(point.impressions) || 0,
      clicks: parseInt(point.clicks) || 0,
    }));
  }, [data?.timeSeries]);

  const topCampaignsData = useMemo(() => {
    if (!data?.topCampaigns) return [];
    return data.topCampaigns.map((c) => ({
      name: c.campaign_name.length > 28 ? c.campaign_name.slice(0, 28) + "…" : c.campaign_name,
      fullName: c.campaign_name,
      spend: parseFloat(c.spend) || 0,
      objective: shortObjective(c.objective),
      ctr: parseFloat(c.ctr) || 0,
    }));
  }, [data?.topCampaigns]);

  const maxSpend = useMemo(
    () => Math.max(...(topCampaignsData.map((c) => c.spend) || [0]), 1),
    [topCampaignsData]
  );

  const summary = data?.summary;
  const currency = selectedAccount?.currency || "USD";

  const kpis = summary
    ? [
        {
          label: "Spend",
          value: formatCurrency(summary.spend, currency),
          icon: DollarSign,
          color: "text-blue-400",
          bg: "from-blue-500/20 to-blue-600/10",
        },
        {
          label: "Impressions",
          value: formatNumber(summary.impressions),
          icon: Eye,
          color: "text-cyan-400",
          bg: "from-cyan-500/20 to-cyan-600/10",
        },
        {
          label: "Clicks",
          value: formatNumber(summary.clicks),
          icon: MousePointerClick,
          color: "text-violet-400",
          bg: "from-violet-500/20 to-violet-600/10",
        },
        {
          label: "CTR",
          value: formatPercent(summary.ctr),
          icon: Percent,
          color: "text-emerald-400",
          bg: "from-emerald-500/20 to-emerald-600/10",
        },
        {
          label: "CPC",
          value: formatCurrency(summary.cpc, currency),
          icon: TrendingUp,
          color: "text-amber-400",
          bg: "from-amber-500/20 to-amber-600/10",
        },
        {
          label: "CPM",
          value: formatCurrency(summary.cpm, currency),
          icon: BarChart3,
          color: "text-rose-400",
          bg: "from-rose-500/20 to-rose-600/10",
        },
      ]
    : [];

  if (!selectedAccount) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-3">
            <BarChart3 className="w-10 h-10 text-gray-600 mx-auto" />
            <p className="text-gray-400 font-medium">No account selected</p>
            <p className="text-gray-500 text-sm">
              Select an ad account from the Dashboard first.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-gray-100">Analytics</h2>
            <p className="text-gray-500 mt-1 text-sm">
              Performance overview for{" "}
              <span className="text-gray-400">{selectedAccount.name}</span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
            className="gap-2 border-gray-800 text-gray-400 hover:text-gray-200"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>

        {/* Date preset picker */}
        <div className="flex gap-1.5">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setDatePreset(preset.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                datePreset === preset.value
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 border border-transparent"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-300 font-medium">
                Failed to load analytics
              </p>
              <p className="text-xs text-red-400/70 mt-0.5">
                {error.response?.data?.message || error.message}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              className="border-red-500/30 text-red-400 hover:text-red-300"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card
                  key={i}
                  className="border-gray-800/40 bg-gray-900/30"
                >
                  <CardContent className="p-4">
                    <div className="w-8 h-8 rounded-lg bg-gray-800/60 animate-pulse mb-3" />
                    <div className="h-6 w-20 bg-gray-800/50 rounded animate-pulse mb-1" />
                    <div className="h-3 w-14 bg-gray-800/40 rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="border-gray-800/40 bg-gray-900/30">
              <CardContent className="p-6">
                <div className="h-[240px] flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Data loaded */}
        {!isLoading && !error && data && (
          <>
            {/* No data state */}
            {!summary && (
              <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-16 text-center">
                <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No data available</p>
                <p className="text-gray-500 text-sm mt-1">
                  No delivery during this period. If all campaigns are paused, try a wider date range to see historical data.
                </p>
              </div>
            )}

            {/* All-zero state — summary exists but no actual delivery */}
            {summary &&
              parseFloat(summary.spend) === 0 &&
              parseFloat(summary.impressions) === 0 && (
                <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-3 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
                  <p className="text-xs text-yellow-400/80">
                    All metrics are zero for this period — campaigns may be paused or have no delivery. Try selecting a wider date range.
                  </p>
                </div>
              )}

            {/* KPI Cards */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {kpis.map((kpi, i) => (
                  <Card
                    key={kpi.label}
                    className={cn(
                      "border-gray-800/60 bg-gray-900/50 hover:bg-gray-900/80 transition-all duration-200 animate-fade-in-up",
                      `stagger-${Math.min(i + 1, 6)}`
                    )}
                  >
                    <CardContent className="p-4">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3",
                          kpi.bg
                        )}
                      >
                        <kpi.icon className={cn("w-4 h-4", kpi.color)} />
                      </div>
                      <p className="text-lg font-bold text-gray-100 tracking-tight">
                        {kpi.value}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {kpi.label}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Spend over time chart */}
            {chartData.length > 1 && (
              <Card className="border-gray-800/60 bg-gray-900/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    Spend over time
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="spendGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#3b82f6"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#3b82f6"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#6b7280", fontSize: 11 }}
                          dy={8}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#6b7280", fontSize: 11 }}
                          tickFormatter={(v) =>
                            v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
                          }
                          dx={-4}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#111827",
                            border: "1px solid rgba(75, 85, 99, 0.4)",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#e5e7eb",
                          }}
                          formatter={(value) => [
                            formatCurrency(Number(value), currency),
                            "Spend",
                          ]}
                          labelStyle={{ color: "#9ca3af" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="spend"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#spendGradient)"
                          dot={false}
                          activeDot={{
                            r: 4,
                            fill: "#3b82f6",
                            stroke: "#1e3a5f",
                            strokeWidth: 2,
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top campaigns */}
            {topCampaignsData.length > 0 && (
              <Card className="border-gray-800/60 bg-gray-900/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    Top campaigns by spend
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {topCampaignsData.map((campaign, i) => (
                      <div key={i} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-[11px] font-mono text-gray-600 w-4 shrink-0">
                              {i + 1}
                            </span>
                            <span
                              className="text-sm text-gray-300 truncate"
                              title={campaign.fullName}
                            >
                              {campaign.name}
                            </span>
                            <span className="text-[10px] text-gray-600 font-mono bg-gray-800/60 px-1.5 py-0.5 rounded shrink-0">
                              {campaign.objective}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 ml-3">
                            <span className="text-xs text-gray-500">
                              CTR {formatPercent(campaign.ctr)}
                            </span>
                            <span className="text-sm font-medium text-gray-200 w-24 text-right">
                              {formatCurrency(campaign.spend, currency)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-6 h-1.5 rounded-full bg-gray-800/60 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(campaign.spend / maxSpend) * 100}%`,
                              backgroundColor: BAR_COLORS[i] || BAR_COLORS[4],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
