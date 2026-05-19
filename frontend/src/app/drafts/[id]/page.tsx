"use client";

import { useEffect, useState, use } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { draftApi } from "@/services/api";
import {
  Save, Send, ShieldCheck, AlertTriangle, FileText, Layers,
  Megaphone, Loader2, ArrowLeft, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { MetaField } from "@/components/meta/MetaField";
import { MetaForm } from "@/components/meta/MetaForm";
import {
  OBJECTIVE_LABELS, BID_STRATEGIES,
  VALID_OPTIMIZATION_GOALS, VALID_DESTINATION_TYPES,
  PROMOTED_OBJECT_REQUIREMENTS, PROMOTED_OBJECT_FIELD_LABELS,
} from "@/lib/meta-schema";

export default function DraftEditorPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [draft, setDraft] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<{ type: "CAMPAIGN" | "ADSET" | "AD"; id: string } | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);

  const campaignObjective: string = draft?.data?.objective || draft?.objective || "";
  const isCBO = !!(draft?.data?.daily_budget || draft?.data?.lifetime_budget);

  const fetchDraft = async () => {
    try {
      setIsLoading(true);
      const response = await draftApi.getCampaign(params.id);
      setDraft(response.data);
      if (!selectedNode) {
        setSelectedNode({ type: "CAMPAIGN", id: response.data.id });
        setEditData(response.data);
      } else {
        const d = response.data;
        if (selectedNode.type === "CAMPAIGN") setEditData(d);
        else if (selectedNode.type === "ADSET") {
          const found = d.adSets?.find((s: any) => s.id === selectedNode.id);
          if (found) setEditData(found);
        } else if (selectedNode.type === "AD") {
          for (const s of d.adSets || []) {
            const found = s.ads?.find((a: any) => a.id === selectedNode.id);
            if (found) { setEditData(found); break; }
          }
        }
      }
    } catch { toast.error("Failed to load draft details"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchDraft(); }, [params.id]);

  const handleSelectNode = (type: "CAMPAIGN" | "ADSET" | "AD", item: any) => {
    setSelectedNode({ type, id: item.id });
    setEditData(item);
  };

  const handleUpdateField = (field: string, value: any) => setEditData({ ...editData, [field]: value });
  const handleUpdateDataField = (field: string, value: any) => setEditData({ ...editData, data: { ...editData.data, [field]: value } });
  const handleUpdateNestedDataField = (parent: string, field: string, value: any) => {
    setEditData({ ...editData, data: { ...editData.data, [parent]: { ...(editData.data?.[parent] || {}), [field]: value } } });
  };

  const handleUpdateCreativeLinkData = (field: string, value: any) => {
    setEditData({
      ...editData,
      data: {
        ...editData.data,
        creative: {
          ...editData.data?.creative,
          object_story_spec: {
            ...editData.data?.creative?.object_story_spec,
            link_data: { ...editData.data?.creative?.object_story_spec?.link_data, [field]: value },
          },
        },
      },
    });
  };

  const handleUpdateCreativeCTA = (ctaType: string) => {
    setEditData({
      ...editData,
      data: {
        ...editData.data,
        creative: {
          ...editData.data?.creative,
          object_story_spec: {
            ...editData.data?.creative?.object_story_spec,
            link_data: {
              ...editData.data?.creative?.object_story_spec?.link_data,
              call_to_action: { type: ctaType },
            },
          },
        },
      },
    });
  };

  const handleSave = async () => {
    if (!selectedNode || !editData) return;
    setIsSaving(true);
    try {
      if (selectedNode.type === "CAMPAIGN") await draftApi.updateCampaign(selectedNode.id, editData);
      else if (selectedNode.type === "ADSET") await draftApi.updateAdSet(selectedNode.id, editData);
      else if (selectedNode.type === "AD") await draftApi.updateAd(selectedNode.id, editData);
      toast.success("Changes saved");
      fetchDraft();
    } catch { toast.error("Failed to save changes"); }
    finally { setIsSaving(false); }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const response = await draftApi.validateDraft(params.id);
      setValidationResults(response.data);
      if (response.data.isValid) toast.success("Validation passed!");
      else toast.error("Validation failed. Please fix the errors.");
      fetchDraft();
    } catch { toast.error("Validation failed"); }
    finally { setIsValidating(false); }
  };

  const handlePublish = async () => {
    if (!confirm("Publish to Meta? This will create real campaigns, ad sets, and ads (all PAUSED).")) return;
    setIsPublishing(true);
    try {
      await draftApi.publishDraft(params.id);
      toast.success("Published successfully!");
      router.push("/drafts");
    } catch (error: any) { toast.error(error.response?.data?.error || "Publishing failed"); }
    finally { setIsPublishing(false); }
  };

  const handleCleanup = async () => {
    if (!confirm("This will DELETE all Meta objects created by previous publish attempts and reset this draft for a fresh publish. Continue?")) return;
    setIsCleaning(true);
    try {
      const response = await draftApi.cleanupMetaObjects(params.id);
      toast.success(`Cleaned up ${response.data.deleted.length} Meta objects. Draft reset.`);
      fetchDraft();
    } catch (error: any) { toast.error(error.response?.data?.error || "Cleanup failed"); }
    finally { setIsCleaning(false); }
  };

  const hasMetaId = !!draft?.metaId || draft?.adSets?.some((s: any) => !!s.metaId);

  if (isLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div></DashboardLayout>;
  }
  if (!draft) {
    return <DashboardLayout><div className="text-center py-16 text-gray-500">Draft not found</div></DashboardLayout>;
  }

  const statusColor =
    draft.status === "READY" ? "text-emerald-400 bg-emerald-500/15" :
    draft.status === "PUBLISHED" ? "text-emerald-500 bg-emerald-500/10" :
    draft.status === "FAILED" ? "text-red-400 bg-red-500/15" :
    "text-gray-400 bg-gray-800/50";

  const goalOptions = VALID_OPTIMIZATION_GOALS[campaignObjective] || [];
  const destOptions = VALID_DESTINATION_TYPES[campaignObjective] || [];
  const promotedObjectFields = PROMOTED_OBJECT_REQUIREMENTS[campaignObjective] || [];
  const needsPromotedObject = promotedObjectFields.length > 0;
  const isAppPromotion = campaignObjective === "OUTCOME_APP_PROMOTION";

  const renderCampaignForm = () => (
    <div className="space-y-4">
      <MetaField label="Campaign Name" value={editData.name || ""} onChange={(v) => handleUpdateField("name", v)} />
      <MetaField label="Objective" value={campaignObjective} type="enum"
        options={Object.entries(OBJECTIVE_LABELS).map(([v, l]) => ({ value: v, label: l }))} immutable />
      <MetaField label="Buying Type" value={editData.data?.buying_type || "AUCTION"} type="enum"
        options={[{ value: "AUCTION", label: "Auction" }, { value: "RESERVED", label: "Reach & Frequency" }]} immutable />

      <div className="pt-2 border-t border-gray-800/40">
        <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Budget & Bidding</span>
      </div>

      <MetaField label="Bid Strategy" value={editData.data?.bid_strategy || ""} type="enum"
        options={BID_STRATEGIES} onChange={(v) => handleUpdateDataField("bid_strategy", v)} />

      <div className="flex items-center gap-2 py-1">
        <Checkbox
          checked={!!editData.data?.is_adset_budget_sharing_enabled}
          onCheckedChange={(v) => handleUpdateDataField("is_adset_budget_sharing_enabled", !!v)}
        />
        <Label className="text-xs text-gray-400">Campaign Budget Optimization (CBO)</Label>
      </div>

      {isCBO && (
        <>
          <MetaField label="Daily Budget (CBO)" value={editData.data?.daily_budget} type="number" isBudget
            onChange={(v) => handleUpdateDataField("daily_budget", v)}
            hint="Campaign-level daily budget. Mutually exclusive with Lifetime Budget." />
          <MetaField label="Lifetime Budget (CBO)" value={editData.data?.lifetime_budget} type="number" isBudget
            onChange={(v) => handleUpdateDataField("lifetime_budget", v)}
            hint="Campaign-level lifetime budget. Mutually exclusive with Daily Budget." />
        </>
      )}

      <MetaField label="Spend Cap" value={editData.data?.spend_cap} type="number" isBudget
        onChange={(v) => handleUpdateDataField("spend_cap", v)} hint="Max total spend. Set 0 to remove." />

      <div className="pt-2 border-t border-gray-800/40">
        <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Special Ad Categories</span>
        <p className="text-[10px] text-gray-600 mt-0.5">Required by Meta for ads about credit, employment, housing, etc.</p>
      </div>
      <div className="space-y-2">
        {['NONE', 'CREDIT', 'EMPLOYMENT', 'HOUSING', 'ISSUES_ELECTIONS_POLITICS', 'FINANCIAL_PRODUCTS_SERVICES', 'ONLINE_GAMBLING_AND_GAMING'].map((cat) => {
          const current: string[] = editData.data?.special_ad_categories || ['NONE'];
          const checked = current.includes(cat);
          return (
            <div key={cat} className="flex items-center gap-2">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => {
                  let next = v
                    ? (cat === 'NONE' ? ['NONE'] : [...current.filter((c: string) => c !== 'NONE'), cat])
                    : current.filter((c: string) => c !== cat);
                  handleUpdateDataField("special_ad_categories", next.length ? next : ['NONE']);
                }}
              />
              <Label className="text-xs text-gray-400">{cat.replace(/_/g, ' ')}</Label>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderAdSetForm = () => (
    <div className="space-y-4">
      <MetaField label="Ad Set Name" value={editData.name || ""} onChange={(v) => handleUpdateField("name", v)} />

      <MetaField label="Optimization Goal" value={editData.data?.optimization_goal || ""} type="enum"
        options={goalOptions} onChange={(v) => handleUpdateDataField("optimization_goal", v)}
        hint={`Valid goals for ${OBJECTIVE_LABELS[campaignObjective] || campaignObjective}`} />

      <MetaField label="Destination Type" value={editData.data?.destination_type || ""} type="enum"
        options={destOptions} onChange={(v) => handleUpdateDataField("destination_type", v)} />

      <MetaField label="Billing Event" value={editData.data?.billing_event || ""} type="enum"
        options={[
          { value: "IMPRESSIONS", label: "Impressions" }, { value: "LINK_CLICKS", label: "Link Clicks" },
          { value: "APP_INSTALLS", label: "App Installs" }, { value: "THRUPLAY", label: "ThruPlay" },
        ]}
        onChange={(v) => handleUpdateDataField("billing_event", v)} />

      {needsPromotedObject && (
        <>
          <div className="pt-2 border-t border-gray-800/40">
            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Promoted Object</span>
            {editData.metaId && <span className="ml-2 text-[9px] text-red-400">(immutable after publish)</span>}
          </div>

          {promotedObjectFields.map((field) => (
            <MetaField key={field} label={PROMOTED_OBJECT_FIELD_LABELS[field] || field}
              value={editData.data?.promoted_object?.[field] || ""}
              onChange={(v) => handleUpdateNestedDataField("promoted_object", field, v)}
              placeholder={`Enter ${PROMOTED_OBJECT_FIELD_LABELS[field]?.toLowerCase() || field}`}
              disabled={!!editData.metaId} />
          ))}

          {isAppPromotion && (
            <MetaField label="App Store URL" value={editData.data?.promoted_object?.object_store_url || ""}
              onChange={(v) => handleUpdateNestedDataField("promoted_object", "object_store_url", v)}
              placeholder="https://play.google.com/store/apps/details?id=..."
              disabled={!!editData.metaId} />
          )}
        </>
      )}

      {!isCBO ? (
        <>
          <div className="pt-2 border-t border-gray-800/40">
            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Ad Set Budget</span>
          </div>
          <MetaField label="Bid Strategy" value={editData.data?.bid_strategy || ""} type="enum"
            options={BID_STRATEGIES} onChange={(v) => handleUpdateDataField("bid_strategy", v)} />
          <MetaField label="Daily Budget" value={editData.data?.daily_budget} type="number" isBudget
            onChange={(v) => handleUpdateDataField("daily_budget", v)} />
          <MetaField label="Lifetime Budget" value={editData.data?.lifetime_budget} type="number" isBudget
            onChange={(v) => handleUpdateDataField("lifetime_budget", v)} />
          <MetaField label="Bid Amount" value={editData.data?.bid_amount} type="number" isBudget
            onChange={(v) => handleUpdateDataField("bid_amount", v)} hint="Required for Bid Cap / Cost Cap strategies" />
        </>
      ) : (
        <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-lg">
          <p className="text-[11px] text-blue-400">
            This campaign uses Campaign Budget Optimization (CBO). Budget is managed at campaign level.
          </p>
        </div>
      )}

      <div className="pt-2 border-t border-gray-800/40">
        <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Schedule</span>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-400">Start Time</Label>
        <Input
          type="datetime-local"
          value={editData.data?.start_time ? editData.data.start_time.slice(0, 16) : ""}
          onChange={(e) => handleUpdateDataField("start_time", e.target.value ? `${e.target.value}:00` : undefined)}
          className="bg-gray-950/50 border-gray-800/40"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-400">End Time</Label>
        <Input
          type="datetime-local"
          value={editData.data?.end_time ? editData.data.end_time.slice(0, 16) : ""}
          onChange={(e) => handleUpdateDataField("end_time", e.target.value ? `${e.target.value}:00` : undefined)}
          className="bg-gray-950/50 border-gray-800/40"
        />
      </div>

      {['OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_APP_PROMOTION'].includes(campaignObjective) && (
        <>
          <div className="pt-2 border-t border-gray-800/40">
            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Attribution</span>
          </div>
          <MetaField
            label="Attribution Event Type"
            value={editData.data?.attribution_spec?.event_type || "CLICK_THROUGH"}
            type="enum"
            options={[{ value: "CLICK_THROUGH", label: "Click Through" }, { value: "VIEW_THROUGH", label: "View Through" }]}
            onChange={(v) => handleUpdateNestedDataField("attribution_spec", "event_type", v)}
          />
          <MetaField
            label="Attribution Window (Days)"
            value={editData.data?.attribution_spec?.window_days || "7"}
            type="enum"
            options={[{ value: "1", label: "1 Day" }, { value: "7", label: "7 Days" }, { value: "28", label: "28 Days" }]}
            onChange={(v) => handleUpdateNestedDataField("attribution_spec", "window_days", v)}
          />
        </>
      )}
    </div>
  );

  const CTA_OPTIONS = [
    { value: "LEARN_MORE", label: "Learn More" },
    { value: "SHOP_NOW", label: "Shop Now" },
    { value: "SIGN_UP", label: "Sign Up" },
    { value: "BOOK_TRAVEL", label: "Book Now" },
    { value: "CONTACT_US", label: "Contact Us" },
    { value: "DOWNLOAD", label: "Download" },
    { value: "GET_OFFER", label: "Get Offer" },
    { value: "GET_QUOTE", label: "Get Quote" },
    { value: "SUBSCRIBE", label: "Subscribe" },
    { value: "WATCH_MORE", label: "Watch More" },
  ];

  const renderAdForm = () => (
    <div className="space-y-4">
      <MetaField label="Ad Name" value={editData.name || ""} onChange={(v) => handleUpdateField("name", v)} />

      <MetaField
        label="Status"
        value={editData.status || "PAUSED"}
        type="enum"
        options={[{ value: "PAUSED", label: "Paused" }, { value: "ACTIVE", label: "Active" }]}
        onChange={(v) => handleUpdateField("status", v)}
      />

      <div className="pt-2 border-t border-gray-800/40">
        <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Ad Creative</span>
        <p className="text-[10px] text-gray-600 mt-0.5">Creative ID takes priority on publish. Inline fields apply when no Creative ID is set.</p>
      </div>

      <MetaField label="Creative ID"
        value={editData.data?.creative?.creative_id || editData.data?.creative?.id || ""}
        onChange={(v) => handleUpdateNestedDataField("creative", "creative_id", v)}
        placeholder="Enter creative ID" hint="Reference to existing Meta creative" />

      <MetaField label="Ad Body Text"
        value={editData.data?.creative?.object_story_spec?.link_data?.message || ""}
        onChange={(v) => handleUpdateCreativeLinkData("message", v)}
        placeholder="Write your ad body text here..." />

      <MetaField label="Headline"
        value={editData.data?.creative?.object_story_spec?.link_data?.name || ""}
        onChange={(v) => handleUpdateCreativeLinkData("name", v)}
        placeholder="Enter headline" />

      <MetaField label="Destination URL"
        value={editData.data?.creative?.object_story_spec?.link_data?.link || ""}
        onChange={(v) => handleUpdateCreativeLinkData("link", v)}
        placeholder="https://example.com" />

      <MetaField label="Call to Action" type="enum"
        value={editData.data?.creative?.object_story_spec?.link_data?.call_to_action?.type || ""}
        options={CTA_OPTIONS}
        onChange={(v) => handleUpdateCreativeCTA(v)} />

      <div className="pt-2 border-t border-gray-800/40">
        <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Tracking</span>
      </div>

      <MetaField label="Pixel ID"
        value={editData.data?.tracking_specs?.[0]?.fb_pixel?.[0] || ""}
        onChange={(v) => handleUpdateDataField("tracking_specs", v ? [{ action_type: ["offsite_conversion"], fb_pixel: [v] }] : [])}
        placeholder="Your Meta Pixel ID"
        hint="Meta Pixel for tracking website conversion events" />

      <div className="pt-2 border-t border-gray-800/40">
        <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">URL Parameters</span>
      </div>

      <MetaField label="URL Parameters"
        value={editData.data?.url_parameters || ""}
        onChange={(v) => handleUpdateDataField("url_parameters", v)}
        placeholder="utm_source=facebook&utm_medium=paid&utm_campaign=brand"
        hint="Appended to destination URLs for tracking" />
    </div>
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-gray-800/40">
          <div className="flex items-center gap-3">
            <Link href="/drafts">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-300">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-100">{draft.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusColor)}>{draft.status}</span>
                <span className="text-xs text-gray-600">{OBJECTIVE_LABELS[campaignObjective] || campaignObjective}</span>
                {draft.metaId && <span className="text-[10px] text-gray-600 font-mono">Meta: {draft.metaId}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {(draft.status === "FAILED" || hasMetaId) && draft.status !== "PUBLISHED" && (
              <Button variant="outline" size="sm" className="gap-1.5 border-red-800 text-red-400 hover:bg-red-500/10"
                onClick={handleCleanup} disabled={isCleaning}>
                {isCleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Cleanup Meta
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 border-gray-800 text-gray-400"
              onClick={handleValidate} disabled={isValidating}>
              <ShieldCheck className={cn("w-3.5 h-3.5", isValidating && "animate-spin")} /> Validate
            </Button>
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
              onClick={handlePublish} disabled={isPublishing || draft.status === "PUBLISHING" || draft.status === "PUBLISHED"}>
              <Send className="w-3.5 h-3.5" /> {isPublishing ? "Publishing..." : "Publish to Meta"}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 gap-5 overflow-hidden">
          <div className="w-72 border-r border-gray-800/40 overflow-y-auto pr-3">
            <div className="space-y-3">
              <button
                className={cn(
                  "w-full p-2.5 rounded-lg flex items-center gap-2.5 transition-all text-left",
                  selectedNode?.type === "CAMPAIGN" ? "bg-blue-500/10 border border-blue-500/30" : "hover:bg-gray-800/40"
                )}
                onClick={() => handleSelectNode("CAMPAIGN", draft)}>
                <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Megaphone className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-sm font-medium truncate text-gray-200">{draft.name}</span>
              </button>

              <div className="pl-5 space-y-2 border-l border-gray-800/40 ml-3.5">
                {draft.adSets?.map((adSet: any) => (
                  <div key={adSet.id} className="space-y-1.5">
                    <button
                      className={cn(
                        "w-full p-2 rounded-lg flex items-center gap-2.5 transition-all text-left",
                        selectedNode?.type === "ADSET" && selectedNode.id === adSet.id ? "bg-blue-500/10 border border-blue-500/30" : "hover:bg-gray-800/40"
                      )}
                      onClick={() => handleSelectNode("ADSET", adSet)}>
                      <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Layers className="w-3 h-3 text-purple-400" />
                      </div>
                      <span className="text-xs font-medium truncate text-gray-300">{adSet.name}</span>
                    </button>

                    <div className="pl-5 space-y-1 border-l border-gray-800/30 ml-3">
                      {adSet.ads?.map((ad: any) => (
                        <button key={ad.id}
                          className={cn(
                            "w-full p-1.5 rounded-lg flex items-center gap-2 transition-all text-left",
                            selectedNode?.type === "AD" && selectedNode.id === ad.id ? "bg-blue-500/10 border border-blue-500/30" : "hover:bg-gray-800/40"
                          )}
                          onClick={() => handleSelectNode("AD", ad)}>
                          <div className="w-5 h-5 rounded bg-green-500/10 flex items-center justify-center shrink-0">
                            <FileText className="w-2.5 h-2.5 text-green-400" />
                          </div>
                          <span className="text-[11px] truncate text-gray-400">{ad.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {editData ? (
              <div className="space-y-5 max-w-2xl">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-800/50 text-gray-500 uppercase tracking-wide">
                      {selectedNode?.type}
                    </span>
                    {editData.metaId && <span className="text-[10px] text-gray-600 font-mono">Meta: {editData.metaId}</span>}
                  </div>
                  <Button size="sm" className="gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200"
                    onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                  </Button>
                </div>

                {editData.validationErrors && editData.validationErrors.length > 0 && (
                  <div className="bg-red-500/5 border border-red-500/20 p-3.5 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">Validation Issues</span>
                    </div>
                    <ul className="text-[11px] text-red-400/80 list-disc pl-5 space-y-0.5">
                      {editData.validationErrors.map((err: any, idx: number) => (
                        <li key={idx}>{err.message} <span className="text-red-500/40">({err.field})</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                <Tabs defaultValue="form" className="w-full">
                  <TabsList className="bg-gray-900/50 border border-gray-800/60 h-9">
                    <TabsTrigger value="form" className="text-xs">Edit Form</TabsTrigger>
                    <TabsTrigger value="schema" className="text-xs">Full Schema</TabsTrigger>
                    <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
                    <TabsTrigger value="json" className="text-xs">Raw JSON</TabsTrigger>
                  </TabsList>

                  <TabsContent value="form" className="space-y-4 mt-4">
                    {selectedNode?.type === "CAMPAIGN" && renderCampaignForm()}
                    {selectedNode?.type === "ADSET" && renderAdSetForm()}
                    {selectedNode?.type === "AD" && renderAdForm()}
                  </TabsContent>

                  <TabsContent value="schema" className="mt-4">
                    <MetaForm
                      entityType={
                        selectedNode?.type === "CAMPAIGN" ? "campaign" :
                        selectedNode?.type === "ADSET" ? "adSet" : "ad"
                      }
                      initialValues={editData.data || {}}
                      context={{
                        objective: campaignObjective,
                        buyingType: editData.data?.buying_type || "AUCTION",
                        isCBO,
                      }}
                      onChange={(values) => setEditData({ ...editData, data: values })}
                    />
                  </TabsContent>

                  <TabsContent value="summary" className="mt-4">
                    <Card className="bg-gray-900/30 border-gray-800/60">
                      <CardContent className="pt-5">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-gray-800/30">
                            <span className="text-xs text-gray-500">Type</span>
                            <span className="text-xs font-medium text-gray-300">{selectedNode?.type}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-800/30">
                            <span className="text-xs text-gray-500">Name</span>
                            <span className="text-xs font-medium text-gray-300">{editData.name}</span>
                          </div>
                          {Object.entries(editData.data || {}).map(([key, value]: [string, any]) => {
                            if (typeof value === "string" || typeof value === "number") {
                              return (
                                <div key={key} className="flex justify-between items-center py-2 border-b border-gray-800/30">
                                  <span className="text-xs text-gray-500 capitalize">{key.replace(/_/g, " ")}</span>
                                  <span className="text-xs font-medium truncate max-w-[280px] text-gray-300">{String(value)}</span>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="json" className="mt-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Raw Data (read-only view of payload)</Label>
                      <textarea
                        className="w-full h-96 bg-gray-900/50 border border-gray-800/60 rounded-lg p-4 font-mono text-xs text-gray-300 focus:outline-none focus:border-blue-500/50 transition-colors"
                        value={JSON.stringify(editData.data, null, 2)} readOnly />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                Select an item from the tree to edit
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
