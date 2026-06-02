// backend/src/routes/tipos.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();
router.use(autenticar);

router.get('/solicitacao', async (req, res) => {
  const tipos = await prisma.tipoSolicitacao.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  res.json(tipos);
});

router.post('/solicitacao', autorizar('tipos', 'escrita'), async (req, res) => {
  try {
    const tipo = await prisma.tipoSolicitacao.create({ data: { nome: req.body.nome } });
    res.status(201).json(tipo);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Tipo já existe' });
    res.status(500).json({ error: 'Erro ao criar tipo' });
  }
});

router.get('/desconto', async (req, res) => {
  const tipos = await prisma.tipoDesconto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  res.json(tipos);
});

router.post('/desconto', autorizar('tipos', 'escrita'), async (req, res) => {
  try {
    const tipo = await prisma.tipoDesconto.create({ data: { nome: req.body.nome } });
    res.status(201).json(tipo);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Tipo já existe' });
    res.status(500).json({ error: 'Erro ao criar tipo' });
  }
});

module.exports = router;
