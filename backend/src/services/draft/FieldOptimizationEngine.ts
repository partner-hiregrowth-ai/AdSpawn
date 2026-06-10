import {
  CAMPAIGN_FIELDS,
  ADSET_FIELDS,
  AD_FIELDS,
  FieldConfig,
  VALID_OPTIMIZATION_GOALS,
  VALID_DESTINATION_TYPES,
  PROMOTED_OBJECT_REQUIREMENTS,
  ATTRIBUTION_SPEC_OBJECTIVES,
  BID_CAP_STRATEGIES,
  COST_CAP_INCOMPATIBLE_GOALS,
  VALID_BUYING_TYPES,
  OBJECTIVE_DEFAULTS,
  OPTIMIZATION_GOAL_LABELS,
  DESTINATION_TYPE_LABELS,
  READ_ONLY_FIELDS,
  stripReadOnlyFields,
  sanitizePromotedObject,
  sanitizeTargeting,
  migrateOptimizationGoal,
  migrateDestinationType,
} from './MetaFieldRegistry';

// ─── Types ───

export type FieldAction = 'kept' | 'removed' | 'transformed' | 'locked' | 'auto_mapped' | 'added';

export interface OptimizedField {
  field: string;
  label: string;
  action: FieldAction;
  reason?: string;
  originalValue?: any;
  newValue: any;
  editable: boolean;
  type: FieldConfig['type'];
  enumValues?: string[];
  enumLabels?: Record<string, string>;
}

export interface OptimizationResult {
  entityType: 'campaign' | 'adSet' | 'ad';
  fields: OptimizedField[];
  payload: Record<string, any>;
  warnings: string[];
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Engine ───

export class FieldOptimizationEngine {

  // ── Optimize a campaign for duplication ──

  static optimizeCampaignForDuplication(
    sourceData: Record<string, any>,
    overrides?: Record<string, any>,
  ): OptimizationResult {
    const cleaned = stripReadOnlyFields(sourceData);
    const fields: OptimizedField[] = [];
    const warnings: string[] = [];
    const payload: Record<string, any> = {};
    const objective = overrides?.objective || cleaned.objective;

    for (const [key, config] of Object.entries(CAMPAIGN_FIELDS)) {
      const sourceVal = cleaned[key];
      const overrideVal = overrides?.[key];
      const value = overrideVal !== undefined ? overrideVal : sourceVal;

      if (key === 'status') {
        payload.status = 'PAUSED';
        fields.push({
          field: key, label: config.label, action: 'locked',
          reason: 'Always created as PAUSED', originalValue: sourceVal,
          newValue: 'PAUSED', editable: false, type: config.type,
          enumValues: config.enumValues, enumLabels: config.enumLabels,
        });
        continue;
      }

      if (key === 'is_adset_budget_sharing_enabled') continue;

      if (key === 'buying_type') {
        if ((VALID_BUYING_TYPES[objective] || []).length <= 1) continue;
      }

      if (value !== undefined && value !== null) {
        payload[key] = value;
        fields.push({
          field: key, label: config.label,
          action: overrideVal !== undefined ? 'transformed' : 'kept',
          originalValue: sourceVal, newValue: value,
          editable: key !== 'objective',
          type: config.type,
          enumValues: config.enumValues, enumLabels: config.enumLabels,
        });
      }
    }

    if (payload.daily_budget && payload.lifetime_budget) {
      delete payload.lifetime_budget;
      warnings.push('Both daily_budget and lifetime_budget were set. Kept daily_budget only.');
    }

    return { entityType: 'campaign', fields, payload, warnings, errors: [] };
  }

  // ── Optimize an ad set for duplication ──

