const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, exigirSetor } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar, exigirSetor('abastecimento'));

// GET /api/tipos-caminhao-lavagem
router.get('/', async (req, res) => {
  try {
    const tipos = await prisma.tipoCaminhao.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });
    res.json(tipos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar tipos de caminhão' });
  }
});

// POST /api/tipos-caminhao-lavagem
router.post('/', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
    const tipo = await prisma.tipoCaminhao.create({ data: { nome: nome.trim() } });
    res.status(201).json(tipo);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Tipo já cadastrado' });
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar tipo de caminhão' });
  }
});

// DELETE /api/tipos-caminhao-lavagem/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.tipoCaminhao.update({
      where: { id: req.params.id },
      data: { ativo: false },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover tipo de caminhão' });
  }
});

module.exports = router;
