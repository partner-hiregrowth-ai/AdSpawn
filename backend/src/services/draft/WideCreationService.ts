import { prisma } from '../../prisma';
import { DraftStatus } from '@prisma/client';
import {
  VALID_OPTIMIZATION_GOALS,
  OBJECTIVE_DEFAULTS,
  CAMPAIGN_FIELDS,
  PROMOTED_OBJECT_REQUIREMENTS,
  ATTRIBUTION_SPEC_OBJECTIVES,
  sanitizeTargeting,
  sanitizePromotedObject,
} from './MetaFieldRegistry';
import { FieldOptimizationEngine } from './FieldOptimizationEngine';
import { DraftValidationEngine, ValidationError } from './DraftValidationEngine';

// ─── Types ───

export interface NamingPattern {
  template: string; // e.g. "{objective}_{index:02d}" or "Campaign {n}"
}

export interface WideAdNode {
  fields: Record<string, any>;
  inherit?: Record<string, 'adset' | 'template' | 'custom'>;
}

export interface WideAdSetNode {
  fields: Record<string, any>;
  inherit?: Record<string, 'campaign' | 'template' | 'custom'>;
  adCount: number;
  ads?: WideAdNode[];
}

export interface WideCampaignNode {
  fields: Record<string, any>;
  adSetCount: number;
  adSets?: WideAdSetNode[];
}

export interface WideCreationTemplate {
  name: string;
  adAccountId: string;
  defaults?: {
    campaign?: Record<string, any>;
    adSet?: Record<string, any>;
    ad?: Record<string, any>;
  };
  namingPattern?: {
    campaign?: string;
    adSet?: string;
    ad?: string;
  };
  campaigns: WideCampaignNode[];
}

export interface WideValidationResult {
  valid: boolean;
  totalEntities: { campaigns: number; adSets: number; ads: number };
  errors: WideValidationError[];
  warnings: WideValidationWarning[];
}

export interface WideValidationError {
  path: string;
  field?: string;
  message: string;
  entityLabel?: string;
}

export interface WideValidationWarning {
  path: string;
  field?: string;
  message: string;
  entityLabel?: string;
}

export interface WideGenerationResult {
  campaignIds: string[];
  adSetIds: string[];
  adIds: string[];
  totalCreated: { campaigns: number; adSets: number; ads: number };
  warnings: string[];
}

// ─── Naming Resolution ───

function resolveNamingPattern(
  pattern: string | undefined,
  context: { index: number; objective?: string; parentName?: string; total: number },
): string {
  if (!pattern) {
    return `Entity ${context.index + 1}`;
  }

  let name = pattern;
  name = name.replace(/\{index\}/g, String(context.index + 1));
  name = name.replace(/\{index:02d\}/g, String(context.index + 1).padStart(2, '0'));
  name = name.replace(/\{index:03d\}/g, String(context.index + 1).padStart(3, '0'));
  name = name.replace(/\{n\}/g, String(context.index + 1));
  name = name.replace(/\{total\}/g, String(context.total));
  name = name.replace(/\{objective\}/g, context.objective || 'UNKNOWN');
  name = name.replace(/\{parent\}/g, context.parentName || '');

  return name;
}

// ─── Inheritance Resolution ───

function resolveInheritedFields(
  entityFields: Record<string, any>,
  parentFields: Record<string, any> | undefined,
  templateDefaults: Record<string, any> | undefined,
  inheritableKeys: string[],
): Record<string, any> {
  const resolved: Record<string, any> = { ...entityFields };

  for (const key of inheritableKeys) {
    if (resolved[key] !== undefined) continue;
    if (parentFields && parentFields[key] !== undefined) {
      resolved[key] = parentFields[key];
    } else if (templateDefaults && templateDefaults[key] !== undefined) {
      resolved[key] = templateDefaults[key];
    }
  }

  return resolved;
}

// Keys that can cascade from campaign to adset
const CAMPAIGN_TO_ADSET_INHERITABLE = [
  'targeting', 'billing_event', 'start_time', 'end_time',
];

