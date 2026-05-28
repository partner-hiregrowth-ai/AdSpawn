import { create } from 'zustand';

// ─── Types ───

export interface ObjectiveSelection {
  objective: string;
  count: number;
}

export interface WideAdNode {
  id: string;
  fields: Record<string, any>;
}

export interface WideAdSetNode {
  id: string;
  fields: Record<string, any>;
  ads: WideAdNode[];
}

export interface WideCampaignNode {
  id: string;
  objective: string;
  fields: Record<string, any>;
  adSets: WideAdSetNode[];
}

export interface ObjectiveLevelDefaults {
  campaign: Record<string, any>;
  adSet: Record<string, any>;
  ad: Record<string, any>;
}

export interface WideCreationState {
  step: 1 | 2;
  templateName: string;

  // Step 1: Objective selection
  objectiveSelections: ObjectiveSelection[];
  adSetsPerCampaign: number;
  adsPerAdSet: number;

  // Generated structure
  campaigns: WideCampaignNode[];

  // Per-objective defaults ("All" mode values)
  objectiveDefaults: Record<string, ObjectiveLevelDefaults>;

  // Optional per-item field overrides keyed by stable nodeId (see nodeIdFor).
  // These layer on top of bulk (Step 3) config — item-level beats objective-level.
  nodeOverrides: Record<string, Record<string, any>>;

  // Default creative (applies to all ads without explicit creative)
  defaultCreative: Record<string, any> | null;

  // Naming
  namingPattern: {
    campaign: string;
    adSet: string;
    ad: string;
  };

  // UI state
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  activeCampaignIndex: number;

  // Step 1: Objective selection
  addObjectiveSelection: (objective: string, count: number) => void;
  removeObjectiveSelection: (index: number) => void;
  updateObjectiveSelection: (index: number, updates: Partial<ObjectiveSelection>) => void;
  setAdSetsPerCampaign: (count: number) => void;
  setAdsPerAdSet: (count: number) => void;

  // Step transitions
  setStep: (step: 1 | 2) => void;
  generateStructure: () => void;

  // Navigation
  setTemplateName: (name: string) => void;
  setActiveCampaignIndex: (index: number) => void;

  // Campaign field ops
  updateCampaignField: (id: string, field: string, value: any) => void;
  bulkUpdateCampaignField: (objective: string, field: string, value: any) => void;

  // AdSet field ops
  updateAdSetField: (campaignId: string, adSetId: string, field: string, value: any) => void;
  bulkUpdateAdSetField: (objective: string, field: string, value: any) => void;

  // Ad field ops
  updateAdField: (campaignId: string, adSetId: string, adId: string, field: string, value: any) => void;
  bulkUpdateAdField: (objective: string, field: string, value: any) => void;

  // AdSet/Ad structure manipulation
  addAdSet: (campaignId: string) => void;
  removeAdSet: (campaignId: string, adSetId: string) => void;
  addAd: (campaignId: string, adSetId: string) => void;
  removeAd: (campaignId: string, adSetId: string, adId: string) => void;

  // Selection & expand
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  toggleExpand: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // Bulk
  bulkUpdateSelectedField: (field: string, value: any) => void;

  // Objective defaults ("All" mode)
  setObjectiveDefault: (objective: string, level: 'campaign' | 'adSet' | 'ad', field: string, value: any) => void;
  getObjectiveDefaults: (objective: string) => ObjectiveLevelDefaults;
  getMergedFields: (objective: string, level: 'campaign' | 'adSet' | 'ad', entityFields: Record<string, any>) => Record<string, any>;
  clearEntityOverride: (entityId: string, level: 'campaign' | 'adSet' | 'ad', field: string) => void;
  isFieldOverridden: (entityFields: Record<string, any>, field: string) => boolean;

  // Per-item overrides
  setNodeOverride: (nodeId: string, fields: Record<string, any>) => void;
  clearNodeOverride: (nodeId: string) => void;
  getNodeOverride: (nodeId: string) => Record<string, any> | undefined;

  // Default creative
  setDefaultCreative: (creative: Record<string, any> | null) => void;

  // Naming
  setNamingPattern: (level: 'campaign' | 'adSet' | 'ad', pattern: string) => void;

  // Reset
  reset: () => void;

  // Export template for API
  toTemplate: (adAccountId: string) => any;

  // Helpers
  getCampaignsByObjective: (objective: string) => WideCampaignNode[];
  getObjectives: () => string[];
}

