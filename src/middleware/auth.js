const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const permissoes = {
  usuarios:    { leitura: ['admin'], escrita: ['admin'] },
  motoristas:  { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','guiche','acertador','dgp','financeiro'] },
  solicitacoes:{ leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','guiche','acertador','dgp','financeiro'] },
  exclusoes:   { leitura: ['admin','acertador','financeiro'], escrita: ['admin','acertador','financeiro'] },
  folgas:      { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','financeiro'] },
  ferias:      { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','dgp'] },
  agendamentos:{ leitura: ['admin','guiche'], escrita: ['admin','guiche'] },
  financeiro:  { leitura: ['admin','acertador'], escrita: ['admin','acertador'] },
  tipos:       { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','guiche','acertador','dgp','financeiro'] },
  levantamentos: { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','financeiro'] },
};

async function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token nao fornecido' });
  }
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, nome: true, email: true, papel: true, ativo: true, perfilAgendamento: true, perfilFinanceiro: true }
    });
    if (!usuario || !usuario.ativo) return res.status(401).json({ error: 'Usuario invalido' });
    req.usuario = usuario;
    next();
  } catch (err) {
    console.error('Erro ao validar token:', err);
    return res.status(401).json({ error: 'Token invalido' });
  }
}

function autorizar(recurso, tipo) {
  tipo = tipo || 'leitura';
  return function(req, res, next) {
    var papel = req.usuario && req.usuario.papel;
    var permitidos = (permissoes[recurso] && permissoes[recurso][tipo]) || [];
    if (permitidos.indexOf(papel) === -1) {
      return res.status(403).json({ error: 'Acesso negado para este perfil' });
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
