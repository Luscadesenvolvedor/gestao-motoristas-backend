const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar, exigirSetorOuPapel } = require('../middleware/auth');
const { randomUUID } = require('crypto');
const router = express.Router();

router.use(autenticar, exigirSetorOuPapel('abastecimento', ['levantamentos']));
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// GET /api/medias-consumo/importacoes
router.get('/importacoes', async (req, res) => {
  try {
    let lista;
    try {
      lista = await prisma.$queryRawUnsafe(`
        SELECT id, "nomeArquivo", "totalRegistros", "totalValor", "periodoInicio", "periodoFim", "criadoEm", "frota"
        FROM "importacoes_consumo"
        ORDER BY "criadoEm" DESC
      `);
    } catch {
      lista = await prisma.$queryRawUnsafe(`
        SELECT id, "nomeArquivo", "totalRegistros", NULL::numeric AS "totalValor", "periodoInicio", "periodoFim", "criadoEm", NULL::text AS "frota"
        FROM "importacoes_consumo"
        ORDER BY "criadoEm" DESC
      `);
    }
    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar importações' });
  }
});

// helper: monta WHERE + JOIN a partir de { importacaoId, frota, motorista, mes, ano }
function buildWhere(query) {
  const params = [];
  let i = 1;
  const joins = `JOIN "importacoes_consumo" ic ON r."importacaoId" = ic."id"`;
  let where = 'WHERE 1=1';

  if (query.importacaoId) { where += ` AND r."importacaoId" = $${i++}`; params.push(query.importacaoId); }
  if (query.frota) {
    const fn = normFrota(query.frota);
    if (fn === 'BAÚ') {
      // aceita 'BAÚ' e 'BAU' (com e sem acento) no banco
      where += ` AND COALESCE(r."frota", ic."frota") IN ($${i++}, $${i++})`;
      params.push('BAÚ', 'BAU');
    } else {
      where += ` AND COALESCE(r."frota", ic."frota") = $${i++}`;
      params.push(fn);
    }
  }
  if (query.motorista)    { where += ` AND r."motorista" ILIKE $${i++}`; params.push(query.motorista); }
  if (query.placa)        { where += ` AND r."placa" ILIKE $${i++}`;     params.push(query.placa); }
  if (query.mes && query.ano) {
    where += ` AND EXTRACT(MONTH FROM r."data") = $${i++} AND EXTRACT(YEAR FROM r."data") = $${i++}`;
    params.push(parseInt(query.mes), parseInt(query.ano));
  } else if (query.ano) {
    where += ` AND EXTRACT(YEAR FROM r."data") = $${i++}`;
    params.push(parseInt(query.ano));
  }
  return { joins, where, params };
}

// GET /api/medias-consumo?importacaoId=X | frota=Y | motorista=Z
router.get('/', async (req, res) => {
  try {
    let registros;
    try {
      const { joins, where, params } = buildWhere(req.query);
      registros = await prisma.$queryRawUnsafe(`
        SELECT r.*
        FROM "registros_consumo" r
        ${joins}
        ${where}
        ORDER BY r."data" ASC, r."motorista" ASC
      `, ...params);
    } catch {
      // fallback sem filtro de frota (caso coluna ainda não exista)
      const { joins, where, params } = buildWhere({ ...req.query, frota: undefined });
      registros = await prisma.$queryRawUnsafe(`
        SELECT r.*
        FROM "registros_consumo" r
        ${joins}
        ${where}
        ORDER BY r."data" ASC, r."motorista" ASC
      `, ...params);
    }
    res.json(registros);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar registros' });
  }
});

