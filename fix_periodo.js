const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:PKHPWLLcGbnLlyojsZiPWpOdPUoJyxEP@zephyr.proxy.rlwy.net:41118/railway' } }
});
p.$executeRawUnsafe('ALTER TABLE folgas ALTER COLUMN periodo TYPE TEXT USING periodo::TEXT;')
  .then(() => { console.log('OK'); p.$disconnect(); })
  .catch(e => { console.error(e); p.$disconnect(); });