// backend/src/routes/folgas.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');
const router = express.Router();
const prisma = new PrismaClient();
router.use(autenticar, autorizar('folgas', 'leitura'));

router.get('/', async (req, res) => {
  const folgas = await prisma.folga.findMany({
    include: { motorista: { select: { nome: true } },
      auditorias: req.usuario.papel === 'admin' ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } } : false
    },
    orderBy: { periodo: 'desc' }
  });
  res.json(folgas);
});

router.post('/', autorizar('folgas', 'escrita'), async (req, res) => {
  try {
    const { motoristaId, periodo, quantidadeDias } = req.body;
    const valorTotal = quantidadeDias * 150;
    const folga = await prisma.folga.create({ data: { motoristaId, periodo, quantidadeDias: parseInt(quantidadeDias), valorTotal } });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'folgas', registroId: folga.id, dadosNovos: req.body, extra: { folgaId: folga.id } });

    // Criar solicitação automática com tipo "Folga"
    try {
      const tipoFolga = await prisma.tipoSolicitacao.findFirst({ where: { nome: { contains: 'folg', mode: 'insensitive' } } });
      if (tipoFolga) {
        await prisma.solicitacao.create({
          data: {
            solicitanteId: req.usuario.id,
            motoristaId,
            tipoId: tipoFolga.id,
            data: new Date(),
            valor: valorTotal,
            status: 'pendente',
            observacao: `Folgas - Ref: (${quantidadeDias}) ${periodo} - dep via envelope`,
          }
        });
        // Marcar como enviado para não duplicar pelo botão manual
        await prisma.folga.update({ where: { id: folga.id }, data: { enviado: true } });
      }
    } catch (errSol) {
      console.error('Aviso: folga criada mas solicitação automática falhou:', errSol.message);
    }

    res.status(201).json(folga);
  } catch { res.status(500).json({ error: 'Erro ao registrar folga' }); }
});

router.delete('/:id', autorizar('folgas', 'escrita'), async (req, res) => {
  if (req.usuario.papel !== 'admin') return res.status(403).json({ error: 'Apenas admin pode excluir' });
  try {
    await prisma.auditoria.deleteMany({ where: { folgaId: req.params.id } });
    await prisma.folga.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao excluir folga' }); }
});

router.post('/:id/solicitar', autorizar('folgas', 'escrita'), async (req, res) => {
  try {
    const folga = await prisma.folga.findUnique({ where: { id: req.params.id } });
    if (!folga) return res.status(404).json({ error: 'Folga não encontrada' });
    const tipoFolga = await prisma.tipoSolicitacao.findFirst({ where: { nome: { contains: 'folg', mode: 'insensitive' } } });
    if (!tipoFolga) return res.status(400).json({ error: 'Tipo "Folga" não encontrado no cadastro de tipos' });
    const solicitacao = await prisma.solicitacao.create({
      data: {
        solicitanteId: req.usuario.id,
        motoristaId: folga.motoristaId,
        tipoId: tipoFolga.id,
        data: new Date(),
        valor: folga.valorTotal,
        status: 'pendente',
        observacao: `Folgas - Ref: (${folga.quantidadeDias}) ${folga.periodo} - dep via envelope`,
      }
    });
    res.status(201).json(solicitacao);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar solicitação' }); }
});

router.patch('/:id/enviado', autorizar('folgas', 'escrita'), async (req, res) => {
  const folga = await prisma.folga.update({ where: { id: req.params.id }, data: { enviado: req.body.enviado } });
  res.json(folga);
});

module.exports = router;