// GET /api/medias-consumo/resumo-mensal?importacaoId=X | frota=Y | motorista=Z
router.get('/resumo-mensal', async (req, res) => {
  try {
    const { joins, where, params } = buildWhere(req.query);
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        TO_CHAR(r."data", 'YYYY-MM') AS mes,
        SUM(r."vlrTotal") AS "totalGasto",
        SUM(CASE WHEN LOWER(r."produto") LIKE '%diesel%' AND r."distancia" > 0 THEN r."distancia" ELSE 0 END) AS "totalKm",
        SUM(CASE WHEN LOWER(r."produto") LIKE '%diesel%' AND r."distancia" > 0 THEN r."litros"    ELSE 0 END) AS "totalLitros",
        SUM(CASE WHEN LOWER(r."produto") LIKE '%arla%'   THEN r."litros"    ELSE 0 END) AS "totalArla",
        COUNT(DISTINCT r."placa") AS "totalCaminhoes"
      FROM "registros_consumo" r
      ${joins}
      ${where}
      GROUP BY mes
      ORDER BY mes ASC
    `, ...params);

    res.json(rows.map(r => ({
      mes:            r.mes,
      totalGasto:     Number(r.totalGasto     || 0),
      totalKm:        Number(r.totalKm        || 0),
      totalLitros:    Number(r.totalLitros    || 0),
      totalArla:      Number(r.totalArla      || 0),
      totalCaminhoes: Number(r.totalCaminhoes || 0),
      mediaReal:      Number(r.totalLitros) > 0 ? Number(r.totalKm) / Number(r.totalLitros) : 0,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar resumo mensal' });
  }
});

// GET /api/medias-consumo/meses?importacaoId=X | frota=Y
router.get('/meses', async (req, res) => {
  try {
    const { joins, where, params } = buildWhere(req.query);
    const lista = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT TO_CHAR(r."data", 'YYYY-MM') AS mes
      FROM "registros_consumo" r
      ${joins}
      ${where}
      ORDER BY mes ASC
    `, ...params);
    res.json(lista.map(r => r.mes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar meses' });
  }
});

// GET /api/medias-consumo/motoristas?importacaoId=X | frota=Y
router.get('/motoristas', async (req, res) => {
  try {
    const { joins, where, params } = buildWhere(req.query);
    const lista = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT r."motorista"
      FROM "registros_consumo" r
      ${joins}
      ${where}
      ORDER BY r."motorista" ASC
    `, ...params);
    res.json(lista.map(r => r.motorista));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar motoristas' });
  }
});

// GET /api/medias-consumo/placas?importacaoId=X | frota=Y
router.get('/placas', async (req, res) => {
  try {
    const { joins, where, params } = buildWhere(req.query);
    const lista = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT r."placa"
      FROM "registros_consumo" r
      ${joins}
      ${where}
      AND r."placa" IS NOT NULL AND r."placa" <> ''
      ORDER BY r."placa" ASC
    `, ...params);
    res.json(lista.map(r => r.placa));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar placas' });
  }
});

