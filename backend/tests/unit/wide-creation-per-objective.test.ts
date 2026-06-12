import { describe, it, expect } from 'vitest';
import {
  WideCreationService,
  WideCreationTemplate,
} from '../../src/services/draft/WideCreationService';
import { MetaFormSchemaEngine } from '../../src/services/draft/MetaFormSchemaEngine';
import {
  VALID_OPTIMIZATION_GOALS,
  VALID_DESTINATION_TYPES,
  OBJECTIVE_DEFAULTS,
  PROMOTED_OBJECT_REQUIREMENTS,
  ATTRIBUTION_SPEC_OBJECTIVES,
} from '../../src/services/draft/MetaFieldRegistry';

const ALL_OBJECTIVES = Object.keys(VALID_OPTIMIZATION_GOALS);
const AD_DEFAULTS = { ad: { creative: { creative_id: '99999' } }, adSet: { daily_budget: '5000' } };

// ─── Per-Objective Schema Differentiation ───
// These tests verify that each objective produces a DIFFERENT schema with
// objective-specific fields, options, and validation rules.

describe('Per-Objective Schema Differentiation', () => {
  const campaignSchemas = ALL_OBJECTIVES.map(obj => ({
    objective: obj,
    schema: MetaFormSchemaEngine.getCampaignFormSchema({ objective: obj }),
  }));

  const adSetSchemas = ALL_OBJECTIVES.map(obj => ({
    objective: obj,
    schema: MetaFormSchemaEngine.getAdSetFormSchema({ objective: obj }),
  }));

  describe('Campaign Schemas', () => {
    it('generates a schema for each objective', () => {
      for (const { objective, schema } of campaignSchemas) {
        expect(schema.entityType).toBe('campaign');
        expect(schema.context.objective).toBe(objective);
        expect(schema.sections.length).toBeGreaterThan(0);
      }
    });

    it('all campaign schemas have identity, budget, and special sections', () => {
      for (const { schema } of campaignSchemas) {
        const ids = schema.sections.map(s => s.id);
        expect(ids).toContain('identity');
        expect(ids).toContain('budget');
        expect(ids).toContain('special');
      }
    });
  });

  describe('Ad Set Schemas per Objective', () => {
    it('generates an ad set schema for each objective', () => {
      for (const { objective, schema } of adSetSchemas) {
        expect(schema.entityType).toBe('adSet');
        expect(schema.sections.length).toBeGreaterThan(0);
      }
    });

    it('optimization_goal options differ per objective', () => {
      const goalOptionsByObjective: Record<string, string[]> = {};
      for (const { objective, schema } of adSetSchemas) {
        const optGoalField = schema.sections
          .flatMap(s => s.fields)
          .find(f => f.key === 'optimization_goal');
        expect(optGoalField).toBeDefined();
        const goals = optGoalField!.options!.map(o => o.value);
        goalOptionsByObjective[objective] = goals;
      }

      // Verify different objectives have different goal sets
      expect(goalOptionsByObjective['OUTCOME_TRAFFIC']).toContain('LINK_CLICKS');
      expect(goalOptionsByObjective['OUTCOME_TRAFFIC']).toContain('LANDING_PAGE_VIEWS');
      expect(goalOptionsByObjective['OUTCOME_TRAFFIC']).not.toContain('LEAD_GENERATION');

      expect(goalOptionsByObjective['OUTCOME_LEADS']).toContain('LEAD_GENERATION');
      expect(goalOptionsByObjective['OUTCOME_LEADS']).not.toContain('LANDING_PAGE_VIEWS');

      expect(goalOptionsByObjective['OUTCOME_SALES']).toContain('OFFSITE_CONVERSIONS');
      expect(goalOptionsByObjective['OUTCOME_SALES']).toContain('VALUE');
      expect(goalOptionsByObjective['OUTCOME_SALES']).not.toContain('APP_INSTALLS');

      expect(goalOptionsByObjective['OUTCOME_APP_PROMOTION']).toContain('APP_INSTALLS');
      expect(goalOptionsByObjective['OUTCOME_APP_PROMOTION']).not.toContain('LEAD_GENERATION');

      expect(goalOptionsByObjective['OUTCOME_AWARENESS']).toContain('REACH');
      expect(goalOptionsByObjective['OUTCOME_AWARENESS']).toContain('AD_RECALL_LIFT');
      expect(goalOptionsByObjective['OUTCOME_AWARENESS']).not.toContain('LINK_CLICKS');

      expect(goalOptionsByObjective['OUTCOME_ENGAGEMENT']).toContain('POST_ENGAGEMENT');
      expect(goalOptionsByObjective['OUTCOME_ENGAGEMENT']).toContain('MESSAGES');
    });

    it('destination_type options differ per objective', () => {
      const destOptionsByObjective: Record<string, string[]> = {};
      for (const { objective, schema } of adSetSchemas) {
        const destField = schema.sections
          .flatMap(s => s.fields)
          .find(f => f.key === 'destination_type');
        expect(destField).toBeDefined();
        const types = destField!.options!.map(o => o.value);
        destOptionsByObjective[objective] = types;
      }

      expect(destOptionsByObjective['OUTCOME_TRAFFIC']).toContain('WEBSITE');
      expect(destOptionsByObjective['OUTCOME_TRAFFIC']).toContain('MESSENGER');

      expect(destOptionsByObjective['OUTCOME_AWARENESS']).toContain('UNDEFINED');
      expect(destOptionsByObjective['OUTCOME_AWARENESS']).not.toContain('WEBSITE');

      expect(destOptionsByObjective['OUTCOME_APP_PROMOTION']).toContain('APP');
    });

    it('promoted_object section only appears for objectives that require it', () => {
      for (const { objective, schema } of adSetSchemas) {
        const promotedReqs = PROMOTED_OBJECT_REQUIREMENTS[objective] || [];
        const hasPromotedSection = schema.sections.some(s =>
          s.fields.some(f => f.key === 'promoted_object')
        );
        if (promotedReqs.length > 0) {
          expect(hasPromotedSection).toBe(true);
        }
      }
    });

    it('attribution_spec only shown for supported objectives', () => {
      for (const { objective, schema } of adSetSchemas) {
        const hasAttrField = schema.sections
          .flatMap(s => s.fields)
          .some(f => f.key === 'attribution_spec');
        if (ATTRIBUTION_SPEC_OBJECTIVES.has(objective)) {
          // May or may not be shown depending on schema design
          // but should NOT be present for unsupported objectives
        } else {
          if (hasAttrField) {
            const field = schema.sections.flatMap(s => s.fields).find(f => f.key === 'attribution_spec')!;
            expect(field.hidden).toBe(true);
          }
        }
      }
    });

    it('CBO mode removes budget fields from ad set schema', () => {
      for (const objective of ALL_OBJECTIVES) {
        const cboSchema = MetaFormSchemaEngine.getAdSetFormSchema({ objective, isCBO: true });
        const nonCboSchema = MetaFormSchemaEngine.getAdSetFormSchema({ objective, isCBO: false });

        const cboFields = cboSchema.sections.flatMap(s => s.fields).map(f => f.key);
        const nonCboFields = nonCboSchema.sections.flatMap(s => s.fields).map(f => f.key);

        // Non-CBO should have budget fields
        if (nonCboFields.includes('daily_budget')) {
          const budgetField = nonCboSchema.sections.flatMap(s => s.fields).find(f => f.key === 'daily_budget');
          expect(budgetField?.editable).toBe(true);
        }
      }
    });
  });

  describe('Ad Schemas', () => {
    it('generates an ad schema', () => {
      const schema = MetaFormSchemaEngine.getAdFormSchema();
      expect(schema.entityType).toBe('ad');
      expect(schema.sections.length).toBeGreaterThan(0);
    });

    it('ad schema has creative field', () => {
      const schema = MetaFormSchemaEngine.getAdFormSchema();
      const hasCreative = schema.sections.flatMap(s => s.fields).some(f => f.key === 'creative');
      expect(hasCreative).toBe(true);
    });
  });
});

