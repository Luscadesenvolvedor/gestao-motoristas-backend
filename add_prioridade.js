require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS prioridade BOOLEAN NOT NULL DEFAULT false'
  );
  console.log('Coluna prioridade adicionada com sucesso!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
