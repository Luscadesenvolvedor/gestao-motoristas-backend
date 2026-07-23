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
    select: {
      id: true, nome: true, email: true, papel: true, ativo: true, setor: true, criadoEm: true,
      perfilAgendamento: true, perfilFinanceiro: true, permissoes: true,
      auditoriasFeitas: req.usuario.papel === 'admin'
        ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } }
        : false
    }
  });
  res.json(usuarios);
});

router.post('/', autorizar('usuarios', 'escrita'), async (req, res) => {
  try {
    const { nome, email, senha, papel, setor } = req.body;
    const PAPEIS_VALIDOS = ['admin','guiche','acertador','dgp','financeiro','levantamentos'];
    const SETORES_VALIDOS = ['acerto','abastecimento'];
    if (!nome || !email || !senha || !papel) return res.status(400).json({ error: 'Campos obrigatórios: nome, email, senha, papel' });
    if (!/.+@.+\..+/.test(email)) return res.status(400).json({ error: 'Email inválido' });
    if (senha.length < 8) return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres' });
    if (!PAPEIS_VALIDOS.includes(papel)) return res.status(400).json({ error: 'Papel inválido' });
    const setorFinal = SETORES_VALIDOS.includes(setor) ? setor : 'acerto';
    const hash = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({ data: { nome, email, senha: hash, papel, setor: setorFinal } });
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
    const { nome, email, papel, senha, setor } = req.body;
    const SETORES_VALIDOS = ['acerto','abastecimento'];
    const data = { nome, email, papel };
    if (senha) data.senha = await bcrypt.hash(senha, 10);
    if (setor && SETORES_VALIDOS.includes(setor)) data.setor = setor;
    const usuario = await prisma.usuario.update({ where: { id: req.params.id }, data });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'usuarios', registroId: req.params.id, dadosNovos: { nome, email, papel } });
    const { senha: _, ...u } = usuario;
    res.json(u);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Trocar própria senha
router.patch('/trocar-senha', autenticar, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    if (novaSenha.length < 8) return res.status(400).json({ error: 'Nova senha deve ter no mínimo 8 caracteres' });
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    const ok = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!ok) return res.status(400).json({ error: 'Senha atual incorreta' });
    const hash = await bcrypt.hash(novaSenha, 10);
    await prisma.usuario.update({ where: { id: req.usuario.id }, data: { senha: hash } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao trocar senha' });
  }
});

// Excluir (desativar) usuário
router.delete('/:id', autorizar('usuarios', 'escrita'), async (req, res) => {
  try {
    if (req.params.id === req.usuario.id) return res.status(400).json({ error: 'Você não pode excluir a si mesmo' });
    await prisma.usuario.update({ where: { id: req.params.id }, data: { ativo: false } });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'excluiu', tabela: 'usuarios', registroId: req.params.id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

router.patch('/:id/permissoes', autorizar('usuarios', 'escrita'), async (req, res) => {
  try {
    await prisma.usuario.update({
      where: { id: req.params.id },
      data: { permissoes: req.body.permissoes }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'usuarios', registroId: req.params.id, dadosNovos: { permissoes: req.body.permissoes } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao salvar permissões' });
  }
});

// Vincular perfil de agendamento
router.patch('/:id/perfil-agendamento', autorizar('usuarios', 'escrita'), async (req, res) => {
  try {
    const { perfilAgendamento } = req.body;
    await prisma.usuario.update({
      where: { id: req.params.id },
      data: { perfilAgendamento: perfilAgendamento ? parseInt(perfilAgendamento) : null }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'usuarios', registroId: req.params.id, dadosNovos: { perfilAgendamento } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao vincular perfil de agendamento' });
  }
});

// Vincular perfil financeiro
router.patch('/:id/perfil-financeiro', autorizar('usuarios', 'escrita'), async (req, res) => {
  try {
    const { perfilFinanceiro } = req.body;
    await prisma.usuario.update({
      where: { id: req.params.id },
      data: { perfilFinanceiro: perfilFinanceiro ? parseInt(perfilFinanceiro) : null }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'usuarios', registroId: req.params.id, dadosNovos: { perfilFinanceiro } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao vincular perfil financeiro' });
  }
});

module.exports = router;