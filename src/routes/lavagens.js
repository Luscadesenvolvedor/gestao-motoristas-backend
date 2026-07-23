const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, exigirSetor } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar, exigirSetor('abastecimento'));

// GET /api/lavagens?mes=7&ano=2026&frota=buzin&placa=ABC1234
router.get('/', async (req, res) => {
  try {
    const { mes, ano, frota, placa } = req.query;
    const where = {};

    if (mes && ano) {
      const inicio = new Date(parseInt(ano), parseInt(mes) - 1, 1);
      const fim    = new Date(parseInt(ano), parseInt(mes), 1);
      where.data   = { gte: inicio, lt: fim };
    } else if (ano) {
      const inicio = new Date(parseInt(ano), 0, 1);
      const fim    = new Date(parseInt(ano) + 1, 0, 1);
      where.data   = { gte: inicio, lt: fim };
    }

    if (frota) where.frota = frota;
    if (placa) where.placa = { contains: placa.toUpperCase() };

    const lavagens = await prisma.lavagem.findMany({
      where,
      include: {
        tipoServico:  true,
        tipoCaminhao: true,
        fornecedor:   { select: { id: true, razaoSocial: true } },
        usuario:      { select: { id: true, nome: true } },
      },
      orderBy: { data: 'desc' },
    });
    res.json(lavagens);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar lavagens' });
  }
});

// GET /api/lavagens/resumo?mes=7&ano=2026
router.get('/resumo', async (req, res) => {
  try {
    const { mes, ano } = req.query;
    const where = {};

    if (mes && ano) {
      const inicio = new Date(parseInt(ano), parseInt(mes) - 1, 1);
      const fim    = new Date(parseInt(ano), parseInt(mes), 1);
      where.data   = { gte: inicio, lt: fim };
    }

    const lavagens = await prisma.lavagem.findMany({
      where,
      select: { placa: true, frota: true, valor: true, data: true },
    });

    const porPlaca = {};
    for (const l of lavagens) {
      if (!porPlaca[l.placa]) porPlaca[l.placa] = { placa: l.placa, frota: l.frota, quantidade: 0, total: 0 };
      porPlaca[l.placa].quantidade += 1;
      porPlaca[l.placa].total += Number(l.valor);
    }

    const resumo = Object.values(porPlaca).sort((a, b) => b.quantidade - a.quantidade);
    res.json(resumo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao calcular resumo' });
  }
});

// POST /api/lavagens
router.post('/', async (req, res) => {
  try {
    const { placa, frota, tipoServicoId, tipoCaminhaoId, fornecedorId, valor, data, observacao } = req.body;
    if (!placa || !frota || !tipoServicoId || !fornecedorId || !valor || !data) {
      return res.status(400).json({ error: 'Campos obrigatórios: placa, frota, tipoServico, fornecedor, valor, data' });
    }
    const lavagem = await prisma.lavagem.create({
      data: {
        placa:          placa.toUpperCase().trim(),
        frota,
        tipoServicoId,
        tipoCaminhaoId: tipoCaminhaoId || null,
        fornecedorId,
        valor:          parseFloat(valor),
        data:           new Date(data),
        observacao:     observacao || null,
        usuarioId:      req.usuario.id,
      },
      include: {
        tipoServico:  true,
        tipoCaminhao: true,
        fornecedor:   { select: { id: true, razaoSocial: true } },
        usuario:      { select: { id: true, nome: true } },
      },
    });
    res.status(201).json(lavagem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao registrar lavagem' });
  }
});

// DELETE /api/lavagens/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.lavagem.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir registro' });
  }
});

module.exports = router;
