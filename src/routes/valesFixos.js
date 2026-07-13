// backend/src/routes/valesFixos.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();
router.use(autenticar, autorizar('solicitacoes', 'leitura'));

router.get('/', async (req, res) => {
  try {
    const vales = await prisma.valeFixo.findMany({
      include: {
        motorista: { select: { id: true, nome: true, pix: true } },
        usuario:   { select: { id: true, nome: true } },
      },
      orderBy: { dataPagamento: 'desc' },
    });
    res.json(vales);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar vales fixos' }); }
});

router.post('/', autorizar('solicitacoes', 'escrita'), async (req, res) => {
  try {
    const { motoristaId, dataPagamento, valor } = req.body;
    if (!motoristaId || !dataPagamento || !valor) return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    if (parseFloat(valor) <= 0) return res.status(400).json({ error: 'Valor deve ser maior que zero' });
    const vale = await prisma.valeFixo.create({
      data: {
        motoristaId,
        dataPagamento: new Date(dataPagamento),
        valor: parseFloat(valor),
        usuarioId: req.usuario.id,
      },
      include: {
        motorista: { select: { id: true, nome: true, pix: true } },
        usuario:   { select: { id: true, nome: true } },
      },
    });
    res.status(201).json(vale);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar vale fixo' }); }
});

router.delete('/:id', autorizar('solicitacoes', 'escrita'), async (req, res) => {
  try {
    const vale = await prisma.valeFixo.findUnique({ where: { id: req.params.id } });
    if (!vale) return res.status(404).json({ error: 'Vale não encontrado' });
    if (req.usuario.papel !== 'admin' && vale.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: 'Sem permissão para excluir este vale' });
    }
    await prisma.valeFixo.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao excluir vale' }); }
});

module.exports = router;
