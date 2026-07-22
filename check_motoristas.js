require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total     = await prisma.motorista.count();
  const ativos    = await prisma.motorista.count({ where: { status: 'ativo', excluido: false } });
  const deslig    = await prisma.motorista.count({ where: { status: 'desligado', excluido: false } });
  const excluidos = await prisma.motorista.count({ where: { excluido: true } });

  console.log('Total no banco:        ', total);
  console.log('Ativos (aparecem):     ', ativos);
  console.log('Desligados:            ', deslig);
  console.log('Excluidos (deletados): ', excluidos);

  if (excluidos > 0) {
    const lista = await prisma.motorista.findMany({ where: { excluido: true }, select: { nome: true, status: true } });
    console.log('\nMotoristas excluidos:');
    lista.forEach(m => console.log(' -', m.nome, '|', m.status));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
