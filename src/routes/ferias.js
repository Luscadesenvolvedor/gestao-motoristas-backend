const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, autorizar } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');
const router = express.Router();
const prisma = new PrismaClient();
router.use(autenticar, autorizar('ferias', 'leitura'));

async function criarNotificacao(titulo, mensagem, tipo) {
  try {
    await prisma.notificacao.create({
      data: { titulo, mensagem, tipo, usuarioId: null }
    });
  } catch (err) {
    console.error('Erro ao criar notificacao:', err.message);
  }
}

router.get('/', async (req, res) => {
  const ferias = await prisma.ferias.findMany({
    include: { motorista: { select: { nome: true } },
      auditorias: req.usuario.papel === 'admin' ? { orderBy: { criadoEm: 'desc' }, take: 1, include: { usuario: { select: { nome: true } } } } : false
    },
    orderBy: { inicio: 'desc' }
  });
  res.json(ferias);
});

router.get('/ativo/:motoristaId', async (req, res) => {
  const hoje = new Date();
  const ferias = await prisma.ferias.findFirst({
    where: { motoristaId: req.params.motoristaId, inicio: { lte: hoje }, OR: [{ fim: { gte: hoje } }, { fim: null }] }
  });
  const afastamento = await prisma.afastamento.findFirst({
    where: { motoristaId: req.params.motoristaId, retornou: false, dataInicio: { lte: hoje } }
  });
  const abandono = await prisma.abandono.findFirst({
    where: { motoristaId: req.params.motoristaId }
  });
  res.json({
    emFerias: !!ferias && ferias.tipo === 'ferias',
    emAtestado: !!ferias && ferias.tipo === 'atestado',
    emAfastamento: !!afastamento,
    abandonou: !!abandono,
    ferias, afastamento, abandono
  });
});

router.post('/', autorizar('ferias', 'escrita'), async (req, res) => {
  try {
    const { motoristaId, tipo, inicio, fim, observacao } = req.body;
    const iniDate = new Date(inicio);
    const fimDate = fim ? new Date(fim) : null;
    const dias = fimDate ? Math.ceil((fimDate - iniDate) / (1000 * 60 * 60 * 24)) + 1 : null;
    const ferias = await prisma.ferias.create({
      data: { motoristaId, tipo: tipo || 'ferias', inicio: iniDate, fim: fimDate, quantidadeDias: dias, observacao },
      include: { motorista: { select: { nome: true } } }
    });
    await registrarAuditoria({ usuarioId: req.usuario.id, acao: 'criou', tabela: 'ferias', registroId: ferias.id, dadosNovos: req.body, extra: { feriasId: ferias.id } });

    const tipoLabel = tipo === 'atestado' ? 'atestado' : 'férias';
    const periodo = fimDate
      ? `${iniDate.toLocaleDateString('pt-BR')} até ${fimDate.toLocaleDateString('pt-BR')}`
      : `a partir de ${iniDate.toLocaleDateString('pt-BR')}`;
    await criarNotificacao(
      `${tipo === 'atestado' ? '🏥 Atestado' : '🏖️ Férias'} — ${ferias.motorista.nome}`,
      `${ferias.motorista.nome} está de ${tipoLabel} — ${periodo}${observacao ? ` — ${observacao}` : ''}`,
      tipo || 'ferias'
    );

    res.status(201).json(ferias);
  } catch (err) { res.status(500).json({ error: 'Erro ao registrar' }); }
});

router.put('/:id', autorizar('ferias', 'escrita'), async (req, res) => {
  try {
    const { inicio, fim, tipo, observacao } = req.body;
    const iniDate = new Date(inicio);
    const fimDate = fim ? new Date(fim) : null;
    const dias = fimDate ? Math.ceil((fimDate - iniDate) / (1000 * 60 * 60 * 24)) + 1 : null;
    const ferias = await prisma.ferias.update({
      where: { id: req.params.id },
      data: { tipo, inicio: iniDate, fim: fimDate, quantidadeDias: dias, observacao }
    });
    res.json(ferias);
  } catch { res.status(500).json({ error: 'Erro ao atualizar' }); }
});

router.delete('/:id', autorizar('ferias', 'escrita'), async (req, res) => {
  try {
    await prisma.ferias.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Erro ao excluir' }); }
});

router.get('/afastamentos', async (req, res) => {
  const lista = await prisma.afastamento.findMany({
    include: { motorista: { select: { nome: true } } },
    orderBy: { dataInicio: 'desc' }
  });
  res.json(lista);
});

router.post('/afastamentos', autorizar('ferias', 'escrita'), async (req, res) => {
  try {
    const { motoristaId, dataInicio, dataRetorno, indeterminado, observacao } = req.body;
    const item = await prisma.afastamento.create({
      data: { motoristaId, dataInicio: new Date(dataInicio), dataRetorno: dataRetorno ? new Date(dataRetorno) : null, indeterminado: !!indeterminado, observacao },
      include: { motorista: { select: { nome: true } } }
    });
    const retorno = indeterminado ? 'prazo indeterminado' : dataRetorno ? `retorno em ${new Date(dataRetorno).toLocaleDateString('pt-BR')}` : 'sem data de retorno';
    await criarNotificacao(
      `⚠️ Afastamento — ${item.motorista.nome}`,
      `${item.motorista.nome} está afastado desde ${new Date(dataInicio).toLocaleDateString('pt-BR')} — ${retorno}${observacao ? ` — ${observacao}` : ''}`,
      'afastamento'
    );
    res.status(201).json(item);
  } catch { res.status(500).json({ error: 'Erro ao registrar afastamento' }); }
});

router.patch('/afastamentos/:id/retornou', autorizar('ferias', 'escrita'), async (req, res) => {
  const item = await prisma.afastamento.update({
    where: { id: req.params.id },
    data: { retornou: true, dataRetorno: new Date() },
    include: { motorista: { select: { nome: true } } }
  });
  await criarNotificacao(
    `✅ Retorno ao trabalho — ${item.motorista.nome}`,
    `${item.motorista.nome} retornou ao trabalho em ${new Date().toLocaleDateString('pt-BR')}`,
    'afastamento'
  );
  res.json(item);
});

router.delete('/afastamentos/:id', autorizar('ferias', 'escrita'), async (req, res) => {
  try {
    await prisma.afastamento.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Erro ao excluir afastamento' }); }
});

router.get('/abandonos', async (req, res) => {
  const lista = await prisma.abandono.findMany({
    include: { motorista: { select: { nome: true } } },
    orderBy: { data: 'desc' }
  });
  res.json(lista);
});

router.post('/abandonos', autorizar('ferias', 'escrita'), async (req, res) => {
  try {
    const { motoristaId, data, observacao } = req.body;
    const item = await prisma.abandono.create({
      data: { motoristaId, data: new Date(data), observacao },
      include: { motorista: { select: { nome: true } } }
    });
    await criarNotificacao(
      `🚪 Abandono — ${item.motorista.nome}`,
      `${item.motorista.nome} abandonou o serviço em ${new Date(data).toLocaleDateString('pt-BR')}${observacao ? ` — ${observacao}` : ''}`,
      'abandono'
    );
    res.status(201).json(item);
  } catch { res.status(500).json({ error: 'Erro ao registrar abandono' }); }
});

router.delete('/abandonos/:id', autorizar('ferias', 'escrita'), async (req, res) => {
  try {
    await prisma.abandono.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Erro ao excluir abandono' }); }
});

module.exports = router;