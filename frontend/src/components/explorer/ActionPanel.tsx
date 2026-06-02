"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Copy, Loader2, Layers, X, Globe, Zap, AlertTriangle, Info,
  ArrowRightLeft, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NamingTemplateEditor } from "@/components/dashboard/NamingTemplateEditor";
import { NamingPreview } from "@/components/dashboard/NamingPreview";
import { MetaField } from "@/components/meta/MetaField";
import { OptimizedFieldRow } from "@/components/meta/OptimizedFieldRow";
import { FieldSummaryBadges } from "@/components/meta/FieldActionBadge";
import { ValidationBanner } from "@/components/meta/ValidationBanner";
import {
  OBJECTIVES, OBJECTIVE_LABELS,
  type OptimizedField,
} from "@/lib/meta-schema";

type PanelMode = 'duplicate' | 'convert';

interface ActionPanelProps {
  selectedItems: Map<string, { id: string; type: string; name: string }>;
  selectedItemsList: Array<{ id: string; type: string; name: string }>;
  panelMode: PanelMode;
  setPanelMode: (m: PanelMode) => void;
  setPanelOpen: (v: boolean) => void;
  canConvert: boolean;
  isBusy: boolean;
  isSingleItem: boolean;
  hasCampaigns: boolean;
  setConfirmAction: (a: 'delete' | 'activate' | 'pause' | null) => void;
  activating: boolean;
  pausing: boolean;
  deleting: boolean;
  duplicating: boolean;
  savingDraft: boolean;
  converting: boolean;
  optimizing: boolean;
  optimizationData: any;
  allOptFields: OptimizedField[];
  handleFieldChange: (entityKey: string, field: string, value: any) => void;
  renamePattern: string;
  setRenamePattern: (p: string) => void;
  previewContext: Record<string, string | undefined>;
  country: string;
  setCountry: (v: string) => void;
  angle: string;
  setAngle: (v: string) => void;
  numCopies: number;
  setNumCopies: (v: number) => void;
  destAccountId: string | null;
  setDestAccountId: (v: string | null) => void;
  adAccounts: Array<{ id: string; name: string }>;
  selectedAccount: { id: string } | null;
  deep: boolean;
  setDeep: (v: boolean) => void;
  handleAnalyzeForDuplicate: () => void;
  handleAnalyzeForConvert: () => void;
  handleDuplicate: () => void;
  handleSaveDraft: () => void;
  handleConvert: (mode: "draft" | "publish") => void;
  resetOptimization: () => void;
  targetObjective: string;
  setTargetObjective: (v: string) => void;
  convertName: string;
  setConvertName: (v: string) => void;
}

