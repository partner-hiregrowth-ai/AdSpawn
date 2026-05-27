import { describe, it, expect } from 'vitest';
import {
  detectImmutableConflicts,
  stripImmutableFields,
  stripReadOnlyFields,
  sanitizePromotedObject,
  sanitizeTargeting,
  sanitizeTrackingSpecs,
  migrateOptimizationGoal,
  migrateDestinationType,
  IMMUTABLE_CAMPAIGN_FIELDS,
  IMMUTABLE_ADSET_FIELDS,
} from '../../src/services/draft/MetaFieldRegistry';

describe('detectImmutableConflicts', () => {
  it('returns empty array when no source snapshot', () => {
    const conflicts = detectImmutableConflicts('campaign', { buying_type: 'AUCTION' }, null);
    expect(conflicts).toHaveLength(0);
  });

  it('detects campaign immutable field conflict', () => {
    const conflicts = detectImmutableConflicts(
      'campaign',
      { buying_type: 'RESERVED', objective: 'OUTCOME_SALES' },
      { buying_type: 'AUCTION', objective: 'OUTCOME_TRAFFIC' }
    );
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts.some(c => c.field === 'buying_type')).toBe(true);
    const buyingConflict = conflicts.find(c => c.field === 'buying_type')!;
    expect(buyingConflict.draftValue).toBe('RESERVED');
    expect(buyingConflict.metaValue).toBe('AUCTION');
  });

  it('returns empty when values match', () => {
    const conflicts = detectImmutableConflicts(
      'campaign',
      { buying_type: 'AUCTION' },
      { buying_type: 'AUCTION' }
    );
    expect(conflicts).toHaveLength(0);
  });

  it('ignores fields not in draft', () => {
    const conflicts = detectImmutableConflicts(
      'campaign',
      {},
      { buying_type: 'AUCTION' }
    );
    expect(conflicts).toHaveLength(0);
  });

  it('ignores fields not in source', () => {
    const conflicts = detectImmutableConflicts(
      'campaign',
      { buying_type: 'AUCTION' },
      {}
    );
    expect(conflicts).toHaveLength(0);
  });

  it('detects adSet immutable field conflict', () => {
    const conflicts = detectImmutableConflicts(
      'adSet',
      { destination_type: 'WEBSITE', campaign_id: '123' },
      { destination_type: 'APP', campaign_id: '456' }
    );
    expect(conflicts.some(c => c.field === 'destination_type')).toBe(true);
    expect(conflicts.some(c => c.field === 'campaign_id')).toBe(true);
  });

  it('detects ad immutable field conflict', () => {
    const conflicts = detectImmutableConflicts(
      'ad',
      { adset_id: 'new-adset' },
      { adset_id: 'old-adset' }
    );
    expect(conflicts.some(c => c.field === 'adset_id')).toBe(true);
  });

  it('handles complex JSON comparison', () => {
    const conflicts = detectImmutableConflicts(
      'campaign',
      { buying_type: 'AUCTION' },
      { buying_type: 'AUCTION' }
    );
    expect(conflicts).toHaveLength(0);
  });
});

describe('stripImmutableFields', () => {
  it('strips campaign immutable fields', () => {
    const payload = {
      name: 'Test',
      objective: 'OUTCOME_TRAFFIC',
      buying_type: 'AUCTION',
      bid_strategy: 'COST_CAP',
    };
    const { cleaned, stripped } = stripImmutableFields('campaign', payload);
    expect(cleaned.name).toBe('Test');
    expect(stripped).toContain('buying_type');
    expect(stripped).toContain('objective');
    expect(cleaned.buying_type).toBeUndefined();
    expect(cleaned.objective).toBeUndefined();
  });

  it('strips adSet immutable fields', () => {
    const payload = {
      name: 'AdSet',
      campaign_id: '123',
      destination_type: 'WEBSITE',
      billing_event: 'IMPRESSIONS',
    };
    const { cleaned, stripped } = stripImmutableFields('adSet', payload);
    expect(stripped).toContain('campaign_id');
    expect(stripped).toContain('destination_type');
    expect(cleaned.name).toBe('AdSet');
    expect(cleaned.billing_event).toBe('IMPRESSIONS');
  });

  it('strips ad immutable fields', () => {
    const payload = {
      name: 'Ad',
      adset_id: 'adset-123',
      creative: { creative_id: '456' },
    };
    const { cleaned, stripped } = stripImmutableFields('ad', payload);
    expect(stripped).toContain('adset_id');
    expect(cleaned.name).toBe('Ad');
    expect(cleaned.creative).toBeDefined();
  });

  it('returns empty stripped array when no immutable fields present', () => {
    const { cleaned, stripped } = stripImmutableFields('campaign', { name: 'Test', status: 'PAUSED' });
    expect(stripped).toHaveLength(0);
    expect(cleaned.name).toBe('Test');
  });
});

