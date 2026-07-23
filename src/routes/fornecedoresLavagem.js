const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, exigirSetor } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar, exigirSetor('abastecimento'));

const includePrecos = {
  precos: {
    include: {
      tipoServico:  true,
      tipoCaminhao: true,
    },
  },
};

// GET /api/fornecedores-lavagem
router.get('/', async (req, res) => {
  try {
    const fornecedores = await prisma.fornecedorLavagem.findMany({
      where: { ativo: true },
      include: includePrecos,
      orderBy: { razaoSocial: 'asc' },
    });
    res.json(fornecedores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar fornecedores' });
  }
});

// POST /api/fornecedores-lavagem
// Body: { razaoSocial, cnpj?, contato?, precos: [{ tipoServicoId, tipoCaminhaoId?, valor }] }
router.post('/', async (req, res) => {
  try {
    const { razaoSocial, cnpj, contato, precos } = req.body;
    if (!razaoSocial) return res.status(400).json({ error: 'Razão Social obrigatória' });

    const precosValidos = (precos || []).filter(p =>
      p.tipoServicoId && p.valor !== '' && p.valor !== null && p.valor !== undefined
    );

    const fornecedor = await prisma.fornecedorLavagem.create({
      data: {
        razaoSocial,
        cnpj:    cnpj    || null,
        contato: contato || null,
        precos: precosValidos.length > 0 ? {
          create: precosValidos.map(p => ({
            tipoServicoId:  p.tipoServicoId,
            tipoCaminhaoId: p.tipoCaminhaoId || null,
            valor:          parseFloat(String(p.valor).replace(',', '.')),
          })),
        } : undefined,
      },
      include: includePrecos,
    });
    res.status(201).json(fornecedor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar fornecedor' });
  }
});

// PUT /api/fornecedores-lavagem/:id
router.put('/:id', async (req, res) => {
  try {
    const { razaoSocial, cnpj, contato, precos } = req.body;

    await prisma.fornecedorLavagem.update({
      where: { id: req.params.id },
      data: { razaoSocial, cnpj: cnpj || null, contato: contato || null },
    });

    // Recria todos os preços
    if (precos !== undefined) {
      await prisma.precoFornecedorServico.deleteMany({ where: { fornecedorId: req.params.id } });
      const precosValidos = (precos || []).filter(p =>
        p.tipoServicoId && p.valor !== '' && p.valor !== null && p.valor !== undefined
      );
      if (precosValidos.length > 0) {
        await prisma.precoFornecedorServico.createMany({
          data: precosValidos.map(p => ({
            fornecedorId:   req.params.id,
            tipoServicoId:  p.tipoServicoId,
            tipoCaminhaoId: p.tipoCaminhaoId || null,
            valor:          parseFloat(String(p.valor).replace(',', '.')),
          })),
        });
      }
    }

    const fornecedor = await prisma.fornecedorLavagem.findUnique({
      where: { id: req.params.id },
      include: includePrecos,
    });
    res.json(fornecedor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
  }
});

// DELETE /api/fornecedores-lavagem/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.fornecedorLavagem.update({
      where: { id: req.params.id },
      data: { ativo: false },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover fornecedor' });
  }
});

module.exports = router;
