"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Upload } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { uploadApi } from "@/services/api";

// Per-ad creative override editor for Wide Creation. Emits the exact `creative`
// object the backend stores verbatim on the draft ad (WideCreationService reads
// resolvedAdFields.creative as-is — no transform). Supported shapes:
//   - Creative ID:        { creative_id }
//   - Inline:             { object_story_spec: { page_id, link_data|video_data|photo_data } }
//   - Dynamic Creative:   { asset_feed_spec: {...}, page_id }
// Emitting `undefined` clears the override (the store strips undefined values,
// reverting the ad to the bulk default creative from the Configure step).

type CreativeKind = "none" | "creative_id" | "inline" | "dynamic";
type InlineMediaKind = "link" | "video" | "photo";

// CTA types accepted by both inline link/video data. Mirrors the common subset
// Meta exposes for these placements; keep aligned with the registry if expanded.
const CTA_OPTIONS = [
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "BOOK_NOW", label: "Book Now" },
  { value: "DOWNLOAD", label: "Download" },
  { value: "GET_OFFER", label: "Get Offer" },
  { value: "GET_QUOTE", label: "Get Quote" },
  { value: "SUBSCRIBE", label: "Subscribe" },
  { value: "WATCH_MORE", label: "Watch More" },
  { value: "NO_BUTTON", label: "No Button" },
];

// Dynamic Creative supports a narrower CTA set (multi-select).
const DYNAMIC_CTA_OPTIONS = [
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "BOOK_NOW", label: "Book Now" },
  { value: "GET_OFFER", label: "Get Offer" },
];

interface CreativeOverrideEditorProps {
  value: any;
  onChange: (creative: any) => void;
}

// Returns upload helpers bound to the currently selected ad account, or
// undefined when no account is selected (upload buttons are hidden).
function useUploadFns() {
  const { selectedAccount } = useAppStore();
  const acctId = selectedAccount?.adaccount_id || selectedAccount?.id;
  if (!acctId) return { uploadImage: undefined, uploadVideo: undefined };
  return {
    uploadImage: (file: File) =>
      uploadApi.uploadImage(file, acctId).then((r) => {
        // Return hash by default as it's most common for adimages
        return (r.data.hash || r.data.id) as string;
      }),
    uploadVideo: (file: File) =>
      uploadApi.uploadVideo(file, acctId).then((r) => r.data.videoId as string),
  };
}

