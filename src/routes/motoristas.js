// backend/src/routes/motoristas.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/motoristas
router.get('/', autorizar('motoristas', 'leitura'), async (req, res) => {
  try {
    const { status, frota, categoria, busca } = req.query;
    const where = { excluido: false };
    if (status) where.status = status;
    if (frota) where.frota = frota;
    if (categoria) where.categoria = categoria;
    if (busca) where.nome = { contains: busca, mode: 'insensitive' };

    const motoristas = await prisma.motorista.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: {
        auditorias: req.usuario.papel === 'admin'
          ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } }
          : false
      }
    });
    res.json(motoristas);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar motoristas' });
  }
});

// GET /api/motoristas/:id/historico
router.get('/:id/historico', autorizar('motoristas', 'leitura'), async (req, res) => {
  try {
    const auditorias = await prisma.auditoria.findMany({
      where: { motoristaId: req.params.id },
      orderBy: { criadoEm: 'desc' },
      include: { usuario: { select: { nome: true } } },
    });
    res.json(auditorias);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

// GET /api/motoristas/:id
router.get('/:id', autorizar('motoristas', 'leitura'), async (req, res) => {
  try {
    const motorista = await prisma.motorista.findUnique({
      where: { id: req.params.id },
      include: { ferias: true }
    });
    if (!motorista) return res.status(404).json({ error: 'Motorista não encontrado' });
    res.json(motorista);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar motorista' });
  }
});

// POST /api/motoristas
router.post('/', autorizar('motoristas', 'escrita'), async (req, res) => {
  try {
    const { nome, cpf } = req.body;

    // Verifica duplicidade de CPF
    if (cpf) {
      const existeCpf = await prisma.motorista.findFirst({ where: { cpf, excluido: false } });
      if (existeCpf) return res.status(400).json({ error: 'CPF já cadastrado' });
    }

    // Verifica duplicidade de nome
    const existeNome = await prisma.motorista.findFirst({
      where: { nome: { equals: nome, mode: 'insensitive' }, excluido: false }
    });
    if (existeNome) return res.status(400).json({ error: 'Motorista com este nome já cadastrado' });

    const dadosMotorista = { ...req.body };
    if (!dadosMotorista.dataDesligamento) delete dadosMotorista.dataDesligamento;
    else dadosMotorista.dataDesligamento = new Date(dadosMotorista.dataDesligamento);
    const motorista = await prisma.motorista.create({ data: dadosMotorista });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'motoristas', registroId: motorista.id, dadosNovos: req.body, extra: { motoristaId: motorista.id } });
    res.status(201).json(motorista);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'CPF já cadastrado' });
    res.status(500).json({ error: 'Erro ao criar motorista' });
  }
});
 
// PUT /api/motoristas/:id
router.put('/:id', autorizar('motoristas', 'escrita'), async (req, res) => {
  try {
    const antigo = await prisma.motorista.findUnique({ where: { id: req.params.id } });
    const { id, auditorias, ferias, solicitacoes, exclusoes, folgas, agendamentos, controleFinanceiro, afastamentos, abandonos, criadoEm, atualizadoEm, excluido, ...dados } = req.body;
    if (!dados.dataDesligamento) dados.dataDesligamento = null;
    else dados.dataDesligamento = new Date(dados.dataDesligamento);
    const motorista = await prisma.motorista.update({ where: { id: req.params.id }, data: dados });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'motoristas', registroId: motorista.id, dadosAntigos: antigo, dadosNovos: dados, extra: { motoristaId: motorista.id } });
    res.json(motorista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar motorista' });
  }
});

// DELETE /api/motoristas/:id (somente admin)
router.delete('/:id', autorizar('motoristas', 'escrita'), async (req, res) => {
  if (req.usuario.papel !== 'admin') return res.status(403).json({ error: 'Apenas admin pode excluir' });
  try {
    await prisma.motorista.update({
      where: { id: req.params.id },
      data: { excluido: true }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);    res.status(500).json({ error: 'Erro ao excluir motorista' });
  }
});

module.exports = router;