// Keys that can be set at template level for adsets
const TEMPLATE_ADSET_INHERITABLE = [
  'targeting', 'billing_event', 'optimization_goal', 'destination_type',
  'daily_budget', 'lifetime_budget', 'start_time', 'end_time',
  'promoted_object', 'page_id',
];

// Keys that can be set at template level for ads
const TEMPLATE_AD_INHERITABLE = [
  'creative', 'tracking_specs', 'url_parameters',
];

// ─── Service ───

export class WideCreationService {

  // ── Validate entire template tree without persisting ──
  // Delegates entity-level checks to DraftValidationEngine for consistency
  // with the draft editor and publish flows.

  static async validateTemplate(template: WideCreationTemplate): Promise<WideValidationResult> {
    const errors: WideValidationError[] = [];
    const warnings: WideValidationWarning[] = [];
    let totalAdSets = 0;
    let totalAds = 0;

    if (!template.campaigns || template.campaigns.length === 0) {
      errors.push({ path: 'template', message: 'At least one campaign is required.', entityLabel: 'Template' });
      return { valid: false, totalEntities: { campaigns: 0, adSets: 0, ads: 0 }, errors, warnings };
    }

    if (!template.adAccountId) {
      errors.push({ path: 'template', message: 'Ad account is required. Select an ad account before validating.', entityLabel: 'Template' });
    }

    for (let ci = 0; ci < template.campaigns.length; ci++) {
      const campaign = template.campaigns[ci];

      const campaignFields = resolveInheritedFields(
        campaign.fields,
        undefined,
        template.defaults?.campaign,
        Object.keys(CAMPAIGN_FIELDS),
      );

      const objective = campaignFields.objective;
      const campaignName = campaignFields.name || resolveNamingPattern(
        template.namingPattern?.campaign,
        { index: ci, objective: objective || 'UNKNOWN', total: template.campaigns.length },
      );
      const campaignPath = `campaigns[${ci}]`;
      const campaignLabel = campaignName || `Campaign ${ci + 1}`;

      if (!objective) {
        errors.push({ path: campaignPath, field: 'objective', message: 'Campaign objective is required.', entityLabel: campaignLabel });
      } else if (!VALID_OPTIMIZATION_GOALS[objective]) {
        errors.push({ path: campaignPath, field: 'objective', message: `"${objective}" is not a recognized campaign objective.`, entityLabel: campaignLabel });
      }

      if (!campaignFields.name && !template.namingPattern?.campaign) {
        errors.push({ path: campaignPath, field: 'name', message: 'Campaign name or naming pattern is required.', entityLabel: campaignLabel });
      }

      const isCBO = !!(campaignFields.daily_budget || campaignFields.lifetime_budget);

      // Build synthetic campaign for DraftValidationEngine
      const syntheticCampaignData = {
        ...campaignFields,
        name: campaignName,
        objective: objective || '',
        status: 'PAUSED',
        special_ad_categories: campaignFields.special_ad_categories || ['NONE'],
      };

      const adSetsToValidate: WideAdSetNode[] = campaign.adSets || Array.from(
        { length: campaign.adSetCount || 1 },
        () => ({ fields: {}, adCount: 1 } as WideAdSetNode),
      );
      totalAdSets += adSetsToValidate.length;

      const syntheticAdSets: any[] = [];

      for (let ai = 0; ai < adSetsToValidate.length; ai++) {
        const adSet = adSetsToValidate[ai];
        const adSetFields = resolveInheritedFields(
          adSet.fields,
          campaignFields,
          template.defaults?.adSet,
          TEMPLATE_ADSET_INHERITABLE,
        );

        const defaults = objective ? OBJECTIVE_DEFAULTS[objective] : undefined;
        const adSetName = adSetFields.name || resolveNamingPattern(
          template.namingPattern?.adSet,
          { index: ai, objective: objective || '', parentName: campaignName, total: adSetsToValidate.length },
        );

        const syntheticAdSetData: Record<string, any> = {
          name: adSetName,
          optimization_goal: adSetFields.optimization_goal || defaults?.optimization_goal,
          billing_event: adSetFields.billing_event || defaults?.billing_event || 'IMPRESSIONS',
          destination_type: adSetFields.destination_type || defaults?.destination_type,
          targeting: adSetFields.targeting || { geo_locations: { countries: ['TH'] }, age_min: 20 },
          status: 'PAUSED',
        };

        if (!isCBO) {
          if (adSetFields.daily_budget) syntheticAdSetData.daily_budget = adSetFields.daily_budget;
          if (adSetFields.lifetime_budget && !adSetFields.daily_budget) syntheticAdSetData.lifetime_budget = adSetFields.lifetime_budget;
          if (adSetFields.bid_strategy) syntheticAdSetData.bid_strategy = adSetFields.bid_strategy;
          if (adSetFields.bid_amount) syntheticAdSetData.bid_amount = adSetFields.bid_amount;
        } else if (adSetFields.daily_budget || adSetFields.lifetime_budget) {
          const adSetPath = `${campaignPath}.adSets[${ai}]`;
          const adSetLabel = `${campaignLabel} > ${adSetFields.name || resolveNamingPattern(template.namingPattern?.adSet, { index: ai, objective: objective || '', parentName: campaignName, total: adSetsToValidate.length })}`;
          warnings.push({ path: adSetPath, field: 'budget', message: 'Ad set budgets are ignored under CBO campaigns. Budget is managed at campaign level.', entityLabel: adSetLabel });
        }
        if (adSetFields.promoted_object) syntheticAdSetData.promoted_object = adSetFields.promoted_object;
        if (adSetFields.attribution_spec) syntheticAdSetData.attribution_spec = adSetFields.attribution_spec;
        if (adSetFields.start_time) syntheticAdSetData.start_time = adSetFields.start_time;
        if (adSetFields.end_time) syntheticAdSetData.end_time = adSetFields.end_time;
        if (adSetFields.dsa_beneficiary) syntheticAdSetData.dsa_beneficiary = adSetFields.dsa_beneficiary;
        if (adSetFields.dsa_payor) syntheticAdSetData.dsa_payor = adSetFields.dsa_payor;

        const adsToValidate = adSet.ads || Array.from({ length: adSet.adCount || 1 }, () => ({ fields: {} }));
        totalAds += adsToValidate.length;

        const syntheticAds: any[] = [];
        for (let adi = 0; adi < adsToValidate.length; adi++) {
          const ad = adsToValidate[adi];
          const adFields = resolveInheritedFields(
            ad.fields,
            undefined,
            template.defaults?.ad,
            TEMPLATE_AD_INHERITABLE,
          );
          const adName = adFields.name || resolveNamingPattern(
            template.namingPattern?.ad,
            { index: adi, objective: objective || '', parentName: adSetName, total: adsToValidate.length },
          );
          syntheticAds.push({
            id: `wide-ad-${ci}-${ai}-${adi}`,
            name: adName,
            data: { name: adName, status: 'PAUSED', creative: adFields.creative, tracking_specs: adFields.tracking_specs },
            metaId: null,
          });
        }

        syntheticAdSets.push({
          id: `wide-adset-${ci}-${ai}`,
          name: adSetName,
          data: syntheticAdSetData,
          metaId: null,
          ads: syntheticAds,
        });
      }

      const syntheticCampaign = {
        id: `wide-campaign-${ci}`,
        name: campaignName,
        objective: objective || '',
        data: syntheticCampaignData,
        metaId: null,
        adSets: syntheticAdSets,
      };

      // Run DraftValidationEngine for full cross-entity validation
      if (objective) {
        const result = await DraftValidationEngine.validateFullDraft(syntheticCampaign);

        for (const err of result.campaignErrors) {
          const entry = { path: campaignPath, field: err.field, message: err.message, entityLabel: campaignLabel };
          if (err.severity === 'error') errors.push(entry);
          else warnings.push(entry);
        }

        for (const [synId, adSetErrs] of Object.entries(result.adSetErrors)) {
          const ai = syntheticAdSets.findIndex(s => s.id === synId);
          const adSetPath = `${campaignPath}.adSets[${ai}]`;
          const adSetLabel = `${campaignLabel} > ${syntheticAdSets[ai]?.name || `Ad Set ${ai + 1}`}`;
          for (const err of adSetErrs) {
            const entry = { path: adSetPath, field: err.field, message: err.message, entityLabel: adSetLabel };
            if (err.severity === 'error') errors.push(entry);
            else warnings.push(entry);
          }
        }

        for (const [synId, adErrs] of Object.entries(result.adErrors)) {
          const parts = synId.replace('wide-ad-', '').split('-');
          const ai = parseInt(parts[1], 10);
          const adi = parseInt(parts[2], 10);
          const adPath = `${campaignPath}.adSets[${ai}].ads[${adi}]`;
          const adLabel = `${campaignLabel} > ${syntheticAdSets[ai]?.name || `Ad Set ${ai + 1}`} > ${syntheticAdSets[ai]?.ads[adi]?.name || `Ad ${adi + 1}`}`;
          for (const err of adErrs) {
            // Creative is intentionally absent at template/draft-creation time — skip it here.
            // The DraftValidationEngine enforces it at publish time.
            if (err.field === 'creative') continue;
            const entry = { path: adPath, field: err.field, message: err.message, entityLabel: adLabel };
            if (err.severity === 'error') errors.push(entry);
            else warnings.push(entry);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      totalEntities: { campaigns: template.campaigns.length, adSets: totalAdSets, ads: totalAds },
      errors,
      warnings,
    };
  }

  // ── Generate draft entities from template ──

  static async generateFromTemplate(
    template: WideCreationTemplate,
    profileId: string,
  ): Promise<WideGenerationResult> {
    const campaignIds: string[] = [];
    const adSetIds: string[] = [];
    const adIds: string[] = [];
    const warnings: string[] = [];

    const adAccountId = template.adAccountId.startsWith('act_')
      ? template.adAccountId
      : `act_${template.adAccountId}`;

    // Sequential creates with manual rollback on failure — avoids single-transaction
    // timeout risk on large templates. On error, any campaigns already written are
    // deleted (cascade removes their adSets and ads automatically).
    try {
      for (let ci = 0; ci < template.campaigns.length; ci++) {
      const campaignNode = template.campaigns[ci];

      // Resolve campaign fields
      const resolvedCampaignFields = resolveInheritedFields(
        campaignNode.fields,
        undefined,
        template.defaults?.campaign,
        Object.keys(CAMPAIGN_FIELDS),
      );

      const objective = resolvedCampaignFields.objective || 'OUTCOME_TRAFFIC';
      const defaults = OBJECTIVE_DEFAULTS[objective];

      // Generate campaign name
      const campaignName = resolvedCampaignFields.name || resolveNamingPattern(
        template.namingPattern?.campaign,
        { index: ci, objective, total: template.campaigns.length },
      );

      // Build campaign payload
      const campaignPayload: Record<string, any> = {
        name: campaignName,
        objective,
        status: 'PAUSED',
        special_ad_categories: resolvedCampaignFields.special_ad_categories || ['NONE'],
      };

      if (resolvedCampaignFields.bid_strategy) campaignPayload.bid_strategy = resolvedCampaignFields.bid_strategy;
      if (resolvedCampaignFields.daily_budget) campaignPayload.daily_budget = resolvedCampaignFields.daily_budget;
      if (resolvedCampaignFields.lifetime_budget && !resolvedCampaignFields.daily_budget) {
        campaignPayload.lifetime_budget = resolvedCampaignFields.lifetime_budget;
      }
      if (resolvedCampaignFields.spend_cap) campaignPayload.spend_cap = resolvedCampaignFields.spend_cap;
      if (resolvedCampaignFields.buying_type) campaignPayload.buying_type = resolvedCampaignFields.buying_type;

      const isCBO = !!(campaignPayload.daily_budget || campaignPayload.lifetime_budget);

      // Create draft campaign
      const draftCampaign = await prisma.draftCampaign.create({
        data: {
          profileId,
          adAccountId,
          name: campaignName,
          objective,
          data: campaignPayload,
          status: DraftStatus.DRAFT,
        },
      });
      campaignIds.push(draftCampaign.id);

      // Generate ad sets
      const adSets = campaignNode.adSets || Array.from(
        { length: campaignNode.adSetCount || 1 },
        () => ({ fields: {}, adCount: 1 } as WideAdSetNode),
      );

      for (let ai = 0; ai < adSets.length; ai++) {
        const adSetNode = adSets[ai];

        // Resolve adset fields with inheritance
        const resolvedAdSetFields = resolveInheritedFields(
          adSetNode.fields,
          resolvedCampaignFields,
          template.defaults?.adSet,
          TEMPLATE_ADSET_INHERITABLE,
        );

        // Generate adset name
        const adSetName = resolvedAdSetFields.name || resolveNamingPattern(
          template.namingPattern?.adSet,
          { index: ai, objective, parentName: campaignName, total: adSets.length },
        );

        // Build adset payload
        const adSetPayload: Record<string, any> = {
          name: adSetName,
          optimization_goal: resolvedAdSetFields.optimization_goal || defaults.optimization_goal,
          billing_event: resolvedAdSetFields.billing_event || defaults.billing_event,
          destination_type: resolvedAdSetFields.destination_type || defaults.destination_type,
          targeting: sanitizeTargeting(resolvedAdSetFields.targeting),
          status: 'PAUSED',
        };

        // Budget (only if non-CBO)
        if (!isCBO) {
          if (resolvedAdSetFields.daily_budget) adSetPayload.daily_budget = resolvedAdSetFields.daily_budget;
          if (resolvedAdSetFields.lifetime_budget && !resolvedAdSetFields.daily_budget) {
            adSetPayload.lifetime_budget = resolvedAdSetFields.lifetime_budget;
          }
          if (resolvedAdSetFields.bid_strategy) adSetPayload.bid_strategy = resolvedAdSetFields.bid_strategy;
          if (resolvedAdSetFields.bid_amount) adSetPayload.bid_amount = resolvedAdSetFields.bid_amount;
        }

        // Promoted object
        const promotedReqs = PROMOTED_OBJECT_REQUIREMENTS[objective] || [];
        if (resolvedAdSetFields.promoted_object) {
          const sanitized = sanitizePromotedObject(resolvedAdSetFields.promoted_object);
          if (sanitized) adSetPayload.promoted_object = sanitized;
        } else if (promotedReqs.length > 0) {
          warnings.push(`${adSetName}: promoted_object required for ${objective} but not provided`);
        }

        // Attribution spec
        if (resolvedAdSetFields.attribution_spec && ATTRIBUTION_SPEC_OBJECTIVES.has(objective)) {
          adSetPayload.attribution_spec = resolvedAdSetFields.attribution_spec;
        }

        // page_id for ad creative injection at publish time
        if (resolvedAdSetFields.page_id) {
          adSetPayload.page_id = resolvedAdSetFields.page_id;
        }

        // Time
        if (resolvedAdSetFields.start_time) adSetPayload.start_time = resolvedAdSetFields.start_time;
        if (resolvedAdSetFields.end_time) adSetPayload.end_time = resolvedAdSetFields.end_time;

        // Create draft adset
        const draftAdSet = await prisma.draftAdSet.create({
          data: {
            profileId,
            adAccountId,
            draftCampaignId: draftCampaign.id,
            name: adSetName,
            data: adSetPayload,
            status: DraftStatus.DRAFT,
          },
        });
        adSetIds.push(draftAdSet.id);

        // Generate ads
        const ads = adSetNode.ads || Array.from(
          { length: adSetNode.adCount || 1 },
          () => ({ fields: {} } as WideAdNode),
        );

        for (let adi = 0; adi < ads.length; adi++) {
          const adNode = ads[adi];

          const resolvedAdFields = resolveInheritedFields(
            adNode.fields,
            undefined,
            template.defaults?.ad,
            TEMPLATE_AD_INHERITABLE,
          );

          // Generate ad name
          const adName = resolvedAdFields.name || resolveNamingPattern(
            template.namingPattern?.ad,
            { index: adi, objective, parentName: adSetName, total: ads.length },
          );

          // Build ad payload
          const adPayload: Record<string, any> = {
            name: adName,
            status: 'PAUSED',
          };

          if (resolvedAdFields.creative) adPayload.creative = resolvedAdFields.creative;
          if (resolvedAdFields.tracking_specs) adPayload.tracking_specs = resolvedAdFields.tracking_specs;
          if (resolvedAdFields.url_parameters) adPayload.url_parameters = resolvedAdFields.url_parameters;

          // Create draft ad
          const draftAd = await prisma.draftAd.create({
            data: {
              profileId,
              adAccountId,
              draftAdSetId: draftAdSet.id,
              name: adName,
              data: adPayload,
              status: DraftStatus.DRAFT,
            },
          });
          adIds.push(draftAd.id);
        }
      }
    }

      return {
        campaignIds,
        adSetIds,
        adIds,
        totalCreated: {
          campaigns: campaignIds.length,
          adSets: adSetIds.length,
          ads: adIds.length,
        },
        warnings,
      };
    } catch (err) {
      // Roll back any campaigns already created (cascade deletes adsets + ads).
      if (campaignIds.length > 0) {
        await prisma.draftCampaign.deleteMany({ where: { id: { in: campaignIds } } }).catch(() => {});
      }
      throw err;
    }
  }

  // ── Bulk update fields across multiple entities with inheritance ──

  static async bulkApplyFields(
    entityIds: string[],
    entityType: 'campaign' | 'adSet' | 'ad',
    fieldUpdates: Record<string, any>,
    cascadeToChildren: boolean = false,
    profileId?: string,
  ): Promise<{ updated: number; cascaded: number; warnings: string[] }> {
    let updated = 0;
    let cascaded = 0;
    const warnings: string[] = [];

    for (const id of entityIds) {
      if (entityType === 'campaign') {
        const existing = profileId
          ? await prisma.draftCampaign.findFirst({ where: { id, profileId } })
          : await prisma.draftCampaign.findUnique({ where: { id } });
        if (!existing) continue;
        const existingData = existing.data as Record<string, any>;
        const newData = { ...existingData, ...fieldUpdates };
        await prisma.draftCampaign.update({
          where: { id },
          data: {
            data: newData,
            name: fieldUpdates.name || existing.name,
            objective: fieldUpdates.objective || existing.objective,
          },
        });
        updated++;

        if (cascadeToChildren) {
          const adSets = await prisma.draftAdSet.findMany({ where: { draftCampaignId: id } });
          for (const adSet of adSets) {
            const adSetData = adSet.data as Record<string, any>;
            const cascadeUpdates: Record<string, any> = {};
            for (const key of CAMPAIGN_TO_ADSET_INHERITABLE) {
              if (fieldUpdates[key] !== undefined) {
                cascadeUpdates[key] = fieldUpdates[key];
              }
            }
            if (Object.keys(cascadeUpdates).length > 0) {
              await prisma.draftAdSet.update({
                where: { id: adSet.id },
                data: { data: { ...adSetData, ...cascadeUpdates } },
              });
              cascaded++;
            }
          }
        }
      } else if (entityType === 'adSet') {
        const existing = profileId
          ? await prisma.draftAdSet.findFirst({ where: { id, campaign: { profileId } } })
          : await prisma.draftAdSet.findUnique({ where: { id } });
        if (!existing) continue;
        const existingData = existing.data as Record<string, any>;
        const newData = { ...existingData, ...fieldUpdates };
        await prisma.draftAdSet.update({
          where: { id },
          data: {
            data: newData,
            name: fieldUpdates.name || existing.name,
          },
        });
        updated++;
      } else {
        const existing = profileId
          ? await prisma.draftAd.findFirst({ where: { id, adSet: { campaign: { profileId } } } })
          : await prisma.draftAd.findUnique({ where: { id } });
        if (!existing) continue;
        const existingData = existing.data as Record<string, any>;
        const newData = { ...existingData, ...fieldUpdates };
        await prisma.draftAd.update({
          where: { id },
          data: {
            data: newData,
            name: fieldUpdates.name || existing.name,
          },
        });
        updated++;
      }
    }

    return { updated, cascaded, warnings };
  }

  // ── Get tree structure of a generated set ──

  static async getTreeStructure(campaignIds: string[], profileId?: string): Promise<any[]> {
    return prisma.draftCampaign.findMany({
      where: profileId ? { id: { in: campaignIds }, profileId } : { id: { in: campaignIds } },
      include: {
        adSets: {
          include: {
            ads: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
