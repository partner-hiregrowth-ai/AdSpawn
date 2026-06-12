import { describe, it, expect } from 'vitest';
import { DraftValidationEngine } from '../../src/services/draft/DraftValidationEngine';

function makeCampaign(overrides: any = {}) {
  return {
    id: 'camp-1',
    name: 'Test Campaign',
    objective: 'OUTCOME_TRAFFIC',
    data: { objective: 'OUTCOME_TRAFFIC' },
    metaId: null,
    ...overrides,
  } as any;
}

function makeAdSet(overrides: any = {}) {
  return {
    id: 'adset-1',
    name: 'Test Ad Set',
    data: {
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      targeting: { geo_locations: { countries: ['TH'] } },
      daily_budget: '5000',
    },
    metaId: null,
    ...overrides,
  } as any;
}

function makeAd(overrides: any = {}) {
  return {
    id: 'ad-1',
    name: 'Test Ad',
    data: { creative: { creative_id: '123' } },
    metaId: null,
    ...overrides,
  } as any;
}

describe('DraftValidationEngine.validateCampaign', () => {
  it('returns no errors for a valid campaign', async () => {
    const errors = await DraftValidationEngine.validateCampaign(makeCampaign());
    expect(errors).toHaveLength(0);
  });

  it('requires campaign name', async () => {
    const errors = await DraftValidationEngine.validateCampaign(makeCampaign({ name: '' }));
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  it('requires objective', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({ objective: null, data: {} })
    );
    expect(errors.some(e => e.field === 'objective' && e.message.includes('required'))).toBe(true);
  });

  it('rejects unknown objective', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({ data: { objective: 'INVALID_OBJ' } })
    );
    expect(errors.some(e => e.field === 'objective' && e.message.includes('not a recognized'))).toBe(true);
  });

  it('rejects both daily_budget and lifetime_budget', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({ data: { objective: 'OUTCOME_TRAFFIC', daily_budget: '5000', lifetime_budget: '50000' } })
    );
    expect(errors.some(e => e.field === 'budget')).toBe(true);
  });

  it('errors when bid cap strategy lacks bid_amount', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({ data: { objective: 'OUTCOME_TRAFFIC', bid_strategy: 'COST_CAP' } })
    );
    expect(errors.some(e => e.field === 'bid_strategy' && e.severity === 'error')).toBe(true);
  });

  it('does not warn when bid cap strategy has bid_amount', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({ data: { objective: 'OUTCOME_TRAFFIC', bid_strategy: 'COST_CAP', bid_amount: '1000' } })
    );
    expect(errors.some(e => e.field === 'bid_strategy')).toBe(false);
  });

  it('warns when bid cap strategy has no bid_amount', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({ data: { objective: 'OUTCOME_TRAFFIC', bid_strategy: 'COST_CAP' } })
    );
    expect(errors.some(e => e.field === 'bid_strategy')).toBe(true);
  });

  it('warns about immutable field changes on published campaigns', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({
        metaId: 'meta_123',
        data: {
          objective: 'OUTCOME_TRAFFIC',
          buying_type: 'AUCTION',
          _original_buying_type: 'RESERVED',
        },
      })
    );
    expect(errors.some(e => e.field === 'buying_type' && e.severity === 'warning')).toBe(true);
  });

  it('does not warn when immutable field unchanged', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({
        metaId: 'meta_123',
        data: {
          objective: 'OUTCOME_TRAFFIC',
          buying_type: 'AUCTION',
          _original_buying_type: 'AUCTION',
        },
      })
    );
    expect(errors.some(e => e.field === 'buying_type')).toBe(false);
  });
});

