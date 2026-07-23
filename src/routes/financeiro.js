// backend/src/routes/financeiro.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');
const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar, autorizar('financeiro', 'leitura'));

// GET /api/financeiro
router.get('/', async (req, res) => {
  try {
    const { motoristaId, mes, perfil } = req.query;
    const where = {};

    if (req.usuario.papel === 'acertador') {
      where.usuarioId = req.usuario.id;
    } else if (perfil && perfil !== 'todos') {
      const u = await prisma.usuario.findFirst({ where: { perfilFinanceiro: parseInt(perfil) } });
      if (u) where.usuarioId = u.id;
    }
    // admin sem perfil = retorna todos

    if (motoristaId) where.motoristaId = motoristaId;
    if (mes) where.mesDesconto = mes;

    const itens = await prisma.controleFinanceiro.findMany({
      where,
      include: {
        motorista: { select: { nome: true } },
        tipoDesconto: true,
        usuario: { select: { nome: true } },
        auditorias: req.usuario.papel === 'admin'
          ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } }
          : false
      },
      orderBy: { criadoEm: 'desc' }
    });

    // Busca parcelas separadamente — não quebra se a tabela ainda não existir
    let parcelasMap = {};
    try {
      const parcelas = await prisma.parcelaDesconto.findMany({
        where: { controleFinanceiroId: { in: itens.map(i => i.id) } },
        orderBy: { mes: 'asc' }
      });
      parcelas.forEach(p => {
        if (!parcelasMap[p.controleFinanceiroId]) parcelasMap[p.controleFinanceiroId] = [];
        parcelasMap[p.controleFinanceiroId].push(p);
      });
    } catch { /* tabela ainda não existe — retorna lista sem parcelas */ }

    const resultado = itens.map(i => ({ ...i, parcelasDesconto: parcelasMap[i.id] || [] }));
    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar registros financeiros' });
  }
});

// POST /api/financeiro/:id/parcelas
router.post('/:id/parcelas', autorizar('financeiro', 'escrita'), async (req, res) => {
  try {
    const { mes, valor } = req.body;
    if (!mes || !valor) return res.status(400).json({ error: 'Mês e valor são obrigatórios' });

    const parcela = await prisma.parcelaDesconto.create({
      data: { controleFinanceiroId: req.params.id, mes, valor: parseFloat(valor) }
    });

    // Atualiza valorDescontado no registro pai com a soma de todas as parcelas
    const todas = await prisma.parcelaDesconto.findMany({ where: { controleFinanceiroId: req.params.id } });
    const somaTotal = todas.reduce((s, p) => s + parseFloat(p.valor), 0);
    await prisma.controleFinanceiro.update({
      where: { id: req.params.id },
      data: { valorDescontado: somaTotal }
    });

    res.status(201).json(parcela);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar parcela' });
  }
});

