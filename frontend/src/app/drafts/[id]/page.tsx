"use client";

import { useEffect, useState, use } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { draftApi, uploadApi } from "@/services/api";
import {
  Save, Send, ShieldCheck, AlertTriangle, FileText, Layers,
  Megaphone, Loader2, ArrowLeft, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn, extractApiError } from "@/lib/utils";
import Link from "next/link";
import { MetaField } from "@/components/meta/MetaField";
import { MetaForm } from "@/components/meta/MetaForm";
import {
  OBJECTIVE_LABELS, BID_STRATEGIES,
  VALID_OPTIMIZATION_GOALS, VALID_DESTINATION_TYPES,
  PROMOTED_OBJECT_REQUIREMENTS, PROMOTED_OBJECT_FIELD_LABELS,
} from "@/lib/meta-schema";

function toDateTimeLocal(v: string | undefined): string {
  if (!v) return "";
  const s = String(v);
  if (s.includes("T")) return s.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;
  return s.slice(0, 16);
}

function parseDateTimeParts(v: string | undefined): { date: string; hour: string; minute: string } {
  if (!v) return { date: "", hour: "", minute: "" };
  const s = String(v);
  const match = s.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return { date: "", hour: "", minute: "" };
  return { date: match[1], hour: match[2] || "00", minute: match[3] || "00" };
}

