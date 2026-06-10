// backend/src/routes/folgas.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');
const router = express.Router();
const prisma = new PrismaClient();
router.use(autenticar, autorizar('folgas', 'leitura'));

router.get('/', async (req, res) => {
  const folgas = await prisma.folga.findMany({
    include: { motorista: { select: { nome: true } },
      auditorias: req.usuario.papel === 'admin' ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } } : false
    },
    orderBy: { periodo: 'desc' }
  });
  res.json(folgas);
});

router.post('/', autorizar('folgas', 'escrita'), async (req, res) => {
  try {
    const { motoristaId, periodo, quantidadeDias } = req.body;
    const valorTotal = quantidadeDias * 150;
   const folga = await prisma.folga.create({ data: { motoristaId, periodo, quantidadeDias: parseInt(quantidadeDias), valorTotal } });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'folgas', registroId: folga.id, dadosNovos: req.body, extra: { folgaId: folga.id } });
    res.status(201).json(folga);
  } catch { res.status(500).json({ error: 'Erro ao registrar folga' }); }
});

router.patch('/:id/enviado', autorizar('folgas', 'escrita'), async (req, res) => {
  const folga = await prisma.folga.update({ where: { id: req.params.id }, data: { enviado: req.body.enviado } });
  res.json(folga);
});

module.exports = router;