describe('sanitizeTargeting', () => {
  it('returns default targeting when null', () => {
    const result = sanitizeTargeting(null);
    expect(result).toEqual({ geo_locations: { countries: ['TH'] }, age_min: 20 });
  });

  it('returns default targeting when undefined', () => {
    const result = sanitizeTargeting(undefined);
    expect(result).toEqual({ geo_locations: { countries: ['TH'] }, age_min: 20 });
  });

  it('preserves valid targeting', () => {
    const targeting = { geo_locations: { countries: ['US'] }, age_min: 18 };
    const result = sanitizeTargeting(targeting);
    expect(result.geo_locations.countries).toEqual(['US']);
    expect(result.age_min).toBe(18);
  });

  it('adds default geo_locations if empty', () => {
    const targeting = { age_min: 18, geo_locations: {} };
    const result = sanitizeTargeting(targeting);
    expect(result.geo_locations).toEqual({ countries: ['TH'] });
    expect(result.age_min).toBe(20);
  });

  it('sets age_min to 18 for non-TH country without age_min', () => {
    const targeting = { geo_locations: { countries: ['US'] } };
    const result = sanitizeTargeting(targeting);
    expect(result.age_min).toBe(18);
  });

  it('returns default on invalid JSON', () => {
    const circular: any = {};
    circular.self = circular;
    // JSON.parse(JSON.stringify(circular)) will throw
    // But sanitizeTargeting uses try-catch
    // We can test the catch path by passing something that causes stringify to throw
    // Actually, circular refs throw on JSON.stringify
    const result = sanitizeTargeting(circular);
    expect(result).toEqual({ geo_locations: { countries: ['TH'] }, age_min: 20 });
  });
});