describe('DraftValidationEngine.validateAdSet', () => {
  it('returns no errors for a valid ad set', async () => {
    const errors = await DraftValidationEngine.validateAdSet(makeAdSet());
    expect(errors).toHaveLength(0);
  });

  it('requires name', async () => {
    const errors = await DraftValidationEngine.validateAdSet(makeAdSet({ name: '' }));
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  it('requires billing_event', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({ data: { optimization_goal: 'LINK_CLICKS', targeting: {} } })
    );
    expect(errors.some(e => e.field === 'billing_event')).toBe(true);
  });

  it('requires optimization_goal', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({ data: { billing_event: 'IMPRESSIONS', targeting: {} } })
    );
    expect(errors.some(e => e.field === 'optimization_goal')).toBe(true);
  });

  it('requires targeting', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({ data: { billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS' } })
    );
    expect(errors.some(e => e.field === 'targeting')).toBe(true);
  });

  it('validates optimization_goal against objective', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({ data: { billing_event: 'IMPRESSIONS', optimization_goal: 'APP_INSTALLS', targeting: {} } }),
      'OUTCOME_TRAFFIC'
    );
    expect(errors.some(e => e.field === 'optimization_goal' && e.message.includes('not available'))).toBe(true);
  });

  it('accepts valid optimization_goal for objective', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({ data: { billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS', targeting: {} } }),
      'OUTCOME_TRAFFIC'
    );
    expect(errors.some(e => e.field === 'optimization_goal')).toBe(false);
  });

  it('validates destination_type against objective', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'REACH',
          targeting: {},
          destination_type: 'WEBSITE',
        },
      }),
      'OUTCOME_AWARENESS'
    );
    // OUTCOME_AWARENESS only allows 'UNDEFINED'
    expect(errors.some(e => e.field === 'destination_type')).toBe(true);
  });

  it('requires promoted_object for OUTCOME_LEADS', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: { billing_event: 'IMPRESSIONS', optimization_goal: 'LEAD_GENERATION', targeting: {} },
      }),
      'OUTCOME_LEADS'
    );
    expect(errors.some(e => e.field === 'promoted_object')).toBe(true);
  });

  it('validates promoted_object has required fields', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LEAD_GENERATION',
          targeting: {},
          promoted_object: { custom_field: 'something' },
        },
      }),
      'OUTCOME_LEADS'
    );
    expect(errors.some(e => e.field === 'promoted_object' && e.message.includes('missing'))).toBe(true);
  });

  it('accepts valid promoted_object', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LEAD_GENERATION',
          targeting: {},
          promoted_object: { page_id: '12345' },
        },
      }),
      'OUTCOME_LEADS'
    );
    expect(errors.some(e => e.field === 'promoted_object')).toBe(false);
  });

  it('warns about attribution_spec on unsupported objectives', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'REACH',
          targeting: {},
          attribution_spec: [{ event_type: 'CLICK_THROUGH' }],
        },
      }),
      'OUTCOME_AWARENESS'
    );
    expect(errors.some(e => e.field === 'attribution_spec' && e.severity === 'warning')).toBe(true);
  });

  it('allows attribution_spec on OUTCOME_SALES', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'OFFSITE_CONVERSIONS',
          targeting: {},
          attribution_spec: [{ event_type: 'CLICK_THROUGH' }],
          promoted_object: { pixel_id: '123' },
        },
      }),
      'OUTCOME_SALES'
    );
    expect(errors.some(e => e.field === 'attribution_spec')).toBe(false);
  });

  it('rejects adset budget under CBO', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: {},
          daily_budget: '5000',
        },
      }),
      'OUTCOME_TRAFFIC',
      true
    );
    expect(errors.some(e => e.field === 'budget' && e.message.includes('CBO'))).toBe(true);
  });

  it('errors on missing budget for non-CBO', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: {},
        },
      }),
      'OUTCOME_TRAFFIC',
      false
    );
    expect(errors.some(e => e.field === 'budget' && e.severity === 'error')).toBe(true);
  });

  it('rejects both daily and lifetime budget on non-CBO adset', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: {},
          daily_budget: '5000',
          lifetime_budget: '50000',
        },
      }),
      'OUTCOME_TRAFFIC',
      false
    );
    expect(errors.some(e => e.field === 'budget' && e.severity === 'error')).toBe(true);
  });

  it('warns about immutable adset fields on published entities', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        metaId: 'meta_adset_1',
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: {},
          destination_type: 'WEBSITE',
          _original_destination_type: 'APP',
        },
      })
    );
    expect(errors.some(e => e.field === 'destination_type' && e.severity === 'warning')).toBe(true);
  });

  it('flags a past start_time as info (not a warning) so duplicated campaigns are not alarming', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: { geo_locations: { countries: ['US'] } },
          daily_budget: '5000',
          start_time: '2020-01-01T00:00:00Z',
        },
      })
    );
    const startErr = errors.find(e => e.field === 'start_time');
    expect(startErr?.severity).toBe('info');
    expect(startErr?.message).toContain('as soon as it\'s published');
  });

  it('does not flag a near-now start_time within the 5-minute grace buffer', async () => {
    const nearNow = new Date(Date.now() - 120_000).toISOString(); // 2 minutes ago
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: { geo_locations: { countries: ['US'] } },
          daily_budget: '5000',
          start_time: nearNow,
        },
      })
    );
    expect(errors.some(e => e.field === 'start_time')).toBe(false);
  });

  it('skips campaign_id in immutable check', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        metaId: 'meta_adset_1',
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: {},
          campaign_id: 'new_campaign',
          _original_campaign_id: 'old_campaign',
        },
      })
    );
    expect(errors.some(e => e.field === 'campaign_id')).toBe(false);
  });
});

