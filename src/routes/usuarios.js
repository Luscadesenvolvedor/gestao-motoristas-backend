// backend/src/routes/usuarios.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();
const prisma = new PrismaClient();
router.use(autenticar, autorizar('usuarios', 'leitura'));

router.get('/', async (req, res) => {
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true,
      auditorias: { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } }
    }
  });
  res.json(usuarios);
});

router.post('/', autorizar('usuarios', 'escrita'), async (req, res) => {
  try {
    const { nome, email, senha, papel } = req.body;
    const hash = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({ data: { nome, email, senha: hash, papel } });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'usuarios', registroId: usuario.id, dadosNovos: { nome, email, papel } });
    const { senha: _, ...u } = usuario;
    res.status(201).json(u);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Email já cadastrado' });
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

router.put('/:id', autorizar('usuarios', 'escrita'), async (req, res) => {
  try {
    const { nome, email, papel, senha } = req.body;
    const data = { nome, email, papel };
    if (senha) data.senha = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.update({ where: { id: req.params.id }, data });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'usuarios', registroId: req.params.id, dadosNovos: { nome, email, papel } });
    const { senha: _, ...u } = usuario;
    res.json(u);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

module.exports = router;
