import { describe, it, expect } from 'vitest';
import {
  VALID_OPTIMIZATION_GOALS,
  VALID_DESTINATION_TYPES,
  OBJECTIVE_DEFAULTS,
  PROMOTED_OBJECT_REQUIREMENTS,
  BID_CAP_STRATEGIES,
  ATTRIBUTION_SPEC_OBJECTIVES,
  migrateOptimizationGoal,
  migrateDestinationType,
  stripReadOnlyFields,
  sanitizePromotedObject,
  sanitizeTargeting,
  READ_ONLY_FIELDS,
} from '../../src/services/draft/MetaFieldRegistry';
import { FieldOptimizationEngine } from '../../src/services/draft/FieldOptimizationEngine';
import { ADSET_FIXTURES } from '../fixtures/meta-entities';

const ALL_OBJECTIVES = Object.keys(VALID_OPTIMIZATION_GOALS);
const ALL_GOALS = [...new Set(Object.values(VALID_OPTIMIZATION_GOALS).flat())];
const ALL_DEST_TYPES = [...new Set(Object.values(VALID_DESTINATION_TYPES).flat())];

// ─── Optimization Goal Compatibility Matrix ───

describe('Optimization Goal × Objective Matrix', () => {
  for (const objective of ALL_OBJECTIVES) {
    const validGoals = VALID_OPTIMIZATION_GOALS[objective];
    const promotedReqs = PROMOTED_OBJECT_REQUIREMENTS[objective] || [];

    describe(`${objective}`, () => {
      for (const goal of validGoals) {
        it(`accepts ${goal}`, () => {
          const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
            {
              optimization_goal: goal,
              billing_event: 'IMPRESSIONS',
              targeting: { geo_locations: { countries: ['TH'] } },
              ...(promotedReqs.length ? { promoted_object: { [promotedReqs[0]]: '12345' } } : {}),
            },
            objective,
            false,
          );
          expect(result.errors).toHaveLength(0);
          expect(result.payload.optimization_goal).toBe(goal);
        });
      }

      const invalidGoals = ALL_GOALS.filter(g => !validGoals.includes(g));
      for (const invalidGoal of invalidGoals) {
        it(`migrates invalid ${invalidGoal}`, () => {
          const migration = migrateOptimizationGoal(invalidGoal, objective);
          expect(validGoals).toContain(migration.goal);
          if (migration.migrated) {
            expect(migration.reason).toBeDefined();
          }
        });
      }
    });
  }
});

// ─── Destination Type × Objective Matrix ───

describe('Destination Type × Objective Matrix', () => {
  for (const objective of ALL_OBJECTIVES) {
    const validTypes = VALID_DESTINATION_TYPES[objective];

    describe(`${objective}`, () => {
      for (const destType of validTypes) {
        // UNDEFINED is treated as "no value" by migrateDestinationType — it returns fallback without flagging migration
        if (destType === 'UNDEFINED') {
          it(`handles UNDEFINED (returns fallback)`, () => {
            const migration = migrateDestinationType(destType, objective);
            expect(validTypes).toContain(migration.type);
          });
          continue;
        }

        it(`accepts ${destType}`, () => {
          const migration = migrateDestinationType(destType, objective);
          expect(migration.type).toBe(destType);
          expect(migration.migrated).toBe(false);
        });
      }

      const invalidTypes = ALL_DEST_TYPES.filter(t => !validTypes.includes(t) && t !== 'UNDEFINED');
      for (const invalidType of invalidTypes) {
        it(`migrates invalid ${invalidType}`, () => {
          const migration = migrateDestinationType(invalidType, objective);
          expect(validTypes).toContain(migration.type);
          expect(migration.migrated).toBe(true);
          expect(migration.reason).toBeDefined();
        });
      }
    });
  }
});

// ─── Promoted Object Requirements ───

