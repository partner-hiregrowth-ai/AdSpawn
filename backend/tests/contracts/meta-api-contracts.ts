// Meta Marketing API payload contracts.
// These define what Meta actually accepts/rejects.
// Updated when drift detection catches changes.

import { VALID_OPTIMIZATION_GOALS, VALID_DESTINATION_TYPES } from '../../src/services/draft/MetaFieldRegistry';

export interface FieldContract {
  type: 'string' | 'number' | 'enum' | 'boolean' | 'object' | 'array';
  enumValues?: string[];
}

export interface EntityContract {
  required: string[];
  forbidden: string[];
  mutuallyExclusive: string[][];
  enumConstraints: Record<string, string[]>;
  conditionallyRequired?: Record<string, ConditionalRequirement>;
  objectConstraints?: Record<string, ObjectConstraint>;
}

export interface ConditionalRequirement {
  when: Record<string, any>;
  message: string;
}

export interface ObjectConstraint {
  requiredKeys?: string[];
  forbiddenKeys?: string[];
  atLeastOneOf?: string[];
}

// ─── Campaign Contract ───

export const CAMPAIGN_CONTRACT: EntityContract = {
  required: ['name', 'objective', 'status', 'special_ad_categories'],
  forbidden: [
    'id', 'account_id', 'effective_status', 'configured_status',
    'created_time', 'updated_time', 'budget_remaining',
    'can_create_brand_lift_study', 'can_use_spend_cap',
    'source_campaign_id', 'source_campaign', 'topline_id',
    'issues_info', 'recommendations', 'smart_pse_enabled',
    'budget_rebalance_flag',
  ],
  mutuallyExclusive: [
    ['daily_budget', 'lifetime_budget'],
  ],
  enumConstraints: {
    objective: [
      'OUTCOME_AWARENESS', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT',
      'OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_APP_PROMOTION',
    ],
    status: ['ACTIVE', 'PAUSED'],
    buying_type: ['AUCTION', 'RESERVED'],
    bid_strategy: [
      'LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP',
      'COST_CAP', 'LOWEST_COST_WITH_MIN_ROAS',
    ],
  },
};

// ─── Ad Set Contract ───

export const ADSET_CONTRACT: EntityContract = {
  required: ['name', 'campaign_id', 'optimization_goal', 'billing_event', 'targeting'],
  forbidden: [
    'id', 'account_id', 'effective_status', 'configured_status',
    'created_time', 'updated_time', 'budget_remaining',
    'issues_info', 'recommendations',
  ],
  mutuallyExclusive: [
    ['daily_budget', 'lifetime_budget'],
  ],
  enumConstraints: {
    optimization_goal: [...new Set(Object.values(VALID_OPTIMIZATION_GOALS).flat())],
    billing_event: ['IMPRESSIONS', 'LINK_CLICKS', 'APP_INSTALLS', 'THRUPLAY', 'POST_ENGAGEMENT'],
    destination_type: [...new Set(Object.values(VALID_DESTINATION_TYPES).flat())],
    bid_strategy: [
      'LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP',
      'COST_CAP', 'LOWEST_COST_WITH_MIN_ROAS',
    ],
    status: ['ACTIVE', 'PAUSED'],
  },
  conditionallyRequired: {
    bid_amount: {
      when: { bid_strategy: ['LOWEST_COST_WITH_BID_CAP', 'COST_CAP', 'TARGET_COST'] },
      message: 'bid_amount is required when using bid cap strategies',
    },
    end_time: {
      when: { lifetime_budget: 'exists' },
      message: 'end_time is required when using lifetime_budget',
    },
  },
  objectConstraints: {
    targeting: {
      requiredKeys: ['geo_locations'],
    },
    promoted_object: {
      atLeastOneOf: ['page_id', 'pixel_id', 'application_id', 'product_set_id'],
    },
  },
};

// ─── Ad Contract ───

export const AD_CONTRACT: EntityContract = {
  required: ['name', 'adset_id', 'creative', 'status'],
  forbidden: [
    'id', 'account_id', 'effective_status', 'configured_status',
    'created_time', 'updated_time',
  ],
  mutuallyExclusive: [],
  enumConstraints: {
    status: ['ACTIVE', 'PAUSED'],
  },
  objectConstraints: {
    creative: {
      requiredKeys: ['creative_id'],
    },
  },
};

