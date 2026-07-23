// backend/src/routes/notasAbastecimento.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar);

// Recalcula status com base na data de vencimento
function calcularStatus(item) {
  if (item.status === 'pago') return 'pago';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(item.dataVencimento);
  venc.setHours(0, 0, 0, 0);
  return venc < hoje ? 'vencido' : 'pendente';
}

// GET /api/notas-abastecimento
router.get('/', async (req, res) => {
  try {
    const itens = await prisma.notaAbastecimento.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { dataVencimento: 'asc' }
    });
    // Recalcula status dinamicamente
    const resultado = itens.map(i => ({ ...i, status: calcularStatus(i) }));
    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar notas' });
  }
});

// POST /api/notas-abastecimento
router.post('/', async (req, res) => {
  try {
    const { tipo, numero, fornecedor, descricao, valor, dataEmissao, dataVencimento, observacao } = req.body;
    if (!tipo || !numero || !fornecedor || !valor || !dataEmissao || !dataVencimento) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }
    const item = await prisma.notaAbastecimento.create({
      data: {
        tipo,
        numero,
        fornecedor,
        descricao: descricao || null,
        valor: parseFloat(valor),
        dataEmissao: new Date(dataEmissao),
        dataVencimento: new Date(dataVencimento),
        observacao: observacao || null,
        usuarioId: req.usuario.id,
        status: 'pendente'
      }
    });
    res.status(201).json({ ...item, status: calcularStatus(item) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar nota' });
  }
});

// PUT /api/notas-abastecimento/:id
router.put('/:id', async (req, res) => {
  try {
    const { tipo, numero, fornecedor, descricao, valor, dataEmissao, dataVencimento, observacao } = req.body;
    const item = await prisma.notaAbastecimento.update({
      where: { id: req.params.id },
      data: {
        tipo,
        numero,
        fornecedor,
        descricao: descricao || null,
        valor: parseFloat(valor),
        dataEmissao: new Date(dataEmissao),
        dataVencimento: new Date(dataVencimento),
        observacao: observacao || null,
      }
    });
    res.json({ ...item, status: calcularStatus(item) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar nota' });
  }
});

// PATCH /api/notas-abastecimento/:id/pagar
router.patch('/:id/pagar', async (req, res) => {
  try {
    const { dataPagamento } = req.body;
    const item = await prisma.notaAbastecimento.update({
      where: { id: req.params.id },
      data: {
        status: 'pago',
        dataPagamento: dataPagamento ? new Date(dataPagamento) : new Date()
      }
    });
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao marcar como pago' });
  }
});

// PATCH /api/notas-abastecimento/:id/reabrir
router.patch('/:id/reabrir', async (req, res) => {
  try {
    const item = await prisma.notaAbastecimento.update({
      where: { id: req.params.id },
      data: { status: 'pendente', dataPagamento: null }
    });
    res.json({ ...item, status: calcularStatus(item) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao reabrir nota' });
  }
});

// DELETE /api/notas-abastecimento/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.notaAbastecimento.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir nota' });
  }
});

module.exports = router;