describe('DraftValidationEngine.validateAd', () => {
  it('returns no errors for a valid ad', async () => {
    const errors = await DraftValidationEngine.validateAd(makeAd());
    expect(errors).toHaveLength(0);
  });

  it('requires ad name', async () => {
    const errors = await DraftValidationEngine.validateAd(makeAd({ name: '' }));
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  it('requires creative', async () => {
    const errors = await DraftValidationEngine.validateAd(makeAd({ data: {} }));
    expect(errors.some(e => e.field === 'creative' && e.message.includes('required'))).toBe(true);
  });

  it('requires creative_id or id in creative', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { some_field: 'value' } } })
    );
    expect(errors.some(e => e.field === 'creative' && e.message.includes('incomplete'))).toBe(true);
  });

  it('accepts creative with id', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { id: '123' } } })
    );
    expect(errors).toHaveLength(0);
  });

  it('accepts ad with video_data, video_id, and thumbnail', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', video_data: { video_id: '456', image_hash: 'thumb1' } } } } })
    );
    expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  it('rejects video_data without a thumbnail (Meta requires image_hash or image_url)', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', video_data: { video_id: '456' } } } } })
    );
    expect(errors.some(e => e.field === 'creative.video_data.image_hash' && e.severity === 'error')).toBe(true);
  });

  it('rejects link_data carrying both image_hash and picture (mutually exclusive)', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', link_data: { link: 'https://x.com', image_hash: 'abc', picture: 'https://x.com/p.jpg' } } } } })
    );
    expect(errors.some(e => e.field === 'creative.link_data.image_hash' && e.severity === 'error')).toBe(true);
  });

  it('accepts photo_data with url instead of image_hash', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', photo_data: { url: 'https://x.com/p.jpg' } } } } })
    );
    expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  it('rejects a standard inline creative inside a Dynamic Creative ad set', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', link_data: { link: 'https://x.com', image_hash: 'abc' } } } } }),
      true, // isDynamicCreative ad set
    );
    expect(errors.some(e => e.field === 'creative' && e.severity === 'error' && e.message.includes('Dynamic Creative'))).toBe(true);
  });

  it('rejects a plain creative_id reference inside a Dynamic Creative ad set', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { creative_id: '123' } } }),
      true,
    );
    expect(errors.some(e => e.field === 'creative' && e.severity === 'error' && e.message.includes('Dynamic Creative'))).toBe(true);
  });

  it('rejects video_data without video_id', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', video_data: { message: 'hello' } } } } })
    );
    expect(errors.some(e => e.field === 'creative.video_data.video_id')).toBe(true);
  });

  it('accepts ad with photo_data and image_hash', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', photo_data: { image_hash: 'abc123' } } } } })
    );
    expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  it('rejects photo_data without image_hash', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', photo_data: { message: 'hello' } } } } })
    );
    expect(errors.some(e => e.field === 'creative.photo_data.image_hash')).toBe(true);
  });

  it('accepts carousel with 2+ valid cards', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', link_data: {
        message: 'hi', child_attachments: [
          { link: 'https://a.com', image_hash: 'h1' },
          { link: 'https://b.com', image_hash: 'h2' },
        ],
      } } } } })
    );
    expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  it('rejects carousel with fewer than 2 cards', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', link_data: {
        child_attachments: [{ link: 'https://a.com' }],
      } } } } })
    );
    expect(errors.some(e => e.field === 'creative.child_attachments' && e.message.includes('at least 2'))).toBe(true);
  });

  it('rejects carousel card missing link', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', link_data: {
        child_attachments: [{ link: 'https://a.com' }, { name: 'no link' }],
      } } } } })
    );
    expect(errors.some(e => e.field === 'creative.child_attachments[1].link')).toBe(true);
  });

  it('accepts ad with asset_feed_spec', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: {
        page_id: '123',
        creative: { asset_feed_spec: {
          images: [{ hash: 'x' }],
          bodies: [{ text: 'y' }],
          titles: [{ text: 'z' }],
          link_urls: [{ website_url: 'http://example.com' }]
        } }
      } }),
      true // isDynamicCreative
    );
    expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  it('rejects asset_feed_spec without images or videos', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { asset_feed_spec: { bodies: [{ text: 'y' }] } } } }),
      true // isDynamicCreative
    );
    expect(errors.some(e => e.field === 'creative.asset_feed_spec' && e.severity === 'error')).toBe(true);
  });

  it('errors when asset_feed_spec has no bodies', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { asset_feed_spec: { images: [{ hash: 'x' }] } } } }),
      true // isDynamicCreative
    );
    expect(errors.some(e => e.field === 'creative.asset_feed_spec.bodies' && e.severity === 'error')).toBe(true);
  });

  it('errors when page_id is missing from object_story_spec', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { link_data: { message: 'hi' } } } } })
    );
    expect(errors.some(e => e.field === 'creative.page_id' && e.severity === 'error')).toBe(true);
  });

  it('resolves page_id from adSetContext promoted_object', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { link_data: { message: 'hi' } } } } }),
      false,
      { promoted_object: { page_id: '123' } }
    );
    expect(errors.some(e => e.field === 'creative.page_id')).toBe(false);
  });

  it('warns that creative_id overrides asset_feed/platform_customizations for a NON-dynamic ad set', async () => {
    // For a non-DC ad set the publish path uses the creative_id and discards the dynamic
    // assets, so the warning is accurate.
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { id: '123', asset_feed_spec: { images: [{ hash: 'x' }], bodies: [{ text: 'y' }] } } } }),
      false // not a dynamic creative ad set
    );
    expect(errors.some(e => e.field === 'creative.creative_id' && e.severity === 'warning')).toBe(true);
  });

  it('suppresses the creative_id override warning for a Dynamic Creative ad set', async () => {
    // For a DC ad set the publish path builds an inline asset_feed_spec creative and omits
    // creative_id entirely, so the dynamic assets are NOT ignored — the warning is misleading
    // and must be suppressed.
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { id: '123', asset_feed_spec: { images: [{ hash: 'x' }], bodies: [{ text: 'y' }] } } } }),
      true // dynamic creative ad set
    );
    expect(errors.some(e => e.field === 'creative.creative_id')).toBe(false);
  });

  it('suppresses the asset_feed_spec DC-mismatch error when the ad also has a creative_id in a non-DC ad set', async () => {
    // Ads duplicated from a DC campaign carry BOTH creative.id and asset_feed_spec. In a
    // non-DC ad set the publish path uses the creative_id shortcut and ignores asset_feed_spec,
    // so the DC-mismatch error is a false positive and must not fire.
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { id: '123', asset_feed_spec: { images: [{ hash: 'x' }], bodies: [{ text: 'y' }] } } } }),
      false // not a dynamic creative ad set
    );
    expect(errors.some(e => e.field === 'creative.asset_feed_spec' && e.message.includes('Dynamic Creative assets'))).toBe(false);
  });

  it('still fires the asset_feed_spec DC-mismatch error when there is no creative_id in a non-DC ad set', async () => {
    // No creative_id means publish would actually try to use asset_feed_spec on a non-DC ad
    // set, which fails — so the error must fire.
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: {
        page_id: '999',
        creative: { asset_feed_spec: {
          images: [{ hash: 'x' }],
          bodies: [{ text: 'y' }],
          titles: [{ text: 'z' }],
          link_urls: [{ website_url: 'https://example.com' }],
        } },
      } }),
      false // not a dynamic creative ad set
    );
    expect(errors.some(e => e.field === 'creative.asset_feed_spec' && e.message.includes('Dynamic Creative assets'))).toBe(true);
  });
});