export function ActionPanel({
  selectedItems, selectedItemsList,
  panelMode, setPanelMode, setPanelOpen,
  canConvert, isBusy, isSingleItem, hasCampaigns,
  setConfirmAction,
  activating, pausing, deleting, duplicating, savingDraft, converting, optimizing,
  optimizationData, allOptFields, handleFieldChange,
  renamePattern, setRenamePattern, previewContext,
  country, setCountry, angle, setAngle, numCopies, setNumCopies,
  destAccountId, setDestAccountId, adAccounts, selectedAccount,
  deep, setDeep,
  handleAnalyzeForDuplicate, handleAnalyzeForConvert,
  handleDuplicate, handleSaveDraft, handleConvert,
  resetOptimization,
  targetObjective, setTargetObjective, convertName, setConvertName,
}: ActionPanelProps) {
  const renderOptimizationSection = () => {
    if (!optimizationData) return null;
    const campaign = optimizationData.campaign;
    const adSetsList = optimizationData.adSets || [];

    return (
      <div className="space-y-4">
        <FieldSummaryBadges fields={allOptFields} />

        {panelMode === 'convert' && optimizationData.sourceObjective && (
          <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-lg flex gap-2 items-start">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-300">
              Converting from <strong>{OBJECTIVE_LABELS[optimizationData.sourceObjective] || optimizationData.sourceObjective}</strong> to{" "}
              <strong>{OBJECTIVE_LABELS[optimizationData.targetObjective] || optimizationData.targetObjective}</strong>.
              Edit any editable field before confirming.
            </p>
          </div>
        )}

        {campaign && (
          <div>
            <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-blue-400" /> Campaign Fields
            </h4>
            <ValidationBanner warnings={campaign.warnings} errors={campaign.errors} />
            <div className="space-y-1.5 mt-2">
              {campaign.fields?.map((f: OptimizedField) => (
                <OptimizedFieldRow key={f.field} field={f} compact
                  onChangeValue={(field, value) => handleFieldChange("campaign", field, value)} />
              ))}
            </div>
          </div>
        )}

        {adSetsList.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-purple-400" /> Ad Set Fields
              {optimizationData.totalAdSets > adSetsList.length && (
                <span className="text-[10px] text-gray-500">(showing {adSetsList.length} of {optimizationData.totalAdSets})</span>
              )}
            </h4>
            {adSetsList.map((adSet: any) => (
              <div key={adSet.sourceId} className="mb-3">
                <p className="text-[11px] text-gray-400 mb-1.5 font-medium">{adSet.sourceName}</p>
                <ValidationBanner warnings={adSet.warnings} errors={adSet.errors} />
                <div className="space-y-1.5 mt-1">
                  {adSet.fields?.map((f: OptimizedField) => (
                    <OptimizedFieldRow key={f.field} field={f} compact
                      onChangeValue={(field, value) => handleFieldChange(adSet.sourceId, field, value)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDuplicatePanel = () => (
    <div className="space-y-5">
      <div className="bg-amber-900/20 border border-amber-500/30 p-3 rounded-lg flex gap-2.5 text-amber-200">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="text-[11px]">New structures will be created as <strong>PAUSED</strong>.</p>
      </div>

      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Naming</h3>
        <div className="space-y-3">
          <NamingTemplateEditor onPatternChange={setRenamePattern} initialPattern={renamePattern} type={hasCampaigns ? "CAMPAIGN" : "ALL"} />
          <NamingPreview pattern={renamePattern} context={previewContext} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Settings</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetaField label="Target Country" value={country} onChange={setCountry} placeholder="e.g. TH" />
          <MetaField label="Marketing Angle" value={angle} onChange={setAngle} placeholder="e.g. UGC" />
          <MetaField label="Copies" value={numCopies} type="number" onChange={(v: string) => setNumCopies(parseInt(v) || 1)} />
        </div>

        <div className="mt-3">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1.5">
            Destination Account
          </label>
          <Select value={destAccountId} onValueChange={setDestAccountId}>
            <SelectTrigger className="h-8 bg-gray-950 border-gray-800 text-xs text-gray-300 focus:ring-0">
              <SelectValue placeholder="Select account..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              {adAccounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id}
                  className={cn("text-xs", acc.id === selectedAccount?.id ? "text-blue-400" : "text-gray-300")}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {destAccountId && destAccountId !== selectedAccount?.id && (
            <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Cloning to a different ad account
            </p>
          )}
        </div>

        {hasCampaigns && (
          <div className="flex items-center space-x-2 bg-gray-950 p-3 rounded-lg border border-gray-800 mt-3">
            <Checkbox id="deep" checked={deep} onCheckedChange={(checked) => setDeep(!!checked)} />
            <div className="grid gap-1 leading-none">
              <label htmlFor="deep" className="text-xs font-medium">Deep Duplication</label>
              <p className="text-[10px] text-gray-500">Include all Ad Sets and Ads.</p>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Field Optimization</h3>
          {isSingleItem && !optimizationData && (
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5 border-gray-700 text-gray-300"
              onClick={handleAnalyzeForDuplicate} disabled={optimizing}>
              {optimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Analyze Fields
            </Button>
          )}
        </div>

        {!isSingleItem && (
          <p className="text-[11px] text-gray-600">Field optimization is available for single-item duplicates.</p>
        )}

        {optimizationData && renderOptimizationSection()}
        {optimizing && (
          <div className="flex items-center gap-2 text-gray-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Analyzing fields...</span>
          </div>
        )}
      </section>

      <section className="pt-3 border-t border-gray-800/40 space-y-2">
        <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2" onClick={handleDuplicate} disabled={isBusy}>
          {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
          {duplicating ? "Duplicating..." : "Duplicate Now"}
        </Button>
        <Button variant="outline" className="w-full border-blue-600/30 text-blue-400 hover:bg-blue-600/10 gap-2"
          onClick={handleSaveDraft} disabled={isBusy}>
          {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
          Save as Draft
        </Button>
      </section>
    </div>
  );

  const renderConvertPanel = () => (
    <div className="space-y-5">
      <div className="bg-gray-900/50 border border-gray-800/60 p-3 rounded-lg flex gap-2.5">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
        <p className="text-[11px] text-gray-400">
          Converts the campaign to a different objective while preserving its structure.
          Fields that don&apos;t apply to the new objective are automatically remapped or removed.
          The result is saved as a <strong className="text-gray-300">PAUSED draft</strong> — nothing goes live until you publish.
        </p>
      </div>
      <div className="bg-amber-900/20 border border-amber-500/30 p-3 rounded-lg flex gap-2.5 text-amber-200">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="text-[11px]">
          Incompatible fields will be automatically removed or remapped. New items will be <strong>PAUSED</strong>.
        </p>
      </div>

      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Target Objective</h3>
        <div className="grid grid-cols-2 gap-2">
          {OBJECTIVES.map((obj) => (
            <button key={obj.value} onClick={() => { setTargetObjective(obj.value); resetOptimization(); }}
              className={cn(
                "p-3 rounded-lg border-2 text-left transition-all",
                targetObjective === obj.value
                  ? "border-blue-600 bg-blue-600/10"
                  : "border-gray-800 bg-gray-950 hover:border-gray-700"
              )}>
              <div className="text-xs font-bold text-gray-100">{obj.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{obj.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Configuration</h3>
        <div className="space-y-3">
          <MetaField label="New Campaign Name" value={convertName} onChange={setConvertName} placeholder="Enter new name..." />
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1.5">
              Destination Account
            </label>
            <Select value={destAccountId ?? ''} onValueChange={(v) => setDestAccountId(v || null)}>
              <SelectTrigger className="h-8 bg-gray-950 border-gray-800 text-xs text-gray-300 focus:ring-0">
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                {adAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}
                    className={cn("text-xs", acc.id === selectedAccount?.id ? "text-blue-400" : "text-gray-300")}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {destAccountId && destAccountId !== selectedAccount?.id && (
              <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Converting to a different ad account
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Field Optimization</h3>
          {!optimizationData && (
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5 border-gray-700 text-gray-300"
              onClick={handleAnalyzeForConvert} disabled={optimizing}>
              {optimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Analyze & Optimize
            </Button>
          )}
        </div>

        {optimizationData && renderOptimizationSection()}
        {optimizing && (
          <div className="flex items-center gap-2 text-gray-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Analyzing conversion...</span>
          </div>
        )}
      </section>

      <section className="pt-3 border-t border-gray-800/40 space-y-2">
        <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
          onClick={() => handleConvert("publish")} disabled={isBusy || !optimizationData}>
          {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
          {converting ? "Converting..." : "Convert & Publish"}
        </Button>
        <Button variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 gap-2"
          onClick={() => handleConvert("draft")} disabled={isBusy || !optimizationData}>
          <Layers className="w-4 h-4" /> Save as Draft
        </Button>
      </section>
    </div>
  );

  return (
    <div className="w-full lg:w-[420px] lg:shrink-0 bg-gray-900/30 border border-gray-800/60 rounded-xl flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-800/60 bg-gray-900/50">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
            {selectedItems.size} item{selectedItems.size > 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-gray-300"
            onClick={() => setPanelOpen(false)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex gap-1 bg-gray-950/50 rounded-lg p-0.5">
          <button
            onClick={() => { setPanelMode('duplicate'); resetOptimization(); }}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5",
              panelMode === 'duplicate' ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
            )}>
            <Copy className="w-3 h-3" /> Duplicate
          </button>
          <button
            onClick={() => { setPanelMode('convert'); resetOptimization(); }}
            disabled={!canConvert}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5",
              panelMode === 'convert' ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-300",
              !canConvert && "opacity-40 cursor-not-allowed"
            )}>
            <ArrowRightLeft className="w-3 h-3" /> Convert
          </button>
        </div>
      </div>

      <div className="px-4 pt-2 space-y-1.5">
        <div className="flex gap-2">
          <Button variant="outline" size="sm"
            className="flex-1 border-emerald-800/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 gap-1.5 h-8 text-xs"
            onClick={() => setConfirmAction('activate')} disabled={isBusy}>
            {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {activating ? "Activating..." : "Activate"}
          </Button>
          <Button variant="outline" size="sm"
            className="flex-1 border-amber-800/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 gap-1.5 h-8 text-xs"
            onClick={() => setConfirmAction('pause')} disabled={isBusy}>
            {pausing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            {pausing ? "Pausing..." : "Pause"}
          </Button>
        </div>
        <Button variant="outline" size="sm"
          className="w-full border-red-800/50 text-red-400 hover:bg-red-600/10 hover:text-red-300 gap-2 h-8 text-xs"
          onClick={() => setConfirmAction('delete')} disabled={isBusy}>
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {deleting ? "Deleting..." : `Delete (${selectedItemsList.length}) from Meta`}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {panelMode === 'duplicate' && renderDuplicatePanel()}
        {panelMode === 'convert' && renderConvertPanel()}
      </div>
    </div>
  );
}
