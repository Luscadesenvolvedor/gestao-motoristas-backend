const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, exigirSetor } = require('../middleware/auth');
const { randomUUID } = require('crypto');
const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar, exigirSetor('abastecimento'));
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// GET /api/medias-consumo/importacoes
router.get('/importacoes', async (req, res) => {
  try {
    const lista = await prisma.$queryRawUnsafe(`
      SELECT id, "nomeArquivo", "totalRegistros", "periodoInicio", "periodoFim", "criadoEm", "frota"
      FROM "importacoes_consumo"
      ORDER BY "criadoEm" DESC
    `);
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
  if (query.frota)        { where += ` AND ic."frota" = $${i++}`;        params.push(query.frota); }
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
    const { joins, where, params } = buildWhere(req.query);
    const registros = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM "registros_consumo" r
      ${joins}
      ${where}
      ORDER BY r."data" ASC, r."motorista" ASC
    `, ...params);
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
        SUM(CASE WHEN LOWER(r."produto") LIKE '%diesel%' THEN r."distancia" ELSE 0 END) AS "totalKm",
        SUM(CASE WHEN LOWER(r."produto") LIKE '%diesel%' THEN r."litros"    ELSE 0 END) AS "totalLitros",
        SUM(CASE WHEN LOWER(r."produto") LIKE '%arla%'   THEN r."litros"    ELSE 0 END) AS "totalArla"
      FROM "registros_consumo" r
      ${joins}
      ${where}
      GROUP BY mes
      ORDER BY mes ASC
    `, ...params);

    res.json(rows.map(r => ({
      mes:         r.mes,
      totalGasto:  Number(r.totalGasto  || 0),
      totalKm:     Number(r.totalKm     || 0),
      totalLitros: Number(r.totalLitros || 0),
      totalArla:   Number(r.totalArla   || 0),
      mediaReal:   Number(r.totalLitros) > 0 ? Number(r.totalKm) / Number(r.totalLitros) : 0,
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
        SUM(r."vlrTotal") AS "totalGasto",
        SUM(CASE WHEN LOWER(r."produto") LIKE '%diesel%' THEN r."distancia" ELSE 0 END) AS "totalKm",
        SUM(CASE WHEN LOWER(r."produto") LIKE '%diesel%' THEN r."litros"    ELSE 0 END) AS "totalLitros",
        AVG(CASE WHEN LOWER(r."produto") LIKE '%diesel%' AND r."mediaSugerida" > 0 THEN r."mediaSugerida" END) AS "mediaSug"
      FROM "registros_consumo" r
      ${joins}
      ${where}
      GROUP BY r."motorista"
      ORDER BY r."motorista" ASC
    `, ...params);

    // debug: ver o que vem do banco
    if (rows.length > 0) console.log('[resumo-motoristas] sample row:', JSON.stringify(rows[0]));

    res.json(rows.map(r => {
      const totalKm     = Number(r.totalKm     || 0);
      const totalLitros = Number(r.totalLitros || 0);
      const mediaReal   = totalLitros > 0 ? totalKm / totalLitros : 0;
      const mediaSug    = Number(r.mediaSug    || 0);
      const perc        = mediaSug > 0 ? (mediaReal / mediaSug) * 100 : 0;
      return {
        motorista:   r.motorista,
        placas:      r.placas || '—',
        totalGasto:  Number(r.totalGasto || 0),
        totalKm, totalLitros, mediaReal, mediaSug, perc,
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar resumo por motorista' });
  }
});

// POST /api/medias-consumo/importar
router.post('/importar', async (req, res) => {
  try {
    const { nomeArquivo, registros, frota } = req.body;
    if (!nomeArquivo || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: 'nomeArquivo e registros são obrigatórios' });
    }

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
        const base = idx * 21;
        params.push(
          randomUUID(), importacaoId, r.data, r.motorista,
          r.placa || null, r.modelo || null, r.conjunto || null,
          r.kmInicial || null, r.kmFinal || null, r.distancia || null,
          r.posto || null, r.cidade || null, r.uf || null,
          r.precoLitro || null, r.litros || null, r.produto || null, r.vlrTotal || null,
          r.mediaRealizada || null, r.mediaSugerida || null, r.percAtingido || null, r.gap || null
        );
        const n = (k) => `$${base + k}`;
        return `(${n(1)},${n(2)},${n(3)}::date,${n(4)},${n(5)},${n(6)},${n(7)},${n(8)},${n(9)},${n(10)},${n(11)},${n(12)},${n(13)},${n(14)},${n(15)},${n(16)},${n(17)},${n(18)},${n(19)},${n(20)},${n(21)})`;
      }).join(',');

      await prisma.$executeRawUnsafe(`
        INSERT INTO "registros_consumo" (
          "id","importacaoId","data","motorista","placa","modelo","conjunto",
          "kmInicial","kmFinal","distancia","posto","cidade","uf",
          "precoLitro","litros","produto","vlrTotal",
          "mediaRealizada","mediaSugerida","percAtingido","gap"
        ) VALUES ${placeholders}
      `, ...params);
    }

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

    const LOTE = 100;
    for (let i = 0; i < validos.length; i += LOTE) {
      const lote = validos.slice(i, i + LOTE);
      const params = [];
      const placeholders = lote.map((r, idx) => {
        const base = idx * 21;
        params.push(
          randomUUID(), importacaoId, r.data, r.motorista,
          r.placa || null, r.modelo || null, r.conjunto || null,
          r.kmInicial || null, r.kmFinal || null, r.distancia || null,
          r.posto || null, r.cidade || null, r.uf || null,
          r.precoLitro || null, r.litros || null, r.produto || null, r.vlrTotal || null,
          r.mediaRealizada || null, r.mediaSugerida || null, r.percAtingido || null, r.gap || null
        );
        const n = (k) => `$${base + k}`;
        return `(${n(1)},${n(2)},${n(3)}::date,${n(4)},${n(5)},${n(6)},${n(7)},${n(8)},${n(9)},${n(10)},${n(11)},${n(12)},${n(13)},${n(14)},${n(15)},${n(16)},${n(17)},${n(18)},${n(19)},${n(20)},${n(21)})`;
      }).join(',');
      await prisma.$executeRawUnsafe(`
        INSERT INTO "registros_consumo" (
          "id","importacaoId","data","motorista","placa","modelo","conjunto",
          "kmInicial","kmFinal","distancia","posto","cidade","uf",
          "precoLitro","litros","produto","vlrTotal",
          "mediaRealizada","mediaSugerida","percAtingido","gap"
        ) VALUES ${placeholders}
      `, ...params);
    }

    // Atualizar total de registros na importação
    await prisma.$executeRawUnsafe(`
      UPDATE "importacoes_consumo"
      SET "totalRegistros" = (SELECT COUNT(*) FROM "registros_consumo" WHERE "importacaoId" = $1)
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

module.exports = router;
