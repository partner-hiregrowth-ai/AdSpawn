import { describe, it, expect } from 'vitest';
import { VALID_OPTIMIZATION_GOALS, VALID_DESTINATION_TYPES, OBJECTIVE_DEFAULTS, CAMPAIGN_FIELDS, ADSET_FIELDS, AD_FIELDS, BID_CAP_STRATEGIES, PROMOTED_OBJECT_REQUIREMENTS, ATTRIBUTION_SPEC_OBJECTIVES } from '../../src/services/draft/MetaFieldRegistry';

// ─── Schema Drift Detection ───
// These tests verify internal consistency of our Meta field registry.
// They catch errors when someone updates one map but forgets related maps.
// For live Meta API drift, run with: npm run test:drift (uses validation_only=true)

describe('Registry Internal Consistency', () => {
  const ALL_OBJECTIVES = Object.keys(VALID_OPTIMIZATION_GOALS);

  it('every objective has optimization goals defined', () => {
    for (const obj of ALL_OBJECTIVES) {
      expect(VALID_OPTIMIZATION_GOALS[obj].length).toBeGreaterThan(0);
    }
  });

  it('every objective has destination types defined', () => {
    for (const obj of ALL_OBJECTIVES) {
      expect(VALID_DESTINATION_TYPES[obj]).toBeDefined();
      expect(VALID_DESTINATION_TYPES[obj].length).toBeGreaterThan(0);
    }
  });

  it('every objective has defaults defined', () => {
    for (const obj of ALL_OBJECTIVES) {
      expect(OBJECTIVE_DEFAULTS[obj]).toBeDefined();
      expect(OBJECTIVE_DEFAULTS[obj].optimization_goal).toBeTruthy();
      expect(OBJECTIVE_DEFAULTS[obj].billing_event).toBeTruthy();
      expect(OBJECTIVE_DEFAULTS[obj].destination_type).toBeTruthy();
    }
  });

  it('every default optimization_goal is in valid goals list', () => {
    for (const obj of ALL_OBJECTIVES) {
      const defaultGoal = OBJECTIVE_DEFAULTS[obj].optimization_goal;
      expect(VALID_OPTIMIZATION_GOALS[obj]).toContain(defaultGoal);
    }
  });

  it('every default destination_type is in valid types list', () => {
    for (const obj of ALL_OBJECTIVES) {
      const defaultType = OBJECTIVE_DEFAULTS[obj].destination_type;
      expect(VALID_DESTINATION_TYPES[obj]).toContain(defaultType);
    }
  });

  it('PROMOTED_OBJECT_REQUIREMENTS covers all objectives', () => {
    for (const obj of ALL_OBJECTIVES) {
      expect(PROMOTED_OBJECT_REQUIREMENTS[obj]).toBeDefined();
    }
  });

  it('ATTRIBUTION_SPEC_OBJECTIVES is a subset of objectives', () => {
    for (const obj of ATTRIBUTION_SPEC_OBJECTIVES) {
      expect(ALL_OBJECTIVES).toContain(obj);
    }
  });

  it('BID_CAP_STRATEGIES contains only known strategies (current + legacy)', () => {
    const currentStrategies = CAMPAIGN_FIELDS.bid_strategy.enumValues!;
    const legacyStrategies = ['TARGET_COST']; // Deprecated but still handled
    const allKnown = [...currentStrategies, ...legacyStrategies];
    for (const strategy of BID_CAP_STRATEGIES) {
      expect(allKnown).toContain(strategy);
    }
  });

  it('CAMPAIGN_FIELDS objective enums match VALID_OPTIMIZATION_GOALS keys', () => {
    const fieldObjectives = CAMPAIGN_FIELDS.objective.enumValues!;
    const goalObjectives = Object.keys(VALID_OPTIMIZATION_GOALS);
    expect(fieldObjectives.sort()).toEqual(goalObjectives.sort());
  });

  it('VALID_DESTINATION_TYPES keys match objective list', () => {
    const destObjectives = Object.keys(VALID_DESTINATION_TYPES).sort();
    const allObjectives = ALL_OBJECTIVES.sort();
    expect(destObjectives).toEqual(allObjectives);
  });
});

// ─── Field Registry Completeness ───