describe('DraftValidationEngine.validateFullDraft', () => {
  it('validates full draft tree with valid data', async () => {
    const campaign = {
      ...makeCampaign(),
      adSets: [{
        ...makeAdSet(),
        ads: [makeAd()],
      }],
    };
    const result = await DraftValidationEngine.validateFullDraft(campaign);
    expect(result.isValid).toBe(true);
    expect(result.campaignErrors).toHaveLength(0);
  });

  it('detects CBO from campaign data', async () => {
    const campaign = {
      ...makeCampaign({ data: { objective: 'OUTCOME_TRAFFIC', daily_budget: '5000' } }),
      adSets: [{
        ...makeAdSet({
          data: {
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'LINK_CLICKS',
            targeting: {},
            daily_budget: '3000',
          },
        }),
        ads: [makeAd()],
      }],
    };
    const result = await DraftValidationEngine.validateFullDraft(campaign);
    expect(result.isValid).toBe(false);
    expect(Object.values(result.adSetErrors).flat().some(e => e.message.includes('CBO'))).toBe(true);
  });

  it('marks invalid when campaign has errors', async () => {
    const campaign = {
      ...makeCampaign({ name: '', data: { objective: 'OUTCOME_TRAFFIC' } }),
      adSets: [],
    };
    const result = await DraftValidationEngine.validateFullDraft(campaign);
    expect(result.isValid).toBe(false);
  });

  it('marks invalid when ad has errors', async () => {
    const campaign = {
      ...makeCampaign(),
      adSets: [{
        ...makeAdSet(),
        ads: [makeAd({ data: {} })],
      }],
    };
    const result = await DraftValidationEngine.validateFullDraft(campaign);
    expect(result.isValid).toBe(false);
  });

  it('handles campaign without adSets gracefully', async () => {
    const campaign = makeCampaign();
    const result = await DraftValidationEngine.validateFullDraft(campaign);
    expect(result.isValid).toBe(true);
  });

  it('handles adSet without ads gracefully', async () => {
    const campaign = {
      ...makeCampaign(),
      adSets: [makeAdSet()],
    };
    const result = await DraftValidationEngine.validateFullDraft(campaign);
    expect(result.isValid).toBe(true);
  });

  it('uses campaign.objective when data.objective is missing', async () => {
    const campaign = {
      ...makeCampaign({ objective: 'OUTCOME_TRAFFIC', data: {} }),
      adSets: [{
        ...makeAdSet(),
        ads: [makeAd()],
      }],
    };
    const result = await DraftValidationEngine.validateFullDraft(campaign);
    expect(result.isValid).toBe(true);
  });
});

