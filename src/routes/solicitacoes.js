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
        motorista: { select: { nome: true, ferias: true } },
        tipo: true,
        tipoVale: true,
        tipoRef: true,
        auditorias: req.usuario.papel === 'admin'
          ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } }
          : false
      },
      orderBy: { criadoEm: 'desc' }
    });

    const totalSolicitado = solicitacoes.reduce((s, x) => s + Number(x.valor), 0);
    const totalLiberado = solicitacoes.reduce((s, x) => s + Number(x.liberado || 0), 0);

    res.json({ solicitacoes, totais: { totalSolicitado, totalLiberado, pendente: totalSolicitado - totalLiberado } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar solicitações' });
  }
});

router.post('/', autorizar('solicitacoes', 'escrita'), async (req, res) => {
  try {
    const { motoristaId, tipoId, tipoValeId, tipoRefId, data, placa, valor } = req.body;
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

router.patch('/:id/liberado', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'admin') return res.status(403).json({ error: 'Apenas admin pode liberar' });
  try {
    const { liberado } = req.body;
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id: req.params.id } });
    const novoStatus = parseFloat(liberado) >= Number(solicitacao.valor) ? 'pago' : 'pendente';
    const atualizada = await prisma.solicitacao.update({
      where: { id: req.params.id },
      data: { liberado: parseFloat(liberado), status: novoStatus }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'editou', tabela: 'solicitacoes', registroId: req.params.id, dadosAntigos: { liberado: solicitacao.liberado }, dadosNovos: { liberado }, extra: { solicitacaoId: req.params.id } });
    res.json(atualizada);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar liberado' });
  }
});

module.exports = router;