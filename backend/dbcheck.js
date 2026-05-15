const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const all = await p.draftCampaign.findMany({
    select: { id: true, name: true, status: true, metaId: true },
    orderBy: { updatedAt: 'desc' }
  });
  console.log('All campaigns (' + all.length + '):');
  all.forEach(c => console.log(' ', c.status.padEnd(12), c.metaId ? 'HAS_META_ID' : 'no_meta_id', '|', c.name.substring(0, 60)));
}

main().catch(console.error).finally(() => p.$disconnect());