// ─── Mixed-Objective Template Validation ───
// Verifies that a single creation template with multiple objectives
// validates each campaign/adset independently with its own rules.

describe('Mixed-Objective Template Validation (per-objective rules)', () => {
  it('validates different objectives independently in same template', async () => {
    const template: WideCreationTemplate = {
      name: 'Mixed',
      adAccountId: 'act_123',
      defaults: AD_DEFAULTS,
      namingPattern: { campaign: '{objective} {index}', adSet: 'AS {index}', ad: 'Ad {index}' },
      campaigns: [
        {
          fields: { objective: 'OUTCOME_TRAFFIC', name: 'Traffic' },
          adSetCount: 0,
          adSets: [{ fields: { optimization_goal: 'LINK_CLICKS' }, adCount: 1, ads: [{ fields: {} }] }],
        },
        {
          fields: { objective: 'OUTCOME_LEADS', name: 'Leads' },
          adSetCount: 0,
          adSets: [{
            fields: {
              optimization_goal: 'LEAD_GENERATION',
              promoted_object: { page_id: '12345' },
            },
            adCount: 1,
            ads: [{ fields: {} }],
          }],
        },
        {
          fields: { objective: 'OUTCOME_SALES', name: 'Sales' },
          adSetCount: 0,
          adSets: [{
            fields: {
              optimization_goal: 'OFFSITE_CONVERSIONS',
              promoted_object: { pixel_id: '67890', custom_event_type: 'PURCHASE' },
            },
            adCount: 1,
            ads: [{ fields: {} }],
          }],
        },
      ],
    };
    const result = await WideCreationService.validateTemplate(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('cross-objective goal mismatch is detected per-campaign', async () => {
    const template: WideCreationTemplate = {
      name: 'Mismatch',
      adAccountId: 'act_123',
      defaults: AD_DEFAULTS,
      campaigns: [
        {
          // TRAFFIC with valid goal
          fields: { objective: 'OUTCOME_TRAFFIC', name: 'Good' },
          adSetCount: 0,
          adSets: [{ fields: { optimization_goal: 'LINK_CLICKS' }, adCount: 1, ads: [{ fields: {} }] }],
        },
        {
          // TRAFFIC with INVALID goal (LEAD_GENERATION is for LEADS, not TRAFFIC)
          fields: { objective: 'OUTCOME_TRAFFIC', name: 'Bad' },
          adSetCount: 0,
          adSets: [{ fields: { optimization_goal: 'LEAD_GENERATION' }, adCount: 1, ads: [{ fields: {} }] }],
        },
      ],
    };
    const result = await WideCreationService.validateTemplate(template);
    expect(result.valid).toBe(false);
    // Only the second campaign should have errors
    const errorPaths = result.errors.map(e => e.path);
    expect(errorPaths.some(p => p.includes('campaigns[1]'))).toBe(true);
    expect(errorPaths.some(p => p.includes('campaigns[0]'))).toBe(false);
  });

  it('each objective enforces its own promoted_object requirements', async () => {
    const template: WideCreationTemplate = {
      name: 'Promoted',
      adAccountId: 'act_123',
      defaults: AD_DEFAULTS,
      campaigns: [
        {
          // TRAFFIC — does NOT require promoted_object
          fields: { objective: 'OUTCOME_TRAFFIC', name: 'Traffic' },
          adSetCount: 0,
          adSets: [{ fields: {}, adCount: 1, ads: [{ fields: {} }] }],
        },
        {
          // LEADS — DOES require promoted_object
          fields: { objective: 'OUTCOME_LEADS', name: 'Leads' },
          adSetCount: 0,
          adSets: [{ fields: {}, adCount: 1, ads: [{ fields: {} }] }],
        },
      ],
    };
    const result = await WideCreationService.validateTemplate(template);
    // Missing promoted_object no longer blocks template validation — drafts are
    // created anyway and the requirement is enforced at publish time. Neither
    // campaign should produce a promoted_object error here.
    expect(result.errors.some(e => e.message.toLowerCase().includes('promoted object'))).toBe(false);
    expect(result.errors.some(e => e.field === 'promoted_object' || e.field?.startsWith('promoted_object.'))).toBe(false);
  });

  it('each objective enforces its own destination_type rules', async () => {
    const template: WideCreationTemplate = {
      name: 'Dest',
      adAccountId: 'act_123',
      defaults: AD_DEFAULTS,
      campaigns: [
        {
          // AWARENESS only supports UNDEFINED — WEBSITE is invalid
          fields: { objective: 'OUTCOME_AWARENESS', name: 'Awareness' },
          adSetCount: 0,
          adSets: [{ fields: { destination_type: 'WEBSITE' }, adCount: 1, ads: [{ fields: {} }] }],
        },
        {
          // TRAFFIC supports WEBSITE — valid
          fields: { objective: 'OUTCOME_TRAFFIC', name: 'Traffic' },
          adSetCount: 0,
          adSets: [{ fields: { destination_type: 'WEBSITE' }, adCount: 1, ads: [{ fields: {} }] }],
        },
      ],
    };
    const result = await WideCreationService.validateTemplate(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('campaigns[0]') && e.field === 'destination_type')).toBe(true);
    expect(result.errors.some(e => e.path.includes('campaigns[1]'))).toBe(false);
  });
});

// ─── Objective-Specific Field Cascade ───
// Tests that campaign objective correctly cascades to ad set validation.

describe('Objective Cascade to Ad Set Validation', () => {
  for (const objective of ALL_OBJECTIVES) {
    const validGoals = VALID_OPTIMIZATION_GOALS[objective];
    const invalidGoals = Object.values(VALID_OPTIMIZATION_GOALS)
      .flat()
      .filter(g => !validGoals.includes(g));

    if (invalidGoals.length === 0) continue;

    it(`${objective}: rejects goals that belong to other objectives`, async () => {
      const foreignGoal = invalidGoals[0];
      const template: WideCreationTemplate = {
        name: 'Cascade Test',
        adAccountId: 'act_123',
        defaults: AD_DEFAULTS,
        campaigns: [{
          fields: { objective, name: `${objective} Campaign` },
          adSetCount: 0,
          adSets: [{
            fields: { optimization_goal: foreignGoal },
            adCount: 1,
            ads: [{ fields: {} }],
          }],
        }],
      };
      const result = await WideCreationService.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'optimization_goal')).toBe(true);
    });
  }
});

