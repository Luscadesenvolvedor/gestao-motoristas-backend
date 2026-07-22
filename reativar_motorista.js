// Uso: node reativar_motorista.js "nome do motorista"
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const nome = process.argv[2];
  if (!nome) { console.log('Uso: node reativar_motorista.js "nome"'); process.exit(1); }

  const motorista = await prisma.motorista.findFirst({
    where: { nome: { contains: nome, mode: 'insensitive' } }
  });

  if (!motorista) {
    console.log('Nao encontrado:', nome);
    process.exit(0);
  }

  console.log('Encontrado:');
  console.log('  Nome:     ', motorista.nome);
  console.log('  Status:   ', motorista.status);
  console.log('  Excluido: ', motorista.excluido);

  if (motorista.status !== 'ativo' || motorista.excluido) {
    await prisma.motorista.update({
      where: { id: motorista.id },
      data: { status: 'ativo', excluido: false }
    });
    console.log('\nMotorista REATIVADO com sucesso.');
  } else {
    console.log('\nMotorista ja esta ativo e nao excluido.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
