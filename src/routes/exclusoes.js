// backend/src/routes/exclusoes.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');
const router = express.Router();
const prisma = new PrismaClient();
router.use(autenticar, autorizar('exclusoes', 'leitura'));

router.get('/', async (req, res) => {
  const items = await prisma.exclusaoVale.findMany({
    include: { motorista: { select: { nome: true } }, solicitante: { select: { nome: true } },
      auditorias: req.usuario.papel === 'admin' ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } } : false
    },
    orderBy: { criadoEm: 'desc' }
  });
  res.json(items);
});

router.post('/', autorizar('exclusoes', 'escrita'), async (req, res) => {
  try {
    const item = await prisma.exclusaoVale.create({
      data: { ...req.body, solicitanteId: req.usuario.id, dataVale: new Date(req.body.dataVale) }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'exclusoes', registroId: item.id, dadosNovos: req.body, extra: { exclusaoId: item.id } });
    res.status(201).json(item);
  } catch { res.status(500).json({ error: 'Erro ao criar exclusão' }); }
});

router.patch('/:id/feito', autorizar('exclusoes', 'escrita'), async (req, res) => {
  const item = await prisma.exclusaoVale.update({ where: { id: req.params.id }, data: { feito: req.body.feito } });
  res.json(item);
});

module.exports = router;
