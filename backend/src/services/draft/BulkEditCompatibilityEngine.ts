import {
  CAMPAIGN_FIELDS,
  ADSET_FIELDS,
  AD_FIELDS,
  FieldConfig,
  VALID_OPTIMIZATION_GOALS,
  VALID_DESTINATION_TYPES,
  IMMUTABLE_CAMPAIGN_FIELDS,
  IMMUTABLE_ADSET_FIELDS,
  IMMUTABLE_AD_FIELDS,
  READ_ONLY_FIELDS,
  BID_CAP_STRATEGIES,
} from './MetaFieldRegistry';

// ─── Types ───

export type EntityLevel = 'campaign' | 'adSet' | 'ad';

export interface EntityFingerprint {
  level: EntityLevel;
  objective: string;
  buyingType?: string;
  optimizationGoal?: string;
  destinationType?: string;
  isCBO?: boolean;
}

export interface BulkFieldSchema {
  field: string;
  label: string;
  type: FieldConfig['type'];
  editable: boolean;
  locked: boolean;
  lockReason?: string;
  required: boolean | 'conditional';
  enumValues?: string[];
  enumLabels?: Record<string, string>;
  isBudget?: boolean;
  incompatibleWith?: string[];
  currentValues: { draftId: string; value: any }[];
  commonValue: any;
  isMixed: boolean;
}

export interface BulkEditSchemaResult {
  compatible: boolean;
  incompatibleReason?: string;
  entityLevel: EntityLevel;
  fields: BulkFieldSchema[];
  fingerprints: EntityFingerprint[];
  warnings: string[];
}

export interface BulkEditValidationResult {
  valid: boolean;
  perEntityErrors: Record<string, { field: string; message: string; severity: 'error' | 'warning' }[]>;
  globalErrors: string[];
  globalWarnings: string[];
}

// ─── Engine ───

export class BulkEditCompatibilityEngine {

  static computeFingerprint(draft: any, level: EntityLevel): EntityFingerprint {
    if (level === 'campaign') {
      const data = draft.data || {};
      return {
        level,
        objective: draft.objective || data.objective || '',
        buyingType: data.buying_type || 'AUCTION',
        isCBO: !!data.is_adset_budget_sharing_enabled,
      };
    }

    if (level === 'adSet') {
      const data = draft.data || {};
      return {
        level,
        objective: draft.campaignObjective || '',
        optimizationGoal: data.optimization_goal || '',
        destinationType: data.destination_type || '',
        isCBO: draft.isCBO || false,
      };
    }

    return { level, objective: '' };
  }

  static areCompatible(fingerprints: EntityFingerprint[]): { compatible: boolean; reason?: string } {
    if (fingerprints.length === 0) return { compatible: false, reason: 'No entities selected' };
    if (fingerprints.length === 1) return { compatible: true };

    const first = fingerprints[0];

    // All must be same level
    if (!fingerprints.every(f => f.level === first.level)) {
      return { compatible: false, reason: 'Cannot bulk edit entities of different levels (Campaign, Ad Set, Ad)' };
    }

    // For campaigns: must share objective for dependent fields to align
    // But we allow mixed objectives — we just restrict to the intersection of fields
    // Buying type difference is fine — immutable fields are excluded anyway

    return { compatible: true };
  }

