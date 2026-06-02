// backend/src/routes/agendamentos.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');
const router = express.Router();
const prisma = new PrismaClient();
router.use(autenticar, autorizar('agendamentos', 'leitura'));

router.get('/', async (req, res) => {
  const { perfil, mes } = req.query;
  const where = {};
  if (perfil) where.perfil = parseInt(perfil);
  if (mes) {
    const [ano, m] = mes.split('-');
    where.dataHora = { gte: new Date(ano, m - 1, 1), lt: new Date(ano, m, 1) };
  }
  const agendamentos = await prisma.agendamento.findMany({ where, include: { motorista: { select: { nome: true } } }, orderBy: { dataHora: 'asc' } });
  res.json(agendamentos);
});

router.post('/', autorizar('agendamentos', 'escrita'), async (req, res) => {
  try {
    const ag = await prisma.agendamento.create({ data: { ...req.body, dataHora: new Date(req.body.dataHora), mesesAcerto: parseInt(req.body.mesesAcerto) } });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'agendamentos', registroId: ag.id, dadosNovos: req.body, extra: { agendamentoId: ag.id } });
    res.status(201).json(ag);
  } catch { res.status(500).json({ error: 'Erro ao criar agendamento' }); }
});

router.delete('/:id', autorizar('agendamentos', 'escrita'), async (req, res) => {
  await prisma.agendamento.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
