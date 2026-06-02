// backend/src/routes/motoristas.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/motoristas
router.get('/', autorizar('motoristas', 'leitura'), async (req, res) => {
  try {
    const { status, frota, categoria, busca } = req.query;
    const where = {};
    if (status) where.status = status;
    if (frota) where.frota = frota;
    if (categoria) where.categoria = categoria;
    if (busca) where.nome = { contains: busca, mode: 'insensitive' };

    const motoristas = await prisma.motorista.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: {
        auditorias: req.usuario.papel === 'admin'
          ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } }
          : false
      }
    });
    res.json(motoristas);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar motoristas' });
  }
});

// GET /api/motoristas/:id
router.get('/:id', autorizar('motoristas', 'leitura'), async (req, res) => {
  try {
    const motorista = await prisma.motorista.findUnique({
      where: { id: req.params.id },
      include: { ferias: true }
    });
    if (!motorista) return res.status(404).json({ error: 'Motorista não encontrado' });
    res.json(motorista);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar motorista' });
  }
});

// POST /api/motoristas
router.post('/', autorizar('motoristas', 'escrita'), async (req, res) => {
  try {
    const motorista = await prisma.motorista.create({ data: req.body });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'motoristas', registroId: motorista.id, dadosNovos: req.body, extra: { motoristaId: motorista.id } });
    res.status(201).json(motorista);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'CPF já cadastrado' });
    res.status(500).json({ error: 'Erro ao criar motorista' });
  }
});

// PUT /api/motoristas/:id
router.put('/:id', autorizar('motoristas', 'escrita'), async (req, res) => {
  try {
    const antigo = await prisma.motorista.findUnique({ where: { id: req.params.id } });
    const motorista = await prisma.motorista.update({ where: { id: req.params.id }, data: req.body });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'motoristas', registroId: motorista.id, dadosAntigos: antigo, dadosNovos: req.body, extra: { motoristaId: motorista.id } });
    res.json(motorista);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar motorista' });
  }
});

// DELETE /api/motoristas/:id (somente admin)
router.delete('/:id', autorizar('motoristas', 'escrita'), async (req, res) => {
  if (req.usuario.papel !== 'admin') return res.status(403).json({ error: 'Apenas admin pode excluir' });
  try {
    await prisma.motorista.update({ where: { id: req.params.id }, data: { status: 'desligado' } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao desligar motorista' });
  }
});

module.exports = router;
