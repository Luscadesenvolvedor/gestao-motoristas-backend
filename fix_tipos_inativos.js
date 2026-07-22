// Reativa tipos_vale, tipos_ref, tipos_solicitacao que estao inativos
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vales = await prisma.tipoVale.updateMany({ where: { ativo: false }, data: { ativo: true } });
  console.log('TipoVale reativados:', vales.count);

  const refs = await prisma.tipoRef.updateMany({ where: { ativo: false }, data: { ativo: true } });
  console.log('TipoRef reativados:', refs.count);

  const tipos = await prisma.tipoSolicitacao.updateMany({ where: { ativo: false }, data: { ativo: true } });
  console.log('TipoSolicitacao reativados:', tipos.count);

  const descontos = await prisma.tipoDesconto.updateMany({ where: { ativo: false }, data: { ativo: true } });
  console.log('TipoDesconto reativados:', descontos.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
