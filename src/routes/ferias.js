// backend/src/routes/ferias.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');
const router = express.Router();
const prisma = new PrismaClient();
router.use(autenticar, autorizar('ferias', 'leitura'));

router.get('/', async (req, res) => {
  const ferias = await prisma.ferias.findMany({
    include: { motorista: { select: { nome: true } },
      auditorias: req.usuario.papel === 'admin' ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } } : false
    },
    orderBy: { inicio: 'desc' }
  });
  res.json(ferias);
});

// Verifica se motorista está de férias agora
router.get('/ativo/:motoristaId', async (req, res) => {
  const hoje = new Date();
  const ferias = await prisma.ferias.findFirst({
    where: { motoristaId: req.params.motoristaId, inicio: { lte: hoje }, fim: { gte: hoje } }
  });
  res.json({ emFerias: !!ferias, ferias });
});

router.post('/', autorizar('ferias', 'escrita'), async (req, res) => {
  try {
    const { motoristaId, inicio, fim, quantidadeDias } = req.body;
    const ferias = await prisma.ferias.create({ data: { motoristaId, inicio: new Date(inicio), fim: new Date(fim), quantidadeDias: parseInt(quantidadeDias) } });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'ferias', registroId: ferias.id, dadosNovos: req.body, extra: { feriasId: ferias.id } });
    res.status(201).json(ferias);
  } catch { res.status(500).json({ error: 'Erro ao registrar férias' }); }
});

router.put('/:id', autorizar('ferias', 'escrita'), async (req, res) => {
  try {
    const antigo = await prisma.ferias.findUnique({ where: { id: req.params.id } });
    const ferias = await prisma.ferias.update({ where: { id: req.params.id }, data: { ...req.body, inicio: new Date(req.body.inicio), fim: new Date(req.body.fim) } });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'ferias', registroId: req.params.id, dadosAntigos: antigo, dadosNovos: req.body, extra: { feriasId: req.params.id } });
    res.json(ferias);
  } catch { res.status(500).json({ error: 'Erro ao atualizar férias' }); }
});

module.exports = router;
