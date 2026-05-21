import { prisma } from '../../prisma';
import { DraftStatus } from '@prisma/client';
import {
  VALID_OPTIMIZATION_GOALS,
  VALID_DESTINATION_TYPES,
  OBJECTIVE_DEFAULTS,
  PROMOTED_OBJECT_REQUIREMENTS,
  ATTRIBUTION_SPEC_OBJECTIVES,
  BID_CAP_STRATEGIES,
  CAMPAIGN_FIELDS,
  sanitizeTargeting,
  sanitizePromotedObject,
} from './MetaFieldRegistry';
import { FieldOptimizationEngine } from './FieldOptimizationEngine';

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
  path: string; // e.g. "campaigns[0].adSets[1]"
  field?: string;
  message: string;
}

export interface WideValidationWarning {
  path: string;
  field?: string;
  message: string;
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

  static validateTemplate(template: WideCreationTemplate): WideValidationResult {
    const errors: WideValidationError[] = [];
    const warnings: WideValidationWarning[] = [];
    let totalAdSets = 0;
    let totalAds = 0;

    if (!template.campaigns || template.campaigns.length === 0) {
      errors.push({ path: 'template', message: 'At least one campaign is required' });
      return { valid: false, totalEntities: { campaigns: 0, adSets: 0, ads: 0 }, errors, warnings };
    }

    if (!template.adAccountId) {
      errors.push({ path: 'template', message: 'adAccountId is required' });
    }

    for (let ci = 0; ci < template.campaigns.length; ci++) {
      const campaign = template.campaigns[ci];
      const campaignPath = `campaigns[${ci}]`;

      // Resolve campaign fields with template defaults
      const campaignFields = resolveInheritedFields(
        campaign.fields,
        undefined,
        template.defaults?.campaign,
        Object.keys(CAMPAIGN_FIELDS),
      );

      // Validate campaign
      const objective = campaignFields.objective;
      if (!objective) {
        errors.push({ path: campaignPath, field: 'objective', message: 'Objective is required' });
      } else if (!VALID_OPTIMIZATION_GOALS[objective]) {
        errors.push({ path: campaignPath, field: 'objective', message: `Invalid objective: ${objective}` });
      }

      if (!campaignFields.name && !template.namingPattern?.campaign) {
        errors.push({ path: campaignPath, field: 'name', message: 'Campaign name or naming pattern is required' });
      }

      if (campaignFields.daily_budget && campaignFields.lifetime_budget) {
        warnings.push({ path: campaignPath, message: 'Both daily_budget and lifetime_budget set. daily_budget will be used.' });
      }

      // Determine CBO
      const isCBO = campaignFields.daily_budget || campaignFields.lifetime_budget || campaignFields.bid_strategy;

      // Validate ad sets
      const adSetCount = campaign.adSetCount || 0;
      if (adSetCount === 0 && (!campaign.adSets || campaign.adSets.length === 0)) {
        warnings.push({ path: campaignPath, message: 'Campaign has no ad sets defined' });
      }

      const adSetsToValidate: WideAdSetNode[] = campaign.adSets || Array.from({ length: adSetCount }, () => ({ fields: {}, adCount: 0, ads: [] }));
      totalAdSets += adSetsToValidate.length;

      for (let ai = 0; ai < adSetsToValidate.length; ai++) {
        const adSet = adSetsToValidate[ai];
        const adSetPath = `${campaignPath}.adSets[${ai}]`;

        // Resolve fields with inheritance
        const adSetFields = resolveInheritedFields(
          adSet.fields,
          campaignFields,
          template.defaults?.adSet,
          TEMPLATE_ADSET_INHERITABLE,
        );

        if (objective) {
          // Validate optimization_goal
          if (adSetFields.optimization_goal) {
            const validGoals = VALID_OPTIMIZATION_GOALS[objective] || [];
            if (!validGoals.includes(adSetFields.optimization_goal)) {
              errors.push({
                path: adSetPath,
                field: 'optimization_goal',
                message: `${adSetFields.optimization_goal} is not valid for ${objective}`,
              });
            }
          }

          // Validate destination_type
          if (adSetFields.destination_type && adSetFields.destination_type !== 'UNDEFINED') {
            const validTypes = VALID_DESTINATION_TYPES[objective] || [];
            if (!validTypes.includes(adSetFields.destination_type)) {
              errors.push({
                path: adSetPath,
                field: 'destination_type',
                message: `${adSetFields.destination_type} is not valid for ${objective}`,
              });
            }
          }

          // Check promoted_object requirements
          const promotedReqs = PROMOTED_OBJECT_REQUIREMENTS[objective] || [];
          if (promotedReqs.length > 0 && !adSetFields.promoted_object) {
            errors.push({
              path: adSetPath,
              field: 'promoted_object',
              message: `${objective} requires promoted_object with ${promotedReqs.join('/')}`,
            });
          }

          // Budget conflicts with CBO
          if (isCBO && (adSetFields.daily_budget || adSetFields.lifetime_budget)) {
            warnings.push({
              path: adSetPath,
              message: 'Campaign uses CBO — ad set budget fields will be stripped on publish',
            });
          }

          // Non-CBO campaigns require budget at ad set level
          if (!isCBO && !adSetFields.daily_budget && !adSetFields.lifetime_budget) {
            errors.push({
              path: adSetPath,
              field: 'daily_budget',
              message: 'Ad set requires daily_budget or lifetime_budget (campaign has no CBO budget)',
            });
          }

          // Bid cap without bid_amount
          if (adSetFields.bid_strategy && BID_CAP_STRATEGIES.has(adSetFields.bid_strategy) && !adSetFields.bid_amount) {
            errors.push({
              path: adSetPath,
              field: 'bid_amount',
              message: `${adSetFields.bid_strategy} requires bid_amount`,
            });
          }
        }

        // Validate ads
        const adCount = adSet.adCount || 0;
        const adsToValidate = adSet.ads || Array.from({ length: adCount }, () => ({ fields: {} }));
        totalAds += adsToValidate.length;

        for (let adi = 0; adi < adsToValidate.length; adi++) {
          const ad = adsToValidate[adi];
          const adPath = `${adSetPath}.ads[${adi}]`;

          const adFields = resolveInheritedFields(
            ad.fields,
            undefined,
            template.defaults?.ad,
            TEMPLATE_AD_INHERITABLE,
          );

          if (!adFields.creative && !adFields.creative_id) {
            errors.push({ path: adPath, field: 'creative', message: 'Creative (creative_id or object_story_spec) is required' });
          } else if (adFields.creative?.object_story_spec && !adFields.creative?.creative_id) {
            // object_story_spec needs page_id — check spec, adSet, or promoted_object
            const specPageId = adFields.creative.object_story_spec.page_id;
            const adSetPageId = adSetFields.page_id || adSetFields.promoted_object?.page_id;
            if (!specPageId && !adSetPageId) {
              errors.push({ path: adPath, field: 'page_id', message: 'page_id is required when using object_story_spec (set in adSet defaults or creative)' });
            }
          }
          if (!adFields.name && !template.namingPattern?.ad) {
            warnings.push({ path: adPath, message: 'Ad has no name configured' });
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
    userId: string,
  ): Promise<WideGenerationResult> {
    const campaignIds: string[] = [];
    const adSetIds: string[] = [];
    const adIds: string[] = [];
    const warnings: string[] = [];

    const adAccountId = template.adAccountId.startsWith('act_')
      ? template.adAccountId
      : `act_${template.adAccountId}`;

    // Wrap the entire generation in a single transaction so a mid-loop failure
    // does not leave orphaned campaigns/adsets in the DB. The 30s timeout
    // accommodates large templates (~500 entities); larger inputs are rejected
    // upstream at the controller.
    return prisma.$transaction(async (tx) => {
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
      const draftCampaign = await tx.draftCampaign.create({
        data: {
          userId,
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
        const draftAdSet = await tx.draftAdSet.create({
          data: {
            userId,
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
          const draftAd = await tx.draftAd.create({
            data: {
              userId,
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
    }, { timeout: 30_000, maxWait: 5_000 });
  }

  // ── Bulk update fields across multiple entities with inheritance ──

  static async bulkApplyFields(
    entityIds: string[],
    entityType: 'campaign' | 'adSet' | 'ad',
    fieldUpdates: Record<string, any>,
    cascadeToChildren: boolean = false,
    userId?: string,
  ): Promise<{ updated: number; cascaded: number; warnings: string[] }> {
    let updated = 0;
    let cascaded = 0;
    const warnings: string[] = [];

    for (const id of entityIds) {
      if (entityType === 'campaign') {
        const existing = userId
          ? await prisma.draftCampaign.findFirst({ where: { id, userId } })
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
        const existing = userId
          ? await prisma.draftAdSet.findFirst({ where: { id, campaign: { userId } } })
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
        const existing = userId
          ? await prisma.draftAd.findFirst({ where: { id, adSet: { campaign: { userId } } } })
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

  static async getTreeStructure(campaignIds: string[], userId?: string): Promise<any[]> {
    return prisma.draftCampaign.findMany({
      where: userId ? { id: { in: campaignIds }, userId } : { id: { in: campaignIds } },
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
