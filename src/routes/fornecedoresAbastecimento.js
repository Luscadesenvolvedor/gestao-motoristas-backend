const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { autenticar, exigirSetor } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.use(autenticar, exigirSetor('abastecimento'));

// GET /api/fornecedores-abastecimento
router.get('/', async (req, res) => {
  try {
    const lista = await prisma.fornecedorAbastecimento.findMany({
      where: { ativo: true },
      include: {
        faturas: {
          select: { id: true, valor: true, status: true, dataVencimento: true }
        }
      },
      orderBy: { razaoSocial: 'asc' }
    });
    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar fornecedores' });
  }
});

// POST /api/fornecedores-abastecimento
router.post('/', async (req, res) => {
  try {
    const { razaoSocial, cnpj, responsavel, contato, tipoServico, chavePix } = req.body;
    if (!razaoSocial || !cnpj || !responsavel || !contato || !tipoServico) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }
    const item = await prisma.fornecedorAbastecimento.create({
      data: { razaoSocial, cnpj, responsavel, contato, tipoServico, chavePix: chavePix || null }
    });
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar fornecedor' });
  }
});

// PUT /api/fornecedores-abastecimento/:id
router.put('/:id', async (req, res) => {
  try {
    const { razaoSocial, cnpj, responsavel, contato, tipoServico, chavePix } = req.body;
    const item = await prisma.fornecedorAbastecimento.update({
      where: { id: req.params.id },
      data: { razaoSocial, cnpj, responsavel, contato, tipoServico, chavePix: chavePix || null }
    });
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
  }
});

// DELETE /api/fornecedores-abastecimento/:id (desativa)
router.delete('/:id', async (req, res) => {
  try {
    await prisma.fornecedorAbastecimento.update({
      where: { id: req.params.id },
      data: { ativo: false }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir fornecedor' });
  }
});

module.exports = router;
