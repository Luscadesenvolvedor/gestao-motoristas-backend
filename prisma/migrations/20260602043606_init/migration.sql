-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('admin', 'guiche', 'acertador', 'dgp', 'financeiro');

-- CreateEnum
CREATE TYPE "Frota" AS ENUM ('buzin', 'lbm', 'meli');

-- CreateEnum
CREATE TYPE "StatusMotorista" AS ENUM ('ativo', 'desligado');

-- CreateEnum
CREATE TYPE "CategoriaMotorista" AS ENUM ('frota', 'dedicado_usiminas', 'dedicado_arcelormittal', 'patio', 'tirador_ferias');

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('pendente', 'pago');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motoristas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "contato" TEXT NOT NULL,
    "banco" TEXT,
    "agencia" TEXT,
    "pix" TEXT,
    "destinatario" TEXT,
    "frota" "Frota" NOT NULL,
    "status" "StatusMotorista" NOT NULL DEFAULT 'ativo',
    "categoria" "CategoriaMotorista" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motoristas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_solicitacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes" (
    "id" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tipoId" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "placa" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    "liberado" DECIMAL(10,2),
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'pendente',
    "anexoUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exclusoes_vale" (
    "id" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "numeroVale" TEXT NOT NULL,
    "dataVale" TIMESTAMP(3) NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "feito" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exclusoes_vale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folgas" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "periodo" TIMESTAMP(3) NOT NULL,
    "quantidadeDias" INTEGER NOT NULL,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folgas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ferias" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "quantidadeDias" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ferias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" TEXT NOT NULL,
    "perfil" INTEGER NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "mesesAcerto" INTEGER NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_desconto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_desconto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controle_financeiro" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "tipoDescontoId" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "valorDescontado" DECIMAL(10,2) NOT NULL,
    "numeroAcerto" TEXT NOT NULL,
    "mesDesconto" TEXT NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "controle_financeiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "tabela" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "motoristaId" TEXT,
    "solicitacaoId" TEXT,
    "exclusaoId" TEXT,
    "folgaId" TEXT,
    "feriasId" TEXT,
    "agendamentoId" TEXT,
    "controleId" TEXT,
    "dadosAntigos" JSONB,
    "dadosNovos" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "motoristas_cpf_key" ON "motoristas"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_solicitacao_nome_key" ON "tipos_solicitacao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_desconto_nome_key" ON "tipos_desconto"("nome");

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "tipos_solicitacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exclusoes_vale" ADD CONSTRAINT "exclusoes_vale_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exclusoes_vale" ADD CONSTRAINT "exclusoes_vale_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folgas" ADD CONSTRAINT "folgas_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ferias" ADD CONSTRAINT "ferias_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controle_financeiro" ADD CONSTRAINT "controle_financeiro_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controle_financeiro" ADD CONSTRAINT "controle_financeiro_tipoDescontoId_fkey" FOREIGN KEY ("tipoDescontoId") REFERENCES "tipos_desconto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_exclusaoId_fkey" FOREIGN KEY ("exclusaoId") REFERENCES "exclusoes_vale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_folgaId_fkey" FOREIGN KEY ("folgaId") REFERENCES "folgas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_feriasId_fkey" FOREIGN KEY ("feriasId") REFERENCES "ferias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_controleId_fkey" FOREIGN KEY ("controleId") REFERENCES "controle_financeiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
