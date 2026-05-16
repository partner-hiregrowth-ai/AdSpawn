import { prisma } from '../../prisma';
import { FacebookService } from '../facebook.service';
import { DraftStatus } from '@prisma/client';

export class DraftPublishService {
  static async publishCampaign(campaignId: string, accessToken: string) {
    if (!accessToken) {
      throw new Error('No Facebook access token provided');
    }

    const fbService = new FacebookService(accessToken);
    const campaign = await prisma.draftCampaign.findUnique({
      where: { id: campaignId },
      include: {
        adSets: {
          include: {
            ads: true,
          },
        },
      },
    });

    if (!campaign) throw new Error('Campaign draft not found');

    // ✅ FIX: Normalize adAccountId — Meta API always requires the act_ prefix.
    // Without it, the API receives a bare number and returns:
    // "Object does not exist, cannot be loaded due to missing permissions"
    const normalizeAccountId = (id: string) =>
      id.startsWith('act_') ? id : `act_${id}`;

    const campaignAccountId = normalizeAccountId(campaign.adAccountId);

    try {
      // 1. Update status to PUBLISHING
      await prisma.draftCampaign.update({
        where: { id: campaignId },
        data: { status: DraftStatus.PUBLISHING },
      });

      // 2. Publish Campaign (skip if already published — idempotent retry)
      const campaignData = campaign.data as any;
      const isCBO = !!(campaignData.daily_budget || campaignData.lifetime_budget);

      // Bid strategies that require bid_amount or bid_constraints.
      // We don't fetch bid_amount for campaigns, so we fall back to LOWEST_COST_WITHOUT_CAP for these.
      const BID_CAP_STRATEGIES = new Set(['LOWEST_COST_WITH_BID_CAP', 'COST_CAP', 'TARGET_COST', 'LOWEST_COST_WITH_MIN_ROAS']);

      let metaCampaignId: string;
      if (campaign.metaId) {
        // Campaign exists on Meta from a prior attempt — sync mutable fields
        metaCampaignId = campaign.metaId;
        const updatePayload: any = {
          name: campaign.name,
          status: 'PAUSED',
          special_ad_categories: campaignData.special_ad_categories || [],
        };
        if (isCBO) {
          if (campaignData.daily_budget && campaignData.lifetime_budget) {
            updatePayload.daily_budget = String(campaignData.daily_budget);
          } else if (campaignData.daily_budget) {
            updatePayload.daily_budget = String(campaignData.daily_budget);
          } else if (campaignData.lifetime_budget) {
            updatePayload.lifetime_budget = String(campaignData.lifetime_budget);
          }
          if (campaignData.bid_strategy && !BID_CAP_STRATEGIES.has(campaignData.bid_strategy)) {
            updatePayload.bid_strategy = campaignData.bid_strategy;
          } else {
            updatePayload.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
          }
        }
        try {
          console.log(`[DraftPublishService] Updating existing Meta campaign ${metaCampaignId}:`, JSON.stringify(updatePayload));
          await fbService.client.post(`/${metaCampaignId}`, updatePayload);
        } catch (error: any) {
          console.error(`[DraftPublishService] Failed to update Meta campaign ${metaCampaignId}:`, error.response?.data?.error || error.message);
        }
      } else {
        const campaignPayload: any = {
          name: campaign.name,
          objective: campaignData.objective || campaign.objective,
          status: 'PAUSED',
          special_ad_categories: campaignData.special_ad_categories || [],
        };

        if (isCBO) {
          // Meta requires exactly one — prefer daily_budget when both exist
          if (campaignData.daily_budget && campaignData.lifetime_budget) {
            campaignPayload.daily_budget = String(campaignData.daily_budget);
          } else if (campaignData.daily_budget) {
            campaignPayload.daily_budget = String(campaignData.daily_budget);
          } else if (campaignData.lifetime_budget) {
            campaignPayload.lifetime_budget = String(campaignData.lifetime_budget);
          }
          // Cap-type strategies require bid_amount we may not have — fall back to safest option
          if (campaignData.bid_strategy && !BID_CAP_STRATEGIES.has(campaignData.bid_strategy)) {
            campaignPayload.bid_strategy = campaignData.bid_strategy;
          } else {
            campaignPayload.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
          }
        } else {
          // Meta requires this field explicitly on non-CBO campaigns
          campaignPayload.is_adset_budget_sharing_enabled = false;
        }

        try {
          console.log(`[DraftPublishService] Publishing campaign ${campaignId} payload:`, JSON.stringify(campaignPayload));
          const fbCampaign = await fbService.client.post(
            `/${campaignAccountId}/campaigns`,
            campaignPayload
          );
          metaCampaignId = fbCampaign.data.id;
        } catch (error: any) {
          console.error('Failed to publish campaign to Facebook:', error.response?.data || error.message);
          throw new Error(`Facebook API Error (Campaign): ${error.response?.data?.error?.message || error.message}`);
        }

        await prisma.draftCampaign.update({
          where: { id: campaignId },
          data: { metaId: metaCampaignId },
        });
      }

      // 3. Publish Ad Sets
      for (const adSet of campaign.adSets) {
        await prisma.draftAdSet.update({
          where: { id: adSet.id },
          data: { status: DraftStatus.PUBLISHING },
        });

        const adSetAccountId = normalizeAccountId(adSet.adAccountId);

        let metaAdSetId: string;
        if (adSet.metaId) {
          // Already published (partial retry) — reuse existing Meta ID
          metaAdSetId = adSet.metaId;
        } else {
          const adSetData = adSet.data as any;
          const campaignObjective: string = campaignData.objective || campaign.objective || '';
          const ATTRIBUTION_SPEC_OBJECTIVES = new Set(['OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_TRAFFIC']);
          const VALID_DESTINATION_TYPES = new Set([
            'WEBSITE', 'APP', 'MESSENGER', 'APPLINKS_AUTOMATIC', 'FACEBOOK',
            'INSTAGRAM_DIRECT', 'WHATSAPP', 'SHOP_AUTOMATIC', 'ON_AD', 'ON_POST',
            'ON_EVENT', 'ON_VIDEO', 'ON_PAGE',
          ]);

          // Clean promoted_object: strip read-only fields Meta returns but rejects on create
          let cleanPromotedObject: any = undefined;
          if (adSetData.promoted_object) {
            const { smart_pse_enabled, ...writableFields } = adSetData.promoted_object;
            if (Object.keys(writableFields).length > 0) {
              cleanPromotedObject = writableFields;
            }
          }

          const adSetPayload: any = {
            name: adSet.name,
            campaign_id: metaCampaignId,
            status: 'PAUSED',
            billing_event: adSetData.billing_event || 'IMPRESSIONS',
            optimization_goal: adSetData.optimization_goal,
            targeting: adSetData.targeting || { geo_locations: { countries: ['TH'] } },
            ...(cleanPromotedObject && { promoted_object: cleanPromotedObject }),
            ...(adSetData.destination_type && VALID_DESTINATION_TYPES.has(adSetData.destination_type) && { destination_type: adSetData.destination_type }),
            ...(adSetData.attribution_spec && ATTRIBUTION_SPEC_OBJECTIVES.has(campaignObjective) && { attribution_spec: adSetData.attribution_spec }),
          };

          // Under CBO the campaign owns bid strategy — ad sets must not send bid fields
          if (!isCBO) {
            const adSetBidStrategy: string | undefined = adSetData.bid_strategy;
            const adSetBidAmount: number | string | undefined = adSetData.bid_amount;
            if (adSetBidStrategy && BID_CAP_STRATEGIES.has(adSetBidStrategy)) {
              if (adSetBidAmount) {
                adSetPayload.bid_strategy = adSetBidStrategy;
                adSetPayload.bid_amount = String(adSetBidAmount);
              }
            } else {
              if (adSetBidStrategy) adSetPayload.bid_strategy = adSetBidStrategy;
              if (adSetBidAmount) adSetPayload.bid_amount = String(adSetBidAmount);
            }
          }

          // CBO campaigns manage budget at campaign level — ad sets must not have their own budgets
          if (!isCBO) {
            const adSetDailyBudget = Number(adSetData.daily_budget) || 0;
            const adSetLifetimeBudget = Number(adSetData.lifetime_budget) || 0;
            // Only send one; prefer daily when both are non-zero
            if (adSetDailyBudget > 0 && adSetLifetimeBudget > 0) {
              adSetPayload.daily_budget = String(adSetDailyBudget);
            } else if (adSetDailyBudget > 0) {
              adSetPayload.daily_budget = String(adSetDailyBudget);
            } else if (adSetLifetimeBudget > 0) {
              adSetPayload.lifetime_budget = String(adSetLifetimeBudget);
            }
            if (adSetData.start_time) adSetPayload.start_time = adSetData.start_time;
            if (adSetData.end_time) adSetPayload.end_time = adSetData.end_time;
          }

          try {
            console.log(`[DraftPublishService] Publishing ad set ${adSet.id} payload:`, JSON.stringify(adSetPayload));
            const fbAdSet = await fbService.client.post(`/${adSetAccountId}/adsets`, adSetPayload);
            metaAdSetId = fbAdSet.data.id;
          } catch (error: any) {
            const errData = error.response?.data?.error;
            console.error(`Failed to publish ad set ${adSet.id} to Facebook:`, JSON.stringify(errData) || error.message);

            const bidErrorSubcodes = new Set([2490487, 1815857]);
            if (bidErrorSubcodes.has(errData?.error_subcode)) {
              // Bid strategy/amount conflict — strip all bid fields and retry.
              // This handles two cases:
              //   1. The ad set's stored bid data is incompatible with the objective.
              //   2. The parent campaign on Meta was created in a previous attempt with a bad bid
              //      strategy (BID_CAP without bid_amount). If retry also fails, we reset the
              //      campaign metaId so the next publish attempt recreates the campaign cleanly.
              const bidlessPayload = { ...adSetPayload };
              delete bidlessPayload.bid_strategy;
              delete bidlessPayload.bid_amount;
              delete bidlessPayload.bid_constraints;
              console.log(`[DraftPublishService] Retrying ad set ${adSet.id} without bid fields`);
              try {
                const fbAdSetRetry = await fbService.client.post(`/${adSetAccountId}/adsets`, bidlessPayload);
                metaAdSetId = fbAdSetRetry.data.id;
              } catch (retryError: any) {
                const retryErrData = retryError.response?.data?.error;
                const retryDetail = retryErrData
                  ? `${retryErrData.message} (code ${retryErrData.code}/${retryErrData.error_subcode ?? 'no subcode'})${retryErrData.error_user_msg ? ': ' + retryErrData.error_user_msg : ''}`
                  : retryError.message;
                console.error(`[DraftPublishService] Ad set retry failed:`, JSON.stringify(retryErrData) || retryError.message);
                await prisma.draftCampaign.update({
                  where: { id: campaignId },
                  data: { metaId: null },
                });
                throw new Error(`Facebook API Error (AdSet ${adSet.id}): ${retryDetail} (campaign metaId reset — retry publish)`);
              }
            } else {
              const detail = errData
                ? `${errData.message} (code ${errData.code}/${errData.error_subcode ?? 'no subcode'})${errData.error_user_msg ? ': ' + errData.error_user_msg : ''}`
                : error.message;
              throw new Error(`Facebook API Error (AdSet ${adSet.id}): ${detail}`);
            }
          }

          await prisma.draftAdSet.update({
            where: { id: adSet.id },
            data: { metaId: metaAdSetId },
          });
        }

        await prisma.draftAdSet.update({
          where: { id: adSet.id },
          data: { status: DraftStatus.PUBLISHED },
        });

        // 4. Publish Ads
        for (const ad of adSet.ads) {
          await prisma.draftAd.update({
            where: { id: ad.id },
            data: { status: DraftStatus.PUBLISHING },
          });

          const adAccountId = normalizeAccountId(ad.adAccountId);

          let metaAdId: string;
          if (ad.metaId) {
            // Already published (partial retry) — reuse existing Meta ID
            metaAdId = ad.metaId;
          } else {
            const adData = ad.data as any;
            const adPayload = {
              name: ad.name,
              adset_id: metaAdSetId,
              status: 'PAUSED',
              ...(adData.creative?.id
                ? { creative: { creative_id: String(adData.creative.id) } }
                : adData.creative?.creative_id
                  ? { creative: { creative_id: String(adData.creative.creative_id) } }
                  : {}),
              ...(adData.tracking_specs && { tracking_specs: adData.tracking_specs }),
            };

            try {
              const fbAd = await fbService.client.post(
                `/${adAccountId}/ads`,
                adPayload
              );
              metaAdId = fbAd.data.id;
            } catch (error: any) {
              console.error(`Failed to publish ad ${ad.id} to Facebook:`, error.response?.data || error.message);
              throw new Error(`Facebook API Error (Ad ${ad.id}): ${error.response?.data?.error?.message || error.message}`);
            }

            await prisma.draftAd.update({
              where: { id: ad.id },
              data: { metaId: metaAdId },
            });
          }

          await prisma.draftAd.update({
            where: { id: ad.id },
            data: { status: DraftStatus.PUBLISHED },
          });
        }
      }

      // All adsets and ads done — now mark campaign PUBLISHED
      await prisma.draftCampaign.update({
        where: { id: campaignId },
        data: { status: DraftStatus.PUBLISHED },
      });

      return { success: true, metaCampaignId };
    } catch (error: any) {
      console.error('Publishing failed:', error.message);

      // Reset campaign and any child records stuck in PUBLISHING back to FAILED/DRAFT
      await prisma.draftCampaign.update({
        where: { id: campaignId },
        data: { status: DraftStatus.FAILED },
      });
      await prisma.draftAdSet.updateMany({
        where: { draftCampaignId: campaignId, status: DraftStatus.PUBLISHING },
        data: { status: DraftStatus.FAILED },
      });
      // Reset ads inside those ad sets
      const adSetIds = campaign.adSets.map((s) => s.id);
      if (adSetIds.length > 0) {
        await prisma.draftAd.updateMany({
          where: { draftAdSetId: { in: adSetIds }, status: DraftStatus.PUBLISHING },
          data: { status: DraftStatus.FAILED },
        });
      }

      // Log the error
      await prisma.draftPublishLog.create({
        data: {
          draftId: campaignId,
          draftType: 'CAMPAIGN',
          status: 'FAILED',
          error: error.message,
        },
      });

      throw error;
    }
  }
}
