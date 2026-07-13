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
    const { motoristaId, dataVale, numeroVale, motivo, observacao } = req.body;
    if (!motoristaId || !dataVale || !numeroVale) return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    const item = await prisma.exclusaoVale.create({
      data: { motoristaId, dataVale: new Date(dataVale), numeroVale, motivo: motivo || '', observacao: observacao || null, solicitanteId: req.usuario.id }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'exclusoes', registroId: item.id, dadosNovos: req.body, extra: { exclusaoId: item.id } });
    res.status(201).json(item);
  } catch { res.status(500).json({ error: 'Erro ao criar exclusão' }); }
});

router.patch('/:id/feito', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'admin') return res.status(403).json({ error: 'Apenas admin pode marcar como feito' });
  try {
    const item = await prisma.exclusaoVale.update({ where: { id: req.params.id }, data: { feito: req.body.feito } });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'exclusoes', registroId: req.params.id, dadosNovos: { feito: req.body.feito } });
    res.json(item);
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar' }); }
});

router.delete('/:id', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'admin') return res.status(403).json({ error: 'Apenas admin pode excluir' });
  try {
    await prisma.auditoria.deleteMany({ where: { exclusaoId: req.params.id } });
    await prisma.exclusaoVale.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao excluir' }); }
});

module.exports = router;