// ─── Contract Validator ───

export interface ContractViolation {
  type: 'missing_required' | 'forbidden_present' | 'invalid_enum' | 'mutual_exclusion' | 'conditional_required' | 'object_constraint';
  field: string;
  message: string;
}

export function validateAgainstContract(
  payload: Record<string, any>,
  contract: EntityContract,
  context?: { objective?: string },
): ContractViolation[] {
  const violations: ContractViolation[] = [];

  // Required fields
  for (const field of contract.required) {
    if (field === 'campaign_id' || field === 'adset_id') continue; // Set by parent
    if (payload[field] === undefined || payload[field] === null) {
      violations.push({
        type: 'missing_required',
        field,
        message: `Required field '${field}' is missing`,
      });
    }
  }

  // Forbidden fields
  for (const field of contract.forbidden) {
    if (field in payload) {
      violations.push({
        type: 'forbidden_present',
        field,
        message: `Read-only field '${field}' must not be in payload`,
      });
    }
  }

  // Enum constraints
  for (const [field, validValues] of Object.entries(contract.enumConstraints)) {
    if (payload[field] !== undefined && !validValues.includes(payload[field])) {
      violations.push({
        type: 'invalid_enum',
        field,
        message: `'${payload[field]}' is not a valid value for '${field}'. Valid: [${validValues.join(', ')}]`,
      });
    }
  }

  // Objective-specific enum validation
  if (context?.objective && payload.optimization_goal) {
    const validGoals = VALID_OPTIMIZATION_GOALS[context.objective] || [];
    if (!validGoals.includes(payload.optimization_goal)) {
      violations.push({
        type: 'invalid_enum',
        field: 'optimization_goal',
        message: `'${payload.optimization_goal}' is invalid for objective '${context.objective}'`,
      });
    }
  }
  if (context?.objective && payload.destination_type) {
    const validDests = VALID_DESTINATION_TYPES[context.objective] || [];
    if (!validDests.includes(payload.destination_type)) {
      violations.push({
        type: 'invalid_enum',
        field: 'destination_type',
        message: `'${payload.destination_type}' is invalid for objective '${context.objective}'`,
      });
    }
  }

  // Mutual exclusion
  for (const group of contract.mutuallyExclusive) {
    const present = group.filter(f => payload[f] !== undefined && payload[f] !== null);
    if (present.length > 1) {
      violations.push({
        type: 'mutual_exclusion',
        field: present.join('+'),
        message: `Fields [${present.join(', ')}] are mutually exclusive`,
      });
    }
  }

  // Conditional requirements
  if (contract.conditionallyRequired) {
    for (const [field, condition] of Object.entries(contract.conditionallyRequired)) {
      let conditionMet = false;
      for (const [depField, depValue] of Object.entries(condition.when)) {
        if (depValue === 'exists') {
          conditionMet = payload[depField] !== undefined && payload[depField] !== null;
        } else if (Array.isArray(depValue)) {
          conditionMet = depValue.includes(payload[depField]);
        } else {
          conditionMet = payload[depField] === depValue;
        }
      }
      if (conditionMet && (payload[field] === undefined || payload[field] === null)) {
        violations.push({
          type: 'conditional_required',
          field,
          message: condition.message,
        });
      }
    }
  }

  // Object constraints
  if (contract.objectConstraints) {
    for (const [field, constraint] of Object.entries(contract.objectConstraints)) {
      const obj = payload[field];
      if (!obj) continue;

      if (constraint.requiredKeys) {
        for (const key of constraint.requiredKeys) {
          if (!obj[key] || (typeof obj[key] === 'object' && Object.keys(obj[key]).length === 0)) {
            violations.push({
              type: 'object_constraint',
              field: `${field}.${key}`,
              message: `'${field}.${key}' is required`,
            });
          }
        }
      }

      if (constraint.atLeastOneOf) {
        const hasOne = constraint.atLeastOneOf.some(key => obj[key] !== undefined && obj[key] !== null);
        if (!hasOne) {
          violations.push({
            type: 'object_constraint',
            field,
            message: `'${field}' must contain at least one of: ${constraint.atLeastOneOf.join(', ')}`,
          });
        }
      }
    }
  }

  return violations;
}