function DateTimeInput({ label, value, onChange }: { label: string; value: string | undefined; onChange: (v: string | undefined) => void }) {
  const parts = parseDateTimeParts(value);

  const update = (date: string, hour: string, minute: string) => {
    if (!date) { onChange(undefined); return; }
    onChange(`${date}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`);
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-gray-400">{label}</Label>
      <div className="flex gap-2">
        <Input
          type="date"
          value={parts.date}
          onChange={(e) => update(e.target.value, parts.hour, parts.minute)}
          className="bg-gray-950/50 border-gray-800/40 flex-1"
        />
        <select
          value={parts.hour}
          onChange={(e) => update(parts.date, e.target.value, parts.minute)}
          className="w-16 h-8 rounded-md bg-gray-950 border border-gray-800 text-sm text-gray-200 px-1.5"
        >
          {hours.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-gray-500 self-center">:</span>
        <select
          value={minutes.includes(parts.minute) ? parts.minute : "00"}
          onChange={(e) => update(parts.date, parts.hour, e.target.value)}
          className="w-16 h-8 rounded-md bg-gray-950 border border-gray-800 text-sm text-gray-200 px-1.5"
        >
          {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}

function UploadButton({ type, adAccountId, onUploaded }: { type: "image" | "video"; adAccountId?: string; onUploaded: (value: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const accept = type === "image" ? "image/jpeg,image/png,image/gif,image/webp" : "video/mp4,video/quicktime,video/x-msvideo,video/webm";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adAccountId) return;
    setUploading(true);
    try {
      const resp = type === "image"
        ? await uploadApi.uploadImage(file, adAccountId)
        : await uploadApi.uploadVideo(file, adAccountId);
      onUploaded(type === "image" ? resp.data.hash : resp.data.videoId);
      toast.success(`${type === "image" ? "Image" : "Video"} uploaded successfully`);
    } catch (err: any) {
      toast.error(extractApiError(err, `${type} upload failed`));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const disabled = !adAccountId || uploading;

  return (
    <label className={cn(
      "inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border cursor-pointer mt-1",
      disabled
        ? "text-gray-600 border-gray-800 cursor-not-allowed"
        : "text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300"
    )}>
      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
      {uploading ? "Uploading..." : `Upload ${type}`}
      <input type="file" accept={accept} onChange={handleUpload} className="hidden" disabled={disabled} />
    </label>
  );
}

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
  // In-memory edits keyed by `${type}:${id}`. Switching nodes preserves edits;
  // they are only persisted when the user clicks Save.
  const [editCache, setEditCache] = useState<Map<string, any>>(new Map());
  const nodeKey = (type: string, id: string) => `${type}:${id}`;
  const currentKey = selectedNode ? nodeKey(selectedNode.type, selectedNode.id) : null;
  const isDirty = editCache.size > 0;

  const campaignObjective: string = draft?.data?.objective || draft?.objective || "";
  const isCBO = !!(draft?.data?.daily_budget || draft?.data?.lifetime_budget);

  const fetchDraft = async () => {
    try {
      setIsLoading(true);
      const response = await draftApi.getCampaign(params.id);
      setDraft(response.data);
      // Helper: prefer the cached (unsaved) version of a node over the server's value.
      const restore = (key: string, serverItem: any) => {
        const cached = editCache.get(key);
        setEditData(cached ?? serverItem);
      };
      if (!selectedNode) {
        setSelectedNode({ type: "CAMPAIGN", id: response.data.id });
        restore(nodeKey("CAMPAIGN", response.data.id), response.data);
      } else {
        const d = response.data;
        if (selectedNode.type === "CAMPAIGN") restore(nodeKey("CAMPAIGN", selectedNode.id), d);
        else if (selectedNode.type === "ADSET") {
          const found = d.adSets?.find((s: any) => s.id === selectedNode.id);
          if (found) restore(nodeKey("ADSET", selectedNode.id), found);
        } else if (selectedNode.type === "AD") {
          for (const s of d.adSets || []) {
            const found = s.ads?.find((a: any) => a.id === selectedNode.id);
            if (found) { restore(nodeKey("AD", selectedNode.id), found); break; }
          }
        }
      }
    } catch { toast.error("Failed to load draft details"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchDraft(); }, [params.id]);

  // Warn when navigating/refreshing/closing with unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers display their own generic message; setting returnValue
      // is required for the prompt to fire.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Switching node now PRESERVES the previous node's edits in the cache (no auto-save).
  // When you come back, your in-progress edits are restored.
  const handleSelectNode = (type: "CAMPAIGN" | "ADSET" | "AD", item: any) => {
    setSelectedNode({ type, id: item.id });
    const cached = editCache.get(nodeKey(type, item.id));
    setEditData(cached ?? item);
  };

  // Single helper: update local view AND stash in cache so it survives node switches.
  const commitEdit = (next: any) => {
    setEditData(next);
    if (!currentKey) return;
    setEditCache((prev) => {
      const m = new Map(prev);
      m.set(currentKey, next);
      return m;
    });
  };

  const handleUpdateField = (field: string, value: any) => commitEdit({ ...editData, [field]: value });
  const handleUpdateDataField = (field: string, value: any) => commitEdit({ ...editData, data: { ...editData.data, [field]: value } });
  const handleUpdateNestedDataField = (parent: string, field: string, value: any) => {
    commitEdit({ ...editData, data: { ...editData.data, [parent]: { ...(editData.data?.[parent] || {}), [field]: value } } });
  };

  const handleUpdateCreativeLinkData = (field: string, value: any) => {
    commitEdit({
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
    commitEdit({
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
    // Snapshot all pending edits — including the one currently visible.
    const pending = new Map(editCache);
    if (currentKey && editData) pending.set(currentKey, editData);
    if (pending.size === 0) return;

    setIsSaving(true);
    try {
      for (const [key, data] of pending) {
        const sep = key.indexOf(":");
        const type = key.slice(0, sep);
        const id = key.slice(sep + 1);
        if (type === "CAMPAIGN") await draftApi.updateCampaign(id, data);
        else if (type === "ADSET") await draftApi.updateAdSet(id, data);
        else if (type === "AD") await draftApi.updateAd(id, data);
      }
      toast.success(pending.size > 1 ? `Saved ${pending.size} changes` : "Changes saved");
      setEditCache(new Map());
      fetchDraft();
    } catch { toast.error("Failed to save changes"); }
    finally { setIsSaving(false); }
  };

  const handleValidate = async () => {
    if (isDirty) {
      toast.error("Save your changes before validating.");
      return;
    }
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
    if (isDirty) {
      toast.error("Save your changes before publishing.");
      return;
    }
    if (!confirm("Publish to Meta? This will create real campaigns, ad sets, and ads (all PAUSED).")) return;
    setIsPublishing(true);
    try {
      await draftApi.publishDraft(params.id);
      toast.success("Published successfully!");
      router.push("/drafts");
    } catch (error: any) { toast.error(error.response?.data?.userMessage || error.response?.data?.error || "Publishing failed"); }
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

      {["COST_CAP", "LOWEST_COST_WITH_BID_CAP", "BID_CAP"].includes(editData.data?.bid_strategy || "") && (
        <MetaField label="Bid Amount" value={editData.data?.bid_amount} type="number" isBudget
          onChange={(v) => handleUpdateDataField("bid_amount", v)}
          hint="Required for Bid Cap / Cost Cap strategies (in cents, e.g. 500 = $5.00)" />
      )}

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
        {['NONE', 'EMPLOYMENT', 'HOUSING', 'ISSUES_ELECTIONS_POLITICS', 'FINANCIAL_PRODUCTS_SERVICES', 'ONLINE_GAMBLING_AND_GAMING'].map((cat) => {
          const current: string[] = editData.data?.special_ad_categories || ['NONE'];
          const checked = current.includes(cat);
          const labelId = `special-cat-${cat}`;
          return (
            <div key={cat} className="flex items-start gap-2">
              <Checkbox
                id={labelId}
                checked={checked}
                className="mt-0.5 shrink-0"
                onCheckedChange={(v) => {
                  let next = v
                    ? (cat === 'NONE' ? ['NONE'] : [...current.filter((c: string) => c !== 'NONE'), cat])
                    : current.filter((c: string) => c !== cat);
                  handleUpdateDataField("special_ad_categories", next.length ? next : ['NONE']);
                }}
              />
              <label htmlFor={labelId} className="text-xs text-gray-400 leading-normal cursor-pointer flex-1 min-w-0 break-words">
                {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </label>
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
      <DateTimeInput
        label="Start Time"
        value={editData.data?.start_time}
        onChange={(v) => handleUpdateDataField("start_time", v)}
      />
      <DateTimeInput
        label="End Time"
        value={editData.data?.end_time}
        onChange={(v) => handleUpdateDataField("end_time", v)}
      />

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

  const CREATIVE_TYPES = [
    { value: "link", label: "Link Ad" },
    { value: "video", label: "Video Ad" },
    { value: "photo", label: "Photo Ad" },
    { value: "carousel", label: "Carousel Ad" },
  ];

  const getCreativeType = (): string => {
    const ct = editData?.data?.creative?.creative_type;
    if (ct) return ct;
    const oss = editData?.data?.creative?.object_story_spec;
    if (!oss) return "link";
    if (oss.video_data && Object.keys(oss.video_data).length > 0) return "video";
    if (oss.photo_data && Object.keys(oss.photo_data).length > 0) return "photo";
    if (oss.link_data?.child_attachments?.length > 0) return "carousel";
    return "link";
  };

  const handleSetCreativeType = (type: string) => {
    const oss = editData.data?.creative?.object_story_spec || {};
    commitEdit({
      ...editData,
      data: {
        ...editData.data,
        creative: {
          ...editData.data?.creative,
          creative_type: type,
          object_story_spec: { page_id: oss.page_id },
        },
      },
    });
  };

  const handleUpdateCreativeVideoData = (field: string, value: any) => {
    commitEdit({
      ...editData,
      data: {
        ...editData.data,
        creative: {
          ...editData.data?.creative,
          object_story_spec: {
            ...editData.data?.creative?.object_story_spec,
            video_data: { ...editData.data?.creative?.object_story_spec?.video_data, [field]: value },
          },
        },
      },
    });
  };

  const handleUpdateCreativePhotoData = (field: string, value: any) => {
    commitEdit({
      ...editData,
      data: {
        ...editData.data,
        creative: {
          ...editData.data?.creative,
          object_story_spec: {
            ...editData.data?.creative?.object_story_spec,
            photo_data: { ...editData.data?.creative?.object_story_spec?.photo_data, [field]: value },
          },
        },
      },
    });
  };

  const handleUpdateVideoCTA = (field: string, value: any) => {
    const vd = editData.data?.creative?.object_story_spec?.video_data || {};
    const cta = vd.call_to_action || {};
    const ctaValue = cta.value || {};
    let newCta: any;
    if (field === "type") {
      newCta = { ...cta, type: value };
    } else if (field === "link") {
      newCta = { ...cta, value: { ...ctaValue, link: value } };
    }
    handleUpdateCreativeVideoData("call_to_action", newCta);
  };

  const handleUpdateCarouselCard = (index: number, field: string, value: any) => {
    const cards = [...(editData.data?.creative?.object_story_spec?.link_data?.child_attachments || [])];
    cards[index] = { ...(cards[index] || {}), [field]: value };
    commitEdit({
      ...editData,
      data: {
        ...editData.data,
        creative: {
          ...editData.data?.creative,
          object_story_spec: {
            ...editData.data?.creative?.object_story_spec,
            link_data: { ...editData.data?.creative?.object_story_spec?.link_data, child_attachments: cards },
          },
        },
      },
    });
  };

  const handleAddCarouselCard = () => {
    const cards = [...(editData.data?.creative?.object_story_spec?.link_data?.child_attachments || [])];
    if (cards.length >= 10) return;
    cards.push({ link: "", name: "", description: "", image_hash: "" });
    commitEdit({
      ...editData,
      data: {
        ...editData.data,
        creative: {
          ...editData.data?.creative,
          object_story_spec: {
            ...editData.data?.creative?.object_story_spec,
            link_data: { ...editData.data?.creative?.object_story_spec?.link_data, child_attachments: cards },
          },
        },
      },
    });
  };

  const handleRemoveCarouselCard = (index: number) => {
    const cards = [...(editData.data?.creative?.object_story_spec?.link_data?.child_attachments || [])];
    if (cards.length <= 2) return;
    cards.splice(index, 1);
    commitEdit({
      ...editData,
      data: {
        ...editData.data,
        creative: {
          ...editData.data?.creative,
          object_story_spec: {
            ...editData.data?.creative?.object_story_spec,
            link_data: { ...editData.data?.creative?.object_story_spec?.link_data, child_attachments: cards },
          },
        },
      },
    });
  };

  const creativeType = getCreativeType();
  const carouselCards: any[] = editData?.data?.creative?.object_story_spec?.link_data?.child_attachments || [];
  const adAccountId = draft?.adAccountId || editData?.adAccountId;

  const renderAdForm = () => (
    <div className="space-y-4">
      <MetaField label="Ad Name" value={editData.name || ""} onChange={(v) => handleUpdateField("name", v)} />

      <MetaField
        label="Status"
        value={editData.data?.status || "PAUSED"}
        type="enum"
        options={[{ value: "PAUSED", label: "Paused" }, { value: "ACTIVE", label: "Active" }]}
        onChange={(v) => handleUpdateDataField("status", v)}
      />

      <div className="pt-2 border-t border-gray-800/40">
        <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Ad Creative</span>
        <p className="text-[10px] text-gray-600 mt-0.5">Creative ID takes priority on publish. Inline fields apply when no Creative ID is set.</p>
      </div>

      <MetaField label="Creative ID"
        value={editData.data?.creative?.creative_id || editData.data?.creative?.id || ""}
        onChange={(v) => handleUpdateNestedDataField("creative", "creative_id", v)}
        placeholder="Enter creative ID" hint="Reference to existing Meta creative" />

      <MetaField label="Creative Type" type="enum"
        value={creativeType}
        options={CREATIVE_TYPES}
        onChange={(v) => handleSetCreativeType(v)} />

      <MetaField label="Page ID"
        value={editData.data?.creative?.object_story_spec?.page_id || ""}
        onChange={(v) => {
          commitEdit({
            ...editData,
            data: {
              ...editData.data,
              creative: {
                ...editData.data?.creative,
                object_story_spec: { ...editData.data?.creative?.object_story_spec, page_id: v },
              },
            },
          });
        }}
        placeholder="Facebook Page ID"
        hint="Required for inline creatives. Auto-resolved from ad set if empty." />

      {/* ── Link Ad ── */}
      {creativeType === "link" && (
        <>
          <MetaField label="Ad Body Text"
            value={editData.data?.creative?.object_story_spec?.link_data?.message || ""}
            onChange={(v) => handleUpdateCreativeLinkData("message", v)}
            placeholder="Write your ad body text here..." />
          <MetaField label="Headline"
            value={editData.data?.creative?.object_story_spec?.link_data?.name || ""}
            onChange={(v) => handleUpdateCreativeLinkData("name", v)}
            placeholder="Enter headline" />
          <MetaField label="Description"
            value={editData.data?.creative?.object_story_spec?.link_data?.description || ""}
            onChange={(v) => handleUpdateCreativeLinkData("description", v)}
            placeholder="Additional description text below the headline" />
          <MetaField label="Destination URL"
            value={editData.data?.creative?.object_story_spec?.link_data?.link || ""}
            onChange={(v) => handleUpdateCreativeLinkData("link", v)}
            placeholder="https://example.com" />
          <MetaField label="Image Hash"
            value={editData.data?.creative?.object_story_spec?.link_data?.image_hash || ""}
            onChange={(v) => handleUpdateCreativeLinkData("image_hash", v)}
            placeholder="Enter image hash from Meta ad account" />
          <UploadButton type="image" adAccountId={adAccountId}
            onUploaded={(v) => { handleUpdateCreativeLinkData("image_hash", v); }} />
          <MetaField label="Call to Action" type="enum"
            value={editData.data?.creative?.object_story_spec?.link_data?.call_to_action?.type || ""}
            options={CTA_OPTIONS}
            onChange={(v) => handleUpdateCreativeCTA(v)} />
        </>
      )}

      {/* ── Video Ad ── */}
      {creativeType === "video" && (
        <>
          <MetaField label="Video ID"
            value={editData.data?.creative?.object_story_spec?.video_data?.video_id || ""}
            onChange={(v) => handleUpdateCreativeVideoData("video_id", v)}
            placeholder="Enter video ID from Meta" />
          <UploadButton type="video" adAccountId={adAccountId}
            onUploaded={(v) => { handleUpdateCreativeVideoData("video_id", v); }} />
          <MetaField label="Post Text"
            value={editData.data?.creative?.object_story_spec?.video_data?.message || ""}
            onChange={(v) => handleUpdateCreativeVideoData("message", v)}
            placeholder="Write your post text..." />
          <MetaField label="Video Title"
            value={editData.data?.creative?.object_story_spec?.video_data?.title || ""}
            onChange={(v) => handleUpdateCreativeVideoData("title", v)}
            placeholder="Enter video title" />
          <MetaField label="Thumbnail Hash"
            value={editData.data?.creative?.object_story_spec?.video_data?.image_hash || ""}
            onChange={(v) => handleUpdateCreativeVideoData("image_hash", v)}
            placeholder="Thumbnail image hash (optional)"
            hint="If omitted, Meta auto-generates one." />
          <UploadButton type="image" adAccountId={adAccountId}
            onUploaded={(v) => { handleUpdateCreativeVideoData("image_hash", v); }} />
          <MetaField label="Call to Action" type="enum"
            value={editData.data?.creative?.object_story_spec?.video_data?.call_to_action?.type || ""}
            options={CTA_OPTIONS}
            onChange={(v) => handleUpdateVideoCTA("type", v)} />
          <MetaField label="CTA Link"
            value={editData.data?.creative?.object_story_spec?.video_data?.call_to_action?.value?.link || ""}
            onChange={(v) => handleUpdateVideoCTA("link", v)}
            placeholder="https://example.com"
            hint="Destination URL for the call to action button" />
        </>
      )}

      {/* ── Photo Ad ── */}
      {creativeType === "photo" && (
        <>
          <MetaField label="Image Hash"
            value={editData.data?.creative?.object_story_spec?.photo_data?.image_hash || ""}
            onChange={(v) => handleUpdateCreativePhotoData("image_hash", v)}
            placeholder="Image hash from Meta ad account" />
          <UploadButton type="image" adAccountId={adAccountId}
            onUploaded={(v) => { handleUpdateCreativePhotoData("image_hash", v); }} />
          <MetaField label="Post Text"
            value={editData.data?.creative?.object_story_spec?.photo_data?.message || ""}
            onChange={(v) => handleUpdateCreativePhotoData("message", v)}
            placeholder="Write your post text..." />
          <MetaField label="Caption"
            value={editData.data?.creative?.object_story_spec?.photo_data?.caption || ""}
            onChange={(v) => handleUpdateCreativePhotoData("caption", v)}
            placeholder="Photo caption" />
          <MetaField label="Destination URL"
            value={editData.data?.creative?.object_story_spec?.photo_data?.link || ""}
            onChange={(v) => handleUpdateCreativePhotoData("link", v)}
            placeholder="https://example.com" />
          <MetaField label="Call to Action" type="enum"
            value={editData.data?.creative?.object_story_spec?.photo_data?.call_to_action?.type || ""}
            options={CTA_OPTIONS}
            onChange={(v) => handleUpdateCreativePhotoData("call_to_action", { type: v })} />
        </>
      )}

      {/* ── Carousel Ad ── */}
      {creativeType === "carousel" && (
        <>
          <MetaField label="Carousel Message"
            value={editData.data?.creative?.object_story_spec?.link_data?.message || ""}
            onChange={(v) => handleUpdateCreativeLinkData("message", v)}
            placeholder="Post text for the carousel..." />
          <MetaField label="Default URL"
            value={editData.data?.creative?.object_story_spec?.link_data?.link || ""}
            onChange={(v) => handleUpdateCreativeLinkData("link", v)}
            placeholder="https://example.com"
            hint="Default destination URL for the carousel" />

          <div className="pt-2 border-t border-gray-800/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                Carousel Cards ({carouselCards.length}/10)
              </span>
              {carouselCards.length < 10 && (
                <button onClick={handleAddCarouselCard}
                  className="text-[10px] text-blue-400 hover:text-blue-300">+ Add Card</button>
              )}
            </div>
            {carouselCards.length < 2 && (
              <p className="text-[10px] text-amber-500 mt-1">Carousel requires at least 2 cards.</p>
            )}
          </div>

          {carouselCards.map((card: any, i: number) => (
            <div key={i} className="border border-gray-800/40 rounded-md p-3 space-y-2 bg-gray-950/30">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-500">Card {i + 1}</span>
                {carouselCards.length > 2 && (
                  <button onClick={() => handleRemoveCarouselCard(i)}
                    className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
                )}
              </div>
              <MetaField label="Card URL"
                value={card.link || ""}
                onChange={(v) => handleUpdateCarouselCard(i, "link", v)}
                placeholder="https://example.com/page" />
              <MetaField label="Headline"
                value={card.name || ""}
                onChange={(v) => handleUpdateCarouselCard(i, "name", v)}
                placeholder="Card headline" />
              <MetaField label="Description"
                value={card.description || ""}
                onChange={(v) => handleUpdateCarouselCard(i, "description", v)}
                placeholder="Card description" />
              <MetaField label="Image Hash"
                value={card.image_hash || ""}
                onChange={(v) => handleUpdateCarouselCard(i, "image_hash", v)}
                placeholder="Image hash for this card" />
              <UploadButton type="image" adAccountId={adAccountId}
                onUploaded={(v) => { handleUpdateCarouselCard(i, "image_hash", v); }} />
            </div>
          ))}
        </>
      )}

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
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between pb-4 border-b border-gray-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/drafts">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-300 shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-100 truncate">{draft.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusColor)}>{draft.status}</span>
                <span className="text-xs text-gray-600">{OBJECTIVE_LABELS[campaignObjective] || campaignObjective}</span>
                {draft.metaId && <span className="text-[10px] text-gray-600 font-mono hidden sm:inline">Meta: {draft.metaId}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
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

        <div className="flex flex-col md:flex-row flex-1 gap-5 overflow-hidden">
          <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-800/40 overflow-y-auto pr-0 md:pr-3 max-h-48 md:max-h-none pb-3 md:pb-0">
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

          <div className="flex-1 overflow-y-auto min-w-0">
            {editData ? (
              <div className="space-y-5 max-w-2xl">
                <div className="flex flex-wrap justify-between items-center gap-2">
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
                  <TabsList className="bg-gray-900/50 border border-gray-800/60 h-9 w-full">
                    <TabsTrigger value="form" className="text-xs flex-1">Edit Form</TabsTrigger>
                    <TabsTrigger value="schema" className="text-xs flex-1">Full Schema</TabsTrigger>
                    <TabsTrigger value="summary" className="text-xs flex-1">Summary</TabsTrigger>
                    <TabsTrigger value="json" className="text-xs flex-1">Raw JSON</TabsTrigger>
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
                      onChange={(values) => commitEdit({ ...editData, data: values })}
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