  static optimizeAdSetForDuplication(
    sourceData: Record<string, any>,
    campaignObjective: string,
    isCBO: boolean,
    overrides?: Record<string, any>,
  ): OptimizationResult {
    const cleaned = stripReadOnlyFields(sourceData);
    const fields: OptimizedField[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const payload: Record<string, any> = {};

    const validGoals = VALID_OPTIMIZATION_GOALS[campaignObjective] || [];
    const validDestTypes = VALID_DESTINATION_TYPES[campaignObjective] || [];

    for (const [key, config] of Object.entries(ADSET_FIELDS)) {
      if (key === 'campaign_id') continue;
      const sourceVal = cleaned[key];
      const overrideVal = overrides?.[key];
      let value = overrideVal !== undefined ? overrideVal : sourceVal;

      if (key === 'status') {
        payload.status = 'PAUSED';
        fields.push({
          field: key, label: config.label, action: 'locked',
          reason: 'Always created as PAUSED', originalValue: sourceVal,
          newValue: 'PAUSED', editable: false, type: config.type,
        });
        continue;
      }

      if (key === 'optimization_goal') {
        const migration = migrateOptimizationGoal(value || '', campaignObjective);
        value = migration.goal;
        payload[key] = value;
        fields.push({
          field: key, label: config.label,
          action: migration.migrated ? 'auto_mapped' : 'kept',
          reason: migration.reason, originalValue: sourceVal, newValue: value,
          editable: true, type: 'enum',
          enumValues: validGoals, enumLabels: OPTIMIZATION_GOAL_LABELS,
        });
        continue;
      }

      if (key === 'destination_type') {
        const migration = migrateDestinationType(value, campaignObjective);
        value = migration.type;
        payload[key] = value;
        fields.push({
          field: key, label: config.label,
          action: migration.migrated ? 'auto_mapped' : 'kept',
          reason: migration.reason, originalValue: sourceVal, newValue: value,
          editable: true, type: 'enum',
          enumValues: validDestTypes, enumLabels: DESTINATION_TYPE_LABELS,
        });
        continue;
      }

      if (key === 'promoted_object') {
        const required = PROMOTED_OBJECT_REQUIREMENTS[campaignObjective] || [];
        const sanitized = sanitizePromotedObject(value);
        if (required.length > 0) {
          if (sanitized) {
            payload[key] = sanitized;
            fields.push({
              field: key, label: config.label, action: 'kept',
              originalValue: sourceVal, newValue: sanitized,
              editable: false, type: 'object',
            });
          } else {
            errors.push(`promoted_object with ${required.join('/')} is required for ${campaignObjective}`);
            fields.push({
              field: key, label: config.label, action: 'removed',
              reason: `Required for ${campaignObjective} but missing from source`,
              originalValue: sourceVal, newValue: undefined,
              editable: false, type: 'object',
            });
          }
        } else if (sanitized) {
          payload[key] = sanitized;
          fields.push({
            field: key, label: config.label, action: 'kept',
            originalValue: sourceVal, newValue: sanitized,
            editable: false, type: 'object',
          });
        }
        continue;
      }

      if (key === 'targeting') {
        const sanitized = sanitizeTargeting(value);
        payload[key] = sanitized;
        fields.push({
          field: key, label: config.label, action: 'kept',
          originalValue: sourceVal, newValue: sanitized,
          editable: false, type: 'object',
        });
        continue;
      }

      if (key === 'attribution_spec') {
        if (value && !ATTRIBUTION_SPEC_OBJECTIVES.has(campaignObjective)) {
          fields.push({
            field: key, label: config.label, action: 'removed',
            reason: `Not supported for ${campaignObjective}`,
            originalValue: sourceVal, newValue: undefined,
            editable: false, type: 'object',
          });
          continue;
        }
      }

      if (isCBO && (key === 'daily_budget' || key === 'lifetime_budget' || key === 'bid_strategy' || key === 'bid_amount')) {
        if (value) {
          fields.push({
            field: key, label: config.label, action: 'removed',
            reason: 'Campaign uses CBO — budget managed at campaign level',
            originalValue: sourceVal, newValue: undefined,
            editable: false, type: config.type,
          });
        }
        continue;
      }

      if (value !== undefined && value !== null) {
        payload[key] = value;
        fields.push({
          field: key, label: config.label,
          action: overrideVal !== undefined ? 'transformed' : 'kept',
          originalValue: sourceVal, newValue: value,
          editable: config.mutability === 'mutable',
          type: config.type,
          enumValues: config.enumValues, enumLabels: config.enumLabels,
        });
      }
    }

    if (payload.daily_budget && payload.lifetime_budget) {
      delete payload.lifetime_budget;
      warnings.push('Both budgets set — kept daily_budget only.');
    }

    if (BID_CAP_STRATEGIES.has(payload.bid_strategy) && payload.bid_strategy !== 'LOWEST_COST_WITH_MIN_ROAS' && !payload.bid_amount) {
      warnings.push(`${payload.bid_strategy} requires bid_amount. Falling back to LOWEST_COST_WITHOUT_CAP.`);
      payload.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
    }

    return { entityType: 'adSet', fields, payload, warnings, errors };
  }

  // ── Optimize an ad for duplication ──

  static optimizeAdForDuplication(
    sourceData: Record<string, any>,
    overrides?: Record<string, any>,
  ): OptimizationResult {
    const cleaned = stripReadOnlyFields(sourceData);
    const fields: OptimizedField[] = [];
    const warnings: string[] = [];
    const payload: Record<string, any> = {};

    for (const [key, config] of Object.entries(AD_FIELDS)) {
      if (key === 'adset_id') continue;
      const sourceVal = cleaned[key];
      const overrideVal = overrides?.[key];
      const value = overrideVal !== undefined ? overrideVal : sourceVal;

      if (key === 'status') {
        payload.status = 'PAUSED';
        fields.push({
          field: key, label: config.label, action: 'locked',
          reason: 'Always created as PAUSED', originalValue: sourceVal,
          newValue: 'PAUSED', editable: false, type: config.type,
        });
        continue;
      }

      if (key === 'creative') {
        const creativeId = value?.id || value?.creative_id;
        if (creativeId) {
          payload.creative = { creative_id: String(creativeId) };
        } else if (value?.object_story_spec || value?.asset_feed_spec) {
          payload.creative = { ...value };
          delete payload.creative.id;
          delete payload.creative.creative_type;
        } else {
          warnings.push('No creative_id or inline creative found. Ad may fail to create.');
        }
        fields.push({
          field: key, label: config.label, action: 'kept',
          originalValue: sourceVal, newValue: payload.creative,
          editable: false, type: 'object',
        });
        continue;
      }

      if (value !== undefined && value !== null) {
        payload[key] = value;
        fields.push({
          field: key, label: config.label,
          action: overrideVal !== undefined ? 'transformed' : 'kept',
          originalValue: sourceVal, newValue: value,
          editable: config.mutability === 'mutable',
          type: config.type,
        });
      }
    }

    return { entityType: 'ad', fields, payload, warnings, errors: [] };
  }

  // ── Optimize for objective conversion ──
  // Returns the full optimization result for a campaign+adSets+ads tree conversion

  static optimizeCampaignForConversion(
    campaignData: Record<string, any>,
    targetObjective: string,
    newName: string,
  ): OptimizationResult {
    const result = this.optimizeCampaignForDuplication(campaignData, {
      objective: targetObjective,
      name: newName,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    });

    const validBuyingTypes = VALID_BUYING_TYPES[targetObjective] || ['AUCTION'];

    for (const f of result.fields) {
      if (f.field === 'objective' && f.originalValue !== targetObjective) {
        f.action = 'transformed';
        f.reason = `Changed from ${f.originalValue} to ${targetObjective}`;
        f.editable = true;
        f.enumValues = CAMPAIGN_FIELDS.objective.enumValues;
        f.enumLabels = CAMPAIGN_FIELDS.objective.enumLabels;
      }
      if (f.field === 'bid_strategy') {
        f.action = 'auto_mapped';
        f.reason = 'Reset to safest strategy for conversion';
      }
      if (f.field === 'buying_type' && !validBuyingTypes.includes(f.newValue)) {
        f.originalValue = f.newValue;
        f.newValue = 'AUCTION';
        f.action = 'auto_mapped';
        f.reason = `${f.originalValue} not supported for ${targetObjective}, reset to AUCTION`;
        result.payload.buying_type = 'AUCTION';
      }
    }

    return result;
  }

  static optimizeAdSetForConversion(
    adSetData: Record<string, any>,
    targetObjective: string,
    isCBO: boolean,
    pageId?: string,
  ): OptimizationResult {
    const result = this.optimizeAdSetForDuplication(
      adSetData, targetObjective, isCBO,
    );

    if (targetObjective === 'OUTCOME_LEADS' && pageId) {
      result.payload.promoted_object = { page_id: pageId };
      const existingField = result.fields.find(f => f.field === 'promoted_object');
      if (existingField) {
        existingField.newValue = result.payload.promoted_object;
        existingField.action = 'auto_mapped';
        existingField.reason = 'page_id inherited from ad creative';
      }
    }

    if (targetObjective === 'OUTCOME_ENGAGEMENT') {
      const engagementPageId = adSetData.promoted_object?.page_id || pageId;
      if (engagementPageId) {
        result.payload.promoted_object = { page_id: engagementPageId };
      }
    }

    return result;
  }

  // ── Apply user overrides to an existing optimization result ──

  static applyOverrides(
    result: OptimizationResult,
    overrides: Record<string, any>,
    campaignObjective?: string,
  ): OptimizationResult {
    const updated = { ...result, payload: { ...result.payload }, warnings: [...result.warnings], errors: [...result.errors] };

    for (const [field, value] of Object.entries(overrides)) {
      const existingField = updated.fields.find(f => f.field === field);
      if (!existingField || !existingField.editable) continue;

      existingField.newValue = value;
      existingField.action = 'transformed';
      updated.payload[field] = value;
    }

    return this.revalidateResult(updated, campaignObjective);
  }

  // ── Revalidate after overrides ──

  private static revalidateResult(
    result: OptimizationResult,
    campaignObjective?: string,
  ): OptimizationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const { payload } = result;

    if (result.entityType === 'campaign') {
      if (payload.daily_budget && payload.lifetime_budget) {
        errors.push('Cannot set both daily_budget and lifetime_budget');
      }
    }

    if (result.entityType === 'adSet' && campaignObjective) {
      const validGoals = VALID_OPTIMIZATION_GOALS[campaignObjective] || [];
      if (payload.optimization_goal && !validGoals.includes(payload.optimization_goal)) {
        errors.push(`${payload.optimization_goal} is not valid for ${campaignObjective}`);
      }

      const validDests = VALID_DESTINATION_TYPES[campaignObjective] || [];
      if (payload.destination_type && !validDests.includes(payload.destination_type)) {
        errors.push(`${payload.destination_type} is not valid for ${campaignObjective}`);
      }

      const required = PROMOTED_OBJECT_REQUIREMENTS[campaignObjective] || [];
      if (required.length > 0 && !payload.promoted_object) {
        errors.push(`promoted_object with ${required.join('/')} is required for ${campaignObjective}`);
      } else if (required.length > 0 && payload.promoted_object) {
        const hasRequired = required.some(f => payload.promoted_object[f]);
        if (!hasRequired) {
          errors.push(`promoted_object must include ${required.join(' or ')} for ${campaignObjective}`);
        }
      }

      if (BID_CAP_STRATEGIES.has(payload.bid_strategy) && payload.bid_strategy !== 'LOWEST_COST_WITH_MIN_ROAS' && !payload.bid_amount) {
        warnings.push(`${payload.bid_strategy} requires bid_amount`);
      }

      if (payload.bid_strategy === 'COST_CAP' && COST_CAP_INCOMPATIBLE_GOALS.has(payload.optimization_goal)) {
        errors.push(`${payload.optimization_goal} is not compatible with COST_CAP. Use a different optimization goal or switch to LOWEST_COST_WITHOUT_CAP.`);
      }

      if (payload.daily_budget && payload.lifetime_budget) {
        errors.push('Cannot set both daily_budget and lifetime_budget on an ad set');
      }
    }

    return { ...result, errors, warnings };
  }