// GET /api/medias-consumo/resumo-motoristas?frota=X&mes=M&ano=A
router.get('/resumo-motoristas', async (req, res) => {
  try {
    const { joins, where, params } = buildWhere(req.query);
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        r."motorista",
        STRING_AGG(DISTINCT r."placa", ', ') AS "placas",
        STRING_AGG(DISTINCT r."conjunto", ', ') AS "conjuntos",
        SUM(r."vlrTotal") AS "totalGasto",
        SUM(CASE WHEN LOWER(r."produto") LIKE '%diesel%' AND r."distancia" > 0 THEN r."distancia" ELSE 0 END) AS "totalKm",
        SUM(CASE WHEN LOWER(r."produto") LIKE '%diesel%' AND r."distancia" > 0 THEN r."litros"    ELSE 0 END) AS "totalLitros",
        AVG(CASE WHEN LOWER(r."produto") LIKE '%diesel%' AND r."mediaSugerida" > 0 THEN r."mediaSugerida" END) AS "mediaSug"
      FROM "registros_consumo" r
      ${joins}
      ${where}
      GROUP BY r."motorista"
      ORDER BY r."motorista" ASC
    `, ...params);


    res.json(rows.map(r => {
      const totalKm     = Number(r.totalKm     || 0);
      const totalLitros = Number(r.totalLitros || 0);
      const mediaReal   = totalLitros > 0 ? totalKm / totalLitros : 0;
      const mediaSug    = Number(r.mediaSug    || 0);
      const perc        = mediaSug > 0 ? (mediaReal / mediaSug) * 100 : 0;
      return {
        motorista:   r.motorista,
        placas:      r.placas    || '—',
        conjuntos:   r.conjuntos || '',
        totalGasto:  Number(r.totalGasto || 0),
        totalKm, totalLitros, mediaReal, mediaSug, perc,
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar resumo por motorista' });
  }
});

// normalização de nome (igual ao nomeAliases.js)
function normNome(s) {
  return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

// normalização de frota: converte variantes de BAU/BAÚ para 'BAÚ'
function normFrota(v) {
  const u = String(v || '').toUpperCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (u === 'BAU') return 'BAÚ';
  if (u === 'FROTA') return 'FROTA';
  return String(v || '').toUpperCase().trim();
}

// Garante que a coluna motoristaId existe (migration automática)
async function garantirColunaMotoristId() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "registros_consumo"
    ADD COLUMN IF NOT EXISTS "motoristaId" TEXT REFERENCES "motoristas"("id") ON DELETE SET NULL
  `);
}

// Garante coluna totalValor na importação
async function garantirColunaValorTotal() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "importacoes_consumo"
    ADD COLUMN IF NOT EXISTS "totalValor" NUMERIC(14,2)
  `);
}

// Garante coluna frota por registro (para separar BAÚ/FROTA dentro de uma importação)
async function garantirColunaFrotaRegistro() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "registros_consumo"
    ADD COLUMN IF NOT EXISTS "frota" TEXT
  `);
}