describe('Promoted Object Requirements', () => {
  for (const objective of ALL_OBJECTIVES) {
    const required = PROMOTED_OBJECT_REQUIREMENTS[objective] || [];

    it(`${objective} requires [${required.join(', ') || 'none'}]`, () => {
      if (required.length === 0) {
        const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
          {
            optimization_goal: OBJECTIVE_DEFAULTS[objective].optimization_goal,
            billing_event: 'IMPRESSIONS',
            targeting: { geo_locations: { countries: ['TH'] } },
          },
          objective,
          false,
        );
        expect(result.errors).toHaveLength(0);
      } else {
        // Without promoted_object → should produce error
        const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
          {
            optimization_goal: OBJECTIVE_DEFAULTS[objective].optimization_goal,
            billing_event: 'IMPRESSIONS',
            targeting: { geo_locations: { countries: ['TH'] } },
          },
          objective,
          false,
        );
        const hasPromotedObjectError = result.errors.some(e => e.includes('promoted_object'));
        expect(hasPromotedObjectError).toBe(true);
      }
    });

    if (required.length > 0) {
      it(`${objective} accepts valid promoted_object`, () => {
        const promotedObject: Record<string, string> = {};
        for (const field of required) {
          promotedObject[field] = '12345678';
        }
        const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
          {
            optimization_goal: OBJECTIVE_DEFAULTS[objective].optimization_goal,
            billing_event: 'IMPRESSIONS',
            targeting: { geo_locations: { countries: ['TH'] } },
            promoted_object: promotedObject,
          },
          objective,
          false,
        );
        const hasPromotedObjectError = result.errors.some(e => e.includes('promoted_object'));
        expect(hasPromotedObjectError).toBe(false);
        expect(result.payload.promoted_object).toBeDefined();
      });
    }
  }
});

// ─── Bid Strategy × Bid Amount Dependencies ───

describe('Bid Strategy Requires bid_amount', () => {
  // LOWEST_COST_WITH_MIN_ROAS uses bid_constraints (roas_average_floor), NOT bid_amount
  const bidAmountStrategies = [...BID_CAP_STRATEGIES].filter(s => s !== 'LOWEST_COST_WITH_MIN_ROAS');
  const nonCapStrategies = ['LOWEST_COST_WITHOUT_CAP'];

  for (const strategy of bidAmountStrategies) {
    it(`${strategy} warns when bid_amount is missing`, () => {
      const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
        {
          optimization_goal: 'LINK_CLICKS',
          billing_event: 'IMPRESSIONS',
          targeting: { geo_locations: { countries: ['TH'] } },
          bid_strategy: strategy,
        },
        'OUTCOME_TRAFFIC',
        false,
      );
      const hasBidWarning = result.warnings.some(w => w.includes('bid_amount') || w.includes('LOWEST_COST'));
      expect(hasBidWarning).toBe(true);
    });

    it(`${strategy} passes with bid_amount`, () => {
      const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
        {
          optimization_goal: 'LINK_CLICKS',
          billing_event: 'IMPRESSIONS',
          targeting: { geo_locations: { countries: ['TH'] } },
          bid_strategy: strategy,
          bid_amount: '1500',
        },
        'OUTCOME_TRAFFIC',
        false,
      );
      const hasBidWarning = result.warnings.some(w => w.includes('bid_amount'));
      expect(hasBidWarning).toBe(false);
      expect(result.payload.bid_strategy).toBe(strategy);
    });
  }

  it('LOWEST_COST_WITH_MIN_ROAS passes without bid_amount (uses bid_constraints)', () => {
    const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
      {
        optimization_goal: 'LINK_CLICKS',
        billing_event: 'IMPRESSIONS',
        targeting: { geo_locations: { countries: ['TH'] } },
        bid_strategy: 'LOWEST_COST_WITH_MIN_ROAS',
        bid_constraints: { roas_average_floor: 100 },
      },
      'OUTCOME_TRAFFIC',
      false,
    );
    const hasBidWarning = result.warnings.some(w => w.includes('bid_amount') || w.includes('LOWEST_COST'));
    expect(hasBidWarning).toBe(false);
    expect(result.payload.bid_strategy).toBe('LOWEST_COST_WITH_MIN_ROAS');
  });

  it('LOWEST_COST_WITH_MIN_ROAS without bid_amount or bid_constraints does not fall back to LOWEST_COST_WITHOUT_CAP', () => {
    const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
      {
        optimization_goal: 'LINK_CLICKS',
        billing_event: 'IMPRESSIONS',
        targeting: { geo_locations: { countries: ['TH'] } },
        bid_strategy: 'LOWEST_COST_WITH_MIN_ROAS',
      },
      'OUTCOME_TRAFFIC',
      false,
    );
    // Should preserve the strategy even without bid_constraints; Meta will validate server-side
    expect(result.payload.bid_strategy).toBe('LOWEST_COST_WITH_MIN_ROAS');
  });

  for (const strategy of nonCapStrategies) {
    it(`${strategy} does not require bid_amount`, () => {
      const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
        {
          optimization_goal: 'LINK_CLICKS',
          billing_event: 'IMPRESSIONS',
          targeting: { geo_locations: { countries: ['TH'] } },
          bid_strategy: strategy,
        },
        'OUTCOME_TRAFFIC',
        false,
      );
      const hasBidWarning = result.warnings.some(w => w.includes('bid_amount'));
      expect(hasBidWarning).toBe(false);
    });
  }
});

