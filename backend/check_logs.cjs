const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const logs = await p.draftPublishLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log('Recent publish logs:');
  logs.forEach(l => console.log(
    l.createdAt.toISOString(),
    l.status.padEnd(8),
    l.draftType.padEnd(10),
    '|', (l.error || '').substring(0, 200)
  ));

  const campaigns = await p.draftCampaign.findMany({
    select: { id: true, name: true, status: true, metaId: true },
    orderBy: { updatedAt: 'desc' },
    take: 10
  });
  console.log('\nRecent campaigns:');
  campaigns.forEach(c => console.log(
    c.status.padEnd(12),
    c.metaId ? 'HAS_META' : 'no_meta ',
    '|', c.name.substring(0, 80)
  ));
}

main().catch(console.error).finally(() => p.$disconnect());
