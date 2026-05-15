import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const adSets = await prisma.draftAdSet.findMany({
  where: { id: { in: ['cmp6jhflz000a11svckmflhq5','cmp6jh779000311svf02bmd0w'] } },
  select: { id: true, name: true, status: true, metaId: true, draftCampaignId: true, data: true }
});

for (const a of adSets) {
  const d = a.data;
  console.log('ID:', a.id);
  console.log('  campaignId:', a.draftCampaignId);
  console.log('  status:', a.status, '| metaId:', a.metaId);
  console.log('  optimization_goal:', d.optimization_goal);
  console.log('  bid_strategy:', d.bid_strategy);
  console.log('  bid_amount:', d.bid_amount);
  console.log('  bid_constraints:', JSON.stringify(d.bid_constraints));
  console.log('  billing_event:', d.billing_event);
  console.log('  daily_budget:', d.daily_budget);
  console.log('  lifetime_budget:', d.lifetime_budget);
  console.log('  campaign_id in data:', d.campaign_id);
}

// Also check their parent campaigns
const campaigns = await prisma.draftCampaign.findMany({
  where: { id: { in: adSets.map(a => a.draftCampaignId) } },
  select: { id: true, name: true, status: true, metaId: true, data: true }
});
for (const c of campaigns) {
  const d = c.data;
  console.log('\nCAMPAIGN ID:', c.id);
  console.log('  status:', c.status, '| metaId:', c.metaId);
  console.log('  objective:', d.objective);
  console.log('  bid_strategy:', d.bid_strategy);
  console.log('  daily_budget:', d.daily_budget);
  console.log('  lifetime_budget:', d.lifetime_budget);
}

await prisma.$disconnect();
