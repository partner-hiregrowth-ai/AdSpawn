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
        metaCampaignId = campaign.metaId;
      } else {
        const campaignPayload: any = {
          name: campaign.name,
          objective: campaignData.objective || campaign.objective,
          status: 'PAUSED',
          special_ad_categories: campaignData.special_ad_categories || [],
        };

        if (isCBO) {
          if (campaignData.daily_budget) campaignPayload.daily_budget = String(campaignData.daily_budget);
          if (campaignData.lifetime_budget) campaignPayload.lifetime_budget = String(campaignData.lifetime_budget);
          if (campaignData.bid_strategy && !BID_CAP_STRATEGIES.has(campaignData.bid_strategy)) {
            campaignPayload.bid_strategy = campaignData.bid_strategy;
          }
          // If bid_strategy is a cap type and we have no bid_amount, omit it — Meta defaults to LOWEST_COST_WITHOUT_CAP
        } else {
          // Meta requires this field explicitly on non-CBO campaigns
          campaignPayload.is_adset_budget_sharing_enabled = false;
        }

        try {
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
          // attribution_spec is only valid for TRAFFIC/SALES/LEADS; other objectives reject it
          const ATTRIBUTION_SPEC_OBJECTIVES = new Set(['OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_TRAFFIC']);
          const adSetPayload: any = {
            name: adSet.name,
            campaign_id: metaCampaignId,
            status: 'PAUSED',
            billing_event: adSetData.billing_event || 'IMPRESSIONS',
            optimization_goal: adSetData.optimization_goal,
            targeting: adSetData.targeting || { geo_locations: { countries: ['TH'] } },
            ...(adSetData.promoted_object && { promoted_object: adSetData.promoted_object }),
            ...(adSetData.destination_type && { destination_type: adSetData.destination_type }),
            ...(adSetData.attribution_spec && ATTRIBUTION_SPEC_OBJECTIVES.has(campaignObjective) && { attribution_spec: adSetData.attribution_spec }),
          };

          // Send bid_strategy + bid_amount as a complete pair.
          // BID_CAP/COST_CAP strategies require bid_amount — only include them when both are present.
          // Strategies that don't require bid_amount (LOWEST_COST_WITHOUT_CAP) are safe to include alone.
          const adSetBidStrategy: string | undefined = adSetData.bid_strategy;
          const adSetBidAmount: number | string | undefined = adSetData.bid_amount;
          if (adSetBidStrategy && BID_CAP_STRATEGIES.has(adSetBidStrategy)) {
            if (adSetBidAmount) {
              adSetPayload.bid_strategy = adSetBidStrategy;
              adSetPayload.bid_amount = String(adSetBidAmount);
            }
            // Missing bid_amount → omit both, Meta defaults to LOWEST_COST_WITHOUT_CAP
          } else {
            if (adSetBidStrategy) adSetPayload.bid_strategy = adSetBidStrategy;
            if (adSetBidAmount) adSetPayload.bid_amount = String(adSetBidAmount);
          }

          // CBO campaigns manage budget at campaign level — ad sets must not have their own budgets
          if (!isCBO) {
            if (adSetData.daily_budget) adSetPayload.daily_budget = String(adSetData.daily_budget);
            if (adSetData.lifetime_budget) adSetPayload.lifetime_budget = String(adSetData.lifetime_budget);
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

            if (errData?.error_subcode === 2490487) {
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
                // Retry also failed — the parent campaign on Meta is in a bad state.
                // Reset campaign metaId so the next publish call recreates the campaign with corrected settings.
                console.error(`[DraftPublishService] Ad set retry failed. Resetting campaign metaId for next attempt.`);
                await prisma.draftCampaign.update({
                  where: { id: campaignId },
                  data: { metaId: null },
                });
                throw new Error(`Facebook API Error (AdSet ${adSet.id}): ${retryError.response?.data?.error?.message || retryError.message} (campaign metaId reset — retry publish)`);
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
