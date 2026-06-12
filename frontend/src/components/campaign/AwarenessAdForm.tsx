"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CreativeOverrideEditor } from "@/components/wide-create/CreativeOverrideEditor";
import { toast } from "sonner";
import {
  X, ChevronDown, ChevronRight, Info, AlertTriangle, Star,
  ExternalLink, Plus,
} from "lucide-react";

// ─── Shared primitives ────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
        checked ? "bg-blue-600" : "bg-gray-700")}>
      <span className={cn("pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-md transition-transform duration-200", checked ? "translate-x-[18px]" : "translate-x-0")} />
    </button>
  );
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-gray-900/40 border border-gray-800/60 rounded-xl overflow-hidden", className)}>{children}</div>;
}

function SectionHeader({ title, description, hasToggle, toggled, onToggle }:
  { title: string; description?: string; hasToggle?: boolean; toggled?: boolean; onToggle?: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800/40">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
        {description && <p className="text-[11px] text-gray-500 leading-relaxed">{description}</p>}
      </div>
      {hasToggle && onToggle && <Toggle checked={toggled ?? false} onChange={onToggle} />}
    </div>
  );
}

function SectionBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4 space-y-4", className)}>{children}</div>;
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

function InfoBox({ children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div className="flex gap-3 p-3.5 rounded-lg bg-blue-500/5 border border-l-2 border-blue-500/20 border-l-blue-500/60">
      <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
      <div className="text-xs text-blue-200/80 space-y-1.5 flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-gray-600 hover:text-gray-400 transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
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

function Collapsible({ label, children, defaultOpen = false }:
  { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {label}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function ModalBase({ title, onClose, children, wide = false }:
  { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className={cn("w-full bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800/60 shrink-0">
          <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── Partnership Ad Preview Panel ─────────────────────────────────────────────

function PartnershipPreviewPanel() {
  return (
    <div className="w-64 shrink-0 border-l border-gray-800/40 bg-gray-950/40 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800/40">
        <Select defaultValue="instagram_feed">
          <SelectTrigger className="h-7 text-xs bg-gray-800/30 border-gray-700/40">
            <span>Instagram feed</span>
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800">
            <SelectItem value="instagram_feed" className="text-xs text-gray-300">Instagram feed</SelectItem>
            <SelectItem value="facebook_feed" className="text-xs text-gray-300">Facebook feed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {/* Card 1 */}
        <div className="rounded-lg bg-gray-800/50 border border-gray-700/30 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/30">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-blue-400">P</span>
            </div>
            <div className="text-[10px] text-gray-300 truncate font-medium">Test page for dup and ___</div>
          </div>
          <div className="h-24 bg-gray-700/30 flex items-center justify-center border-b border-gray-700/30">
            <div className="w-10 h-10 rounded bg-gray-600/40" />
          </div>
          <div className="px-3 py-2">
            <span className="text-[10px] text-gray-500">Ad</span>
          </div>
        </div>
        {/* Card 2 */}
        <div className="rounded-lg bg-gray-800/50 border border-gray-700/30 overflow-hidden">
          <div className="px-3 pt-2 pb-1.5">
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">Dynamic identity</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700/30">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-blue-400">P</span>
            </div>
            <div className="text-[10px] text-gray-300 truncate font-medium">Test page for dup</div>
          </div>
          <div className="h-24 bg-gray-700/30 flex items-center justify-center border-b border-gray-700/30">
            <div className="w-10 h-10 rounded bg-gray-600/40" />
          </div>
          <div className="px-3 py-2">
            <span className="text-[10px] text-gray-500">Ad</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Partnership Ad — Step 1 modal ────────────────────────────────────────────

function PartnershipAdModal({ onClose, onDone }: { onClose: () => void; onDone: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <ModalBase title="Enter partnership ad code, post ID or post URL" onClose={onClose} wide>
      <div className="flex h-full">
        <div className="flex-1 p-5 space-y-4">
          <p className="text-xs text-gray-400">This will set the first identity of the partnership ad and will use the media associated with the code or post info.</p>
          <FieldRow label="Ad code, post ID or post URL">
            <Input value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="Enter ad code provided by the creator, or post ID or post URL"
              className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0" />
          </FieldRow>
        </div>
        <PartnershipPreviewPanel />
      </div>
      <div className="flex gap-2.5 p-5 border-t border-gray-800/60 shrink-0">
        <button type="button" onClick={onClose}
          className="flex-1 h-9 text-xs font-medium rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800/40 transition-colors">Cancel</button>
        <button type="button" onClick={() => { if (code.trim()) onDone(code.trim()); }}
          disabled={!code.trim()}
          className="flex-1 h-9 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors">Done</button>
      </div>
    </ModalBase>
  );
}

// ─── Partnership Ad — Step 2 modal ────────────────────────────────────────────

function SelectIdentitiesModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [secondPage, setSecondPage] = useState("");
  const [secondIg, setSecondIg] = useState("");
  const canDone = secondPage.trim().length > 0;

  return (
    <ModalBase title="Select identities" onClose={onClose} wide>
      <div className="flex h-full">
        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          <p className="text-xs text-gray-400 leading-relaxed">
            Choose the Facebook Page and Instagram profiles that this partnership ad will be associated with. You can connect new accounts from the Partnership Ads Hub.
          </p>

          {/* First identity */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-gray-300">First identity</Label>
            <FieldRow label="Facebook Page">
              <Select defaultValue="test_page">
                <SelectTrigger className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-white">f</span>
                    </div>
                    <span>Test page for dup</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800">
                  <SelectItem value="test_page" className="text-xs text-gray-300">Test page for dup</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <div className="flex gap-2">
              <div className="flex-1">
                <FieldRow label="Instagram profile">
                  <Select defaultValue="use_fb">
                    <SelectTrigger className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                      <span>Use Facebook Page</span>
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800">
                      <SelectItem value="use_fb" className="text-xs text-gray-300">Use Facebook Page</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
              <div className="flex items-end">
                <a href="https://business.facebook.com/settings/instagram-accounts" target="_blank" rel="noopener noreferrer"
                  className="h-9 px-3 text-xs font-medium rounded-lg border border-gray-700 text-blue-400 hover:bg-gray-800/40 transition-colors whitespace-nowrap inline-flex items-center">
                  Connect profile
                </a>
              </div>
            </div>
            <InfoBox>
              <span className="font-semibold text-blue-300">Instagram account selection</span>
              <p>You can connect an Instagram account to represent this identity on Instagram. If you don&apos;t connect one, this ad will appear on Instagram with the name, profile picture and other details from your Facebook Page.</p>
            </InfoBox>
          </div>

          <button type="button"
            onClick={() => toast.info("Identity order switched.")}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <span>⇄</span> Switch identities
          </button>

          {/* Second identity */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-gray-300">Second identity</Label>
            <FieldRow label="Facebook Page">
              <Input
                value={secondPage}
                onChange={(e) => setSecondPage(e.target.value)}
                placeholder="Search by Page name or ID"
                className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0"
              />
            </FieldRow>
            <FieldRow label="Instagram profile">
              <Input
                value={secondIg}
                onChange={(e) => setSecondIg(e.target.value)}
                placeholder="Search by Instagram profile"
                className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0"
              />
            </FieldRow>
          </div>

          {/* Header identity */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-300">Identities to display in header</Label>
            <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer bg-blue-500/8 border-blue-500/30">
              <input type="radio" name="header_identity_modal" defaultChecked
                className="mt-0.5 w-3.5 h-3.5 accent-blue-500 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-blue-300">Dynamic identity</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Automatically shows the most relevant identity.</div>
              </div>
            </label>
          </div>
        </div>
        <PartnershipPreviewPanel />
      </div>
      <div className="flex gap-2.5 p-5 border-t border-gray-800/60 shrink-0">
        <button type="button" onClick={onClose}
          className="flex-1 h-9 text-xs font-medium rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800/40 transition-colors">Cancel</button>
        <button type="button" onClick={onDone} disabled={!canDone}
          className="flex-1 h-9 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">Done</button>
      </div>
    </ModalBase>
  );
}

// ─── Creative Mockup Modal ─────────────────────────────────────────────────────

function CreativeMockupModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalBase title="Select mockup" onClose={onClose}>
      <div className="p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-20 h-20 rounded-full bg-gray-800/60 flex items-center justify-center">
          <div className="w-10 h-10 rounded-lg bg-gray-700/60" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-300">No mockups available</div>
          <p className="text-xs text-gray-500 max-w-xs">If you have created mockups in Creative Hub, make sure they&apos;re marked as &quot;Show in Ads Manager.&quot;</p>
        </div>
      </div>
      <div className="flex gap-2.5 p-5 border-t border-gray-800/60">
        <button type="button" onClick={onClose}
          className="flex-1 h-9 text-xs font-medium rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800/40 transition-colors">Cancel</button>
        <button type="button" onClick={onClose}
          className="flex-1 h-9 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">Confirm</button>
      </div>
    </ModalBase>
  );
}

// ─── URL Parameter Builder Modal ──────────────────────────────────────────────

const URL_PARAM_FIELDS = [
  { key: "utm_source", label: "Campaign source", desc: "Identify the advertiser, site, publication, etc. that is sending traffic to your property." },
  { key: "utm_medium", label: "Campaign medium", desc: "The advertising or marketing medium, for example: cpc, banner, email newsletter." },
  { key: "utm_campaign", label: "Campaign name", desc: "The individual campaign name, slogan, promo code, etc." },
  { key: "utm_content", label: "Campaign content", desc: "Identify what specifically was clicked to bring the user to the site." },
];

function UrlParamModal({ onClose, onApply }: { onClose: () => void; onApply: (p: string) => void }) {
  const [params, setParams] = useState<Record<string, string>>({});
  const preview = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("&");

  return (
    <ModalBase title="Build a URL parameter" onClose={onClose}>
      <div className="p-5 space-y-4">
        {URL_PARAM_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-300">{f.label}</Label>
            <Input value={params[f.key] ?? ""} onChange={(e) => setParams((p) => ({ ...p, [f.key]: e.target.value }))}
              placeholder="Select a dynamic parameter or enter a value"
              className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0" />
            <p className="text-[11px] text-gray-600">{f.desc}</p>
          </div>
        ))}
        <button type="button" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add parameter
        </button>
        <div className="space-y-1.5 pt-2 border-t border-gray-800/40">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-400">Audience segment URL parameters</Label>
            <button type="button" className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
              Edit in Advertising settings <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[11px] text-gray-600">No audience segment parameters configured.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400">Parameter preview</Label>
          <div className="min-h-[36px] px-3 py-2 rounded-lg bg-gray-800/30 border border-gray-700/40">
            <span className="text-xs text-gray-500 font-mono break-all">{preview || <span className="text-gray-700">No parameters yet</span>}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2.5 p-5 border-t border-gray-800/60">
        <button type="button" onClick={onClose}
          className="flex-1 h-9 text-xs font-medium rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800/40 transition-colors">Cancel</button>
        <button type="button" onClick={() => { onApply(preview); onClose(); }}
          className="flex-1 h-9 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">Apply</button>
      </div>
    </ModalBase>
  );
}

// ─── Google Analytics Modal ────────────────────────────────────────────────────

function GoogleAnalyticsModal({ onClose }: { onClose: () => void }) {
  const [measurementId, setMeasurementId] = useState("");
  return (
    <ModalBase title="Measure Shops ads performance in Google Analytics" onClose={onClose}>
      <div className="p-5 space-y-4">
        <FieldRow label="Third-party reporting tool">
          <Select defaultValue="ga4">
            <SelectTrigger className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
              <span>Google Analytics 4</span>
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              <SelectItem value="ga4" className="text-xs text-gray-300">Google Analytics 4</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Measurement ID" hint="Example: G-GDHD06G2JP">
          <Input value={measurementId} onChange={(e) => setMeasurementId(e.target.value)}
            placeholder="Enter or select a measurement ID"
            className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0" />
        </FieldRow>
      </div>
      <div className="flex gap-2.5 p-5 border-t border-gray-800/60">
        <button type="button" onClick={onClose}
          className="flex-1 h-9 text-xs font-medium rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800/40 transition-colors">Cancel</button>
        <button type="button" onClick={() => { toast.success("Google Analytics tags saved."); onClose(); }}
          className="flex-1 h-9 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">Save tags</button>
      </div>
    </ModalBase>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface AwarenessAdFormProps {
  initialValues: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}

export function AwarenessAdForm({ initialValues, onChange }: AwarenessAdFormProps) {
  // 1 – Ad name
  const [adName, setAdName] = useState(initialValues.name ?? "New Awareness Ad");

  // 2 – Partnership ad
  const [partnershipOn, setPartnershipOn] = useState(false);
  const [partnershipStep, setPartnershipStep] = useState<"code" | "identities" | null>(null);
  const [partnershipCode, setPartnershipCode] = useState("");

  // 3 – Identity
  const [pageId, setPageId] = useState<string>(initialValues.page_id ?? "");
  const pageIdRef = useRef(pageId);
  pageIdRef.current = pageId;
  const [igProfile] = useState("use_fb");

  // 4 – Ad setup
  const [adSetup, setAdSetup] = useState<"create" | "existing">("create");
  const [creativeSource, setCreativeSource] = useState<"manual" | "catalog">("manual");
  const [format, setFormat] = useState<"single" | "carousel">("single");
  const [multiAdvertiser, setMultiAdvertiser] = useState(true);
  const [showFormatInfoDismissed, setShowFormatInfoDismissed] = useState(false);
  const [showProductInfoDismissed, setShowProductInfoDismissed] = useState(false);

  // 6 – Destination
  const [destination, setDestination] = useState("Website");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [useDisplayLink, setUseDisplayLink] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);

  // 7 – Ad creative
  const [creativeId, setCreativeId] = useState<string>(initialValues.creative?.creative_id ?? initialValues.creative?.id ?? "");
  const [creative, setCreative] = useState<any>(initialValues.creative);
  const creativeRef = useRef(creative);
  creativeRef.current = creative;
  const [showMockupModal, setShowMockupModal] = useState(false);
  const [postId, setPostId] = useState<string>(initialValues.creative?.object_story_id ?? "");

  // 8 – Creative testing
  const [showCreativeMockup, setShowCreativeMockup] = useState(false);

  // 10 – Languages
  const [languagesOn, setLanguagesOn] = useState(false);

  // 11 – Tracking
  const [websiteEvents, setWebsiteEvents] = useState(true);
  const [appEvents, setAppEvents] = useState(true);
  const [urlParams, setUrlParams] = useState("key1=value1&key2=value2");
  const [showUrlParamModal, setShowUrlParamModal] = useState(false);
  const [showGAModal, setShowGAModal] = useState(false);

  // Sync + emit
  const isInternalChange = useRef(false);
  const prevInitialRef = useRef(initialValues);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (initialValues === prevInitialRef.current) return;
    prevInitialRef.current = initialValues;
    if (isInternalChange.current) { isInternalChange.current = false; return; }
    setAdName(initialValues.name ?? "New Awareness Ad");
    setCreativeId(initialValues.creative?.creative_id ?? initialValues.creative?.id ?? "");
    setCreative(initialValues.creative);
    setPageId(initialValues.page_id ?? "");
  }, [initialValues]);

  const emit = useCallback((overrides: Record<string, any> = {}) => {
    isInternalChange.current = true;
    const values: Record<string, any> = { ...initialValues, name: adName, ...overrides };
    // Pass the full creative through — it can be { creative_id }, an inline
    // { object_story_spec } (image/video), or a dynamic { asset_feed_spec }.
    // Reducing it to creative_id here used to destroy duplicated creatives.
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
  }, [initialValues, adName, creativeId]);

  const urlHasError = urlTouched && !websiteUrl.trim() && destination === "Website";

  return (
    <div className="space-y-4">

      {/* ── 1. Ad name ── */}
      <SectionCard>
        <SectionHeader title="Ad" />
        <SectionBody>
          <FieldRow label="Ad name" required>
            <Input value={adName} onChange={(e) => { setAdName(e.target.value); emit({ name: e.target.value }); }}
              placeholder="New Awareness Ad"
              className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0" />
          </FieldRow>
        </SectionBody>
      </SectionCard>

      {/* ── 2. Partnership ad ── */}
      <SectionCard>
        <SectionHeader title="Partnership ad"
          description="Run ads with creators, brands and other businesses. These ads leverage signals from both profiles to improve campaign performance."
          hasToggle toggled={partnershipOn}
          onToggle={(v) => { setPartnershipOn(v); if (v) setPartnershipStep("code"); }} />
        {partnershipOn && partnershipCode && (
          <SectionBody className="!py-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">Partnership code: <span className="font-mono text-gray-300">{partnershipCode}</span></div>
              <button type="button" onClick={() => setPartnershipStep("code")}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">Edit</button>
            </div>
          </SectionBody>
        )}
      </SectionCard>

      {/* ── 3. Identity ── */}
      <SectionCard>
        <SectionHeader title="Identity" description="The profiles that will be used in your ad." />
        <SectionBody>
          <FieldRow label="Facebook Page ID" required hint="Numeric ID of the Facebook Page this ad runs under. Required to publish.">
            <Input
              value={pageId}
              onChange={(e) => { setPageId(e.target.value); emit({ page_id: e.target.value.trim() || undefined }); }}
              placeholder="e.g. 1064753226727354"
              className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0 font-mono"
            />
          </FieldRow>
          <div className="flex gap-2">
            <div className="flex-1">
              <FieldRow label="Instagram profile">
                <Select defaultValue="use_fb">
                  <SelectTrigger className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-800">
                    <SelectItem value="use_fb" className="text-xs text-gray-300">Use Facebook Page</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
            </div>
            <div className="flex items-end">
              <a href="https://business.facebook.com/settings/instagram-accounts" target="_blank" rel="noopener noreferrer"
                className="h-9 px-3 text-xs font-medium rounded-lg border border-gray-700 text-blue-400 hover:bg-gray-800/40 transition-colors whitespace-nowrap inline-flex items-center">
                Connect profile
              </a>
            </div>
          </div>
          <FieldRow label="Threads profile">
            <Select defaultValue="use_fb">
              <SelectTrigger className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="use_fb" className="text-xs text-gray-300">Use Facebook Page</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </SectionBody>
      </SectionCard>

      {/* ── 4. Ad setup ── */}
      <SectionCard>
        <SectionHeader title="Ad setup" />
        <SectionBody>
          <FieldRow label="Ad setup">
            <Select value={adSetup} onValueChange={(v) => { if (v) setAdSetup(v as "create" | "existing"); }}>
              <SelectTrigger className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                <span>{adSetup === "create" ? "Create ad" : "Use existing post"}</span>
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="create" className="text-xs text-gray-300">Create ad</SelectItem>
                <SelectItem value="existing" className="text-xs text-gray-300">Use existing post</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          {adSetup === "create" && (
            <div className="space-y-4">
              {/* Product info box */}
              {!showProductInfoDismissed && (
                <InfoBox onDismiss={() => setShowProductInfoDismissed(true)}>
                  <div className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="space-y-1.5">
                      <div className="font-semibold text-blue-300">Turn ads into a shopping experience</div>
                      <p>Drive sales using your product information by showing relevant products to the right people.</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button type="button" onClick={() => toast.info("Add products in Meta Commerce Manager.")}
                          className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors">Add products</button>
                        <button type="button" onClick={() => setShowProductInfoDismissed(true)}
                          className="text-[11px] text-gray-500 hover:text-gray-400 transition-colors">Remind me later</button>
                      </div>
                    </div>
                  </div>
                </InfoBox>
              )}

              {/* Creative source */}
              <FieldRow label="Creative source">
                <div className="space-y-2">
                  {[
                    { value: "manual", label: "Manual upload", desc: "Upload your own images, videos and copy." },
                    { value: "catalog", label: "Advantage+ catalog ads", desc: "Automatically use images and details from your product catalogue.", disabled: true },
                  ].map((opt) => (
                    <label key={opt.value} className={cn("flex items-start gap-3 p-3 rounded-lg border transition-all",
                      opt.disabled ? "cursor-not-allowed opacity-40 bg-gray-800/10 border-gray-700/20" :
                        creativeSource === opt.value ? "cursor-pointer bg-blue-500/8 border-blue-500/30" :
                          "cursor-pointer bg-gray-800/15 border-gray-700/30 hover:border-gray-600/50")}>
                      <input type="radio" name="creative_source" value={opt.value}
                        checked={creativeSource === opt.value} disabled={opt.disabled}
                        onChange={() => !opt.disabled && setCreativeSource(opt.value as "manual" | "catalog")}
                        className="mt-0.5 w-3.5 h-3.5 accent-blue-500 shrink-0" />
                      <div>
                        <div className={cn("text-xs font-semibold", creativeSource === opt.value && !opt.disabled ? "text-blue-300" : "text-gray-300")}>{opt.label}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </FieldRow>

              {/* Format */}
              <FieldRow label="Format">
                {!showFormatInfoDismissed && (
                  <div className="mb-2">
                    <InfoBox onDismiss={() => setShowFormatInfoDismissed(true)}>
                      <span className="font-semibold text-blue-300">Format selection has changed</span>
                      <p>Format display options in Ad creative is the new way to show your ad in collection formats.</p>
                    </InfoBox>
                  </div>
                )}
                <div className="space-y-2">
                  {[
                    { value: "single", label: "Single image or video" },
                    { value: "carousel", label: "Carousel" },
                  ].map((opt) => (
                    <label key={opt.value} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                      format === opt.value ? "bg-blue-500/8 border-blue-500/30" : "bg-gray-800/15 border-gray-700/30 hover:border-gray-600/50")}>
                      <input type="radio" name="format" value={opt.value} checked={format === opt.value}
                        onChange={() => setFormat(opt.value as "single" | "carousel")}
                        className="w-3.5 h-3.5 accent-blue-500 shrink-0" />
                      <span className={cn("text-xs font-semibold", format === opt.value ? "text-blue-300" : "text-gray-300")}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </FieldRow>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={multiAdvertiser} onChange={(e) => setMultiAdvertiser(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30 focus:outline-none" />
                <div>
                  <div className="text-xs font-medium text-gray-300">Multi-advertiser ads</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Your ad can appear with others in the same ad unit to help promote discoverability. Your ad creative may be resized or cropped.</div>
                </div>
              </label>

              <Collapsible label="Show more settings">
                <div className="space-y-2 pl-1">
                  <div className="flex items-center justify-between py-1.5">
                    <Label className="text-xs text-gray-400">Schedule (Optional)</Label>
                    <span className="text-xs text-gray-500">Jun 8, 2026 - Ongoing</span>
                  </div>
                </div>
              </Collapsible>
            </div>
          )}

          {adSetup === "existing" && (
            <div className="space-y-4">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={multiAdvertiser} onChange={(e) => setMultiAdvertiser(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30 focus:outline-none" />
                <div>
                  <div className="text-xs font-medium text-gray-300">Multi-advertiser ads</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Your ad can appear with others in the same ad unit to help promote discoverability.</div>
                </div>
              </label>
              <Collapsible label="Show more settings">
                <div className="py-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-400">Schedule (Optional)</Label>
                    <span className="text-xs text-gray-500">Jun 8, 2026 - Ongoing</span>
                  </div>
                </div>
              </Collapsible>
            </div>
          )}
        </SectionBody>
      </SectionCard>

      {/* ── 5. Ad sources (existing post only) ── */}
      {adSetup === "existing" && (
        <SectionCard>
          <SectionHeader title="Ad sources" description="Connect ad sources to include more information in your ad that can help inspire action." />
          <SectionBody>
            <FieldRow label="Source URL">
              <Input placeholder="http://www.example.com/page"
                className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0" />
            </FieldRow>
          </SectionBody>
        </SectionCard>
      )}

      {/* ── 6. Destination ── */}
      <SectionCard>
        <SectionHeader title="Destination" />
        <SectionBody>
          <FieldRow label="Main destination">
            <Select value={destination} onValueChange={(v) => { if (v) setDestination(v); }}>
              <SelectTrigger className="w-full bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 focus:border-blue-500/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                {["Website", "App", "Messenger", "Instagram Direct", "WhatsApp", "Calls"].map((d) => (
                  <SelectItem key={d} value={d} className="text-xs text-gray-300">{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {destination === "Website" && (
            <FieldRow label="Website URL" required>
              <Input value={websiteUrl}
                onChange={(e) => { setWebsiteUrl(e.target.value); setUrlTouched(true); }}
                onBlur={() => setUrlTouched(true)}
                placeholder="Enter the URL people visit after your ad"
                className={cn("bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:ring-0 transition-colors",
                  urlHasError ? "border-red-500/70 focus:border-red-500" : "focus:border-blue-500/50")} />
              {urlHasError && (
                <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  Enter the website URL field for your ad.
                </p>
              )}
            </FieldRow>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={useDisplayLink} onChange={(e) => setUseDisplayLink(e.target.checked)}
              className="w-4 h-4 rounded border border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30 focus:outline-none" />
            <span className="text-xs text-gray-300">Use a display link</span>
          </label>

          {/* Personalized destinations */}
          <div className="border border-gray-800/40 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800/20">
              <span className="text-xs font-medium text-gray-300">Personalized destinations</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-600">Turned off</span>
              </div>
              <ul className="text-[11px] text-gray-500 space-y-1 pl-3">
                <li className="list-disc">Optimize website destination</li>
                <li className="list-disc">Browser add-ons: Call, Messenger, Instagram Direct, Instant form</li>
              </ul>
            </div>
          </div>
        </SectionBody>
      </SectionCard>

      {/* ── 7. Ad creative ── */}
      <SectionCard>
        <SectionHeader title="Ad creative" description="Select and optimize your ad text, media and enhancements." />
        <SectionBody>
          <FieldRow label="Creative" hint="Reference an existing creative ID, or build an inline creative with an uploaded image or video. Inline creatives require your FB App to be in Live mode.">
            <CreativeOverrideEditor
              value={creative}
              onChange={(c) => { setCreative(c); emit({ creative: c }); }}
            />
          </FieldRow>
          {!creative && <InfoBox>Add a creative — reference a Creative ID or upload an image/video — to run this ad.</InfoBox>}

          {adSetup === "existing" && (
            <div className="space-y-3">
              <FieldRow label="Post ID" hint="Enter the post ID or URL to use as an existing post.">
                <Input
                  value={postId}
                  onChange={(e) => { setPostId(e.target.value); emit({ creative: { ...(creativeId.trim() ? { creative_id: creativeId.trim() } : {}), object_story_id: e.target.value.trim() || undefined } }); }}
                  placeholder="e.g. 123456789_987654321"
                  className="bg-gray-800/30 border-gray-700/40 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0 font-mono"
                />
              </FieldRow>
              <p className="text-[11px] text-gray-500">Enter a post ID to publish a partnership ad.</p>
            </div>
          )}

          <FieldRow label="Testimonial">
            <div className="relative">
              <Input placeholder="Add text from your partner"
                className="bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0 pr-16" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                <span className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">f</span>
                <span className="w-4 h-4 rounded bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-[9px] font-bold text-white shrink-0">ig</span>
              </div>
            </div>
          </FieldRow>
        </SectionBody>
      </SectionCard>

      {/* ── 8. Creative testing ── */}
      <SectionCard>
        <SectionHeader title="Creative testing" description="Compare up to 5 different versions of your creative in a test that helps ensure delivery to new test ads." />
        <SectionBody>
          <button type="button" onClick={() => setShowCreativeMockup(true)}
            className="h-9 px-4 text-xs font-medium rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800/40 transition-colors">
            Set up test
          </button>
        </SectionBody>
      </SectionCard>

      {/* ── 9. Event details ── */}
      <SectionCard>
        <SectionHeader title="Event details (Optional)" description="Display event details on your ad including event name, time and a reminder button." />
        <SectionBody>
          <WarningBox>
            For the Identity of your ad, you must select an Instagram profile to include event details.
          </WarningBox>
        </SectionBody>
      </SectionCard>

      {/* ── 10. Languages ── */}
      <SectionCard>
        <SectionHeader title="Languages"
          description="Add your own translations or automatically translate your ad to reach people in more languages."
          hasToggle toggled={languagesOn} onToggle={setLanguagesOn} />
        {languagesOn && (
          <SectionBody>
            <InfoBox>
              <span>Select languages to add translations for your ad creative.</span>
            </InfoBox>
          </SectionBody>
        )}
      </SectionCard>

      {/* ── 11. Tracking ── */}
      <SectionCard>
        <SectionHeader title="Tracking" description="Choose conversion events to track. This ad account's selected conversion dataset will be tracked by default." />
        <SectionBody>

          {/* Website events */}
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={websiteEvents} onChange={(e) => setWebsiteEvents(e.target.checked)}
                className="w-4 h-4 rounded border border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30 focus:outline-none" />
              <span className="text-xs font-medium text-gray-300">Website events</span>
            </label>
            {websiteEvents && (
              <div className="ml-6 flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-700/40">
                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-200">Dev Pixel</div>
                  <div className="text-[11px] text-gray-500">Pixel ID: 1163649662554293</div>
                </div>
              </div>
            )}
          </div>

          {/* App events */}
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={appEvents} onChange={(e) => setAppEvents(e.target.checked)}
                className="w-4 h-4 rounded border border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30 focus:outline-none" />
              <span className="text-xs font-medium text-gray-300">App events</span>
            </label>
            {appEvents && (
              <div className="ml-6 flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-700/40">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-200">AdSpawn</div>
                  <div className="text-[11px] text-gray-500">App ID: 2445252759309285</div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
              </div>
            )}
          </div>

          {/* Offline events */}
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 shrink-0" />
            <span className="text-xs font-medium text-gray-500">Offline events</span>
          </div>

          {/* URL parameters */}
          <FieldRow label="URL parameters">
            <div className="flex gap-2">
              <Input value={urlParams} onChange={(e) => setUrlParams(e.target.value)}
                className="flex-1 bg-gray-800/30 border-gray-700/40 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:ring-0 font-mono text-xs" />
            </div>
            <button type="button" onClick={() => setShowUrlParamModal(true)}
              className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors mt-1">
              Build a URL parameter
            </button>
          </FieldRow>

          {/* Third-party reporting */}
          <div className="border border-gray-800/40 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-800/20 border-b border-gray-800/40">
              <div className="text-xs font-medium text-gray-300">Third-party reporting tools</div>
              <p className="text-[11px] text-gray-500 mt-0.5">Meta purchases may not be included in your Google reporting. Connect your account to measure actions on ads that send people to your website or shop.</p>
            </div>
            <div className="px-4 py-3">
              <button type="button" onClick={() => setShowGAModal(true)}
                className="h-8 px-3 text-xs font-medium rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800/40 transition-colors">
                Connect
              </button>
            </div>
          </div>
        </SectionBody>
      </SectionCard>

      {/* ── Modals ── */}
      {partnershipStep === "code" && (
        <PartnershipAdModal onClose={() => { setPartnershipStep(null); setPartnershipOn(false); }}
          onDone={(code) => { setPartnershipCode(code); setPartnershipStep("identities"); }} />
      )}
      {partnershipStep === "identities" && (
        <SelectIdentitiesModal onClose={() => { setPartnershipStep(null); setPartnershipOn(false); }}
          onDone={() => setPartnershipStep(null)} />
      )}
      {showCreativeMockup && <CreativeMockupModal onClose={() => setShowCreativeMockup(false)} />}
      {showUrlParamModal && <UrlParamModal onClose={() => setShowUrlParamModal(false)} onApply={(p) => setUrlParams(p)} />}
      {showGAModal && <GoogleAnalyticsModal onClose={() => setShowGAModal(false)} />}
    </div>
  );
}