describe('DraftValidationEngine — new validation cases', () => {
  // Campaign: CBO enabled but no budget
  it('errors when CBO is enabled but no campaign budget set', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({ data: { objective: 'OUTCOME_TRAFFIC', is_adset_budget_sharing_enabled: true } })
    );
    expect(errors.some(e => e.field === 'budget' && e.message.includes('Campaign Budget Optimization'))).toBe(true);
  });

  // Campaign: start_time after stop_time
  it('errors when campaign start_time is after stop_time', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({ data: { objective: 'OUTCOME_TRAFFIC', start_time: '2026-06-01T00:00:00', stop_time: '2026-05-01T00:00:00' } })
    );
    expect(errors.some(e => e.field === 'stop_time' && e.message.includes('after the start'))).toBe(true);
  });

  it('no error when campaign times are in order', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({ data: { objective: 'OUTCOME_TRAFFIC', start_time: '2026-05-01T00:00:00', stop_time: '2026-06-01T00:00:00' } })
    );
    expect(errors.some(e => e.field === 'stop_time')).toBe(false);
  });

  // Ad set: start_time after end_time
  it('errors when ad set start_time is after end_time', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS',
          targeting: { geo_locations: { countries: ['US'] } },
          start_time: '2026-06-01T00:00:00', end_time: '2026-05-01T00:00:00',
        },
      })
    );
    expect(errors.some(e => e.field === 'end_time' && e.message.includes('after the start'))).toBe(true);
  });

  // Ad set: missing geo_locations
  it('warns when targeting has no geo_locations', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS',
          targeting: { age_min: 18 },
        },
      })
    );
    expect(errors.some(e => e.field === 'targeting' && e.message.includes('location'))).toBe(true);
  });

  it('no geo warning when targeting has countries', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS',
          targeting: { geo_locations: { countries: ['US'] } },
        },
      })
    );
    expect(errors.some(e => e.field === 'targeting' && e.message.includes('location'))).toBe(false);
  });

  // Ad: link_data missing destination URL
  it('errors when link ad has no destination URL', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', link_data: { message: 'Hello' } } } } })
    );
    expect(errors.some(e => e.field === 'creative.link_data.link' && e.message.includes('destination URL'))).toBe(true);
  });

  it('no link error when link_data has a link', async () => {
    const errors = await DraftValidationEngine.validateAd(
      makeAd({ data: { creative: { object_story_spec: { page_id: '111', link_data: { link: 'https://example.com', message: 'Hello' } } } } })
    );
    expect(errors.some(e => e.field === 'creative.link_data.link')).toBe(false);
  });

  // Full draft: campaign with no ad sets
  it('warns when campaign has empty adSets array', async () => {
    const campaign = { ...makeCampaign(), adSets: [] };
    const result = await DraftValidationEngine.validateFullDraft(campaign);
    expect(result.campaignErrors.some(e => e.field === 'adSets' && e.message.includes('no ad sets'))).toBe(true);
  });

  // Full draft: ad set with no ads
  it('warns when ad set has empty ads array', async () => {
    const campaign = {
      ...makeCampaign(),
      adSets: [{ ...makeAdSet(), ads: [] }],
    };
    const result = await DraftValidationEngine.validateFullDraft(campaign);
    const adSetErrors = Object.values(result.adSetErrors).flat();
    expect(adSetErrors.some(e => e.field === 'ads' && e.message.includes('no ads'))).toBe(true);
  });

  // Friendly message content checks
  it('uses friendly names in optimization_goal error', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({ data: { billing_event: 'IMPRESSIONS', optimization_goal: 'APP_INSTALLS', targeting: {} } }),
      'OUTCOME_TRAFFIC'
    );
    const msg = errors.find(e => e.field === 'optimization_goal')?.message || '';
    expect(msg).toContain('App Installs');
    expect(msg).toContain('Traffic');
  });

  it('uses friendly names in promoted_object error', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({ data: { billing_event: 'IMPRESSIONS', optimization_goal: 'LEAD_GENERATION', targeting: {} } }),
      'OUTCOME_LEADS'
    );
    const msg = errors.find(e => e.field === 'promoted_object')?.message || '';
    expect(msg).toContain('Facebook Page');
    expect(msg).toContain('Leads');
  });

  it('uses friendly names in bid_strategy error', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: { billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS', targeting: {}, bid_strategy: 'COST_CAP' },
      }),
      'OUTCOME_TRAFFIC',
      false
    );
    const msg = errors.find(e => e.field === 'bid_amount')?.message || '';
    expect(msg).toContain('Cost Per Result Goal');
    expect(msg).toContain('Highest Volume');
  });
});

