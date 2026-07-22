require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tipos = await prisma.tipoSolicitacao.findMany({ orderBy: { nome: 'asc' } });
  console.log('\nTIPOS cadastrados:');
  tipos.forEach(t => console.log(`  [${t.ativo ? 'ativo' : 'inativo'}] ${t.nome}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