  // ── Validate a final payload before sending to Meta ──

  static validatePayload(
    entityType: 'campaign' | 'adSet' | 'ad',
    payload: Record<string, any>,
    campaignObjective?: string,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const registry =
      entityType === 'campaign' ? CAMPAIGN_FIELDS :
      entityType === 'adSet'   ? ADSET_FIELDS :
      AD_FIELDS;

    for (const [key, config] of Object.entries(registry)) {
      if (config.required === true && !payload[key] && key !== 'status') {
        if (key === 'campaign_id' || key === 'adset_id') continue;
        errors.push(`${config.label} (${key}) is required`);
      }
    }

    if (entityType === 'campaign' && payload.objective && payload.buying_type) {
      const validTypes = VALID_BUYING_TYPES[payload.objective] || ['AUCTION'];
      if (!validTypes.includes(payload.buying_type)) {
        errors.push(`Buying type ${payload.buying_type === 'RESERVED' ? 'Reach & Frequency' : payload.buying_type} is not supported for ${payload.objective}`);
      }
    }

    if (entityType === 'adSet' && campaignObjective) {
      const validGoals = VALID_OPTIMIZATION_GOALS[campaignObjective] || [];
      if (payload.optimization_goal && !validGoals.includes(payload.optimization_goal)) {
        errors.push(`Optimization goal ${payload.optimization_goal} is invalid for ${campaignObjective}`);
      }
    }

    for (const key of Object.keys(payload)) {
      if (READ_ONLY_FIELDS.has(key)) {
        warnings.push(`${key} is read-only and will be stripped`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