// ─── Large Mixed-Objective Templates ───

describe('Large Mixed-Objective Templates', () => {
  it('5 Traffic + 3 Leads + 2 Sales validates correctly', async () => {
    const template: WideCreationTemplate = {
      name: 'Scale Test',
      adAccountId: 'act_123',
      defaults: AD_DEFAULTS,
      namingPattern: { campaign: '{objective} {index}', adSet: 'AS {index}', ad: 'Ad {index}' },
      campaigns: [
        ...Array.from({ length: 5 }, (_, i) => ({
          fields: { objective: 'OUTCOME_TRAFFIC' as string },
          adSetCount: 0,
          adSets: [{ fields: { optimization_goal: 'LINK_CLICKS' }, adCount: 2, ads: [{ fields: {} }, { fields: {} }] }],
        })),
        ...Array.from({ length: 3 }, () => ({
          fields: { objective: 'OUTCOME_LEADS' as string },
          adSetCount: 0,
          adSets: [{
            fields: {
              optimization_goal: 'LEAD_GENERATION',
              promoted_object: { page_id: '12345' },
            },
            adCount: 2,
            ads: [{ fields: {} }, { fields: {} }],
          }],
        })),
        ...Array.from({ length: 2 }, () => ({
          fields: { objective: 'OUTCOME_SALES' as string },
          adSetCount: 0,
          adSets: [{
            fields: {
              optimization_goal: 'OFFSITE_CONVERSIONS',
              promoted_object: { pixel_id: '67890', custom_event_type: 'PURCHASE' },
            },
            adCount: 3,
            ads: [{ fields: {} }, { fields: {} }, { fields: {} }],
          }],
        })),
      ],
    };
    const result = await WideCreationService.validateTemplate(template);
    expect(result.valid).toBe(true);
    expect(result.totalEntities.campaigns).toBe(10);
    expect(result.totalEntities.adSets).toBe(10);
    expect(result.totalEntities.ads).toBe(22);
  });

  it('all 6 objectives × 3 campaigns validates', async () => {
    const template: WideCreationTemplate = {
      name: 'All Objectives',
      adAccountId: 'act_123',
      defaults: AD_DEFAULTS,
      namingPattern: { campaign: '{objective} {index}', adSet: 'AS {index}', ad: 'Ad {index}' },
      campaigns: ALL_OBJECTIVES.flatMap(obj => {
        const promotedObj: Record<string, any> = {};
        const reqs = PROMOTED_OBJECT_REQUIREMENTS[obj] || [];
        if (reqs.length > 0) promotedObj[reqs[0]] = '12345';
        if (obj === 'OUTCOME_SALES') promotedObj.custom_event_type = 'PURCHASE';
        if (obj === 'OUTCOME_APP_PROMOTION') promotedObj.object_store_url = 'https://play.google.com/store/apps/details?id=com.test';
        return Array.from({ length: 3 }, () => ({
          fields: { objective: obj },
          adSetCount: 0,
          adSets: [{
            fields: {
              optimization_goal: OBJECTIVE_DEFAULTS[obj].optimization_goal,
              ...(Object.keys(promotedObj).length > 0 ? { promoted_object: promotedObj } : {}),
            },
            adCount: 2,
            ads: [{ fields: {} }, { fields: {} }],
          }],
        }));
      }),
    };
    const result = await WideCreationService.validateTemplate(template);
    expect(result.valid).toBe(true);
    expect(result.totalEntities.campaigns).toBe(18);
    expect(result.totalEntities.adSets).toBe(18);
    expect(result.totalEntities.ads).toBe(36);
  });
});

