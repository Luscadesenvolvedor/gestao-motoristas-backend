// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const permissoes = {
  usuarios:   { leitura: ['admin'], escrita: ['admin'] },
  motoristas: { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','guiche','acertador','dgp','financeiro'] },
  solicitacoes: { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','guiche','acertador','dgp','financeiro'] },
  exclusoes:  { leitura: ['admin','acertador','financeiro'], escrita: ['admin','acertador','financeiro'] },
  folgas:     { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','financeiro'] },
  ferias:     { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','dgp'] },
  agendamentos: { leitura: ['admin','guiche'], escrita: ['admin','guiche'] },
  financeiro: { leitura: ['admin','acertador'], escrita: ['admin','acertador'] },
  tipos:      { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin'] },
};

async function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await prisma.usuario.findUnique({ where: { id: decoded.id } });
    if (!usuario || !usuario.ativo) return res.status(401).json({ error: 'Usuário inválido' });
    req.usuario = usuario;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function autorizar(recurso, tipo = 'leitura') {
  return (req, res, next) => {
    const papel = req.usuario?.papel;
    const permitidos = permissoes[recurso]?.[tipo] || [];
    if (!permitidos.includes(papel)) {
      return res.status(403).json({ error: 'Acesso negado para este perfil' });
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