describe('DraftValidationEngine.validateAdSet edge cases', () => {
  it('skips destination_type validation for unknown objective', async () => {
    const adSet = makeAdSet({
      data: {
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        targeting: { geo_locations: { countries: ['TH'] } },
        destination_type: 'ANYTHING',
      },
    });
    const errors = await DraftValidationEngine.validateAdSet(adSet, 'UNKNOWN_OBJECTIVE', false);
    expect(errors.some(e => e.field === 'destination_type')).toBe(false);
  });

  it('skips promoted_object validation for objectives without requirements', async () => {
    const adSet = makeAdSet({
      data: {
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        targeting: { geo_locations: { countries: ['TH'] } },
        daily_budget: '5000',
      },
    });
    // OUTCOME_TRAFFIC has no promoted_object requirements
    const errors = await DraftValidationEngine.validateAdSet(adSet, 'OUTCOME_TRAFFIC', false);
    expect(errors.some(e => e.field === 'promoted_object')).toBe(false);
  });

  it('skips budget validation when isCBO is undefined', async () => {
    const adSet = makeAdSet({
      data: {
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        targeting: { geo_locations: { countries: ['TH'] } },
      },
    });
    const errors = await DraftValidationEngine.validateAdSet(adSet, 'OUTCOME_TRAFFIC', undefined as any);
    expect(errors.some(e => e.field === 'budget')).toBe(false);
  });
});

