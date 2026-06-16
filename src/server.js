require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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
const notificacoesRoutes = require('./routes/notificacoes');

const app = express();

// Necessário no Railway/Vercel (atrás de proxy reverso) para que o
// express-rate-limit e outras libs identifiquem o IP real do cliente.
app.set('trust proxy', 1);

// --- Segurança: cabeçalhos HTTP padrão (CSP básica, no-sniff, etc.) ---
app.use(helmet());

// --- Segurança: CORS restrito a origens conhecidas ---
// Defina ALLOWED_ORIGINS no .env como lista separada por vírgula, ex:
// ALLOWED_ORIGINS=https://gestao-motoristas-frontend-lemon.vercel.app,http://localhost:5173
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Permite requisições sem 'origin' (ex: health checks, Postman) e
      // origens explicitamente listadas.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origem não permitida pelo CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// --- Segurança: limite de tamanho do corpo da requisição ---
// Evita payloads excessivos como vetor simples de negação de serviço.
// Ajuste o limite se houver upload de arquivos grandes em base64.
app.use(express.json({ limit: '2mb' }));

// --- Segurança: rate limiting geral em toda a API ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // máx. de requisições por IP nesse intervalo
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});
app.use('/api', apiLimiter);

// --- Segurança: rate limiting mais estrito no login ---
// Mitiga ataques de força bruta de senha.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // tentativas de login por IP a cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
});
app.use('/api/auth', authLimiter);

// --- Atenção: /uploads está sendo servido sem autenticação ---
// Qualquer pessoa com a URL do arquivo consegue acessá-lo, mesmo sem login.
// Se os arquivos contiverem dados sensíveis (comprovantes, documentos),
// adicione aqui o middleware de autenticação já usado nas demais rotas
// antes de liberar o express.static. Exemplo:
//   const { autenticar } = require('./middleware/auth');
//   app.use('/uploads', autenticar, express.static('uploads'));
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
app.use('/api/notificacoes', notificacoesRoutes);

// 404 para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Handler de erro: nunca expõe stack trace ao cliente em produção
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORT}`));