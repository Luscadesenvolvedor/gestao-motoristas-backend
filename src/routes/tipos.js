// backend/src/routes/tipos.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar);

// Tipos de solicitação
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
router.delete('/solicitacao/:id', autorizar('tipos', 'escrita'), async (req, res) => {
  try {
    await prisma.tipoSolicitacao.update({ where: { id: req.params.id }, data: { ativo: false } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir tipo' });
  }
});

// Tipos de desconto
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
router.delete('/desconto/:id', autorizar('tipos', 'escrita'), async (req, res) => {
  try {
    await prisma.tipoDesconto.update({ where: { id: req.params.id }, data: { ativo: false } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir tipo' });
  }
});

// Tipos de vale
router.get('/vale', async (req, res) => {
  const tipos = await prisma.tipoVale.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  res.json(tipos);
});
router.post('/vale', autorizar('tipos', 'escrita'), async (req, res) => {
  try {
    const tipo = await prisma.tipoVale.create({ data: { nome: req.body.nome } });
    res.status(201).json(tipo);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Tipo já existe' });
    res.status(500).json({ error: 'Erro ao criar tipo' });
  }
});
router.delete('/vale/:id', autorizar('tipos', 'escrita'), async (req, res) => {
  try {
    await prisma.tipoVale.update({ where: { id: req.params.id }, data: { ativo: false } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir tipo' });
  }
});

// Tipos de ref
router.get('/ref', async (req, res) => {
  const tipos = await prisma.tipoRef.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  res.json(tipos);
});
router.post('/ref', autorizar('tipos', 'escrita'), async (req, res) => {
  try {
    const tipo = await prisma.tipoRef.create({ data: { nome: req.body.nome } });
    res.status(201).json(tipo);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Tipo já existe' });
    res.status(500).json({ error: 'Erro ao criar tipo' });
  }
});
router.delete('/ref/:id', autorizar('tipos', 'escrita'), async (req, res) => {
  try {
    await prisma.tipoRef.update({ where: { id: req.params.id }, data: { ativo: false } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir tipo' });
  }
});

module.exports = router;