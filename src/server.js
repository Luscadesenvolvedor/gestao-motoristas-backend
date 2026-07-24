require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const _prisma = new PrismaClient();
async function runMigrations() {
  // Setor do usuário (acerto ou abastecimento)
  try {
    await _prisma.$executeRawUnsafe(`ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "setor" TEXT NOT NULL DEFAULT 'acerto';`);
    console.log('Migration setor usuario: OK');
  } catch (e) { console.error('Migration setor usuario erro:', e.message); }

  // Fornecedores de abastecimento
  try {
    await _prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "fornecedores_abastecimento" (
        "id" TEXT NOT NULL,
        "razaoSocial" TEXT NOT NULL,
        "cnpj" TEXT NOT NULL,
        "responsavel" TEXT NOT NULL,
        "contato" TEXT NOT NULL,
        "tipoServico" TEXT NOT NULL,
        "chavePix" TEXT,
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fornecedores_abastecimento_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Migration fornecedores_abastecimento: OK');
  } catch (e) { console.error('Migration fornecedores_abastecimento erro:', e.message); }

  // Forma de pagamento em fornecedores_abastecimento
  try {
    await _prisma.$executeRawUnsafe(`ALTER TABLE "fornecedores_abastecimento" ADD COLUMN IF NOT EXISTS "formaPagamento" TEXT NOT NULL DEFAULT 'pix';`);
    console.log('Migration formaPagamento: OK');
  } catch (e) { console.error('Migration formaPagamento erro:', e.message); }

  // Número da OC em fornecedores_abastecimento
  try {
    await _prisma.$executeRawUnsafe(`ALTER TABLE "fornecedores_abastecimento" ADD COLUMN IF NOT EXISTS "numeroOC" TEXT;`);
    console.log('Migration numeroOC: OK');
  } catch (e) { console.error('Migration numeroOC erro:', e.message); }

  // Frota em fornecedores_abastecimento
  try {
    await _prisma.$executeRawUnsafe(`ALTER TABLE "fornecedores_abastecimento" ADD COLUMN IF NOT EXISTS "frota" TEXT NOT NULL DEFAULT 'buzin';`);
    console.log('Migration frota: OK');
  } catch (e) { console.error('Migration frota erro:', e.message); }

  // Tornar responsavel e contato opcionais
  try {
    await _prisma.$executeRawUnsafe(`ALTER TABLE "fornecedores_abastecimento" ALTER COLUMN "responsavel" DROP NOT NULL;`);
    await _prisma.$executeRawUnsafe(`ALTER TABLE "fornecedores_abastecimento" ALTER COLUMN "contato" DROP NOT NULL;`);
    console.log('Migration responsavel/contato nullable: OK');
  } catch (e) { console.error('Migration nullable erro:', e.message); }

  // Faturas de abastecimento
  try {
    await _prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "faturas_abastecimento" (
        "id" TEXT NOT NULL,
        "fornecedorId" TEXT NOT NULL,
        "numero" TEXT NOT NULL,
        "valor" DECIMAL(10,2) NOT NULL,
        "dataVencimento" DATE NOT NULL,
        "dataPagamento" DATE,
        "status" TEXT NOT NULL DEFAULT 'pendente',
        "arquivoNome" TEXT,
        "arquivoBase64" TEXT,
        "arquivoTipo" TEXT,
        "observacao" TEXT,
        "usuarioId" TEXT NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "faturas_abastecimento_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "faturas_abastecimento_fornecedorId_fkey"
          FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores_abastecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "faturas_abastecimento_usuarioId_fkey"
          FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);
    console.log('Migration faturas_abastecimento: OK');
  } catch (e) { console.error('Migration faturas_abastecimento erro:', e.message); }

  // Notas fiscais de abastecimento
  try {
    await _prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "notas_fiscais_abastecimento" (
        "id" TEXT NOT NULL,
        "faturaId" TEXT NOT NULL,
        "numero" TEXT NOT NULL,
        "valor" DECIMAL(10,2) NOT NULL,
        "arquivoNome" TEXT,
        "arquivoBase64" TEXT,
        "arquivoTipo" TEXT,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "notas_fiscais_abastecimento_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "notas_fiscais_abastecimento_faturaId_fkey"
          FOREIGN KEY ("faturaId") REFERENCES "faturas_abastecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    console.log('Migration notas_fiscais_abastecimento: OK');
  } catch (e) { console.error('Migration notas_fiscais_abastecimento erro:', e.message); }

  // Tabela de notas e remessas de abastecimento (legado)
  try {
    await _prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "notas_abastecimento" (
        "id" TEXT NOT NULL,
        "tipo" TEXT NOT NULL,
        "numero" TEXT NOT NULL,
        "fornecedor" TEXT NOT NULL,
        "descricao" TEXT,
        "valor" DECIMAL(10,2) NOT NULL,
        "dataEmissao" DATE NOT NULL,
        "dataVencimento" DATE NOT NULL,
        "dataPagamento" DATE,
        "status" TEXT NOT NULL DEFAULT 'pendente',
        "observacao" TEXT,
        "usuarioId" TEXT NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "notas_abastecimento_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "notas_abastecimento_usuarioId_fkey"
          FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);
    console.log('Migration notas_abastecimento: OK');
  } catch (e) { console.error('Migration notas_abastecimento erro:', e.message); }
  try {
    await _prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "parcelas_desconto" (
        "id" TEXT NOT NULL,
        "controleFinanceiroId" TEXT NOT NULL,
        "mes" TEXT NOT NULL,
        "valor" DECIMAL(10,2) NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "parcelas_desconto_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "parcelas_desconto_controleFinanceiroId_fkey"
          FOREIGN KEY ("controleFinanceiroId")
          REFERENCES "controle_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    console.log('Migration parcelas_desconto: OK');
  } catch (e) {
    console.error('Migration parcelas_desconto erro:', e.message);
  }
  try {
    await _prisma.$executeRawUnsafe(`ALTER TABLE "controle_financeiro" ADD COLUMN IF NOT EXISTS "abonado" BOOLEAN NOT NULL DEFAULT false;`);
    await _prisma.$executeRawUnsafe(`ALTER TABLE "controle_financeiro" ADD COLUMN IF NOT EXISTS "abonadoPor" TEXT;`);
    console.log('Migration abonado: OK');
  } catch (e) {
    console.error('Migration abonado erro:', e.message);
  }

  // ── Módulo de Lavagens/Serviços ──
  // Se a tabela lavagens existir com estrutura antiga (sem tipoServicoId), dropa tudo e recria
  try {
    const col = await _prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'lavagens' AND column_name = 'tipoServicoId'
    `);
    if (col.length === 0) {
      console.log('Detectada estrutura antiga de lavagens — recriando tabelas...');
      await _prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "lavagens" CASCADE;`);
      await _prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "precos_fornecedor_servico" CASCADE;`);
      await _prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "precos_lavagem" CASCADE;`);
      await _prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "fornecedores_lavagem" CASCADE;`);
      await _prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "tipos_servico_lavagem" CASCADE;`);
      await _prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "tipos_caminhao_lavagem" CASCADE;`);
      console.log('DROP tabelas antigas: OK');
    }
  } catch (e) { /* tabela lavagens não existe ainda, tudo bem */ }

  try {
    await _prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "tipos_servico_lavagem" (
        "id" TEXT NOT NULL,
        "nome" TEXT NOT NULL,
        "requerTipoCaminhao" BOOLEAN NOT NULL DEFAULT false,
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "tipos_servico_lavagem_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "tipos_servico_lavagem_nome_key" UNIQUE ("nome")
      );
    `);
    console.log('Migration tipos_servico_lavagem: OK');
  } catch (e) { console.error('tipos_servico_lavagem erro:', e.message); }

  try {
    await _prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "tipos_caminhao_lavagem" (
        "id" TEXT NOT NULL,
        "nome" TEXT NOT NULL,
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "tipos_caminhao_lavagem_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "tipos_caminhao_lavagem_nome_key" UNIQUE ("nome")
      );
    `);
    console.log('Migration tipos_caminhao_lavagem: OK');
  } catch (e) { console.error('tipos_caminhao_lavagem erro:', e.message); }

  try {
    await _prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "fornecedores_lavagem" (
        "id" TEXT NOT NULL,
        "razaoSocial" TEXT NOT NULL,
        "cnpj" TEXT,
        "contato" TEXT,
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fornecedores_lavagem_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Migration fornecedores_lavagem: OK');
  } catch (e) { console.error('fornecedores_lavagem erro:', e.message); }

  try {
    await _prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "precos_fornecedor_servico" (
        "id" TEXT NOT NULL,
        "fornecedorId" TEXT NOT NULL,
        "tipoServicoId" TEXT NOT NULL,
        "tipoCaminhaoId" TEXT,
        "valor" DECIMAL(10,2) NOT NULL,
        CONSTRAINT "precos_fornecedor_servico_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "precos_forn_fk" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores_lavagem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "precos_servico_fk" FOREIGN KEY ("tipoServicoId") REFERENCES "tipos_servico_lavagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "precos_caminhao_fk" FOREIGN KEY ("tipoCaminhaoId") REFERENCES "tipos_caminhao_lavagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);
    console.log('Migration precos_fornecedor_servico: OK');
  } catch (e) { console.error('precos_fornecedor_servico erro:', e.message); }

  try {
    await _prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "lavagens" (
        "id" TEXT NOT NULL,
        "placa" TEXT NOT NULL,
        "frota" TEXT NOT NULL,
        "tipoServicoId" TEXT NOT NULL,
        "tipoCaminhaoId" TEXT,
        "fornecedorId" TEXT NOT NULL,
        "valor" DECIMAL(10,2) NOT NULL,
        "data" DATE NOT NULL,
        "observacao" TEXT,
        "usuarioId" TEXT NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "lavagens_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "lavagens_servico_fk" FOREIGN KEY ("tipoServicoId") REFERENCES "tipos_servico_lavagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "lavagens_caminhao_fk" FOREIGN KEY ("tipoCaminhaoId") REFERENCES "tipos_caminhao_lavagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "lavagens_fornecedor_fk" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores_lavagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "lavagens_usuario_fk" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);
    console.log('Migration lavagens: OK');
  } catch (e) { console.error('lavagens erro:', e.message); }
}
runMigrations();

const app = express();

app.use(helmet());

const ORIGENS_PERMITIDAS = [
  'https://gestao-motoristas-frontend-lemon.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];
app.use(cors({
  origin: function(origin, callback) {
    // permite requests sem origin (mobile apps, curl, Postman em dev)
    if (!origin || ORIGENS_PERMITIDAS.includes(origin)) return callback(null, true);
    callback(new Error('CORS: origem não permitida'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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
app.use('/api/notas-abastecimento',        require('./routes/notasAbastecimento'));
app.use('/api/fornecedores-abastecimento', require('./routes/fornecedoresAbastecimento'));
app.use('/api/faturas-abastecimento',      require('./routes/faturasAbastecimento'));
app.use('/api/vales-fixos',  require('./routes/valesFixos'));
app.use('/api/levantamentos', require('./routes/levantamentos'));
app.use('/api/tipos-servico-lavagem',  require('./routes/tiposServicoLavagem'));
app.use('/api/tipos-caminhao-lavagem', require('./routes/tiposCaminhaoLavagem'));
app.use('/api/fornecedores-lavagem',   require('./routes/fornecedoresLavagem'));
app.use('/api/lavagens',               require('./routes/lavagens'));

app.get('/health', function(req, res) { res.json({ ok: true }); });

app.use(function(req, res) { res.status(404).json({ error: 'Rota nao encontrada' }); });

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('Servidor rodando na porta ' + PORT); });
