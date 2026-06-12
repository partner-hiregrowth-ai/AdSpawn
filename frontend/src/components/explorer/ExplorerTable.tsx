"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { adAccountApi, analyticsApi } from "@/services/api";
import { Campaign, AdSet, Ad, AdAccount } from "@/types";
import { cn, extractApiError } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Search, X, ArrowUp, ArrowDown, Loader2 } from "lucide-react";

// Google-Ads-style table view for the Explorer: level tabs (Campaigns /
// Ad sets / Ads), drill-down scope chips, a dense sortable metrics table with
// a totals row, per-row status toggles, and a date-range picker for metrics.
// Selection is shared with the tree view so the Action Panel and bulk
// operations work identically in both modes.

type Level = "campaign" | "adset" | "ad";

interface InsightRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
}

const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "maximum", label: "All time" },
];

type SortKey = "name" | "status" | "budget" | "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "cpm";

interface Row {
  id: string;
  type: "CAMPAIGN" | "ADSET" | "AD";
  name: string;
  status: string;
  detail: string; // objective (campaign) / optimization goal (adset) / creative id (ad)
  budget: number | null;
  parentName?: string;
  insight?: InsightRow;
}

function num(v: string | undefined): number {
  const n = parseFloat(v || "0");
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(v: number, currency: string): string {
  return v === 0 ? "—" : `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function fmtCount(v: number): string {
  return v === 0 ? "—" : v.toLocaleString();
}

function StatusToggle({ status, busy, onToggle }: { status: string; busy: boolean; onToggle: () => void }) {
  const isActive = status === "ACTIVE";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={isActive ? "Pause" : "Enable"}
      disabled={busy}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title={isActive ? "Active — click to pause" : "Paused — click to enable"}
      className={cn(
        "relative inline-flex h-[16px] w-[30px] shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        isActive ? "bg-emerald-500" : "bg-gray-700",
      )}
    >
      <span className={cn(
        "block h-[12px] w-[12px] rounded-full bg-white shadow transition-transform",
        isActive ? "translate-x-[16px]" : "translate-x-[2px]",
      )} />
    </button>
  );
}

interface ExplorerTableProps {
  account: AdAccount;
  campaigns: Campaign[];
  adSets: Record<string, AdSet[]>;
  ads: Record<string, Ad[]>;
  setAdSets: React.Dispatch<React.SetStateAction<Record<string, AdSet[]>>>;
  setAds: React.Dispatch<React.SetStateAction<Record<string, Ad[]>>>;
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  selectedItems: Map<string, { id: string; type: string; name: string }>;
  handleSelection: (id: string, type: string, name: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export function ExplorerTable({
  account, campaigns, adSets, ads, setAdSets, setAds, setCampaigns,
  selectedItems, handleSelection, searchQuery, setSearchQuery,
}: ExplorerTableProps) {
  const [level, setLevel] = useState<Level>("campaign");
  const [scopeCampaign, setScopeCampaign] = useState<Campaign | null>(null);
  const [scopeAdSet, setScopeAdSet] = useState<AdSet | null>(null);
  const [datePreset, setDatePreset] = useState("last_7d");
  const [insights, setInsights] = useState<Record<Level, Record<string, InsightRow>>>({ campaign: {}, adset: {}, ad: {} });
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pendingActivate, setPendingActivate] = useState<Row | null>(null);

  const currency = account.currency || "";

  // ── Metrics: fetch once per level + date range ──
  useEffect(() => {
    let cancelled = false;
    setInsightsLoading(true);
    analyticsApi.getLevelInsights(account.id, level, { datePreset })
      .then((r) => {
        if (cancelled) return;
        const idField = level === "campaign" ? "campaign_id" : level === "adset" ? "adset_id" : "ad_id";
        const map: Record<string, InsightRow> = {};
        for (const row of r.data || []) map[row[idField]] = row;
        setInsights((prev) => ({ ...prev, [level]: map }));
      })
      .catch(() => { /* metrics are additive — table still works without them */ })
      .finally(() => { if (!cancelled) setInsightsLoading(false); });
    return () => { cancelled = true; };
  }, [account.id, level, datePreset]);

  // ── Children: ensure ad sets / ads are loaded for the current level ──
  //
  // Meta rate-limits aggressively, so this loader is deliberately tame:
  //  - small concurrency, paced batches (never all campaigns at once)
  //  - every id is attempted at most once automatically; failures (incl. 429)
  //    are NOT auto-retried — a banner with a manual Retry appears instead
  //  - triggered only by level/scope changes, never by its own state updates,
  //    so partial progress can't re-fire the sweep in a loop
  const attemptedAdSets = useRef<Set<string>>(new Set());
  const attemptedAds = useRef<Set<string>>(new Set());
  const loaderActive = useRef(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ done: number; total: number } | null>(null);

  const loadChildren = useCallback(async () => {
    if (loaderActive.current || level === "campaign") return;
    loaderActive.current = true;
    setRateLimited(false);

    const CONCURRENCY = 2;
    const BATCH_GAP_MS = 400;
    const is429 = (reason: unknown) =>
      (reason as { response?: { status?: number } })?.response?.status === 429;

    // Generic paced fetcher: returns true if it hit a rate limit and stopped.
    const fetchPaced = async <T,>(
      targets: { id: string }[],
      attempted: Set<string>,
      fetchOne: (id: string) => Promise<T>,
      commit: (results: { id: string; data: T }[]) => void,
    ): Promise<boolean> => {
      const todo = targets.filter((t) => !attempted.has(t.id));
      if (todo.length === 0) return false;
      setChildrenLoading(true);
      setLoadProgress({ done: 0, total: todo.length });
      for (let i = 0; i < todo.length; i += CONCURRENCY) {
        const batch = todo.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((t) => fetchOne(t.id).then((data) => ({ id: t.id, data })))
        );
        const ok: { id: string; data: T }[] = [];
        let hit429 = false;
        results.forEach((res, idx) => {
          attempted.add(batch[idx].id);
          if (res.status === "fulfilled") ok.push(res.value);
          else if (is429(res.reason)) hit429 = true;
        });
        if (ok.length) commit(ok);
        setLoadProgress({ done: Math.min(i + CONCURRENCY, todo.length), total: todo.length });
        if (hit429) return true;
        if (i + CONCURRENCY < todo.length) await new Promise((r) => setTimeout(r, BATCH_GAP_MS));
      }
      return false;
    };

    try {
      const campaignTargets = scopeCampaign ? [scopeCampaign] : campaigns;
      const limited = await fetchPaced(
        campaignTargets.filter((c) => !adSets[c.id]),
        attemptedAdSets.current,
        (id) => adAccountApi.getAdSets(id).then((r) => r.data as AdSet[]),
        (ok) => setAdSets((prev) => {
          const next = { ...prev };
          for (const { id, data } of ok) next[id] = data;
          return next;
        }),
      );
      if (limited) { setRateLimited(true); return; }

      if (level === "ad") {
        const adSetPool = scopeAdSet
          ? [scopeAdSet]
          : (scopeCampaign ? (adSets[scopeCampaign.id] || []) : Object.values(adSets).flat());
        const limitedAds = await fetchPaced(
          adSetPool.filter((as) => !ads[as.id]),
          attemptedAds.current,
          (id) => adAccountApi.getAds(id).then((r) => r.data as Ad[]),
          (ok) => setAds((prev) => {
            const next = { ...prev };
            for (const { id, data } of ok) next[id] = data;
            return next;
          }),
        );
        if (limitedAds) setRateLimited(true);
      }
    } finally {
      loaderActive.current = false;
      setChildrenLoading(false);
      setLoadProgress(null);
    }
  }, [level, scopeCampaign, scopeAdSet, campaigns, adSets, ads, setAdSets, setAds]);

  const loadChildrenRef = useRef(loadChildren);
  useEffect(() => { loadChildrenRef.current = loadChildren; }, [loadChildren]);

  useEffect(() => {
    loadChildrenRef.current();
    // Re-run only on navigation — never on data arriving, which is what
    // previously caused a 429 retry storm on large accounts.
  }, [level, scopeCampaign?.id, scopeAdSet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryLoading = () => {
    attemptedAdSets.current.clear();
    attemptedAds.current.clear();
    loadChildrenRef.current();
  };

  // Fresh account → fresh attempt history (entity ids are account-scoped).
  useEffect(() => {
    attemptedAdSets.current.clear();
    attemptedAds.current.clear();
    setRateLimited(false);
  }, [account.id]);

  // ── Build rows for the active level ──
  const rows: Row[] = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const ins = insights[level];

    let built: Row[];
    if (level === "campaign") {
      built = campaigns.map((c) => ({
        id: c.id, type: "CAMPAIGN" as const, name: c.name, status: c.status,
        detail: (c.objective || "").replace("OUTCOME_", ""),
        budget: c.daily_budget || c.lifetime_budget ? num(c.daily_budget || c.lifetime_budget) / 100 : null,
        insight: ins[c.id],
      }));
    } else if (level === "adset") {
      const source = scopeCampaign ? { [scopeCampaign.id]: adSets[scopeCampaign.id] || [] } : adSets;
      built = Object.entries(source).flatMap(([campaignId, list]) => {
        const parent = campaigns.find((c) => c.id === campaignId);
        return (list || []).map((as) => ({
          id: as.id, type: "ADSET" as const, name: as.name, status: as.status,
          detail: ((as as any).optimization_goal || "").replace(/_/g, " "),
          budget: as.daily_budget || as.lifetime_budget ? num(as.daily_budget || as.lifetime_budget) / 100 : null,
          parentName: parent?.name,
          insight: ins[as.id],
        }));
      });
    } else {
      const adSetPool = scopeAdSet
        ? [scopeAdSet]
        : (scopeCampaign ? (adSets[scopeCampaign.id] || []) : Object.values(adSets).flat());
      built = adSetPool.flatMap((as) =>
        (ads[as.id] || []).map((ad) => ({
          id: ad.id, type: "AD" as const, name: ad.name, status: ad.status,
          detail: ad.creative?.id ? `Creative ${ad.creative.id}` : "",
          budget: null,
          parentName: as.name,
          insight: ins[ad.id],
        }))
      );
    }

    if (q) built = built.filter((r) => r.name.toLowerCase().includes(q) || (r.parentName || "").toLowerCase().includes(q));

    const dir = sortDir === "asc" ? 1 : -1;
    return [...built].sort((a, b) => {
      const metric = (r: Row, k: keyof InsightRow) => num(r.insight?.[k]);
      switch (sortKey) {
        case "name": return a.name.localeCompare(b.name) * dir;
        case "status": return a.status.localeCompare(b.status) * dir;
        case "budget": return ((a.budget ?? -1) - (b.budget ?? -1)) * dir;
        default: return (metric(a, sortKey) - metric(b, sortKey)) * dir;
      }
    });
  }, [level, campaigns, adSets, ads, scopeCampaign, scopeAdSet, searchQuery, insights, sortKey, sortDir]);

  const totals = useMemo(() => {
    const spend = rows.reduce((n, r) => n + num(r.insight?.spend), 0);
    const impressions = rows.reduce((n, r) => n + num(r.insight?.impressions), 0);
    const clicks = rows.reduce((n, r) => n + num(r.insight?.clicks), 0);
    return {
      spend, impressions, clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    };
  }, [rows]);

  // ── Drill-down ──
  const drillInto = (row: Row) => {
    if (row.type === "CAMPAIGN") {
      const c = campaigns.find((x) => x.id === row.id);
      if (c) { setScopeCampaign(c); setScopeAdSet(null); setLevel("adset"); }
    } else if (row.type === "ADSET") {
      const as = Object.values(adSets).flat().find((x) => x.id === row.id);
      if (as) { setScopeAdSet(as); setLevel("ad"); }
    }
  };

  const changeLevel = (next: Level) => {
    setLevel(next);
    if (next === "campaign") { setScopeCampaign(null); setScopeAdSet(null); }
    if (next === "adset") setScopeAdSet(null);
  };

  // ── Status toggle (pause instantly; enabling spends money → confirm) ──
  const applyStatus = useCallback(async (row: Row, nextStatus: "ACTIVE" | "PAUSED") => {
    setTogglingId(row.id);
    try {
      if (nextStatus === "ACTIVE") await adAccountApi.bulkActivate([row.id]);
      else await adAccountApi.bulkPause([row.id]);
      const patch = <T extends { id: string; status: string }>(list: T[]) =>
        list.map((x) => (x.id === row.id ? { ...x, status: nextStatus } : x));
      setCampaigns((prev) => patch(prev));
      setAdSets((prev) => { const n = { ...prev }; for (const k in n) n[k] = patch(n[k]); return n; });
      setAds((prev) => { const n = { ...prev }; for (const k in n) n[k] = patch(n[k]); return n; });
      toast.success(`${row.name} ${nextStatus === "ACTIVE" ? "enabled" : "paused"}`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Status change failed"));
    } finally {
      setTogglingId(null);
    }
  }, [setCampaigns, setAdSets, setAds]);

  const handleToggle = (row: Row) => {
    if (row.status === "ACTIVE") applyStatus(row, "PAUSED");
    else setPendingActivate(row); // enabling starts delivery + spend — confirm first
  };

  const sortHeader = (key: SortKey, label: string, align: "left" | "right" = "right") => (
    <th
      className={cn(
        "px-3 py-2 font-medium text-[11px] text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-200 whitespace-nowrap",
        align === "right" ? "text-right" : "text-left",
      )}
      onClick={() => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir(key === "name" || key === "status" ? "asc" : "desc"); }
      }}
      aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === key && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </span>
    </th>
  );

  const levelTabs: Array<{ key: Level; label: string }> = [
    { key: "campaign", label: "Campaigns" },
    { key: "adset", label: "Ad sets" },
    { key: "ad", label: "Ads" },
  ];

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-gray-900/40 border border-gray-800/60 rounded-xl overflow-hidden">

      {/* Level tabs — Google Ads' Campaigns / Ad groups / Ads switcher */}
      <div className="flex items-center border-b border-gray-800/60 px-2">
        {levelTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => changeLevel(t.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              level === t.key
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-300",
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 py-1.5 pr-1">
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            aria-label="Metrics date range"
            className="rounded-md bg-gray-800/60 border border-gray-700/50 text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:border-blue-500/50"
          >
            {DATE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Filter bar: search + scope chips */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-800/40">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${levelTabs.find((t) => t.key === level)?.label.toLowerCase()}…`}
            className="pl-8 pr-3 py-1.5 w-56 rounded-md bg-gray-800/40 border border-gray-700/40 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        {scopeCampaign && (
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-full pl-2.5 pr-1 py-0.5">
            Campaign: {scopeCampaign.name}
            <button onClick={() => { setScopeCampaign(null); setScopeAdSet(null); }} aria-label="Clear campaign filter"
              className="p-0.5 rounded-full hover:bg-blue-500/20"><X className="w-3 h-3" /></button>
          </span>
        )}
        {scopeAdSet && (
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-full pl-2.5 pr-1 py-0.5">
            Ad set: {scopeAdSet.name}
            <button onClick={() => setScopeAdSet(null)} aria-label="Clear ad set filter"
              className="p-0.5 rounded-full hover:bg-purple-500/20"><X className="w-3 h-3" /></button>
          </span>
        )}
        {(insightsLoading || childrenLoading) && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 ml-auto">
            <Loader2 className="w-3 h-3 animate-spin" />
            {childrenLoading
              ? `Loading items…${loadProgress ? ` ${loadProgress.done}/${loadProgress.total}` : ""}`
              : "Loading metrics…"}
          </span>
        )}
      </div>

      {/* Meta rate-limit notice — loading stopped, user decides when to retry */}
      {rateLimited && (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] bg-amber-500/10 border-b border-amber-500/20 text-amber-300">
          <span>Meta API rate limit reached — some items couldn&apos;t load. Wait a minute, then retry.</span>
          <button
            onClick={retryLoading}
            className="font-medium underline underline-offset-2 text-amber-400 hover:text-amber-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="border-b border-gray-800/60">
              <th className="w-8 px-3 py-2"></th>
              <th className="w-10 px-2 py-2 text-left font-medium text-[11px] text-gray-400 uppercase tracking-wide">On</th>
              {sortHeader("name", level === "campaign" ? "Campaign" : level === "adset" ? "Ad set" : "Ad", "left")}
              {sortHeader("status", "Status", "left")}
              <th className="px-3 py-2 text-left font-medium text-[11px] text-gray-400 uppercase tracking-wide whitespace-nowrap">
                {level === "campaign" ? "Objective" : level === "adset" ? "Goal" : "Creative"}
              </th>
              {level !== "ad" && sortHeader("budget", "Budget")}
              {sortHeader("spend", "Cost")}
              {sortHeader("impressions", "Impr.")}
              {sortHeader("clicks", "Clicks")}
              {sortHeader("ctr", "CTR")}
              {sortHeader("cpc", "Avg. CPC")}
              {sortHeader("cpm", "CPM")}
            </tr>
            {/* Totals row, Google Ads style */}
            <tr className="border-b border-gray-800/60 bg-gray-800/30">
              <td className="px-3 py-1.5"></td>
              <td className="px-2 py-1.5"></td>
              <td className="px-3 py-1.5 text-gray-400 font-medium">Total: {rows.length} {rows.length === 1 ? "item" : "items"}</td>
              <td className="px-3 py-1.5"></td>
              <td className="px-3 py-1.5"></td>
              {level !== "ad" && <td className="px-3 py-1.5"></td>}
              <td className="px-3 py-1.5 text-right text-gray-300 font-medium whitespace-nowrap">{fmtMoney(totals.spend, currency)}</td>
              <td className="px-3 py-1.5 text-right text-gray-300 font-medium">{fmtCount(totals.impressions)}</td>
              <td className="px-3 py-1.5 text-right text-gray-300 font-medium">{fmtCount(totals.clicks)}</td>
              <td className="px-3 py-1.5 text-right text-gray-300 font-medium">{totals.ctr > 0 ? `${totals.ctr.toFixed(2)}%` : "—"}</td>
              <td className="px-3 py-1.5 text-right text-gray-300 font-medium whitespace-nowrap">{fmtMoney(totals.cpc, currency)}</td>
              <td className="px-3 py-1.5 text-right text-gray-300 font-medium whitespace-nowrap">{fmtMoney(totals.cpm, currency)}</td>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !childrenLoading && (
              <tr>
                <td colSpan={12} className="px-3 py-10 text-center text-gray-600">
                  {searchQuery ? "No items match your filter." : "Nothing here yet."}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const selected = selectedItems.has(row.id);
              const i = row.insight;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors",
                    selected && "bg-blue-500/5",
                  )}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleSelection(row.id, row.type, row.name)}
                      aria-label={`Select ${row.name}`}
                      className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <StatusToggle status={row.status} busy={togglingId === row.id} onToggle={() => handleToggle(row)} />
                  </td>
                  <td className="px-3 py-2 max-w-[280px]">
                    {row.type !== "AD" ? (
                      <button
                        onClick={() => drillInto(row)}
                        title={`View ${row.type === "CAMPAIGN" ? "ad sets" : "ads"} in ${row.name}`}
                        className="text-blue-400 hover:text-blue-300 hover:underline text-left truncate block max-w-full"
                      >
                        {row.name}
                      </button>
                    ) : (
                      <span className="text-gray-200 truncate block">{row.name}</span>
                    )}
                    {row.parentName && <span className="text-[10px] text-gray-600 truncate block">in {row.parentName}</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={cn(
                      "inline-flex items-center gap-1.5",
                      row.status === "ACTIVE" ? "text-emerald-400" : row.status === "PAUSED" ? "text-gray-500" : "text-amber-400",
                    )}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        row.status === "ACTIVE" ? "bg-emerald-400" : row.status === "PAUSED" ? "bg-gray-600" : "bg-amber-400",
                      )} />
                      {row.status === "ACTIVE" ? "Enabled" : row.status === "PAUSED" ? "Paused" : row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap max-w-[160px] truncate">{row.detail || "—"}</td>
                  {level !== "ad" && (
                    <td className="px-3 py-2 text-right text-gray-300 whitespace-nowrap">
                      {row.budget !== null ? fmtMoney(row.budget, currency) : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right text-gray-200 whitespace-nowrap">{fmtMoney(num(i?.spend), currency)}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{fmtCount(num(i?.impressions))}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{fmtCount(num(i?.clicks))}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{num(i?.ctr) > 0 ? `${num(i?.ctr).toFixed(2)}%` : "—"}</td>
                  <td className="px-3 py-2 text-right text-gray-300 whitespace-nowrap">{fmtMoney(num(i?.cpc), currency)}</td>
                  <td className="px-3 py-2 text-right text-gray-300 whitespace-nowrap">{fmtMoney(num(i?.cpm), currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!pendingActivate}
        onOpenChange={(open) => { if (!open) setPendingActivate(null); }}
        title="Enable on Meta?"
        description={`"${pendingActivate?.name}" will start delivering and spending immediately.`}
        confirmLabel="Enable"
        variant="warning"
        onConfirm={() => {
          if (pendingActivate) applyStatus(pendingActivate, "ACTIVE");
          setPendingActivate(null);
        }}
        isLoading={togglingId === pendingActivate?.id}
      />
    </div>
  );
}
