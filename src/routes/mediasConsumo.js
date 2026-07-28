const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, exigirSetor } = require('../middleware/auth');
const { randomUUID } = require('crypto');
const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar, exigirSetor('abastecimento'));

// GET /api/medias-consumo/importacoes
router.get('/importacoes', async (req, res) => {
  try {
    const lista = await prisma.$queryRawUnsafe(`
      SELECT id, "nomeArquivo", "totalRegistros", "periodoInicio", "periodoFim", "criadoEm"
      FROM "importacoes_consumo"
      ORDER BY "criadoEm" DESC
    `);
    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar importações' });
  }
});

// GET /api/medias-consumo?motorista=X&mes=7&ano=2026
router.get('/', async (req, res) => {
  try {
    const { motorista, mes, ano, importacaoId } = req.query;

    let where = `WHERE 1=1`;
    const params = [];
    let i = 1;

    if (importacaoId) {
      where += ` AND r."importacaoId" = $${i++}`;
      params.push(importacaoId);
    }
    if (motorista) {
      where += ` AND r."motorista" ILIKE $${i++}`;
      params.push(motorista);
    }
    if (mes && ano) {
      where += ` AND EXTRACT(MONTH FROM r."data") = $${i++} AND EXTRACT(YEAR FROM r."data") = $${i++}`;
      params.push(parseInt(mes), parseInt(ano));
    } else if (ano) {
      where += ` AND EXTRACT(YEAR FROM r."data") = $${i++}`;
      params.push(parseInt(ano));
    }

    const registros = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM "registros_consumo" r
      ${where}
      ORDER BY r."data" ASC, r."motorista" ASC
    `, ...params);

    res.json(registros);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar registros' });
  }
});

// GET /api/medias-consumo/meses?importacaoId=X
router.get('/meses', async (req, res) => {
  try {
    const { importacaoId } = req.query;
    let where = importacaoId ? `WHERE "importacaoId" = $1` : '';
    const params = importacaoId ? [importacaoId] : [];

    const lista = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT TO_CHAR("data", 'YYYY-MM') AS mes
      FROM "registros_consumo"
      ${where}
      ORDER BY mes ASC
    `, ...params);

    res.json(lista.map(r => r.mes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar meses' });
  }
});

// GET /api/medias-consumo/motoristas?importacaoId=X
router.get('/motoristas', async (req, res) => {
  try {
    const { importacaoId } = req.query;
    let where = importacaoId ? `WHERE "importacaoId" = $1` : '';
    const params = importacaoId ? [importacaoId] : [];

    const lista = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT "motorista"
      FROM "registros_consumo"
      ${where}
      ORDER BY "motorista" ASC
    `, ...params);

    res.json(lista.map(r => r.motorista));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar motoristas' });
  }
});

// POST /api/medias-consumo/importar
router.post('/importar', async (req, res) => {
  try {
    const { nomeArquivo, registros } = req.body;
    if (!nomeArquivo || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: 'nomeArquivo e registros são obrigatórios' });
    }

    const importacaoId = randomUUID();
    const datas = registros.map(r => r.data).filter(Boolean).sort();
    const periodoInicio = datas[0] || null;
    const periodoFim = datas[datas.length - 1] || null;

    // Inserir cabeçalho da importação
    await prisma.$executeRawUnsafe(`
      INSERT INTO "importacoes_consumo" ("id","nomeArquivo","totalRegistros","periodoInicio","periodoFim","usuarioId","criadoEm")
      VALUES ($1,$2,$3,$4::date,$5::date,$6,NOW())
    `, importacaoId, nomeArquivo, registros.length, periodoInicio, periodoFim, req.usuario.id);

    // Inserir registros em lotes de 500
    const LOTE = 500;
    for (let i = 0; i < registros.length; i += LOTE) {
      const lote = registros.slice(i, i + LOTE);
      for (const r of lote) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "registros_consumo" (
            "id","importacaoId","data","motorista","placa","modelo","conjunto",
            "kmInicial","kmFinal","distancia","posto","cidade","uf",
            "precoLitro","litros","produto","vlrTotal",
            "mediaRealizada","mediaSugerida","percAtingido","gap"
          ) VALUES (
            $1,$2,$3::date,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13,
            $14,$15,$16,$17,
            $18,$19,$20,$21
          )
        `,
          randomUUID(), importacaoId, r.data, r.motorista, r.placa || null, r.modelo || null, r.conjunto || null,
          r.kmInicial || null, r.kmFinal || null, r.distancia || null, r.posto || null, r.cidade || null, r.uf || null,
          r.precoLitro || null, r.litros || null, r.produto || null, r.vlrTotal || null,
          r.mediaRealizada || null, r.mediaSugerida || null, r.percAtingido || null, r.gap || null
        );
      }
    }

    res.status(201).json({ ok: true, importacaoId, total: registros.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao importar registros' });
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