// DELETE /api/financeiro/:id/parcelas/:parcelaId
router.delete('/:id/parcelas/:parcelaId', autorizar('financeiro', 'escrita'), async (req, res) => {
  try {
    await prisma.parcelaDesconto.delete({ where: { id: req.params.parcelaId } });

    // Recalcula valorDescontado
    const restantes = await prisma.parcelaDesconto.findMany({ where: { controleFinanceiroId: req.params.id } });
    const somaTotal = restantes.reduce((s, p) => s + parseFloat(p.valor), 0);
    await prisma.controleFinanceiro.update({
      where: { id: req.params.id },
      data: { valorDescontado: somaTotal }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover parcela' });
  }
});

// POST /api/financeiro
router.post('/', autorizar('financeiro', 'escrita'), async (req, res) => {
  try {
    let usuarioId = req.usuario.id;
    // Admin criando registro para um acertador específico
    if (req.usuario.papel === 'admin' && req.body.perfilAlvo) {
      const alvo = await prisma.usuario.findFirst({ where: { perfilFinanceiro: parseInt(req.body.perfilAlvo) } });
      if (alvo) usuarioId = alvo.id;
    }
    const { motoristaId, tipoDescontoId, mesDesconto, numeroAcerto, numeroVale, valor, valorDescontado, observacao } = req.body;
    if (!motoristaId || !tipoDescontoId || valor === undefined || valor === null || valor === '') return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    if (numeroVale) {
      const existente = await prisma.controleFinanceiro.findFirst({ where: { numeroVale, usuarioId } });
      if (existente) return res.status(409).json({ error: `Vale ${numeroVale} já importado`, duplicado: true });
    }
    const item = await prisma.controleFinanceiro.create({
      data: {
        motoristaId,
        tipoDescontoId,
        mesDesconto: mesDesconto || null,
        numeroAcerto: numeroAcerto || '',
        numeroVale: numeroVale || null,
        valor: parseFloat(valor),
        valorDescontado: parseFloat(valorDescontado || 0),
        observacao: observacao || null,
        usuarioId
      }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'financeiro', registroId: item.id, dadosNovos: req.body, extra: { controleId: item.id } });
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar registro financeiro' });
  }
});

// PUT /api/financeiro/:id
router.put('/:id', autorizar('financeiro', 'escrita'), async (req, res) => {
  try {
    const antigo = await prisma.controleFinanceiro.findUnique({ where: { id: req.params.id } });
    if (!antigo) return res.status(404).json({ error: 'Registro não encontrado' });
    // Acertador só pode editar seus próprios registros
    if (req.usuario.papel === 'acertador' && antigo.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: 'Sem permissão para editar este registro' });
    }
    const { motoristaId, tipoDescontoId, mesDesconto, numeroAcerto, numeroVale, valor, valorDescontado, observacao } = req.body;
    const item = await prisma.controleFinanceiro.update({
      where: { id: req.params.id },
      data: {
        motoristaId,
        tipoDescontoId,
        mesDesconto,
        numeroAcerto: numeroAcerto || antigo.numeroAcerto,
        numeroVale: numeroVale !== undefined ? (numeroVale || null) : antigo.numeroVale,
        mesDesconto: mesDesconto || null,
        observacao: observacao || null,
        valor: parseFloat(valor),
        valorDescontado: parseFloat(valorDescontado || 0)
      }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'financeiro', registroId: req.params.id, dadosAntigos: antigo, dadosNovos: req.body, extra: { controleId: req.params.id } });
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar registro financeiro' });
  }
});

// PATCH /api/financeiro/:id/abonar
router.patch('/:id/abonar', autorizar('financeiro', 'escrita'), async (req, res) => {
  try {
    const { abonadoPor } = req.body;
    const item = await prisma.controleFinanceiro.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Registro não encontrado' });
    const updated = await prisma.controleFinanceiro.update({
      where: { id: req.params.id },
      data: { abonado: true, abonadoPor: abonadoPor || null, valorDescontado: item.valor }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'abonou', tabela: 'financeiro', registroId: req.params.id, dadosNovos: { abonadoPor }, extra: { controleId: req.params.id } });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao abonar registro' });
  }
});

// PATCH /api/financeiro/:id/descontado
router.patch('/:id/descontado', autorizar('financeiro', 'escrita'), async (req, res) => {
  try {
    const item = await prisma.controleFinanceiro.update({
      where: { id: req.params.id },
      data: { valorDescontado: parseFloat(req.body.valorDescontado) }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'financeiro', registroId: req.params.id, dadosNovos: { valorDescontado: req.body.valorDescontado }, extra: { controleId: req.params.id } });
    res.json(item);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar valor descontado' });
  }
});

// DELETE /api/financeiro/:id (somente admin)
router.delete('/:id', autorizar('financeiro', 'escrita'), async (req, res) => {
  if (req.usuario.papel !== 'admin') return res.status(403).json({ error: 'Apenas admin pode excluir' });
  try {
    await prisma.controleFinanceiro.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir registro' });
  }
});

module.exports = router;