// backend/src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const motoristasRoutes = require('./routes/motoristas');
const solicitacoesRoutes = require('./routes/solicitacoes');
const exclusoesRoutes = require('./routes/exclusoes');
const folgasRoutes = require('./routes/folgas');
const feriasRoutes = require('./routes/ferias');
const agendamentosRoutes = require('./routes/agendamentos');
const financeiroRoutes = require('./routes/financeiro');
const tiposRoutes = require('./routes/tipos');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/motoristas', motoristasRoutes);
app.use('/api/solicitacoes', solicitacoesRoutes);
app.use('/api/exclusoes', exclusoesRoutes);
app.use('/api/folgas', folgasRoutes);
app.use('/api/ferias', feriasRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/tipos', tiposRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
