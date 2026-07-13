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
      orderBy: { mes: 'desc' },
    });
    res.json(levantamentos);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar levantamentos' }); }
});

router.post('/', autorizar('levantamentos', 'escrita'), async (req, res) => {
  try {
    const { mes, motoristasFechados, previa, saldo, salario, quinzena, inssIrpf, observacao } = req.body;
    if (!mes || motoristasFechados === undefined || previa === undefined || saldo === undefined || salario === undefined || quinzena === undefined || inssIrpf === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }
    const existente = await prisma.levantamento.findUnique({ where: { mes } });
    if (existente) return res.status(409).json({ error: 'Já existe um levantamento para este mês' });
    const levantamento = await prisma.levantamento.create({
      data: {
        mes,
        motoristasFechados: parseInt(motoristasFechados),
        previa: parseFloat(previa),
        saldo: parseFloat(saldo),
        salario: parseFloat(salario),
        quinzena: parseFloat(quinzena),
        inssIrpf: parseFloat(inssIrpf),
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
    const { mes, motoristasFechados, previa, saldo, salario, quinzena, inssIrpf, observacao } = req.body;
    const levantamento = await prisma.levantamento.update({
      where: { id: req.params.id },
      data: {
        mes,
        motoristasFechados: parseInt(motoristasFechados),
        previa: parseFloat(previa),
        saldo: parseFloat(saldo),
        salario: parseFloat(salario),
        quinzena: parseFloat(quinzena),
        inssIrpf: parseFloat(inssIrpf),
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
