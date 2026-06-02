"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useWideCreationStore, useWideCreationHydration } from "@/store/useWideCreationStore";
import { useAppStore } from "@/store/useAppStore";
import { wideCreationApi } from "@/services/api";
import { toast } from "sonner";
import { StepObjectives } from "@/components/wide-create/StepObjectives";
import { StepConfigure } from "@/components/wide-create/StepConfigure";
import {
  Grid3X3,
  ArrowRight,
  ArrowLeft,
  Rocket,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { cn, extractApiError } from "@/lib/utils";

const STEP_LABELS = [
  { n: 1, label: "Objectives" },
  { n: 2, label: "Configure" },
  { n: 3, label: "Generate" },
];

export default function WideCreatePage() {
  const hydrated = useWideCreationHydration();
  const store = useWideCreationStore();
  const { selectedAccount } = useAppStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [generationResult, setGenerationResult] = useState<any>(null);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterField, setFilterField] = useState<string>('all');
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('adspawn-widecreate-hint-seen')) {
      setShowHint(true);
    }
  }, []);

  const totalCampaigns = store.campaigns.length;
  const totalAdSets = store.campaigns.reduce((sum, c) => sum + c.adSets.length, 0);
  const totalAds = store.campaigns.reduce(
    (sum, c) => sum + c.adSets.reduce((s, as) => s + as.ads.length, 0), 0
  );

  const canGoNext = (): boolean => {
    if (store.step === 1) return store.objectiveSelections.length > 0;
    return true;
  };

  const handleNext = () => {
    if (store.step === 1) {
      store.generateStructure();
    }
  };

  const handleBack = () => {
    if (store.step > 1) {
      store.setStep(1);
    }
  };

  const handleValidate = async () => {
    if (!selectedAccount) {
      toast.error("Please select an ad account first");
      return;
    }
    setIsValidating(true);
    try {
      const template = store.toTemplate(selectedAccount.adaccount_id || selectedAccount.id);
      const res = await wideCreationApi.validate(template);
      setValidation(res.data);
      setFilterLevel('all'); setFilterField('all'); setFilterCampaign('all'); setFilterSeverity('all');
      if (res.data.valid) {
        toast.success(`Valid! ${res.data.totalEntities.campaigns} campaigns, ${res.data.totalEntities.adSets} ad sets, ${res.data.totalEntities.ads} ads ready`);
      } else {
        toast.error(`${res.data.errors.length} error(s) found`);
      }
    } catch (error: any) {
      toast.error(extractApiError(error, "Validation failed"));
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedAccount) {
      toast.error("Please select an ad account first");
      return;
    }
    setIsGenerating(true);
    try {
      const template = store.toTemplate(selectedAccount.adaccount_id || selectedAccount.id);
      const res = await wideCreationApi.generate(template);
      setGenerationResult(res.data);
      toast.success(
        `Created ${res.data.totalCreated.campaigns} campaigns, ${res.data.totalCreated.adSets} ad sets, ${res.data.totalCreated.ads} ads as drafts`
      );
    } catch (error: any) {
      toast.error(extractApiError(error, "Generation failed"));
      if (error.response?.data?.validation) {
        setValidation(error.response.data.validation);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    store.reset();
    setValidation(null);
    setGenerationResult(null);
    setShowResetConfirm(false);
  };

  if (!hydrated) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Grid3X3 className="w-6 h-6 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-100">Wide Creation</h1>
              <p className="text-sm text-gray-500">
                Generate large Campaign → Ad Set → Ad structures at scale
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {totalCampaigns > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                  {totalCampaigns} Campaign{totalCampaigns > 1 ? "s" : ""}
                </Badge>
                <Badge variant="outline" className="text-green-400 border-green-400/30">
                  {totalAdSets} Ad Set{totalAdSets > 1 ? "s" : ""}
                </Badge>
                <Badge variant="outline" className="text-purple-400 border-purple-400/30">
                  {totalAds} Ad{totalAds > 1 ? "s" : ""}
                </Badge>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-gray-400 border-gray-700"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* First-run hint */}
        {showHint && (
          <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-400 mb-0.5">Wide Create vs. Duplicate</p>
              <p className="text-xs text-gray-400">
                Wide Create builds fresh campaign structures from scratch across multiple objectives in one step.
                Use it when you need new campaigns — not copies of existing ones.
                Duplicate (in Explorer) is for copying live campaigns.
              </p>
            </div>
            <button
              onClick={() => { localStorage.setItem('adspawn-widecreate-hint-seen', '1'); setShowHint(false); }}
              className="p-1 text-gray-600 hover:text-gray-400 rounded transition-colors shrink-0"
              aria-label="Dismiss hint"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Step indicators — horizontally scrollable on mobile */}
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex items-center gap-1 min-w-max">
          {STEP_LABELS.map(({ n, label }, i) => {
            const isGenStep = n === 3;
            const isDone = isGenStep ? !!generationResult : n < store.step;
            const isActive = isGenStep ? false : n === store.step;
            const isClickable = !isGenStep && (n <= store.step || (n === 2 && totalCampaigns > 0));
            return (
              <div key={n} className="flex items-center">
                <button
                  onClick={() => { if (isClickable) store.setStep(n as any); }}
                  disabled={!isClickable}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                    isActive
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                      : isDone
                      ? "text-green-400 border border-green-700/50 bg-green-500/5"
                      : "text-gray-600 border border-gray-800 cursor-default"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive ? "bg-blue-600 text-white" :
                    isDone ? "bg-green-600/80 text-white" : "bg-gray-800 text-gray-600"
                  }`}>
                    {isDone ? "✓" : n}
                  </span>
                  {label}
                </button>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`w-4 h-px mx-1 ${isDone ? "bg-green-600/40" : n < store.step ? "bg-blue-500/50" : "bg-gray-800"}`} />
                )}
              </div>
            );
          })}
        </div>
        </div>

        {/* Step Content */}
        {store.step === 1 && <StepObjectives />}
        {store.step === 2 && <StepConfigure />}

        {/* Navigation + Actions */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div>
                {store.step > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBack}
                    className="text-gray-400 border-gray-700"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    Back
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {validation && (
                  <div className="flex items-center gap-1.5 text-xs">
                    {validation.valid ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-green-400">Valid</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-red-400">{validation.errors.length} error(s)</span>
                      </>
                    )}
                  </div>
                )}

                {store.step >= 2 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleValidate}
                      disabled={isValidating}
                      className="border-gray-700 text-gray-300"
                    >
                      {isValidating && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                      Validate
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleGenerate}
                      disabled={isGenerating || totalCampaigns === 0}
                      className="bg-green-600 hover:bg-green-500"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Rocket className="w-3.5 h-3.5 mr-1" />
                      )}
                      Generate Drafts
                    </Button>
                  </>
                )}

                {store.step < 2 && (
                  <Button
                    size="sm"
                    onClick={handleNext}
                    disabled={!canGoNext()}
                    className="bg-blue-600 hover:bg-blue-500"
                  >
                    Next
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </div>
            </div>

            {/* Validation errors & warnings */}
            {validation && (!validation.valid || validation.warnings?.length > 0) && (() => {
              const allItems: { severity: 'error' | 'warning'; path: string; field?: string; message: string; entityLabel?: string }[] = [
                ...(validation.errors || []).map((e: any) => ({ ...e, severity: 'error' as const })),
                ...(validation.warnings || []).map((w: any) => ({ ...w, severity: 'warning' as const })),
              ];
              const getLevel = (item: any): string => {
                const p: string = item.path || '';
                if (p.includes('.ads[')) return 'ad';
                if (p.includes('.adSets[') || p.includes('adsets[')) return 'adset';
                return 'campaign';
              };
              const getCampaignName = (item: any): string => {
                const label: string = item.entityLabel || '';
                const match = label.match(/^([^›]+)/);
                return match ? match[1].trim() : item.path?.split('.')[0] || 'Unknown';
              };

              const levelCounts: Record<string, number> = {};
              const fieldCounts: Record<string, number> = {};
              const campaignCounts: Record<string, number> = {};
              const severityCounts: Record<string, number> = { error: 0, warning: 0 };
              allItems.forEach(item => {
                const lvl = getLevel(item);
                levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
                const f = item.field || 'general';
                fieldCounts[f] = (fieldCounts[f] || 0) + 1;
                const c = getCampaignName(item);
                campaignCounts[c] = (campaignCounts[c] || 0) + 1;
                severityCounts[item.severity]++;
              });

              const filtered = allItems.filter(item => {
                if (filterLevel !== 'all' && getLevel(item) !== filterLevel) return false;
                if (filterField !== 'all' && (item.field || 'general') !== filterField) return false;
                if (filterCampaign !== 'all' && getCampaignName(item) !== filterCampaign) return false;
                if (filterSeverity !== 'all' && item.severity !== filterSeverity) return false;
                return true;
              });

              const chipStyle = (active: boolean, color: 'red' | 'gray' = 'red') =>
                cn(
                  "text-[11px] px-2.5 py-1 rounded-md border transition-colors",
                  active
                    ? color === 'red' ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "text-gray-500 border-gray-800 hover:text-gray-300 hover:border-gray-700"
                );

              const levelLabels: Record<string, string> = { campaign: 'Campaign', adset: 'Ad Set', ad: 'Ad' };
              const fieldLabels: Record<string, string> = { general: 'General' };

              return (
                <div className="mt-3 space-y-2">
                  <div className="space-y-2">
                    {/* Severity */}
                    {(severityCounts.error > 0 && severityCounts.warning > 0) && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-600 uppercase tracking-wider w-16 shrink-0">Severity</span>
                        <button onClick={() => setFilterSeverity('all')} className={chipStyle(filterSeverity === 'all', 'gray')}>All ({allItems.length})</button>
                        <button onClick={() => setFilterSeverity('error')} className={chipStyle(filterSeverity === 'error')}>Errors ({severityCounts.error})</button>
                        <button onClick={() => setFilterSeverity('warning')} className={cn(chipStyle(false), filterSeverity === 'warning' && "bg-amber-500/15 text-amber-400 border-amber-500/30")}>Warnings ({severityCounts.warning})</button>
                      </div>
                    )}
                    {/* Level */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider w-16 shrink-0">Level</span>
                      <button onClick={() => setFilterLevel('all')} className={chipStyle(filterLevel === 'all', 'gray')}>All</button>
                      {Object.entries(levelCounts).map(([k, count]) => (
                        <button key={k} onClick={() => setFilterLevel(k)} className={chipStyle(filterLevel === k, 'gray')}>{levelLabels[k] || k} ({count})</button>
                      ))}
                    </div>
                    {/* Field */}
                    {Object.keys(fieldCounts).length > 1 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-600 uppercase tracking-wider w-16 shrink-0">Field</span>
                        <button onClick={() => setFilterField('all')} className={chipStyle(filterField === 'all', 'gray')}>All</button>
                        {Object.entries(fieldCounts).map(([k, count]) => (
                          <button key={k} onClick={() => setFilterField(k)} className={chipStyle(filterField === k, 'gray')}>{fieldLabels[k] || k} ({count})</button>
                        ))}
                      </div>
                    )}
                    {/* Campaign */}
                    {Object.keys(campaignCounts).length > 1 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-600 uppercase tracking-wider w-16 shrink-0">Campaign</span>
                        <button onClick={() => setFilterCampaign('all')} className={chipStyle(filterCampaign === 'all', 'gray')}>All</button>
                        {Object.entries(campaignCounts).map(([k, count]) => (
                          <button key={k} onClick={() => setFilterCampaign(k)} className={chipStyle(filterCampaign === k, 'gray')}><span className="truncate max-w-[200px] inline-block align-bottom">{k}</span> ({count})</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <div className="text-xs text-gray-600 py-2">No issues match the current filters.</div>
                    ) : filtered.map((item, i) => (
                      <div key={i} className={cn("text-xs flex items-start gap-1.5", item.severity === 'error' ? "text-red-400" : "text-amber-400")}>
                        {item.severity === 'error'
                          ? <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                          : <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />}
                        <span>
                          <span className={item.severity === 'error' ? "text-red-300 font-medium" : "text-amber-300 font-medium"}>{item.entityLabel || item.path}</span>
                          {item.field && <span className={item.severity === 'error' ? "text-red-400/70" : "text-amber-400/70"}> ({item.field})</span>}
                          <span className="text-gray-600"> — </span>
                          {item.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Generation result */}
            {generationResult && (
              <div className="mt-3 p-3 bg-green-950/30 border border-green-800/30 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">
                    Generated {generationResult.totalCreated.campaigns} campaigns,{" "}
                    {generationResult.totalCreated.adSets} ad sets,{" "}
                    {generationResult.totalCreated.ads} ads as drafts
                  </span>
                </div>
                {generationResult.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {generationResult.warnings.map((w: string, i: number) => (
                      <div key={i} className="text-xs text-yellow-400">{w}</div>
                    ))}
                  </div>
                )}
                <a href="/drafts" className="text-xs text-blue-400 hover:underline mt-2 inline-block">
                  View in Drafts →
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={(open) => !open && setShowResetConfirm(false)}
        title="Reset Wide Creation"
        description="This will clear all objectives, configurations, and generated structures. This cannot be undone."
        confirmLabel="Reset all data"
        variant="danger"
        onConfirm={confirmReset}
      />
    </DashboardLayout>
  );
}
