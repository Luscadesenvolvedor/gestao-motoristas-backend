const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar);

// Buscar notificações
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
  } catch {
    res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
});

// Marcar TODAS como lidas — precisa vir ANTES da rota /:id
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
  } catch {
    res.status(500).json({ error: 'Erro ao marcar todas como lidas' });
  }
});

// Marcar como lida
router.patch('/:id/lida', async (req, res) => {
  try {
    const n = await prisma.notificacao.update({
      where: { id: req.params.id },
      data: { lida: true }
    });
    res.json(n);
  } catch {
    res.status(500).json({ error: 'Erro ao marcar como lida' });
  }
});

// Marcar como não lida
router.patch('/:id/nao-lida', async (req, res) => {
  try {
    const n = await prisma.notificacao.update({
      where: { id: req.params.id },
      data: { lida: false }
    });
    res.json(n);
  } catch {
    res.status(500).json({ error: 'Erro ao marcar como não lida' });
  }
});

module.exports = router;