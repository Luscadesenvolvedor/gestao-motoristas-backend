// backend/src/routes/solicitacoes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(autenticar);

// GET /api/solicitacoes
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
        auditorias: req.usuario.papel === 'admin'
          ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } }
          : false
      },
      orderBy: { criadoEm: 'desc' }
    });

    // Totais
    const totalSolicitado = solicitacoes.reduce((s, x) => s + Number(x.valor), 0);
    const totalLiberado = solicitacoes.reduce((s, x) => s + Number(x.liberado || 0), 0);

    res.json({ solicitacoes, totais: { totalSolicitado, totalLiberado, pendente: totalSolicitado - totalLiberado } });
  } catch {
    res.status(500).json({ error: 'Erro ao buscar solicitações' });
  }
});

// POST /api/solicitacoes
router.post('/', autorizar('solicitacoes', 'escrita'), upload.single('anexo'), async (req, res) => {
  try {
    const { motoristaId, tipoId, data, placa, valor } = req.body;

    // Verifica férias
    const hoje = new Date();
    const feriaAtiva = await prisma.ferias.findFirst({
      where: { motoristaId, inicio: { lte: hoje }, fim: { gte: hoje } }
    });

    const solicitacao = await prisma.solicitacao.create({
      data: {
        solicitanteId: req.usuario.id,
        motoristaId,
        tipoId,
        data: new Date(data),
        placa,
        valor: parseFloat(valor),
        anexoUrl: req.file ? `/uploads/${req.file.filename}` : null,
        status: 'pendente'
      },
      include: { motorista: true, tipo: true, solicitante: { select: { nome: true } } }
    });

    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'solicitacoes', registroId: solicitacao.id, dadosNovos: req.body, extra: { solicitacaoId: solicitacao.id } });

    res.status(201).json({ solicitacao, alertaFerias: !!feriaAtiva });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar solicitação' });
  }
});

// PATCH /api/solicitacoes/:id/liberado  (somente admin)
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