  static computeBulkSchema(drafts: any[], level: EntityLevel): BulkEditSchemaResult {
    const fingerprints = drafts.map(d => this.computeFingerprint(d, level));
    const compatibility = this.areCompatible(fingerprints);
    const warnings: string[] = [];

    if (!compatibility.compatible) {
      return {
        compatible: false,
        incompatibleReason: compatibility.reason,
        entityLevel: level,
        fields: [],
        fingerprints,
        warnings: [],
      };
    }

    const registry = level === 'campaign' ? CAMPAIGN_FIELDS
      : level === 'adSet' ? ADSET_FIELDS
      : AD_FIELDS;

    const immutableFields = level === 'campaign' ? IMMUTABLE_CAMPAIGN_FIELDS
      : level === 'adSet' ? IMMUTABLE_ADSET_FIELDS
      : IMMUTABLE_AD_FIELDS;

    const hasPublished = drafts.some(d => !!d.metaId);
    const objectives = [...new Set(fingerprints.map(f => f.objective).filter(Boolean))];
    const hasMixedObjectives = objectives.length > 1;

    const fields: BulkFieldSchema[] = [];

    for (const [key, config] of Object.entries(registry)) {
      // Skip system reference fields
      if (key === 'campaign_id' || key === 'adset_id') continue;
      if (READ_ONLY_FIELDS.has(key)) continue;

      // Determine editability
      let editable = config.mutability === 'mutable';
      let locked = false;
      let lockReason: string | undefined;

      // Immutable fields locked after publish
      if (immutableFields.includes(key)) {
        if (hasPublished) {
          locked = true;
          lockReason = 'Immutable after publishing to Meta';
          editable = false;
        } else {
          // In draft-only mode, some immutable fields can still be set before first publish
          // But for bulk edit, we typically don't allow changing objective/buying_type
          // because it would cascade changes to all child entities
          if (key === 'objective' || key === 'buying_type') {
            locked = true;
            lockReason = 'Changing this would invalidate child entity configurations';
            editable = false;
          }
        }
      }

      // Fields that depend on objective — only editable if all share same objective
      if (config.dependsOn?.includes('objective') && hasMixedObjectives) {
        locked = true;
        lockReason = 'Selected drafts have different objectives — cannot bulk edit objective-dependent fields';
        editable = false;
      }

      // Status is always locked to PAUSED for safety
      if (key === 'status') {
        locked = true;
        lockReason = 'Status managed separately';
        editable = false;
        continue;
      }

      // CBO check for ad set budget fields
      if (level === 'adSet' && (key === 'daily_budget' || key === 'lifetime_budget' || key === 'bid_amount' || key === 'bid_strategy')) {
        const allCBO = fingerprints.every(f => f.isCBO);
        if (allCBO) {
          locked = true;
          lockReason = 'Budget managed at campaign level (CBO enabled)';
          editable = false;
        }
      }

      // Resolve enum values — intersect across all drafts' valid sets
      let enumValues = config.enumValues;
      let enumLabels = config.enumLabels;

      if (key === 'optimization_goal' && level === 'adSet' && !hasMixedObjectives && objectives[0]) {
        enumValues = VALID_OPTIMIZATION_GOALS[objectives[0]] || [];
        // Build labels from the values
        const goalLabels: Record<string, string> = {};
        for (const v of enumValues) {
          goalLabels[v] = v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
        enumLabels = goalLabels;
      }

      if (key === 'destination_type' && level === 'adSet' && !hasMixedObjectives && objectives[0]) {
        enumValues = VALID_DESTINATION_TYPES[objectives[0]] || [];
        const destLabels: Record<string, string> = {};
        for (const v of enumValues) {
          destLabels[v] = v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
        enumLabels = destLabels;
      }

      // Collect current values from all drafts
      const currentValues = drafts.map(d => ({
        draftId: d.id,
        value: d.data?.[key] ?? (key === 'objective' ? d.objective : undefined),
      }));

      // Determine if values are common
      const nonNull = currentValues.filter(cv => cv.value !== undefined && cv.value !== null);
      const firstVal = nonNull[0]?.value;
      const isMixed = nonNull.length > 0 && !nonNull.every(cv =>
        JSON.stringify(cv.value) === JSON.stringify(firstVal)
      );
      const commonValue = isMixed ? undefined : firstVal;

      fields.push({
        field: key,
        label: config.label,
        type: config.type,
        editable,
        locked,
        lockReason,
        required: config.required,
        enumValues,
        enumLabels,
        isBudget: (config as any).isBudget || key.includes('budget') || key === 'spend_cap' || key === 'bid_amount',
        incompatibleWith: config.incompatibleWith,
        currentValues,
        commonValue,
        isMixed,
      });
    }

    if (hasMixedObjectives) {
      warnings.push(`Selected drafts have ${objectives.length} different objectives. Only shared mutable fields are editable.`);
    }

    return {
      compatible: true,
      entityLevel: level,
      fields: fields.filter(f => f.editable || f.locked),
      fingerprints,
      warnings,
    };
  }

  static validateBulkEdit(
    drafts: any[],
    fieldUpdates: Record<string, any>,
    level: EntityLevel,
  ): BulkEditValidationResult {
    const perEntityErrors: Record<string, { field: string; message: string; severity: 'error' | 'warning' }[]> = {};
    const globalErrors: string[] = [];
    const globalWarnings: string[] = [];

    const registry = level === 'campaign' ? CAMPAIGN_FIELDS
      : level === 'adSet' ? ADSET_FIELDS
      : AD_FIELDS;

    const immutableFields = level === 'campaign' ? IMMUTABLE_CAMPAIGN_FIELDS
      : level === 'adSet' ? IMMUTABLE_ADSET_FIELDS
      : IMMUTABLE_AD_FIELDS;

    // Global checks
    if (fieldUpdates.daily_budget && fieldUpdates.lifetime_budget) {
      globalErrors.push('Cannot set both daily_budget and lifetime_budget');
    }

    if (fieldUpdates.bid_strategy && BID_CAP_STRATEGIES.has(fieldUpdates.bid_strategy) && fieldUpdates.bid_strategy !== 'LOWEST_COST_WITH_MIN_ROAS' && !fieldUpdates.bid_amount) {
      globalWarnings.push(`${fieldUpdates.bid_strategy} typically requires bid_amount`);
    }

    // Check for immutable field edits on published drafts
    for (const draft of drafts) {
      const errors: { field: string; message: string; severity: 'error' | 'warning' }[] = [];

      if (draft.metaId) {
        for (const [field, value] of Object.entries(fieldUpdates)) {
          if (immutableFields.includes(field)) {
            errors.push({
              field,
              message: `${field} is immutable — cannot be changed after publishing`,
              severity: 'error',
            });
          }
        }
      }

      // Per-entity validation
      const projected = { ...(draft.data || {}), ...fieldUpdates };
      const objective = fieldUpdates.objective || draft.objective;

      if (level === 'adSet' && objective) {
        const validGoals = VALID_OPTIMIZATION_GOALS[objective] || [];
        if (projected.optimization_goal && !validGoals.includes(projected.optimization_goal)) {
          errors.push({
            field: 'optimization_goal',
            message: `${projected.optimization_goal} is not valid for ${objective}`,
            severity: 'error',
          });
        }

        const validDests = VALID_DESTINATION_TYPES[objective] || [];
        if (projected.destination_type && !validDests.includes(projected.destination_type)) {
          errors.push({
            field: 'destination_type',
            message: `${projected.destination_type} is not valid for ${objective}`,
            severity: 'error',
          });
        }
      }

      if (projected.daily_budget && projected.lifetime_budget) {
        errors.push({
          field: 'budget',
          message: 'Cannot have both daily_budget and lifetime_budget',
          severity: 'error',
        });
      }

      // Check required fields aren't being cleared
      for (const [field, value] of Object.entries(fieldUpdates)) {
        const config = registry[field];
        if (config?.required === true && (value === '' || value === null || value === undefined)) {
          errors.push({
            field,
            message: `${config.label} is required and cannot be empty`,
            severity: 'error',
          });
        }
      }

      if (errors.length > 0) {
        perEntityErrors[draft.id] = errors;
      }
    }

    return {
      valid: globalErrors.length === 0 && Object.keys(perEntityErrors).length === 0,
      perEntityErrors,
      globalErrors,
      globalWarnings,
    };
  }

  static applyBulkEdit(
    drafts: any[],
    fieldUpdates: Record<string, any>,
    level: EntityLevel,
  ): { draftId: string; updatedData: Record<string, any>; objective?: string }[] {
    const results: { draftId: string; updatedData: Record<string, any>; objective?: string }[] = [];

    for (const draft of drafts) {
      const existingData = draft.data || {};
      const updatedData = { ...existingData };
      let objective: string | undefined;

      for (const [field, value] of Object.entries(fieldUpdates)) {
        if (field === 'objective') {
          objective = value;
        } else if (value === '' || value === null) {
          delete updatedData[field];
        } else {
          updatedData[field] = value;
        }
      }

      // Handle incompatible fields
      if (fieldUpdates.daily_budget && updatedData.lifetime_budget) {
        delete updatedData.lifetime_budget;
      }
      if (fieldUpdates.lifetime_budget && updatedData.daily_budget) {
        delete updatedData.daily_budget;
      }

      results.push({ draftId: draft.id, updatedData, objective });
    }

    return results;
  }
}
