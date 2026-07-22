const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTabela(tabela, fkColuna) {
  // Busca todos os nomes que precisam virar maiúsculo
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id::text, nome FROM ${tabela} WHERE nome <> UPPER(nome)`
  );

  let convertidos = 0;
  let removidos = 0;

  for (const row of rows) {
    const nomeUpper = row.nome.toUpperCase();

    // Verifica se já existe um registro com o nome em maiúsculo
    const existente = await prisma.$queryRawUnsafe(
      `SELECT id::text FROM ${tabela} WHERE nome = $1 AND id::text <> $2`,
      nomeUpper, row.id
    );

    if (existente.length > 0) {
      const idUpper = existente[0].id;
      // Redireciona as solicitações para o registro em maiúsculo
      await prisma.$executeRawUnsafe(
        `UPDATE solicitacoes SET "${fkColuna}" = $1 WHERE "${fkColuna}" = $2`,
        idUpper, row.id
      );
      // Remove o duplicado em minúsculo
      await prisma.$executeRawUnsafe(
        `DELETE FROM ${tabela} WHERE id::text = $1`, row.id
      );
      removidos++;
    } else {
      // Sem conflito, só converte
      await prisma.$executeRawUnsafe(
        `UPDATE ${tabela} SET nome = $1 WHERE id::text = $2`, nomeUpper, row.id
      );
      convertidos++;
    }
  }

  console.log(`✅ ${tabela}: ${convertidos} convertido(s), ${removidos} duplicado(s) removido(s)`);
}

async function main() {
  // Placa das solicitações
  const placa = await prisma.$executeRaw`
    UPDATE solicitacoes SET placa = UPPER(placa)
    WHERE placa IS NOT NULL AND placa <> UPPER(placa)
  `;
  console.log(`✅ ${placa} placa(s) convertida(s)`);

  await fixTabela('tipos_solicitacao', 'tipoId');
  await fixTabela('tipos_vale', 'tipoValeId');
  await fixTabela('tipos_ref', 'tipoRefId');
}

main()
  .catch(e => { console.error('❌ Erro:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
