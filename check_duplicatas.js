require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const todas = await prisma.solicitacao.findMany({
    orderBy: { criadoEm: 'asc' },
    include: { motorista: { select: { nome: true } }, tipo: { select: { nome: true } } }
  });

  const duplicatas = [];
  const vistas = new Map();

  for (const s of todas) {
    const chave = `${s.motoristaId}|${s.tipoId}|${s.valor}|${s.data?.toISOString().split('T')[0]}`;
    if (vistas.has(chave)) {
      const original = vistas.get(chave);
      const diffMs = new Date(s.criadoEm) - new Date(original.criadoEm);
      duplicatas.push({
        manter: original.id,
        apagar: s.id,
        motorista: s.motorista?.nome,
        tipo: s.tipo?.nome,
        valor: s.valor.toString(),
        diffSegundos: Math.round(diffMs / 1000),
        criadoEm: s.criadoEm
      });
    } else {
      vistas.set(chave, s);
    }
  }

  if (duplicatas.length === 0) {
    console.log('Nenhuma duplicata encontrada.');
  } else {
    console.log(`${duplicatas.length} duplicata(s) encontrada(s):\n`);
    duplicatas.forEach((d, i) => {
      console.log(`${i+1}. ${d.motorista} | ${d.tipo} | R$ ${d.valor} | +${d.diffSegundos}s depois`);
      console.log(`   Manter: ${d.manter}`);
      console.log(`   Apagar: ${d.apagar}\n`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