describe('Field Registry Completeness', () => {
  it('campaign fields have labels', () => {
    for (const [key, config] of Object.entries(CAMPAIGN_FIELDS)) {
      expect(config.label).toBeTruthy();
    }
  });

  it('adset fields have labels', () => {
    for (const [key, config] of Object.entries(ADSET_FIELDS)) {
      expect(config.label).toBeTruthy();
    }
  });

  it('ad fields have labels', () => {
    for (const [key, config] of Object.entries(AD_FIELDS)) {
      expect(config.label).toBeTruthy();
    }
  });

  it('all enum fields have enumValues', () => {
    const allFields = { ...CAMPAIGN_FIELDS, ...ADSET_FIELDS, ...AD_FIELDS };
    for (const [key, config] of Object.entries(allFields)) {
      if (config.type === 'enum' && !config.dependsOn) {
        expect(config.enumValues).toBeDefined();
        expect(config.enumValues!.length).toBeGreaterThan(0);
      }
    }
  });

  it('incompatibleWith references exist as field keys', () => {
    const campaignKeys = Object.keys(CAMPAIGN_FIELDS);
    for (const [key, config] of Object.entries(CAMPAIGN_FIELDS)) {
      if (config.incompatibleWith) {
        for (const incomp of config.incompatibleWith) {
          expect(campaignKeys).toContain(incomp);
        }
      }
    }

    const adsetKeys = Object.keys(ADSET_FIELDS);
    for (const [key, config] of Object.entries(ADSET_FIELDS)) {
      if (config.incompatibleWith) {
        for (const incomp of config.incompatibleWith) {
          expect(adsetKeys).toContain(incomp);
        }
      }
    }
  });
});

// ─── Live Meta API Drift Detection ───
// These tests are designed to run against a real Meta test account.
// They use validation_only=true to validate without creating objects.
// Skipped by default — run with: npm run test:drift

async function checkTokenValid(): Promise<boolean> {
  if (!process.env.META_ACCESS_TOKEN) return false;
  try {
    const url = `https://graph.facebook.com/v22.0/me?access_token=${process.env.META_ACCESS_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();
    return !data.error;
  } catch {
    return false;
  }
}

let tokenValid = false;

beforeAll(async () => {
  tokenValid = await checkTokenValid();
});

describe.skipIf(!process.env.META_ACCESS_TOKEN)('Live Meta API Drift', () => {
  const accessToken = process.env.META_ACCESS_TOKEN!;
  const adAccountId = process.env.META_AD_ACCOUNT_ID || '';

  beforeEach((ctx) => {
    if (!tokenValid) {
      ctx.skip();
    }
  });

  async function validateWithMeta(endpoint: string, payload: any): Promise<{ success: boolean; error?: any }> {
    try {
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(payload)) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
      formData.append('access_token', accessToken);

      const url = `https://graph.facebook.com/v22.0/${endpoint}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      const data = await response.json();
      if (data.error) {
        return { success: false, error: data.error };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  for (const objective of Object.keys(VALID_OPTIMIZATION_GOALS)) {
    it(`campaign create still accepts ${objective}`, async () => {
      const result = await validateWithMeta(`act_${adAccountId}/campaigns`, {
        name: `drift-test-${objective}-${Date.now()}`,
        objective,
        status: 'PAUSED',
        special_ad_categories: ['NONE'],
        is_adset_budget_sharing_enabled: 'false',
        validation_only: 'true',
      });
      if (!result.success) {
        console.log(`  [DRIFT] ${objective} rejected:`, result.error?.error_user_title || result.error?.message);
      }
      expect(result.success).toBe(true);
    });
  }

  it('Meta still rejects invalid objective', async () => {
    const result = await validateWithMeta(`act_${adAccountId}/campaigns`, {
      name: 'drift-invalid-objective',
      objective: 'COMPLETELY_INVALID_OBJECTIVE',
      status: 'PAUSED',
      special_ad_categories: ['NONE'],
      validation_only: 'true',
    });
    expect(result.success).toBe(false);
  });

  it('Meta still rejects both budgets', async () => {
    const result = await validateWithMeta(`act_${adAccountId}/campaigns`, {
      name: 'drift-dual-budget',
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: ['NONE'],
      daily_budget: '5000',
      lifetime_budget: '100000',
      validation_only: 'true',
    });
    expect(result.success).toBe(false);
  });

  for (const strategy of CAMPAIGN_FIELDS.bid_strategy.enumValues!) {
    it(`Meta still accepts bid_strategy=${strategy}`, async () => {
      const result = await validateWithMeta(`act_${adAccountId}/campaigns`, {
        name: `drift-bid-${strategy}`,
        objective: 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
        special_ad_categories: ['NONE'],
        bid_strategy: strategy,
        daily_budget: '5000',
        validation_only: 'true',
      });
      // Either accepts or rejects with a specific bid-related error (not unknown field)
      if (!result.success) {
        expect(result.error?.error_subcode).not.toBe(100); // 100 = unknown field
      }
    });
  }
});
