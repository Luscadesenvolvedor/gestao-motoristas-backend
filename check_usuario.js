// Uso: node check_usuario.js email@exemplo.com
// Opcionalmente reativa: node check_usuario.js email@exemplo.com --reativar
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const reativar = process.argv[3] === '--reativar';

  if (!email) {
    console.log('Uso: node check_usuario.js email@exemplo.com [--reativar]');
    process.exit(1);
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    console.log('Usuario NAO encontrado:', email);
    process.exit(0);
  }

  console.log('ID:    ', usuario.id);
  console.log('Nome:  ', usuario.nome);
  console.log('Email: ', usuario.email);
  console.log('Papel: ', usuario.papel);
  console.log('Ativo: ', usuario.ativo);

  if (reativar && !usuario.ativo) {
    await prisma.usuario.update({ where: { email }, data: { ativo: true } });
    console.log('\nConta REATIVADA com sucesso.');
  } else if (reativar && usuario.ativo) {
    console.log('\nConta ja esta ativa.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
