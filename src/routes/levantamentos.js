// backend/src/routes/levantamentos.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();
router.use(autenticar, autorizar('levantamentos', 'leitura'));

router.get('/', async (req, res) => {
  try {
    const levantamentos = await prisma.levantamento.findMany({
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: [{ mes: 'desc' }, { tipo: 'asc' }],
    });
    res.json(levantamentos);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar levantamentos' }); }
});

router.post('/', autorizar('levantamentos', 'escrita'), async (req, res) => {
  try {
    const { mes, tipo = 'FROTA', motoristasFechados, previa, saldo, custoFolha, observacao } = req.body;
    if (!mes) return res.status(400).json({ error: 'Mês é obrigatório' });
    const n = v => parseFloat(v) || 0;
    const i = v => parseInt(v) || 0;
    const existente = await prisma.levantamento.findFirst({ where: { mes, tipo } });
    if (existente) {
      const levantamento = await prisma.levantamento.update({
        where: { id: existente.id },
        data: {
          motoristasFechados: existente.motoristasFechados + i(motoristasFechados),
          previa:      { increment: n(previa) },
          saldo:       { increment: n(saldo) },
          custoFolha:  { increment: n(custoFolha) },
          observacao: observacao || existente.observacao,
        },
        include: { usuario: { select: { id: true, nome: true } } },
      });
      return res.json(levantamento);
    }
    const levantamento = await prisma.levantamento.create({
      data: {
        mes,
        tipo,
        motoristasFechados: i(motoristasFechados),
        previa:     n(previa),
        saldo:      n(saldo),
        custoFolha: n(custoFolha),
        observacao: observacao || null,
        usuarioId: req.usuario.id,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
    res.status(201).json(levantamento);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar levantamento' }); }
});

router.put('/:id', autorizar('levantamentos', 'escrita'), async (req, res) => {
  try {
    const { mes, tipo, motoristasFechados, previa, saldo, custoFolha, observacao } = req.body;
    const levantamento = await prisma.levantamento.update({
      where: { id: req.params.id },
      data: {
        mes,
        ...(tipo && { tipo }),
        motoristasFechados: parseInt(motoristasFechados) || 0,
        previa:     parseFloat(previa)     || 0,
        saldo:      parseFloat(saldo)      || 0,
        custoFolha: parseFloat(custoFolha) || 0,
        observacao: observacao || null,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
    res.json(levantamento);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao atualizar levantamento' }); }
});

router.delete('/:id', autorizar('levantamentos', 'escrita'), async (req, res) => {
  try {
    await prisma.levantamento.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao excluir levantamento' }); }
});

module.exports = router;
