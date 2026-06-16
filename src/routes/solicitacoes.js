const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar);

router.get('/', autorizar('solicitacoes', 'leitura'), async (req, res) => {
  try {
    const { status, motoristaId, mes } = req.query;
    const where = {};
    if (status) where.status = status;
    if (motoristaId) where.motoristaId = motoristaId;
    if (mes) {
      const [ano, m] = mes.split('-');
      where.data = { gte: new Date(ano, m - 1, 1), lt: new Date(ano, m, 1) };
    }

    const solicitacoes = await prisma.solicitacao.findMany({
      where,
      include: {
        solicitante: { select: { nome: true, papel: true } },
        motorista: { select: { nome: true, pix: true, frota: true, ferias: true } },
        tipo: true,
        tipoVale: true,
        tipoRef: true,
        auditorias: req.usuario.papel === 'admin'
          ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } }
          : false
      },
      orderBy: { criadoEm: 'desc' }
    });

    const ids = solicitacoes.map(s => s.id);
    let observacoes = {};
    if (ids.length > 0) {
      const rows = await prisma.$queryRaw`SELECT id::text, observacao FROM solicitacoes WHERE id::text = ANY(${ids})`;
      rows.forEach(r => { observacoes[r.id] = r.observacao; });
    }

    const solicitacoesComObs = solicitacoes.map(s => ({ ...s, observacao: observacoes[s.id] || '' }));

    const totalSolicitado = solicitacoesComObs.reduce((s, x) => s + Number(x.valor), 0);
    const totalLiberado = solicitacoesComObs.reduce((s, x) => s + Number(x.liberado || 0), 0);

    res.json({ solicitacoes: solicitacoesComObs, totais: { totalSolicitado, totalLiberado, pendente: totalSolicitado - totalLiberado } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar solicitações' });
  }
});

router.post('/', autorizar('solicitacoes', 'escrita'), async (req, res) => {
  try {
    const { motoristaId, tipoId, tipoValeId, tipoRefId, data, placa, valor, observacao } = req.body;
    const hoje = new Date();

    const feriaAtiva = await prisma.ferias.findFirst({
      where: { motoristaId, inicio: { lte: hoje }, OR: [{ fim: { gte: hoje } }, { fim: null }] }
    });
    const afastamento = await prisma.afastamento.findFirst({
      where: { motoristaId, retornou: false, dataInicio: { lte: hoje } }
    });
    const abandono = await prisma.abandono.findFirst({ where: { motoristaId } });

    const solicitacao = await prisma.solicitacao.create({
      data: {
        solicitanteId: req.usuario.id,
        motoristaId,
        tipoId,
        tipoValeId: tipoValeId || null,
        tipoRefId: tipoRefId || null,
        data: new Date(data),
        placa,
        valor: parseFloat(valor),
        status: 'pendente'
      },
      include: { motorista: true, tipo: true, tipoVale: true, tipoRef: true, solicitante: { select: { nome: true } } }
    });

    if (observacao) {
      await prisma.$executeRaw`UPDATE solicitacoes SET observacao = ${observacao} WHERE id = ${solicitacao.id}`;
    }

    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'solicitacoes', registroId: solicitacao.id, dadosNovos: req.body, extra: { solicitacaoId: solicitacao.id } });

    res.status(201).json({
      solicitacao,
      alertaFerias: !!feriaAtiva && feriaAtiva.tipo === 'ferias',
      alertaAtestado: !!feriaAtiva && feriaAtiva.tipo === 'atestado',
      alertaAfastamento: !!afastamento,
      alertaAbandono: !!abandono
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar solicitação' });
  }
});

router.patch('/marcar-realizado', autorizar('solicitacoes', 'escrita'), async (req, res) => {
  try {
    const { ids, observacoes } = req.body;
    const nome = req.usuario.nome;
    for (const id of (ids || [])) {
      const obs = observacoes?.[id];
      if (obs !== undefined) {
        await prisma.$executeRaw`UPDATE solicitacoes SET observacao = ${obs}, "realizadoPor" = ${nome} WHERE id::text = ${id}`;
      } else {
        await prisma.$executeRaw`UPDATE solicitacoes SET "realizadoPor" = ${nome} WHERE id::text = ${id}`;
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao marcar realizado' });
  }
});

router.patch('/data-pagamento-bulk', autorizar('solicitacoes', 'escrita'), async (req, res) => {
  try {
    const { ids, dataPagamento } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'ids obrigatório' });
    await prisma.solicitacao.updateMany({
      where: { id: { in: ids } },
      data: { dataPagamento: dataPagamento ? new Date(dataPagamento + 'T00:00:00') : null }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar datas' });
  }
});

router.patch('/:id/data-pagamento', autorizar('solicitacoes', 'escrita'), async (req, res) => {
  try {
    const { dataPagamento } = req.body;
    const atualizada = await prisma.solicitacao.update({
      where: { id: req.params.id },
      data: { dataPagamento: dataPagamento ? new Date(dataPagamento + 'T00:00:00') : null }
    });
    res.json(atualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar data de pagamento' });
  }
});

router.patch('/pagar-bulk', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'admin') return res.status(403).json({ error: 'Apenas admin pode liberar' });
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'ids obrigatório' });
    const solicitacoes = await prisma.solicitacao.findMany({
      where: { id: { in: ids }, status: { not: 'pago' } },
      include: { tipo: true }
    });
    for (const s of solicitacoes) {
      const ehSaldo = (s.tipo?.nome || '').toLowerCase().includes('saldo');
      await prisma.solicitacao.update({
        where: { id: s.id },
        data: { status: 'pago', liberado: ehSaldo ? s.valor : s.liberado }
      });
    }
    res.json({ ok: true, atualizados: solicitacoes.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao marcar como pago' });
  }
});

router.patch('/:id/liberado', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'admin') return res.status(403).json({ error: 'Apenas admin pode liberar' });
  try {
    const { liberado, marcarPago } = req.body;
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id: req.params.id }, include: { tipo: true } });
    if (solicitacao.status === 'pago') {
      return res.status(400).json({ error: 'Solicitação já paga não pode ser editada' });
    }

    const ehSaldo = (solicitacao.tipo?.nome || '').toLowerCase().includes('saldo');

    let novoLiberado = solicitacao.liberado;
    let novoStatus = solicitacao.status;

    if (liberado !== undefined) {
      novoLiberado = Number(solicitacao.liberado || 0) + parseFloat(liberado);
    }

    if (marcarPago) {
      novoStatus = 'pago';
      if (ehSaldo) {
        novoLiberado = solicitacao.valor;
      }
    }

    const atualizada = await prisma.solicitacao.update({
      where: { id: req.params.id },
      data: { liberado: novoLiberado, status: novoStatus }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'solicitacoes', registroId: req.params.id, dadosAntigos: { liberado: solicitacao.liberado, status: solicitacao.status }, dadosNovos: { liberado: novoLiberado, status: novoStatus }, extra: { solicitacaoId: req.params.id } });
    res.json(atualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar liberado' });
  }
});

router.delete('/:id', autorizar('solicitacoes', 'escrita'), async (req, res) => {
  const papel = req.usuario.papel;
  if (papel !== 'admin' && papel !== 'financeiro') {
    return res.status(403).json({ error: 'Apenas admin e financeiro podem excluir' });
  }
  try {
    await prisma.auditoria.deleteMany({ where: { solicitacaoId: req.params.id } });
    await prisma.solicitacao.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir solicitação' });
  }
});

module.exports = router;