// ─── Attribution Spec per Objective ───

describe('Attribution Spec Objective Support', () => {
  for (const objective of ALL_OBJECTIVES) {
    const supported = ATTRIBUTION_SPEC_OBJECTIVES.has(objective);

    it(`${objective} ${supported ? 'supports' : 'strips'} attribution_spec`, () => {
      const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
        {
          optimization_goal: OBJECTIVE_DEFAULTS[objective].optimization_goal,
          billing_event: 'IMPRESSIONS',
          targeting: { geo_locations: { countries: ['TH'] } },
          attribution_spec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
          ...(PROMOTED_OBJECT_REQUIREMENTS[objective]?.length ? {
            promoted_object: { [PROMOTED_OBJECT_REQUIREMENTS[objective][0]]: '12345' },
          } : {}),
        },
        objective,
        false,
      );

      if (supported) {
        expect(result.payload.attribution_spec).toBeDefined();
      } else {
        expect(result.payload.attribution_spec).toBeUndefined();
        const stripped = result.fields.find(f => f.field === 'attribution_spec');
        if (stripped) expect(stripped.action).toBe('removed');
      }
    });
  }
});

// ─── CBO Budget Handling ───

describe('CBO Budget Handling', () => {
  const budgetFields = ['daily_budget', 'lifetime_budget', 'bid_strategy', 'bid_amount'];

  for (const objective of ALL_OBJECTIVES) {
    it(`${objective} with CBO strips ad set budget fields`, () => {
      const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
        {
          optimization_goal: OBJECTIVE_DEFAULTS[objective].optimization_goal,
          billing_event: 'IMPRESSIONS',
          targeting: { geo_locations: { countries: ['TH'] } },
          daily_budget: '5000',
          bid_strategy: 'COST_CAP',
          bid_amount: '1500',
          ...(PROMOTED_OBJECT_REQUIREMENTS[objective]?.length ? {
            promoted_object: { [PROMOTED_OBJECT_REQUIREMENTS[objective][0]]: '12345' },
          } : {}),
        },
        objective,
        true, // isCBO = true
      );

      for (const field of budgetFields) {
        expect(result.payload[field]).toBeUndefined();
      }
    });

    it(`${objective} without CBO keeps ad set budget fields`, () => {
      const result = FieldOptimizationEngine.optimizeAdSetForDuplication(
        {
          optimization_goal: OBJECTIVE_DEFAULTS[objective].optimization_goal,
          billing_event: 'IMPRESSIONS',
          targeting: { geo_locations: { countries: ['TH'] } },
          daily_budget: '5000',
          ...(PROMOTED_OBJECT_REQUIREMENTS[objective]?.length ? {
            promoted_object: { [PROMOTED_OBJECT_REQUIREMENTS[objective][0]]: '12345' },
          } : {}),
        },
        objective,
        false, // isCBO = false
      );

      expect(result.payload.daily_budget).toBe('5000');
    });
  }
});