// Small inline upload button for single-value fields (image_hash, video_id).
function UploadFieldButton({
  uploadFn,
  accept,
  onResult,
}: {
  uploadFn: (file: File) => Promise<string>;
  accept: string;
  onResult: (value: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onResult(await uploadFn(file));
    } catch (err: any) {
      setError(err?.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="shrink-0">
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handle} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        title={uploading ? "Uploading…" : "Upload file"}
        className="h-7 px-2 rounded-md border border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-600 disabled:opacity-50 flex items-center"
      >
        <Upload className="w-3 h-3" />
      </button>
      {error && <p className="text-[9px] text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}

// Infer which editor to show from the stored creative shape so reopening the
// panel restores the right view.
function detectKind(creative: any): CreativeKind {
  if (!creative || typeof creative !== "object") return "none";
  if ("creative_id" in creative) return "creative_id";
  if (creative.asset_feed_spec) return "dynamic";
  if (creative.object_story_spec) return "inline";
  return "none";
}

function detectInlineMedia(creative: any): InlineMediaKind {
  const spec = creative?.object_story_spec;
  if (spec?.video_data) return "video";
  if (spec?.photo_data) return "photo";
  return "link";
}

export function CreativeOverrideEditor({ value, onChange }: CreativeOverrideEditorProps) {
  const kind = detectKind(value);

  // Switching kind discards the previous shape's data — a creative is one of
  // creative_id | object_story_spec | asset_feed_spec, never a mix.
  const changeKind = (next: CreativeKind) => {
    switch (next) {
      case "none":
        onChange(undefined);
        break;
      case "creative_id":
        onChange({ creative_id: "" });
        break;
      case "inline":
        onChange({ object_story_spec: { page_id: "", link_data: {} } });
        break;
      case "dynamic":
        onChange({ asset_feed_spec: {}, page_id: "" });
        break;
    }
  };

  return (
    <div className="rounded-md border border-gray-700/60 bg-gray-800/40 p-2 space-y-2">
      <div>
        <Label className="text-[9px] text-gray-500">Creative type</Label>
        <select
          value={kind}
          onChange={(e) => changeKind(e.target.value as CreativeKind)}
          className="w-full mt-0.5 rounded-md bg-gray-800 border border-gray-700 text-xs text-gray-200 px-2 py-1.5"
        >
          <option value="none">None (use bulk default)</option>
          <option value="creative_id">Creative ID</option>
          <option value="inline">Inline Creative</option>
          <option value="dynamic">Dynamic Creative</option>
        </select>
      </div>

      {kind === "creative_id" && (
        <CreativeIdEditor value={value} onChange={onChange} />
      )}
      {kind === "inline" && <InlineCreativeEditor value={value} onChange={onChange} />}
      {kind === "dynamic" && <DynamicCreativeEditor value={value} onChange={onChange} />}
    </div>
  );
}

// ─── Creative ID ───

function CreativeIdEditor({ value, onChange }: CreativeOverrideEditorProps) {
  const creativeId: string = value?.creative_id ?? "";
  return (
    <FieldRow label="Creative ID">
      <Input
        type="text"
        value={creativeId}
        placeholder="e.g. 23847900000000000"
        onChange={(e) => onChange(e.target.value ? { creative_id: e.target.value } : undefined)}
        className="bg-gray-800 border-gray-700 h-7 text-[11px]"
      />
    </FieldRow>
  );
}

// ─── Inline (object_story_spec) ───

function InlineCreativeEditor({ value, onChange }: CreativeOverrideEditorProps) {
  const { uploadImage, uploadVideo } = useUploadFns();
  const spec = value?.object_story_spec ?? {};
  const pageId: string = spec.page_id ?? "";
  const media = detectInlineMedia(value);

  // Rebuild object_story_spec preserving page_id + a single data block. Switching
  // media kind drops the prior data block (Meta accepts exactly one).
  const emitSpec = (next: Record<string, any>) => {
    onChange({ object_story_spec: next });
  };

  const setPageId = (id: string) => {
    emitSpec({ ...spec, page_id: id });
  };

  const changeMedia = (next: InlineMediaKind) => {
    const base: Record<string, any> = { page_id: pageId };
    if (next === "link") base.link_data = {};
    if (next === "video") base.video_data = {};
    if (next === "photo") base.photo_data = {};
    emitSpec(base);
  };

  const setDataField = (block: "link_data" | "video_data" | "photo_data", key: string, val: string) => {
    const current = { ...(spec[block] ?? {}) };
    if (val) current[key] = val;
    else delete current[key];
    emitSpec({ page_id: pageId, [block]: current });
  };

  return (
    <div className="space-y-2">
      <FieldRow label="Page ID *">
        <Input
          type="text"
          value={pageId}
          placeholder="e.g. 1064753226727354"
          onChange={(e) => setPageId(e.target.value)}
          className="bg-gray-800 border-gray-700 h-7 text-[11px]"
        />
      </FieldRow>

      <div>
        <Label className="text-[9px] text-gray-500">Creative format</Label>
        <div className="mt-0.5 flex gap-1">
          {(["link", "video", "photo"] as InlineMediaKind[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => changeMedia(m)}
              className={`flex-1 rounded-md border px-2 py-1 text-[10px] capitalize transition-colors ${
                media === m
                  ? "border-blue-500 bg-blue-500/20 text-blue-300"
                  : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {media === "link" && (
        <div className="space-y-1.5">
          <FieldRow label="Destination URL">
            <Input
              type="text"
              value={spec.link_data?.link ?? ""}
              placeholder="https://example.com"
              onChange={(e) => setDataField("link_data", "link", e.target.value)}
              className="bg-gray-800 border-gray-700 h-7 text-[11px]"
            />
          </FieldRow>
          <FieldRow label="Primary text">
            <Input
              type="text"
              value={spec.link_data?.message ?? ""}
              placeholder="Body / primary text"
              onChange={(e) => setDataField("link_data", "message", e.target.value)}
              className="bg-gray-800 border-gray-700 h-7 text-[11px]"
            />
          </FieldRow>
          <FieldRow label="Headline">
            <Input
              type="text"
              value={spec.link_data?.name ?? ""}
              placeholder="Headline"
              onChange={(e) => setDataField("link_data", "name", e.target.value)}
              className="bg-gray-800 border-gray-700 h-7 text-[11px]"
            />
          </FieldRow>
          <FieldRow label="Description">
            <Input
              type="text"
              value={spec.link_data?.description ?? ""}
              placeholder="Link description"
              onChange={(e) => setDataField("link_data", "description", e.target.value)}
              className="bg-gray-800 border-gray-700 h-7 text-[11px]"
            />
          </FieldRow>
          <CtaSelect
            value={extractCtaType(spec.link_data?.call_to_action)}
            options={CTA_OPTIONS}
            onChangeCta={(cta) => {
              const current = { ...(spec.link_data ?? {}) };
              if (cta) current.call_to_action = { type: cta };
              else delete current.call_to_action;
              onChange({ object_story_spec: { page_id: pageId, link_data: current } });
            }}
          />
        </div>
      )}

      {media === "video" && (
        <div className="space-y-1.5">
          <FieldRow label="Video ID">
            <div className="flex gap-1">
              <Input
                type="text"
                value={spec.video_data?.video_id ?? ""}
                placeholder="e.g. 1234567890"
                onChange={(e) => setDataField("video_data", "video_id", e.target.value)}
                className="bg-gray-800 border-gray-700 h-7 text-[11px] flex-1"
              />
              {uploadVideo && (
                <UploadFieldButton
                  uploadFn={uploadVideo}
                  accept="video/*"
                  onResult={(id) => setDataField("video_data", "video_id", id)}
                />
              )}
            </div>
          </FieldRow>
          <FieldRow label="Title">
            <Input
              type="text"
              value={spec.video_data?.title ?? ""}
              placeholder="Video title"
              onChange={(e) => setDataField("video_data", "title", e.target.value)}
              className="bg-gray-800 border-gray-700 h-7 text-[11px]"
            />
          </FieldRow>
          <CtaSelect
            value={extractCtaType(spec.video_data?.call_to_action)}
            options={CTA_OPTIONS}
            onChangeCta={(cta) => {
              const current = { ...(spec.video_data ?? {}) };
              if (cta) current.call_to_action = { type: cta };
              else delete current.call_to_action;
              onChange({ object_story_spec: { page_id: pageId, video_data: current } });
            }}
          />
        </div>
      )}

      {media === "photo" && (
        <div className="space-y-1.5">
          <FieldRow label="Image hash">
            <div className="flex gap-1">
              <Input
                type="text"
                value={spec.photo_data?.image_hash ?? ""}
                placeholder="e.g. 8c0e8...d3f"
                onChange={(e) => setDataField("photo_data", "image_hash", e.target.value)}
                className="bg-gray-800 border-gray-700 h-7 text-[11px] flex-1"
              />
              {uploadImage && (
                <UploadFieldButton
                  uploadFn={uploadImage}
                  accept="image/*"
                  onResult={(hash) => setDataField("photo_data", "image_hash", hash)}
                />
              )}
            </div>
          </FieldRow>
          <FieldRow label="Caption">
            <Input
              type="text"
              value={spec.photo_data?.caption ?? ""}
              placeholder="Caption"
              onChange={(e) => setDataField("photo_data", "caption", e.target.value)}
              className="bg-gray-800 border-gray-700 h-7 text-[11px]"
            />
          </FieldRow>
        </div>
      )}
    </div>
  );
}

// call_to_action is stored as `{ type: "..." }`; surface just the type string.
function extractCtaType(cta: any): string {
  return cta && typeof cta === "object" ? cta.type ?? "" : "";
}

function CtaSelect({
  value,
  options,
  onChangeCta,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChangeCta: (v: string | undefined) => void;
}) {
  return (
    <FieldRow label="Call to action">
      <select
        value={value}
        onChange={(e) => onChangeCta(e.target.value || undefined)}
        className="w-full rounded-md bg-gray-800 border border-gray-700 text-[11px] text-gray-200 px-2 py-1 h-7"
      >
        <option value="">None</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldRow>
  );
}

// ─── Dynamic Creative (asset_feed_spec) ───

function DynamicCreativeEditor({ value, onChange }: CreativeOverrideEditorProps) {
  const { uploadImage, uploadVideo } = useUploadFns();
  const pageId: string = value?.page_id ?? "";
  const afs = value?.asset_feed_spec ?? {};

  // Rebuild the whole creative object so page_id (top-level) and asset_feed_spec
  // stay in sync. We never drop the wrapper while in dynamic mode (the kind
  // selector owns clearing); empty asset arrays are simply omitted on emit.
  const emit = (nextAfs: Record<string, any>, nextPageId: string) => {
    const cleanedAfs: Record<string, any> = {};
    for (const [k, v] of Object.entries(nextAfs)) {
      if (Array.isArray(v) && v.length === 0) continue;
      cleanedAfs[k] = v;
    }
    onChange({ asset_feed_spec: cleanedAfs, page_id: nextPageId });
  };

  const setPageId = (id: string) => emit(afs, id);

  // Generic list-of-objects updater: each row maps a string to `{ [field]: str }`.
  const setListField = (
    key: "bodies" | "titles" | "link_urls" | "images" | "videos",
    field: string,
    rows: string[],
  ) => {
    const mapped = rows.map((r) => ({ [field]: r }));
    emit({ ...afs, [key]: mapped }, pageId);
  };

  const readList = (key: string, field: string): string[] => {
    const arr = afs[key];
    if (!Array.isArray(arr)) return [];
    return arr.map((item: any) => (item && typeof item === "object" ? item[field] ?? "" : ""));
  };

  const ctaTypes: string[] = Array.isArray(afs.call_to_action_types)
    ? afs.call_to_action_types
    : [];

  const toggleCta = (cta: string) => {
    const next = ctaTypes.includes(cta)
      ? ctaTypes.filter((c) => c !== cta)
      : [...ctaTypes, cta];
    emit({ ...afs, call_to_action_types: next }, pageId);
  };

  return (
    <div className="space-y-2">
      <FieldRow label="Page ID">
        <Input
          type="text"
          value={pageId}
          placeholder="e.g. 1064753226727354"
          onChange={(e) => setPageId(e.target.value)}
          className="bg-gray-800 border-gray-700 h-7 text-[11px]"
        />
      </FieldRow>

      <AssetList
        label="Bodies"
        placeholder="Primary text"
        rows={readList("bodies", "text")}
        onChange={(rows) => setListField("bodies", "text", rows)}
      />
      <AssetList
        label="Titles"
        placeholder="Headline"
        rows={readList("titles", "text")}
        onChange={(rows) => setListField("titles", "text", rows)}
      />
      <AssetList
        label="Link URLs"
        placeholder="https://example.com"
        rows={readList("link_urls", "website_url")}
        onChange={(rows) => setListField("link_urls", "website_url", rows)}
      />
      <AssetList
        label="Image Hashes"
        placeholder="Image hash"
        rows={readList("images", "hash")}
        onChange={(rows) => setListField("images", "hash", rows)}
        uploadFn={uploadImage}
        uploadAccept="image/*"
      />
      <AssetList
        label="Video IDs"
        placeholder="Video ID (e.g. 1234567890)"
        rows={readList("videos", "video_id")}
        onChange={(rows) => setListField("videos", "video_id", rows)}
        uploadFn={uploadVideo}
        uploadAccept="video/*"
      />

      <div>
        <Label className="text-[9px] text-gray-500">Call to actions</Label>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {DYNAMIC_CTA_OPTIONS.map((opt) => {
            const active = ctaTypes.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleCta(opt.value)}
                className={`rounded-md border px-2 py-1 text-[10px] transition-colors ${
                  active
                    ? "border-blue-500 bg-blue-500/20 text-blue-300"
                    : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Add/remove list of plain string inputs. The parent maps each string into the
// asset object shape Meta expects ({text}, {website_url}, {hash}).
function AssetList({
  label,
  placeholder,
  rows,
  onChange,
  uploadFn,
  uploadAccept,
}: {
  label: string;
  placeholder: string;
  rows: string[];
  onChange: (rows: string[]) => void;
  uploadFn?: (file: File) => Promise<string>;
  uploadAccept?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (index: number, val: string) => {
    onChange(rows.map((r, i) => (i === index ? val : r)));
  };
  const remove = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };
  const add = () => {
    onChange([...rows, ""]);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadFn) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadFn(file);
      onChange([...rows, result]);
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <Label className="text-[9px] text-gray-500">{label}</Label>
      <div className="mt-0.5 space-y-1">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-1">
            <Input
              type="text"
              value={row}
              placeholder={placeholder}
              onChange={(e) => update(index, e.target.value)}
              className="bg-gray-800 border-gray-700 h-7 text-[11px] flex-1"
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="text-red-500/40 hover:text-red-400 p-1"
              title={`Remove ${label.toLowerCase()} row`}
              aria-label={`Remove ${label.toLowerCase()} row`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 hover:border-gray-600 hover:text-gray-100"
        >
          <Plus className="w-3 h-3" />
          Add {label.toLowerCase()}
        </button>
        {uploadFn && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={uploadAccept}
              className="hidden"
              onChange={handleUpload}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-blue-700/60 bg-blue-900/20 px-2 py-0.5 text-[10px] text-blue-300 hover:border-blue-600 hover:text-blue-200 disabled:opacity-50"
            >
              <Upload className="w-3 h-3" />
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </>
        )}
      </div>
      {uploadError && <p className="text-[9px] text-red-400 mt-0.5">{uploadError}</p>}
    </div>
  );
}

// ─── Shared layout helper ───

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[9px] text-gray-500">{label}</Label>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
