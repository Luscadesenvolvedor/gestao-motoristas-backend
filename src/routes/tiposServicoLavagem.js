const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, exigirSetor } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar, exigirSetor('abastecimento'));

// GET /api/tipos-servico-lavagem
router.get('/', async (req, res) => {
  try {
    const tipos = await prisma.tipoServico.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });
    res.json(tipos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar tipos de serviço' });
  }
});

// POST /api/tipos-servico-lavagem
router.post('/', async (req, res) => {
  try {
    const { nome, requerTipoCaminhao } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
    const tipo = await prisma.tipoServico.create({
      data: { nome: nome.trim(), requerTipoCaminhao: !!requerTipoCaminhao },
    });
    res.status(201).json(tipo);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Tipo já cadastrado' });
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar tipo de serviço' });
  }
});

// DELETE /api/tipos-servico-lavagem/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.tipoServico.update({
      where: { id: req.params.id },
      data: { ativo: false },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover tipo de serviço' });
  }
});

module.exports = router;