let idCounter = 0;
function genId(prefix: string) {
  return `${prefix}_${++idCounter}_${Date.now().toString(36)}`;
}

/**
 * Stable, position-based identifier for a node in the generated tree.
 * Indexes are global within the campaigns array (campaign), within a campaign
 * (adset), and within an adset (ad). This keeps overrides addressable without
 * coupling to the volatile `genId` values that change every regenerate.
 *
 * Forms: "c{ci}" | "c{ci}:a{ai}" | "c{ci}:a{ai}:d{di}"
 */
export function nodeIdFor(ci: number, ai?: number, di?: number): string {
  let id = `c${ci}`;
  if (ai !== undefined) id += `:a${ai}`;
  if (di !== undefined) id += `:d${di}`;
  return id;
}

const initialState = {
  step: 1 as const,
  templateName: '',
  objectiveSelections: [] as ObjectiveSelection[],
  adSetsPerCampaign: 1,
  adsPerAdSet: 1,
  campaigns: [] as WideCampaignNode[],
  objectiveDefaults: {} as Record<string, ObjectiveLevelDefaults>,
  nodeOverrides: {} as Record<string, Record<string, any>>,
  defaultCreative: null as Record<string, any> | null,
  namingPattern: {
    campaign: '{objective} Campaign {index:02d}',
    adSet: '{parent} - AdSet {index:02d}',
    ad: '{parent} - Ad {index:02d}',
  },
  selectedIds: new Set<string>(),
  expandedIds: new Set<string>(),
  activeCampaignIndex: 0,
};

