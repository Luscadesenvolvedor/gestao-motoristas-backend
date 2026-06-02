// backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // Usuário admin padrão
  const senhaHash = await bcrypt.hash('admin123', 10);
  await prisma.usuario.upsert({
    where: { email: 'admin@empresa.com' },
    update: {},
    create: { nome: 'Administrador', email: 'admin@empresa.com', senha: senhaHash, papel: 'admin' }
  });

  // Tipos de solicitação
  const tiposSolic = ['Vale alimentação', 'Adiantamento', 'Reembolso', 'Vale combustível', 'Ajuda de custo'];
  for (const nome of tiposSolic) {
    await prisma.tipoSolicitacao.upsert({ where: { nome }, update: {}, create: { nome } });
  }

  // Tipos de desconto
  const tiposDesc = ['Desconto de combustível', 'Manutenção', 'Adiantamento devolvido', 'Multa', 'Outros'];
  for (const nome of tiposDesc) {
    await prisma.tipoDesconto.upsert({ where: { nome }, update: {}, create: { nome } });
  }

  console.log('Seed concluído!');
  console.log('Login: admin@empresa.com | Senha: admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
