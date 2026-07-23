// backend/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

// Rate limit por email: 5 tentativas a cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: function(req) {
    return (req.body && req.body.email) ? req.body.email.toLowerCase() : ipKeyGenerator(req);
  },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatorios' });
  try {
    const usuario = await prisma.usuario.findUnique({ where: { email }, select: { id: true, nome: true, email: true, senha: true, papel: true, ativo: true, setor: true, permissoes: true, perfilAgendamento: true, perfilFinanceiro: true } });
    if (!usuario || !usuario.ativo) return res.status(401).json({ error: 'Credenciais invalidas' });
    const senhaOk = await bcrypt.compare(senha, usuario.senha);
    if (!senhaOk) return res.status(401).json({ error: 'Credenciais invalidas' });
    const token = jwt.sign({ id: usuario.id, papel: usuario.papel }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, setor: usuario.setor || 'acerto', permissoes: usuario.permissoes }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// GET /api/auth/me
router.get('/me', autenticar, function(req, res) {
  res.json(req.usuario);
});

module.exports = router;
