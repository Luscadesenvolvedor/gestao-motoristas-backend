// backend/src/routes/financeiro.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');
const router = express.Router();
const prisma = new PrismaClient();
router.use(autenticar, autorizar('financeiro', 'leitura'));

router.get('/', async (req, res) => {
  const { motoristaId, mes } = req.query;
  const where = {};
  if (motoristaId) where.motoristaId = motoristaId;
  if (mes) where.mesDesconto = mes;
  const itens = await prisma.controleFinanceiro.findMany({
    where,
    include: { motorista: { select: { nome: true } }, tipoDesconto: true,
      auditorias: req.usuario.papel === 'admin' ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } } : false
    },
    orderBy: { criadoEm: 'desc' }
  });
  res.json(itens);
});

router.post('/', autorizar('financeiro', 'escrita'), async (req, res) => {
  try {
    const item = await prisma.controleFinanceiro.create({ data: { ...req.body, valor: parseFloat(req.body.valor), valorDescontado: parseFloat(req.body.valorDescontado) } });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'financeiro', registroId: item.id, dadosNovos: req.body, extra: { controleId: item.id } });
    res.status(201).json(item);
  } catch { res.status(500).json({ error: 'Erro ao criar registro financeiro' }); }
});

router.put('/:id', autorizar('financeiro', 'escrita'), async (req, res) => {
  try {
    const antigo = await prisma.controleFinanceiro.findUnique({ where: { id: req.params.id } });
    const item = await prisma.controleFinanceiro.update({ where: { id: req.params.id }, data: { ...req.body, valor: parseFloat(req.body.valor), valorDescontado: parseFloat(req.body.valorDescontado) } });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'financeiro', registroId: req.params.id, dadosAntigos: antigo, dadosNovos: req.body, extra: { controleId: req.params.id } });
    res.json(item);
  } catch { res.status(500).json({ error: 'Erro ao atualizar registro financeiro' }); }
});

module.exports = router;
