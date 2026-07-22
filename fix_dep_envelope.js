const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRaw`
    UPDATE solicitacoes
    SET observacao = REPLACE(observacao, 'Dep em Conta', 'Dep via Envelope')
    WHERE observacao ILIKE '%Dep em Conta%'
  `;
  console.log(`✅ ${result} registro(s) atualizado(s) com sucesso.`);
}

main()
  .catch(e => { console.error('❌ Erro:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