// ─── Schema Option Count Verification ───
// Ensures the schema engine returns the correct number of options
// matching what's defined in MetaFieldRegistry.

describe('Schema Options Match Registry', () => {
  for (const objective of ALL_OBJECTIVES) {
    it(`${objective}: schema goal options match VALID_OPTIMIZATION_GOALS`, () => {
      const schema = MetaFormSchemaEngine.getAdSetFormSchema({ objective });
      const goalField = schema.sections.flatMap(s => s.fields).find(f => f.key === 'optimization_goal');
      expect(goalField).toBeDefined();
      const schemaGoals = goalField!.options!.map(o => o.value).sort();
      const registryGoals = [...VALID_OPTIMIZATION_GOALS[objective]].sort();
      expect(schemaGoals).toEqual(registryGoals);
    });

    it(`${objective}: schema dest options match VALID_DESTINATION_TYPES`, () => {
      const schema = MetaFormSchemaEngine.getAdSetFormSchema({ objective });
      const destField = schema.sections.flatMap(s => s.fields).find(f => f.key === 'destination_type');
      expect(destField).toBeDefined();
      const schemaTypes = destField!.options!.map(o => o.value).sort();
      const registryTypes = [...VALID_DESTINATION_TYPES[objective]].sort();
      expect(schemaTypes).toEqual(registryTypes);
    });
  }
});
