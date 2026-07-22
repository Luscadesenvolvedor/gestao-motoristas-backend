require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const raw = (process.argv[2] || '').replace(/\D/g, '');
  if (!raw) { console.log('Uso: node reativar_por_cpf.js 77545206215'); process.exit(1); }

  // Formata para 000.000.000-00
  const formatado = raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

  // Tenta encontrar com numero puro, formatado ou parcial
  const motorista = await prisma.motorista.findFirst({
    where: { OR: [{ cpf: raw }, { cpf: formatado }, { cpf: { contains: raw } }] }
  });

  if (!motorista) {
    // Lista todos para debug
    console.log('CPF nao encontrado. Listando todos os motoristas com status desligado ou excluido:');
    const lista = await prisma.motorista.findMany({
      where: { OR: [{ status: 'desligado' }, { excluido: true }] },
      select: { nome: true, cpf: true, status: true, excluido: true }
    });
    lista.forEach(m => console.log(' -', m.nome, '| CPF:', m.cpf, '| status:', m.status, '| excluido:', m.excluido));
    process.exit(0);
  }

  console.log('Encontrado:');
  console.log('  Nome:     ', motorista.nome);
  console.log('  CPF:      ', motorista.cpf);
  console.log('  Status:   ', motorista.status);
  console.log('  Excluido: ', motorista.excluido);

  await prisma.motorista.update({
    where: { id: motorista.id },
    data: { status: 'ativo', excluido: false }
  });
  console.log('\nMotorista REATIVADO.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
