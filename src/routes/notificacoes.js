const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar);

router.get('/', async (req, res) => {
  try {
    const notificacoes = await prisma.notificacao.findMany({
      where: {
        OR: [
          { usuarioId: req.usuario.id },
          { usuarioId: null }
        ]
      },
      orderBy: { criadoEm: 'desc' },
      take: 50
    });
    res.json(notificacoes);
  } catch (err) {
    console.error('ERRO NOTIFICACOES:', err.message);
    res.status(500).json({ error: 'Erro ao buscar notificações', detalhe: err.message });
  }
});

router.patch('/todas/lidas', async (req, res) => {
  try {
    await prisma.notificacao.updateMany({
      where: {
        OR: [{ usuarioId: req.usuario.id }, { usuarioId: null }],
        lida: false
      },
      data: { lida: true }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('ERRO TODAS LIDAS:', err.message);
    res.status(500).json({ error: 'Erro ao marcar todas como lidas' });
  }
});

router.patch('/:id/lida', async (req, res) => {
  try {
    const n = await prisma.notificacao.update({
      where: { id: req.params.id },
      data: { lida: true }
    });
    res.json(n);
  } catch (err) {
    console.error('ERRO LIDA:', err.message);
    res.status(500).json({ error: 'Erro ao marcar como lida' });
  }
});

router.patch('/:id/nao-lida', async (req, res) => {
  try {
    const n = await prisma.notificacao.update({
      where: { id: req.params.id },
      data: { lida: false }
    });
    res.json(n);
  } catch (err) {
    console.error('ERRO NAO LIDA:', err.message);
    res.status(500).json({ error: 'Erro ao marcar como não lida' });
  }
});

module.exports = router;