// Monta mapa NORM_NOME → motoristaId a partir da tabela motoristas
async function buildMotoristaMap() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, nome FROM "motoristas" WHERE excluido = false`
  );
  const map = {};
  for (const row of rows) map[normNome(row.nome)] = row.id;
  return map;
}

// GET /api/medias-consumo/painel-motoristas  (lista com dados para o dashboard)
router.get('/painel-motoristas', async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        r.motorista,
        r."motoristaId",
        m.frota,
        m.status,
        m.categoria,
        (
          SELECT r2.placa FROM "registros_consumo" r2
          WHERE r2.motorista = r.motorista AND r2.placa IS NOT NULL AND r2.placa <> ''
          ORDER BY r2.data DESC LIMIT 1
        ) AS placa_atual,
        COUNT(*)::int                                  AS total_registros,
        MAX(r.data)                                    AS ultima_data,
        SUM(CASE WHEN LOWER(r.produto) LIKE '%diesel%' AND r.distancia > 0 THEN r.distancia ELSE 0 END) AS total_km,
        SUM(CASE WHEN LOWER(r.produto) LIKE '%diesel%' AND r.distancia > 0 THEN r.litros    ELSE 0 END) AS total_litros
      FROM "registros_consumo" r
      LEFT JOIN "motoristas" m ON m.id = r."motoristaId"
      WHERE r.motorista IS NOT NULL AND r.motorista <> ''
      GROUP BY r.motorista, r."motoristaId", m.frota, m.status, m.categoria
      ORDER BY r.motorista ASC
    `);
    res.json(rows.map(r => ({
      ...r,
      total_registros: Number(r.total_registros || 0),
      total_km:        Number(r.total_km        || 0),
      total_litros:    Number(r.total_litros    || 0),
      media_geral:     Number(r.total_litros) > 0 ? Number(r.total_km) / Number(r.total_litros) : 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/medias-consumo/motoristas-nomes  (para matching no import — sem exigir permissão de motoristas)
router.get('/motoristas-nomes', async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM "motoristas" WHERE excluido = false ORDER BY nome ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/medias-consumo/importar
router.post('/importar', async (req, res) => {
  try {
    const { nomeArquivo, registros, frota } = req.body;
    if (!nomeArquivo || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: 'nomeArquivo e registros são obrigatórios' });
    }

    // Garantir colunas
    await garantirColunaMotoristId();
    await garantirColunaValorTotal();
    await garantirColunaFrotaRegistro();

    // Mapa nome → id
    const motoristaMap = await buildMotoristaMap();

    // Filtrar apenas registros com data e motorista válidos
    const validos = registros.filter(r => r.data && r.motorista);

    const importacaoId = randomUUID();
    const datas = validos.map(r => r.data).sort();
    const periodoInicio = datas[0] || null;
    const periodoFim = datas[datas.length - 1] || null;

    // Inserir cabeçalho da importação
    await prisma.$executeRawUnsafe(`
      INSERT INTO "importacoes_consumo" ("id","nomeArquivo","totalRegistros","periodoInicio","periodoFim","usuarioId","criadoEm","frota")
      VALUES ($1,$2,$3,$4::date,$5::date,$6,NOW(),$7)
    `, importacaoId, nomeArquivo, validos.length, periodoInicio, periodoFim, req.usuario.id, frota || 'BAÚ');

    // Inserir registros em lotes de 100 com multi-row INSERT (muito mais rápido)
    const LOTE = 100;
    for (let i = 0; i < validos.length; i += LOTE) {
      const lote = validos.slice(i, i + LOTE);
      const params = [];
      const placeholders = lote.map((r, idx) => {
        const base = idx * 23;
        const motoristaId = motoristaMap[normNome(r.motorista)] || null;
        params.push(
          randomUUID(), importacaoId, r.data, r.motorista,
          r.placa || null, r.modelo || null, r.conjunto || null,
          r.kmInicial || null, r.kmFinal || null, r.distancia || null,
          r.posto || null, r.cidade || null, r.uf || null,
          r.precoLitro || null, r.litros || null, r.produto || null, r.vlrTotal || null,
          r.mediaRealizada || null, r.mediaSugerida || null, r.percAtingido || null, r.gap || null,
          motoristaId, normFrota(r.frota || frota || 'BAÚ')
        );
        const n = (k) => `$${base + k}`;
        return `(${n(1)},${n(2)},${n(3)}::date,${n(4)},${n(5)},${n(6)},${n(7)},${n(8)},${n(9)},${n(10)},${n(11)},${n(12)},${n(13)},${n(14)},${n(15)},${n(16)},${n(17)},${n(18)},${n(19)},${n(20)},${n(21)},${n(22)},${n(23)})`;
      }).join(',');

      await prisma.$executeRawUnsafe(`
        INSERT INTO "registros_consumo" (
          "id","importacaoId","data","motorista","placa","modelo","conjunto",
          "kmInicial","kmFinal","distancia","posto","cidade","uf",
          "precoLitro","litros","produto","vlrTotal",
          "mediaRealizada","mediaSugerida","percAtingido","gap","motoristaId","frota"
        ) VALUES ${placeholders}
      `, ...params);
    }

    // Atualizar totalValor acumulado
    await prisma.$executeRawUnsafe(`
      UPDATE "importacoes_consumo"
      SET "totalValor" = (SELECT COALESCE(SUM("vlrTotal"),0) FROM "registros_consumo" WHERE "importacaoId" = $1)
      WHERE "id" = $1
    `, importacaoId);

    res.status(201).json({ ok: true, importacaoId, total: validos.length });
  } catch (err) {
    console.error('Erro ao importar:', err);
    res.status(500).json({ error: 'Erro ao importar registros: ' + err.message });
  }
});

// POST /api/medias-consumo/importacoes/:id/registros  (append chunks)
router.post('/importacoes/:id/registros', async (req, res) => {
  try {
    const { registros } = req.body;
    const { id: importacaoId } = req.params;
    if (!Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: 'registros é obrigatório' });
    }
    const validos = registros.filter(r => r.data && r.motorista);

    await garantirColunaMotoristId();
    await garantirColunaValorTotal();
    await garantirColunaFrotaRegistro();
    const motoristaMap = await buildMotoristaMap();

    // Buscar frota do cabeçalho da importação (fallback para registros sem frota)
    const [imp] = await prisma.$queryRawUnsafe(
      `SELECT "frota" FROM "importacoes_consumo" WHERE "id" = $1`, importacaoId
    );
    const frotaImport = imp?.frota || 'BAÚ';

    const LOTE = 100;
    for (let i = 0; i < validos.length; i += LOTE) {
      const lote = validos.slice(i, i + LOTE);
      const params = [];
      const placeholders = lote.map((r, idx) => {
        const base = idx * 23;
        const motoristaId = motoristaMap[normNome(r.motorista)] || null;
        params.push(
          randomUUID(), importacaoId, r.data, r.motorista,
          r.placa || null, r.modelo || null, r.conjunto || null,
          r.kmInicial || null, r.kmFinal || null, r.distancia || null,
          r.posto || null, r.cidade || null, r.uf || null,
          r.precoLitro || null, r.litros || null, r.produto || null, r.vlrTotal || null,
          r.mediaRealizada || null, r.mediaSugerida || null, r.percAtingido || null, r.gap || null,
          motoristaId, normFrota(r.frota || frotaImport)
        );
        const n = (k) => `$${base + k}`;
        return `(${n(1)},${n(2)},${n(3)}::date,${n(4)},${n(5)},${n(6)},${n(7)},${n(8)},${n(9)},${n(10)},${n(11)},${n(12)},${n(13)},${n(14)},${n(15)},${n(16)},${n(17)},${n(18)},${n(19)},${n(20)},${n(21)},${n(22)},${n(23)})`;
      }).join(',');
      await prisma.$executeRawUnsafe(`
        INSERT INTO "registros_consumo" (
          "id","importacaoId","data","motorista","placa","modelo","conjunto",
          "kmInicial","kmFinal","distancia","posto","cidade","uf",
          "precoLitro","litros","produto","vlrTotal",
          "mediaRealizada","mediaSugerida","percAtingido","gap","motoristaId","frota"
        ) VALUES ${placeholders}
      `, ...params);
    }

    // Atualizar totais na importação
    await prisma.$executeRawUnsafe(`
      UPDATE "importacoes_consumo"
      SET "totalRegistros" = (SELECT COUNT(*) FROM "registros_consumo" WHERE "importacaoId" = $1),
          "totalValor"     = (SELECT COALESCE(SUM("vlrTotal"),0) FROM "registros_consumo" WHERE "importacaoId" = $1)
      WHERE "id" = $1
    `, importacaoId);

    res.json({ ok: true, inseridos: validos.length });
  } catch (err) {
    console.error('Erro ao anexar registros:', err);
    res.status(500).json({ error: 'Erro ao inserir registros: ' + err.message });
  }
});

// DELETE /api/medias-consumo/importacoes/:id
router.delete('/importacoes/:id', async (req, res) => {
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "importacoes_consumo" WHERE "id" = $1`, req.params.id
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir importação' });
  }
});

/* ══════════════════════════════════════════════
   REDES DE POSTOS
   ══════════════════════════════════════════════ */

async function garantirTabelasRede() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "redes_posto" (
      "id"       TEXT PRIMARY KEY,
      "nome"     TEXT NOT NULL UNIQUE,
      "criadoEm" TIMESTAMP DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "postos_rede" (
      "posto"   TEXT PRIMARY KEY,
      "redeId"  TEXT REFERENCES "redes_posto"("id") ON DELETE SET NULL
    )
  `);
}

// GET /api/medias-consumo/redes
router.get('/redes', async (req, res) => {
  try {
    await garantirTabelasRede();
    const redes = await prisma.$queryRawUnsafe(`
      SELECT r.id, r.nome, COUNT(p.posto)::int AS total_postos
      FROM "redes_posto" r
      LEFT JOIN "postos_rede" p ON p."redeId" = r.id
      GROUP BY r.id, r.nome
      ORDER BY r.nome ASC
    `);
    res.json(redes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/medias-consumo/redes
router.post('/redes', async (req, res) => {
  try {
    await garantirTabelasRede();
    const { nome } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "redes_posto" ("id","nome") VALUES ($1,$2)`, id, nome.trim()
    );
    res.status(201).json({ id, nome: nome.trim(), total_postos: 0 });
  } catch (err) {
    if (err.message.includes('unique') || err.message.includes('duplicate')) {
      return res.status(409).json({ error: 'Rede já existe' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/medias-consumo/redes/:id
router.delete('/redes/:id', async (req, res) => {
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "redes_posto" WHERE "id" = $1`, req.params.id
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/medias-consumo/postos-lista
router.get('/postos-lista', async (req, res) => {
  try {
    await garantirTabelasRede();
    const { joins, where, params } = buildWhere(req.query);
    const postos = await prisma.$queryRawUnsafe(`
      SELECT
        base."posto",
        base.total_registros,
        base.total_gasto,
        pr."redeId",
        rp."nome" AS rede_nome
      FROM (
        SELECT
          r."posto",
          COUNT(*)::int     AS total_registros,
          SUM(r."vlrTotal") AS total_gasto
        FROM "registros_consumo" r
        ${joins}
        ${where}
        AND r."posto" IS NOT NULL AND r."posto" <> ''
        AND LOWER(r."produto") LIKE '%diesel%'
        GROUP BY r."posto"
      ) base
      LEFT JOIN "postos_rede" pr ON pr."posto" = base."posto"
      LEFT JOIN "redes_posto" rp ON rp."id"   = pr."redeId"
      ORDER BY base."posto" ASC
    `, ...params);
    res.json(postos.map(p => ({
      posto:          p.posto,
      totalRegistros: Number(p.total_registros || 0),
      totalGasto:     Number(p.total_gasto     || 0),
      redeId:         p.redeId   || null,
      redeNome:       p.rede_nome || null,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/medias-consumo/postos-vincular
router.post('/postos-vincular', async (req, res) => {
  try {
    await garantirTabelasRede();
    const { postos, redeId } = req.body;
    if (!Array.isArray(postos) || postos.length === 0)
      return res.status(400).json({ error: 'postos é obrigatório' });
    for (const posto of postos) {
      if (redeId) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "postos_rede" ("posto","redeId") VALUES ($1,$2)
           ON CONFLICT ("posto") DO UPDATE SET "redeId" = $2`,
          posto, redeId
        );
      } else {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "postos_rede" WHERE "posto" = $1`, posto
        );
      }
    }
    res.json({ ok: true, vinculados: postos.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/medias-consumo/ranking-redes
router.get('/ranking-redes', async (req, res) => {
  try {
    await garantirTabelasRede();
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        rp.id,
        rp.nome,
        COUNT(DISTINCT r."posto")::int   AS total_postos,
        COUNT(*)::int                    AS total_registros,
        SUM(r."vlrTotal")                AS total_gasto,
        SUM(r."litros")                  AS total_litros,
        AVG(r."precoLitro")              AS preco_medio
      FROM "registros_consumo" r
      JOIN "postos_rede"  pr ON pr."posto"  = r."posto"
      JOIN "redes_posto"  rp ON rp."id"     = pr."redeId"
      WHERE LOWER(r."produto") LIKE '%diesel%'
      GROUP BY rp.id, rp.nome
      ORDER BY total_gasto DESC
    `);
    const totalGasto = rows.reduce((a, r) => a + Number(r.total_gasto || 0), 0);
    res.json(rows.map(r => ({
      id:             r.id,
      nome:           r.nome,
      totalPostos:    Number(r.total_postos    || 0),
      totalRegistros: Number(r.total_registros || 0),
      totalGasto:     Number(r.total_gasto     || 0),
      totalLitros:    Number(r.total_litros    || 0),
      precoMedio:     Number(r.preco_medio     || 0),
      percentual:     totalGasto > 0 ? (Number(r.total_gasto || 0) / totalGasto) * 100 : 0,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/medias-consumo/ranking-redes/:redeId/por-uf
router.get('/ranking-redes/:redeId/por-uf', async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        UPPER(TRIM(r."uf")) AS uf,
        COUNT(*)::int        AS total_registros,
        SUM(r."vlrTotal")    AS total_gasto,
        SUM(r."litros")      AS total_litros,
        AVG(r."precoLitro")  AS preco_medio
      FROM "registros_consumo" r
      JOIN "postos_rede" pr ON pr."posto" = r."posto" AND pr."redeId" = $1
      WHERE LOWER(r."produto") LIKE '%diesel%'
        AND r."uf" IS NOT NULL AND r."uf" <> ''
      GROUP BY UPPER(TRIM(r."uf"))
      ORDER BY total_gasto DESC
    `, req.params.redeId);
    const totalGasto = rows.reduce((a, r) => a + Number(r.total_gasto || 0), 0);
    res.json(rows.map(r => ({
      uf:             r.uf,
      totalRegistros: Number(r.total_registros || 0),
      totalGasto:     Number(r.total_gasto     || 0),
      totalLitros:    Number(r.total_litros    || 0),
      precoMedio:     Number(r.preco_medio     || 0),
      percentual:     totalGasto > 0 ? (Number(r.total_gasto || 0) / totalGasto) * 100 : 0,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/medias-consumo/por-uf?frota=X
router.get('/por-uf', async (req, res) => {
  try {
    const { joins, where, params } = buildWhere(req.query);
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        UPPER(TRIM(r."uf")) AS uf,
        COUNT(*)::int AS total_registros,
        SUM(r."vlrTotal") AS total_gasto,
        SUM(r."litros") AS total_litros,
        AVG(r."precoLitro") AS preco_medio
      FROM "registros_consumo" r
      ${joins}
      ${where}
      AND r."uf" IS NOT NULL AND r."uf" <> ''
      AND LOWER(r."produto") LIKE '%diesel%'
      GROUP BY UPPER(TRIM(r."uf"))
      ORDER BY total_gasto DESC
    `, ...params);

    const totalGasto = rows.reduce((acc, r) => acc + Number(r.total_gasto || 0), 0);

    res.json(rows.map(r => ({
      uf:              r.uf,
      totalRegistros:  Number(r.total_registros || 0),
      totalGasto:      Number(r.total_gasto     || 0),
      totalLitros:     Number(r.total_litros    || 0),
      precoMedio:      Number(r.preco_medio     || 0),
      percentual:      totalGasto > 0 ? (Number(r.total_gasto || 0) / totalGasto) * 100 : 0,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar dados por UF' });
  }
});

// GET /api/medias-consumo/consulta-posto?posto=X
router.get('/consulta-posto', async (req, res) => {
  const { posto } = req.query;
  if (!posto) return res.status(400).json({ error: 'posto é obrigatório' });
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        TO_CHAR(r."data", 'YYYY-MM') AS mes,
        AVG(r."precoLitro")          AS preco_medio,
        SUM(r."litros")              AS total_litros,
        SUM(r."vlrTotal")            AS total_gasto,
        COUNT(*)::int                AS total_registros
      FROM "registros_consumo" r
      WHERE r."posto" = $1
        AND LOWER(r."produto") LIKE '%diesel%'
        AND r."data" IS NOT NULL
      GROUP BY mes
      ORDER BY mes ASC
    `, posto);
    res.json(rows.map(r => ({
      mes:            r.mes,
      precoMedio:     Number(r.preco_medio     || 0),
      totalLitros:    Number(r.total_litros    || 0),
      totalGasto:     Number(r.total_gasto     || 0),
      totalRegistros: Number(r.total_registros || 0),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao consultar posto' });
  }
});

/* ══════════════════════════════════════════════
   CADASTRO DE PLACAS
   ══════════════════════════════════════════════ */

async function garantirTabelaCadastroPLacas() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "cadastro_placas" (
      "placa"   TEXT PRIMARY KEY,
      "frota"   TEXT NOT NULL,
      "modelo"  TEXT,
      "ativo"   BOOLEAN NOT NULL DEFAULT true,
      "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// GET /api/medias-consumo/cadastro-placas
router.get('/cadastro-placas', async (req, res) => {
  try {
    await garantirTabelaCadastroPLacas();
    const rows = await prisma.$queryRawUnsafe(`
      SELECT placa, frota, modelo, ativo, "criadoEm", "atualizadoEm"
      FROM "cadastro_placas"
      ORDER BY frota, placa
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar placas' });
  }
});

// POST /api/medias-consumo/cadastro-placas/backfill-frota
// Preenche r."frota" nos registros_consumo que ainda estão NULL, usando cadastro_placas
router.post('/cadastro-placas/backfill-frota', async (req, res) => {
  try {
    await garantirColunaFrotaRegistro();
    const result = await prisma.$executeRawUnsafe(`
      UPDATE "registros_consumo" r
      SET "frota" = CASE
        WHEN UPPER(TRIM(cp."frota")) IN ('BAU','BAÚ') THEN 'BAÚ'
        ELSE UPPER(TRIM(cp."frota"))
      END
      FROM "cadastro_placas" cp
      WHERE UPPER(TRIM(r."placa")) = cp."placa"
        AND (r."frota" IS NULL OR UPPER(TRIM(r."frota")) IN ('BAU','BAÚ'))
    `);
    res.json({ ok: true, atualizados: Number(result) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/medias-consumo/cadastro-placas/importar  (upsert em lote)
router.post('/cadastro-placas/importar', async (req, res) => {
  try {
    const { placas } = req.body; // [{ placa, frota, modelo }]
    if (!Array.isArray(placas) || placas.length === 0) {
      return res.status(400).json({ error: 'placas é obrigatório' });
    }
    await garantirTabelaCadastroPLacas();

    let inseridas = 0, atualizadas = 0;
    for (const p of placas) {
      const placa  = String(p.placa  || '').toUpperCase().trim();
      const frota  = String(p.frota  || '').trim();
      const modelo = p.modelo ? String(p.modelo).trim() : null;
      if (!placa || !frota) continue;

      const existing = await prisma.$queryRawUnsafe(
        `SELECT placa FROM "cadastro_placas" WHERE placa = $1`, placa
      );
      if (existing.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "cadastro_placas" SET frota=$1, modelo=$2, ativo=true, "atualizadoEm"=NOW() WHERE placa=$3`,
          frota, modelo, placa
        );
        atualizadas++;
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "cadastro_placas" (placa, frota, modelo) VALUES ($1,$2,$3)`,
          placa, frota, modelo
        );
        inseridas++;
      }
    }
    res.json({ ok: true, inseridas, atualizadas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao importar placas: ' + err.message });
  }
});

// PATCH /api/medias-consumo/cadastro-placas/:placa  (atualizar frota de uma placa)
router.patch('/cadastro-placas/:placa', async (req, res) => {
  try {
    const placa = String(req.params.placa).toUpperCase().trim();
    const { frota, modelo } = req.body;
    await garantirTabelaCadastroPLacas();

    const existing = await prisma.$queryRawUnsafe(
      `SELECT placa FROM "cadastro_placas" WHERE placa = $1`, placa
    );
    if (existing.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "cadastro_placas" SET frota=$1, modelo=$2, ativo=true, "atualizadoEm"=NOW() WHERE placa=$3`,
        frota, modelo || null, placa
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "cadastro_placas" (placa, frota, modelo) VALUES ($1,$2,$3)`,
        placa, frota, modelo || null
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar placa' });
  }
});

// DELETE /api/medias-consumo/cadastro-placas/:placa
router.delete('/cadastro-placas/:placa', async (req, res) => {
  try {
    const placa = String(req.params.placa).toUpperCase().trim();
    await prisma.$executeRawUnsafe(`DELETE FROM "cadastro_placas" WHERE placa = $1`, placa);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir placa' });
  }
});

module.exports = router;
