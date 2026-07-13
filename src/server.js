require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());

// CORS: permite apenas origens listadas em ALLOWED_ORIGINS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Permite requests sem origin (ex: apps mobile, Postman em dev)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origem não permitida pelo CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes. Aguarde alguns minutos.' },
});
app.use(limiter);

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/usuarios',     require('./routes/usuarios'));
app.use('/api/motoristas',   require('./routes/motoristas'));
app.use('/api/solicitacoes', require('./routes/solicitacoes'));
app.use('/api/exclusoes',    require('./routes/exclusoes'));
app.use('/api/folgas',       require('./routes/folgas'));
app.use('/api/ferias',       require('./routes/ferias'));
app.use('/api/agendamentos', require('./routes/agendamentos'));
app.use('/api/financeiro',   require('./routes/financeiro'));
app.use('/api/tipos',        require('./routes/tipos'));
app.use('/api/notificacoes', require('./routes/notificacoes'));
app.use('/api/vales-fixos',  require('./routes/valesFixos'));
app.use('/api/levantamentos', require('./routes/levantamentos'));

app.get('/health', function(req, res) { res.json({ ok: true }); });

app.use(function(req, res) { res.status(404).json({ error: 'Rota nao encontrada' }); });

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('Servidor rodando na porta ' + PORT); });
