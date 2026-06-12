"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreativeOverrideEditor } from "@/components/wide-create/CreativeOverrideEditor";
import { adAccountApi } from "@/services/api";
import { Info, AlertTriangle } from "lucide-react";

// Pages list is identical for every ad in the session — fetch once and share.
let pagesCache: Promise<Array<{ id: string; name: string }>> | null = null;
function fetchPagesOnce() {
  if (!pagesCache) {
    pagesCache = adAccountApi
      .getPages()
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .catch(() => {
        pagesCache = null; // allow retry on next mount
        return [];
      });
  }
  return pagesCache;
}

// The single, honest ad form shared by all six objectives. Earlier versions of
// the per-objective ad forms were Ads-Manager-style mockups — hardcoded pixel
// IDs, decorative identity selectors, tracking toggles that saved nothing.
// Everything rendered here is wired to the draft payload: name, page_id, and
// creative. Anything not shown is not supported yet.

function SectionCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl overflow-hidden">{children}</div>;
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-5 py-4 border-b border-gray-800/40 space-y-0.5">
      <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
      {description && <p className="text-[11px] text-gray-500 leading-relaxed">{description}</p>}
    </div>
  );
}

function SectionBody({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-4 space-y-4">{children}</div>;
}

function FieldRow({ label, hint, children, required }:
  { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-gray-300">{label}{required && <span className="text-blue-400 ml-1">*</span>}</Label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 flex items-start gap-1"><Info className="w-3 h-3 mt-0.5 shrink-0 text-gray-600" />{hint}</p>}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-3.5 rounded-lg bg-blue-500/5 border border-l-2 border-blue-500/20 border-l-blue-500/60">
      <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
      <div className="text-xs text-blue-200/80 space-y-1.5 flex-1">{children}</div>
    </div>
  );
}

export interface SimpleAdFormProps {
  initialValues: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  defaultName: string;
}

export function SimpleAdForm({ initialValues, onChange, defaultName }: SimpleAdFormProps) {
  const [adName, setAdName] = useState(initialValues.name ?? defaultName);

  const [pageId, setPageId] = useState<string>(initialValues.page_id ?? "");
  const pageIdRef = useRef(pageId);
  useEffect(() => { pageIdRef.current = pageId; }, [pageId]);
  const [pages, setPages] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPagesOnce().then((list) => { if (!cancelled) setPages(list); });
    return () => { cancelled = true; };
  }, []);

  const [creative, setCreative] = useState<any>(initialValues.creative);
  const creativeRef = useRef(creative);
  useEffect(() => { creativeRef.current = creative; }, [creative]);

  // Sync external changes (node switch, post-save refetch) into local state,
  // but ignore the echo of our own emits.
  const isInternalChange = useRef(false);
  const prevInitialRef = useRef(initialValues);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (initialValues === prevInitialRef.current) return;
    prevInitialRef.current = initialValues;
    if (isInternalChange.current) { isInternalChange.current = false; return; }
    setAdName(initialValues.name ?? defaultName);
    setCreative(initialValues.creative);
    setPageId(initialValues.page_id ?? "");
  }, [initialValues, defaultName]);

  const emit = useCallback((overrides: Record<string, any> = {}) => {
    isInternalChange.current = true;
    const values: Record<string, any> = { ...initialValues, name: adName, ...overrides };
    // Pass the full creative through — it can be { creative_id }, an existing
    // post { object_story_id }, an inline { object_story_spec }, or a dynamic
    // { asset_feed_spec }.
    const effCreative = overrides.hasOwnProperty("creative") ? overrides.creative : creativeRef.current;
    if (effCreative && typeof effCreative === "object" && Object.keys(effCreative).length > 0) {
      values.creative = effCreative;
    } else {
      delete values.creative;
    }
    // page_id rides along on every emit so it isn't lost when other fields change.
    const effPageId = overrides.hasOwnProperty("page_id") ? overrides.page_id : (pageIdRef.current?.trim() || undefined);
    if (effPageId) values.page_id = effPageId;
    else delete values.page_id;
    onChangeRef.current(values);
  }, [initialValues, adName]);

  return (
    <div className="space-y-4">

      {/* ── Ad name ── */}
      <SectionCard>
        <SectionHeader title="Ad" />
        <SectionBody>
          <FieldRow label="Ad name" required>
            <Input value={adName} onChange={(e) => { setAdName(e.target.value); emit({ name: e.target.value }); }}
              placeholder={defaultName}
              className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0" />
          </FieldRow>
        </SectionBody>
      </SectionCard>

      {/* ── Identity ── */}
      <SectionCard>
        <SectionHeader title="Identity" description="The Facebook Page this ad runs under." />
        <SectionBody>
          {pages.length > 0 ? (
            <FieldRow label="Facebook Page" required hint="Pages your Facebook login can act on. Required to publish.">
              <select
                value={pages.some((p) => p.id === pageId) ? pageId : ""}
                onChange={(e) => { setPageId(e.target.value); emit({ page_id: e.target.value || undefined }); }}
                className="w-full rounded-lg bg-gray-800/30 border border-gray-700/40 text-sm text-gray-200 px-3 py-2 focus:border-blue-500/50 focus:outline-none"
              >
                <option value="">Select a Page…</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>
              {pageId && !pages.some((p) => p.id === pageId) && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  Saved Page ID {pageId} isn&apos;t in your accessible Pages — select one above to replace it.
                </p>
              )}
            </FieldRow>
          ) : (
            <FieldRow label="Facebook Page ID" required hint="Numeric ID of the Facebook Page this ad runs under. Required to publish. Re-login with Page permissions to pick from a list instead.">
              <Input
                value={pageId}
                onChange={(e) => { setPageId(e.target.value); emit({ page_id: e.target.value.trim() || undefined }); }}
                placeholder="e.g. 1064753226727354"
                aria-label="Facebook Page ID"
                className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0 font-mono"
              />
              {pageId.trim() !== "" && !/^\d+$/.test(pageId.trim()) && (
                <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  Page IDs are numbers only — find yours in your Page&apos;s About section.
                </p>
              )}
            </FieldRow>
          )}
        </SectionBody>
      </SectionCard>

      {/* ── Ad creative ── */}
      <SectionCard>
        <SectionHeader title="Ad creative" description="Reference an existing creative or post, or build an inline creative with an uploaded image or video." />
        <SectionBody>
          <FieldRow label="Creative" required>
            <CreativeOverrideEditor
              value={creative}
              onChange={(c) => { setCreative(c); emit({ creative: c }); }}
            />
          </FieldRow>
          {!creative && <InfoBox>Add a creative — a Creative ID, an existing post, or an uploaded image/video — to run this ad.</InfoBox>}
        </SectionBody>
      </SectionCard>
    </div>
  );
}