// ─── Read-Only Field Stripping ───

describe('Read-Only Field Stripping', () => {
  const readOnlyFields = [...READ_ONLY_FIELDS];

  it('strips all read-only fields from campaign data', () => {
    const data: Record<string, any> = { name: 'test', objective: 'OUTCOME_TRAFFIC' };
    for (const field of readOnlyFields) {
      data[field] = 'should-be-removed';
    }
    const cleaned = stripReadOnlyFields(data);
    for (const field of readOnlyFields) {
      expect(cleaned[field]).toBeUndefined();
    }
    expect(cleaned.name).toBe('test');
    expect(cleaned.objective).toBe('OUTCOME_TRAFFIC');
  });
});

// ─── Targeting Sanitization ───

describe('Targeting Sanitization', () => {
  it('preserves valid targeting', () => {
    const targeting = { geo_locations: { countries: ['TH', 'US'] }, age_min: 25, age_max: 55 };
    const sanitized = sanitizeTargeting(targeting);
    expect(sanitized.geo_locations.countries).toEqual(['TH', 'US']);
    expect(sanitized.age_min).toBe(25);
  });

  it('adds default geo_locations when missing', () => {
    const sanitized = sanitizeTargeting({});
    expect(sanitized.geo_locations).toEqual({ countries: ['TH'] });
  });

  it('adds default geo_locations when null', () => {
    const sanitized = sanitizeTargeting(null);
    expect(sanitized.geo_locations).toEqual({ countries: ['TH'] });
  });

  it('strips targeting read-only fields', () => {
    const targeting = {
      geo_locations: { countries: ['TH'] },
      id: 'should-strip',
      targeting_automation: { some: 'thing' },
      contextual_targeting_options: true,
    };
    const sanitized = sanitizeTargeting(targeting);
    expect(sanitized.id).toBeUndefined();
    expect(sanitized.targeting_automation).toEqual({ some: 'thing' });
    expect(sanitized.contextual_targeting_options).toBeUndefined();
  });
});

// ─── Promoted Object Sanitization ───

describe('Promoted Object Sanitization', () => {
  it('strips promoted_object read-only fields', () => {
    const obj = { page_id: '12345', id: 'should-strip', smart_pse_enabled: true };
    const sanitized = sanitizePromotedObject(obj);
    expect(sanitized.page_id).toBe('12345');
    expect(sanitized.id).toBeUndefined();
    expect(sanitized.smart_pse_enabled).toBeUndefined();
  });

  it('returns undefined for empty promoted_object', () => {
    expect(sanitizePromotedObject({})).toBeUndefined();
    expect(sanitizePromotedObject(null)).toBeUndefined();
    expect(sanitizePromotedObject(undefined)).toBeUndefined();
  });

  it('returns undefined when only read-only fields present', () => {
    const obj = { id: '123', smart_pse_enabled: true };
    expect(sanitizePromotedObject(obj)).toBeUndefined();
  });
});

// ─── Objective Defaults Completeness ───

describe('Objective Defaults Completeness', () => {
  for (const objective of ALL_OBJECTIVES) {
    it(`${objective} has defaults`, () => {
      const defaults = OBJECTIVE_DEFAULTS[objective];
      expect(defaults).toBeDefined();
      expect(defaults.optimization_goal).toBeDefined();
      expect(defaults.billing_event).toBeDefined();
      expect(defaults.destination_type).toBeDefined();
    });

    it(`${objective} defaults are valid`, () => {
      const defaults = OBJECTIVE_DEFAULTS[objective];
      expect(VALID_OPTIMIZATION_GOALS[objective]).toContain(defaults.optimization_goal);
      expect(VALID_DESTINATION_TYPES[objective]).toContain(defaults.destination_type);
    });
  }
});