export const useWideCreationStore = create<WideCreationState>((set, get) => ({
  ...initialState,

  // ── Step 1: Objective Selection ──

  addObjectiveSelection: (objective, count) => set((state) => ({
    objectiveSelections: [...state.objectiveSelections, { objective, count }],
  })),

  removeObjectiveSelection: (index) => set((state) => ({
    objectiveSelections: state.objectiveSelections.filter((_, i) => i !== index),
  })),

  updateObjectiveSelection: (index, updates) => set((state) => ({
    objectiveSelections: state.objectiveSelections.map((sel, i) =>
      i === index ? { ...sel, ...updates } : sel
    ),
  })),

  setAdSetsPerCampaign: (count) => set({ adSetsPerCampaign: count }),
  setAdsPerAdSet: (count) => set({ adsPerAdSet: count }),

  // ── Step Transitions ──

  setStep: (step) => set({ step }),

  generateStructure: () => set((state) => {
    const campaigns: WideCampaignNode[] = [];
    for (const sel of state.objectiveSelections) {
      for (let i = 0; i < sel.count; i++) {
        const campaignId = genId('camp');
        const adSets: WideAdSetNode[] = [];
        for (let j = 0; j < state.adSetsPerCampaign; j++) {
          const adSetId = genId('aset');
          const ads: WideAdNode[] = [];
          for (let k = 0; k < state.adsPerAdSet; k++) {
            ads.push({ id: genId('ad'), fields: {} });
          }
          adSets.push({ id: adSetId, fields: {}, ads });
        }
        campaigns.push({
          id: campaignId,
          objective: sel.objective,
          fields: { objective: sel.objective },
          adSets,
        });
      }
    }
    // Regenerating rebuilds the tree from scratch; position-based overrides from
    // a prior structure no longer map cleanly, so drop them.
    return { campaigns, nodeOverrides: {}, step: 2 as const };
  }),

  // ── Navigation ──

  setTemplateName: (templateName) => set({ templateName }),
  setActiveCampaignIndex: (activeCampaignIndex) => set({ activeCampaignIndex }),

  // ── Campaign Fields ──

  updateCampaignField: (id, field, value) => set((state) => ({
    campaigns: state.campaigns.map(c =>
      c.id === id ? { ...c, fields: { ...c.fields, [field]: value } } : c
    ),
  })),

  bulkUpdateCampaignField: (objective, field, value) => set((state) => ({
    campaigns: state.campaigns.map(c =>
      c.objective === objective ? { ...c, fields: { ...c.fields, [field]: value } } : c
    ),
  })),

  // ── AdSet Fields ──

  updateAdSetField: (campaignId, adSetId, field, value) => set((state) => ({
    campaigns: state.campaigns.map(c =>
      c.id === campaignId
        ? {
          ...c,
          adSets: c.adSets.map(as =>
            as.id === adSetId ? { ...as, fields: { ...as.fields, [field]: value } } : as
          ),
        }
        : c
    ),
  })),

  bulkUpdateAdSetField: (objective, field, value) => set((state) => ({
    campaigns: state.campaigns.map(c =>
      c.objective === objective
        ? {
          ...c,
          adSets: c.adSets.map(as => ({ ...as, fields: { ...as.fields, [field]: value } })),
        }
        : c
    ),
  })),

  // ── Ad Fields ──

  updateAdField: (campaignId, adSetId, adId, field, value) => set((state) => ({
    campaigns: state.campaigns.map(c =>
      c.id === campaignId
        ? {
          ...c,
          adSets: c.adSets.map(as =>
            as.id === adSetId
              ? { ...as, ads: as.ads.map(a => a.id === adId ? { ...a, fields: { ...a.fields, [field]: value } } : a) }
              : as
          ),
        }
        : c
    ),
  })),

  bulkUpdateAdField: (objective, field, value) => set((state) => ({
    campaigns: state.campaigns.map(c =>
      c.objective === objective
        ? {
          ...c,
          adSets: c.adSets.map(as => ({
            ...as,
            ads: as.ads.map(a => ({ ...a, fields: { ...a.fields, [field]: value } })),
          })),
        }
        : c
    ),
  })),

  // ── Structure Manipulation ──

  addAdSet: (campaignId) => set((state) => ({
    campaigns: state.campaigns.map(c =>
      c.id === campaignId
        ? {
          ...c,
          adSets: [...c.adSets, {
            id: genId('aset'),
            fields: {},
            ads: Array.from({ length: state.adsPerAdSet }, () => ({ id: genId('ad'), fields: {} })),
          }],
        }
        : c
    ),
  })),

  removeAdSet: (campaignId, adSetId) => set((state) => ({
    campaigns: state.campaigns.map(c =>
      c.id === campaignId
        ? { ...c, adSets: c.adSets.filter(as => as.id !== adSetId) }
        : c
    ),
  })),

  addAd: (campaignId, adSetId) => set((state) => ({
    campaigns: state.campaigns.map(c =>
      c.id === campaignId
        ? {
          ...c,
          adSets: c.adSets.map(as =>
            as.id === adSetId
              ? { ...as, ads: [...as.ads, { id: genId('ad'), fields: {} }] }
              : as
          ),
        }
        : c
    ),
  })),

  removeAd: (campaignId, adSetId, adId) => set((state) => ({
    campaigns: state.campaigns.map(c =>
      c.id === campaignId
        ? {
          ...c,
          adSets: c.adSets.map(as =>
            as.id === adSetId
              ? { ...as, ads: as.ads.filter(a => a.id !== adId) }
              : as
          ),
        }
        : c
    ),
  })),

  // ── Selection ──

  toggleSelect: (id) => set((state) => {
    const next = new Set(state.selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedIds: next };
  }),

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),

  toggleExpand: (id) => set((state) => {
    const next = new Set(state.expandedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { expandedIds: next };
  }),

  expandAll: () => set((state) => {
    const all = new Set<string>();
    for (const c of state.campaigns) {
      all.add(c.id);
      for (const as of c.adSets) all.add(as.id);
    }
    return { expandedIds: all };
  }),

  collapseAll: () => set({ expandedIds: new Set() }),

  // ── Bulk (selected entities) ──

  bulkUpdateSelectedField: (field, value) => set((state) => {
    const selected = state.selectedIds;
    return {
      campaigns: state.campaigns.map(c => {
        const updatedC = selected.has(c.id)
          ? { ...c, fields: { ...c.fields, [field]: value } }
          : c;
        return {
          ...updatedC,
          adSets: updatedC.adSets.map(as => {
            const updatedAS = selected.has(as.id)
              ? { ...as, fields: { ...as.fields, [field]: value } }
              : as;
            return {
              ...updatedAS,
              ads: updatedAS.ads.map(a =>
                selected.has(a.id) ? { ...a, fields: { ...a.fields, [field]: value } } : a
              ),
            };
          }),
        };
      }),
    };
  }),

  // ── Objective Defaults ("All" mode) ──

  setObjectiveDefault: (objective, level, field, value) => set((state) => {
    const prev = state.objectiveDefaults[objective] || { campaign: {}, adSet: {}, ad: {} };
    const updated = { ...prev, [level]: { ...prev[level], [field]: value } };
    return { objectiveDefaults: { ...state.objectiveDefaults, [objective]: updated } };
  }),

  getObjectiveDefaults: (objective) => {
    return get().objectiveDefaults[objective] || { campaign: {}, adSet: {}, ad: {} };
  },

  getMergedFields: (objective, level, entityFields) => {
    const defaults = (get().objectiveDefaults[objective] || { campaign: {}, adSet: {}, ad: {} })[level];
    return { ...defaults, ...entityFields };
  },

  clearEntityOverride: (entityId, level, field) => set((state) => {
    if (level === 'campaign') {
      return {
        campaigns: state.campaigns.map(c => {
          if (c.id !== entityId) return c;
          const { [field]: _, ...rest } = c.fields;
          return { ...c, fields: rest };
        }),
      };
    }
    if (level === 'adSet') {
      return {
        campaigns: state.campaigns.map(c => ({
          ...c,
          adSets: c.adSets.map(as => {
            if (as.id !== entityId) return as;
            const { [field]: _, ...rest } = as.fields;
            return { ...as, fields: rest };
          }),
        })),
      };
    }
    return {
      campaigns: state.campaigns.map(c => ({
        ...c,
        adSets: c.adSets.map(as => ({
          ...as,
          ads: as.ads.map(a => {
            if (a.id !== entityId) return a;
            const { [field]: _, ...rest } = a.fields;
            return { ...a, fields: rest };
          }),
        })),
      })),
    };
  }),

  isFieldOverridden: (entityFields, field) => {
    return field in entityFields && entityFields[field] !== undefined;
  },

  // ── Per-Item Overrides ──

  setNodeOverride: (nodeId, fields) => set((state) => {
    // Drop keys explicitly set to undefined/'' so a cleared field reverts to
    // the bulk default rather than overriding it with an empty value.
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null || v === '') continue;
      cleaned[k] = v;
    }
    const next = { ...state.nodeOverrides };
    if (Object.keys(cleaned).length === 0) {
      delete next[nodeId];
    } else {
      next[nodeId] = cleaned;
    }
    return { nodeOverrides: next };
  }),

  clearNodeOverride: (nodeId) => set((state) => {
    if (!(nodeId in state.nodeOverrides)) return {} as any;
    const next = { ...state.nodeOverrides };
    delete next[nodeId];
    return { nodeOverrides: next };
  }),

  getNodeOverride: (nodeId) => get().nodeOverrides[nodeId],

  // ── Default Creative ──

  setDefaultCreative: (creative) => set({ defaultCreative: creative }),

  // ── Naming ──

  setNamingPattern: (level, pattern) => set((state) => ({
    namingPattern: { ...state.namingPattern, [level]: pattern },
  })),

  // ── Reset ──

  reset: () => set({ ...initialState, objectiveDefaults: {}, nodeOverrides: {}, selectedIds: new Set(), expandedIds: new Set() }),

  // ── Export ──

  toTemplate: (adAccountId: string) => {
    const state = get();
    const ov = state.nodeOverrides;
    const od = state.objectiveDefaults;
    return {
      name: state.templateName || 'Wide Creation',
      adAccountId,
      namingPattern: state.namingPattern,
      ...(state.defaultCreative ? { defaults: { ad: { creative: state.defaultCreative } } } : {}),
      campaigns: state.campaigns.map((c, ci) => {
        const objDef = od[c.objective] || { campaign: {}, adSet: {}, ad: {} };
        return {
          fields: { ...objDef.campaign, ...c.fields, ...(ov[nodeIdFor(ci)] || {}) },
          adSetCount: c.adSets.length,
          adSets: c.adSets.map((as, ai) => ({
            fields: { ...objDef.adSet, ...as.fields, ...(ov[nodeIdFor(ci, ai)] || {}) },
            adCount: as.ads.length,
            ads: as.ads.map((a, di) => ({
              fields: { ...objDef.ad, ...a.fields, ...(ov[nodeIdFor(ci, ai, di)] || {}) },
            })),
          })),
        };
      }),
    };
  },

  // ── Helpers ──

  getCampaignsByObjective: (objective: string) => {
    return get().campaigns.filter(c => c.objective === objective);
  },

  getObjectives: () => {
    return [...new Set(get().campaigns.map(c => c.objective))];
  },
}));
