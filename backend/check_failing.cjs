const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Get the failing campaigns
  const campaigns = await p.draftCampaign.findMany({
    where: { status: 'FAILED' },
    include: {
      adSets: {
        include: { ads: true }
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: 3
  });

  for (const c of campaigns) {
    const cd = c.data;
    console.log('\n=== CAMPAIGN:', c.name, '===');
    console.log('  status:', c.status, '| metaId:', c.metaId);
    console.log('  objective:', cd.objective);
    console.log('  bid_strategy:', cd.bid_strategy);
    console.log('  daily_budget:', cd.daily_budget);
    console.log('  lifetime_budget:', cd.lifetime_budget);
    console.log('  special_ad_categories:', JSON.stringify(cd.special_ad_categories));

    for (const adSet of c.adSets) {
      const d = adSet.data;
      console.log('\n  AD SET:', adSet.name);
      console.log('    status:', adSet.status, '| metaId:', adSet.metaId);
      console.log('    optimization_goal:', d.optimization_goal);
      console.log('    billing_event:', d.billing_event);
      console.log('    bid_strategy:', d.bid_strategy);
      console.log('    bid_amount:', d.bid_amount);
      console.log('    daily_budget:', d.daily_budget);
      console.log('    lifetime_budget:', d.lifetime_budget);
      console.log('    start_time:', d.start_time);
      console.log('    end_time:', d.end_time);
      console.log('    targeting keys:', Object.keys(d.targeting || {}));
      console.log('    promoted_object:', JSON.stringify(d.promoted_object));
      console.log('    destination_type:', d.destination_type);
      console.log('    attribution_spec:', JSON.stringify(d.attribution_spec));

      for (const ad of adSet.ads) {
        const ad_d = ad.data;
        console.log('\n    AD:', ad.name);
        console.log('      status:', ad.status, '| metaId:', ad.metaId);
        console.log('      creative:', JSON.stringify(ad_d.creative));
      }
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());