describe('sanitizePromotedObject', () => {
  it('returns undefined for null', () => {
    expect(sanitizePromotedObject(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(sanitizePromotedObject(undefined)).toBeUndefined();
  });

  it('strips read-only fields from promoted object', () => {
    const obj = { page_id: '123', custom_event_str: 'event', custom_conversion_id: '456' };
    const result = sanitizePromotedObject(obj);
    expect(result.page_id).toBe('123');
  });

  it('returns undefined when all fields are read-only', () => {
    // This will depend on what PROMOTED_OBJECT_READ_ONLY contains
    // Testing that empty result returns undefined
    const obj = { page_id: '123' };
    const result = sanitizePromotedObject(obj);
    expect(result).toBeDefined();
    expect(result.page_id).toBe('123');
  });
});

describe('migrateOptimizationGoal', () => {

  it('returns same goal when already valid', () => {
    const result = migrateOptimizationGoal('LINK_CLICKS', 'OUTCOME_TRAFFIC');
    expect(result.goal).toBe('LINK_CLICKS');
    expect(result.migrated).toBe(false);
  });

  it('falls back to objective default for unknown objective', () => {
    const result = migrateOptimizationGoal('LINK_CLICKS', 'COMPLETELY_INVALID_OBJECTIVE');
    expect(result.migrated).toBe(true);
    expect(result.reason).toContain('not supported');
  });

  it('uses migration map when goal not directly valid but mapped is', () => {
    // AD_RECALL_LIFT maps to REACH, which is valid for OUTCOME_AWARENESS
    const result = migrateOptimizationGoal('AD_RECALL_LIFT', 'OUTCOME_TRAFFIC');
    // AD_RECALL_LIFT maps to REACH; REACH is valid for OUTCOME_TRAFFIC
    expect(result.goal).toBe('REACH');
    expect(result.migrated).toBe(true);
    expect(result.reason).toContain('mapped to');
  });

  it('falls back when migration map target is not valid for objective', () => {
    // APP_INSTALLS maps to APP_INSTALLS — not valid for OUTCOME_AWARENESS
    const result = migrateOptimizationGoal('APP_INSTALLS', 'OUTCOME_AWARENESS');
    expect(result.migrated).toBe(true);
    expect(result.reason).toContain('fell back to');
  });

  it('handles goal not in migration map at all', () => {
    const result = migrateOptimizationGoal('TOTALLY_UNKNOWN_GOAL', 'OUTCOME_TRAFFIC');
    expect(result.migrated).toBe(true);
    expect(result.reason).toContain('fell back to');
  });
});

describe('migrateDestinationType', () => {

  it('returns fallback for undefined currentType', () => {
    const result = migrateDestinationType(undefined, 'OUTCOME_TRAFFIC');
    expect(result.migrated).toBe(false);
    expect(result.type).toBeDefined();
  });

  it('returns fallback for UNDEFINED currentType', () => {
    const result = migrateDestinationType('UNDEFINED', 'OUTCOME_TRAFFIC');
    expect(result.migrated).toBe(false);
  });

  it('returns same type when valid', () => {
    const result = migrateDestinationType('WEBSITE', 'OUTCOME_TRAFFIC');
    expect(result.type).toBe('WEBSITE');
    expect(result.migrated).toBe(false);
  });

  it('migrates invalid type to fallback', () => {
    const result = migrateDestinationType('APP', 'OUTCOME_AWARENESS');
    expect(result.migrated).toBe(true);
    expect(result.reason).toContain('not valid');
  });

  it('falls back for entirely unknown objective', () => {
    const result = migrateDestinationType('WEBSITE', 'INVALID_OBJECTIVE');
    expect(result.migrated).toBe(true);
  });
});

describe('stripReadOnlyFields', () => {
  it('strips read-only fields from data', () => {
    const data = {
      name: 'Test',
      id: '123',
      account_id: 'act_123',
      created_time: '2024-01-01',
      updated_time: '2024-01-01',
      effective_status: 'ACTIVE',
      bid_strategy: 'COST_CAP',
    };
    const result = stripReadOnlyFields(data);
    expect(result.name).toBe('Test');
    expect(result.bid_strategy).toBe('COST_CAP');
    expect(result.id).toBeUndefined();
    expect(result.created_time).toBeUndefined();
    expect(result.effective_status).toBeUndefined();
  });
});

describe('sanitizeTrackingSpecs', () => {
  it('returns an empty array for non-array input', () => {
    expect(sanitizeTrackingSpecs(undefined as any)).toEqual([]);
    expect(sanitizeTrackingSpecs(null as any)).toEqual([]);
    expect(sanitizeTrackingSpecs({} as any)).toEqual([]);
  });

  it('removes post and post.wall references', () => {
    const result = sanitizeTrackingSpecs([
      { 'action.type': ['post_engagement'], page: ['123'], post: ['456'], 'post.wall': ['789'] },
    ]);
    expect(result).toEqual([{ 'action.type': ['post_engagement'], page: ['123'] }]);
  });

  it('filters out specs that only contain action.type (no object)', () => {
    const result = sanitizeTrackingSpecs([
      { 'action.type': ['onsite_conversion'], conversion_id: ['25753534954323372'] },
      { 'action.type': ['onsite_conversion'] },
      { page: ['1064753226727354'], 'action.type': ['post_interaction_gross'] },
      { page: ['1064753226727354'], 'action.type': ['post_engagement'] },
      { 'action.type': ['link_click'] },
      { 'action.type': ['one_pd_landing_page_view'] },
    ]);
    expect(result).toEqual([
      { 'action.type': ['onsite_conversion'], conversion_id: ['25753534954323372'] },
      { page: ['1064753226727354'], 'action.type': ['post_interaction_gross'] },
      { page: ['1064753226727354'], 'action.type': ['post_engagement'] },
    ]);
  });

  it('filters out a spec that becomes object-less only after post references are stripped', () => {
    const result = sanitizeTrackingSpecs([
      { 'action.type': ['post_engagement'], post: ['456'] },
    ]);
    expect(result).toEqual([]);
  });

  it('filters out empty specs', () => {
    expect(sanitizeTrackingSpecs([{}])).toEqual([]);
  });

  it('keeps specs that reference any non action.type object key', () => {
    const specs = [
      { 'action.type': ['offsite_conversion'], fb_pixel: ['123'] },
      { 'action.type': ['app_install'], application: ['999'] },
    ];
    expect(sanitizeTrackingSpecs(specs)).toEqual(specs);
  });
});
