// backend/src/routes/financeiro.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');
const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar, autorizar('financeiro', 'leitura'));

// GET /api/financeiro
router.get('/', async (req, res) => {
  try {
    const { motoristaId, mes, perfil } = req.query;
    const where = {};

    if (req.usuario.papel === 'acertador') {
      where.usuarioId = req.usuario.id;
    } else if (perfil) {
      const u = await prisma.usuario.findFirst({ where: { perfilFinanceiro: parseInt(perfil) } });
      if (u) where.usuarioId = u.id;
    }

    if (motoristaId) where.motoristaId = motoristaId;
    if (mes) where.mesDesconto = mes;

    const itens = await prisma.controleFinanceiro.findMany({
      where,
      include: {
        motorista: { select: { nome: true } },
        tipoDesconto: true,
        usuario: { select: { nome: true } },
        auditorias: req.usuario.papel === 'admin'
          ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } }
          : false
      },
      orderBy: { criadoEm: 'desc' }
    });
    res.json(itens);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar registros financeiros' });
  }
});

// POST /api/financeiro
router.post('/', autorizar('financeiro', 'escrita'), async (req, res) => {
  try {
    const item = await prisma.controleFinanceiro.create({
      data: {
        ...req.body,
        valor: parseFloat(req.body.valor),
        valorDescontado: parseFloat(req.body.valorDescontado),
        usuarioId: req.usuario.id
      }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'financeiro', registroId: item.id, dadosNovos: req.body, extra: { controleId: item.id } });
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar registro financeiro' });
  }
});

// PUT /api/financeiro/:id
router.put('/:id', autorizar('financeiro', 'escrita'), async (req, res) => {
  try {
    const antigo = await prisma.controleFinanceiro.findUnique({ where: { id: req.params.id } });
    const item = await prisma.controleFinanceiro.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        valor: parseFloat(req.body.valor),
        valorDescontado: parseFloat(req.body.valorDescontado)
      }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'financeiro', registroId: req.params.id, dadosAntigos: antigo, dadosNovos: req.body, extra: { controleId: req.params.id } });
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar registro financeiro' });
  }
});

// PATCH /api/financeiro/:id/descontado
router.patch('/:id/descontado', autorizar('financeiro', 'escrita'), async (req, res) => {
  try {
    const item = await prisma.controleFinanceiro.update({
      where: { id: req.params.id },
      data: { valorDescontado: parseFloat(req.body.valorDescontado) }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'financeiro', registroId: req.params.id, dadosNovos: { valorDescontado: req.body.valorDescontado }, extra: { controleId: req.params.id } });
    res.json(item);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar valor descontado' });
  }
});

// DELETE /api/financeiro/:id (somente admin)
router.delete('/:id', autorizar('financeiro', 'escrita'), async (req, res) => {
  if (req.usuario.papel !== 'admin') return res.status(403).json({ error: 'Apenas admin pode excluir' });
  try {
    await prisma.controleFinanceiro.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir registro' });
  }
});

module.exports = router;