describe('DraftValidationEngine — minimum budget warnings', () => {
  it('warns when ad set daily_budget is below floor', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: { geo_locations: { countries: ['TH'] } },
          daily_budget: '500',
        },
      }),
      'OUTCOME_TRAFFIC',
      false
    );
    expect(errors.some(e => e.field === 'daily_budget' && e.severity === 'warning' && e.message.includes('minimum'))).toBe(true);
  });

  it('formats the daily_budget floor message as a currency decimal (divides by 100)', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: { geo_locations: { countries: ['TH'] } },
          daily_budget: '500',
        },
      }),
      'OUTCOME_TRAFFIC',
      false
    );
    const msg = errors.find(e => e.field === 'daily_budget')?.message || '';
    // 500 (smallest unit) -> 5.00
    expect(msg).toContain('5.00');
    expect(msg).not.toContain('of 500 ');
  });

  it('no warning when ad set daily_budget is above floor', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: { geo_locations: { countries: ['TH'] } },
          daily_budget: '5000',
        },
      }),
      'OUTCOME_TRAFFIC',
      false
    );
    expect(errors.some(e => e.field === 'daily_budget' && e.severity === 'warning')).toBe(false);
  });

  it('warns when ad set lifetime_budget daily equivalent is below floor', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: { geo_locations: { countries: ['TH'] } },
          lifetime_budget: '10000',
          start_time: '2026-05-25T00:00:00',
          end_time: '2026-05-31T00:00:00',
        },
      }),
      'OUTCOME_TRAFFIC',
      false
    );
    expect(errors.some(e => e.field === 'lifetime_budget' && e.severity === 'warning' && e.message.includes('minimum'))).toBe(true);
  });

  it('no warning when ad set lifetime_budget daily equivalent is above floor', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: { geo_locations: { countries: ['TH'] } },
          lifetime_budget: '100000',
          start_time: '2026-05-25T00:00:00',
          end_time: '2026-05-31T00:00:00',
        },
      }),
      'OUTCOME_TRAFFIC',
      false
    );
    expect(errors.some(e => e.field === 'lifetime_budget' && e.severity === 'warning')).toBe(false);
  });

  it('warns when CBO campaign daily_budget is below floor', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({ data: { objective: 'OUTCOME_TRAFFIC', daily_budget: '500' } })
    );
    expect(errors.some(e => e.field === 'daily_budget' && e.severity === 'warning' && e.message.includes('minimum'))).toBe(true);
  });

  it('warns when CBO campaign lifetime_budget daily equivalent is below floor', async () => {
    const errors = await DraftValidationEngine.validateCampaign(
      makeCampaign({
        data: {
          objective: 'OUTCOME_TRAFFIC',
          lifetime_budget: '5000',
          start_time: '2026-05-25T00:00:00',
          stop_time: '2026-05-31T00:00:00',
        },
      })
    );
    expect(errors.some(e => e.field === 'lifetime_budget' && e.severity === 'warning' && e.message.includes('minimum'))).toBe(true);
  });

  it('skips budget floor check for CBO ad set (budget not allowed at ad set level)', async () => {
    const errors = await DraftValidationEngine.validateAdSet(
      makeAdSet({
        data: {
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          targeting: { geo_locations: { countries: ['TH'] } },
          daily_budget: '500',
        },
      }),
      'OUTCOME_TRAFFIC',
      true
    );
    expect(errors.some(e => e.field === 'daily_budget' && e.severity === 'warning')).toBe(false);
  });
});
