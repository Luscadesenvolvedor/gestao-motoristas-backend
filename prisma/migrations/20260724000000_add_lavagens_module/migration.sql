-- CreateTable: tipos_servico_lavagem
CREATE TABLE IF NOT EXISTS "tipos_servico_lavagem" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "requerTipoCaminhao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tipos_servico_lavagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_servico_lavagem_nome_key" ON "tipos_servico_lavagem"("nome");

-- CreateTable: tipos_caminhao_lavagem
CREATE TABLE IF NOT EXISTS "tipos_caminhao_lavagem" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tipos_caminhao_lavagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_caminhao_lavagem_nome_key" ON "tipos_caminhao_lavagem"("nome");

-- CreateTable: fornecedores_lavagem
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

-- CreateTable: precos_fornecedor_servico
CREATE TABLE IF NOT EXISTS "precos_fornecedor_servico" (
    "id" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "tipoServicoId" TEXT NOT NULL,
    "tipoCaminhaoId" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "precos_fornecedor_servico_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "precos_fornecedor_servico_fornecedorId_fkey"
        FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores_lavagem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "precos_fornecedor_servico_tipoServicoId_fkey"
        FOREIGN KEY ("tipoServicoId") REFERENCES "tipos_servico_lavagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "precos_fornecedor_servico_tipoCaminhaoId_fkey"
        FOREIGN KEY ("tipoCaminhaoId") REFERENCES "tipos_caminhao_lavagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: lavagens
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
    CONSTRAINT "lavagens_tipoServicoId_fkey"
        FOREIGN KEY ("tipoServicoId") REFERENCES "tipos_servico_lavagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lavagens_tipoCaminhaoId_fkey"
        FOREIGN KEY ("tipoCaminhaoId") REFERENCES "tipos_caminhao_lavagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lavagens_fornecedorId_fkey"
        FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores_lavagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lavagens_usuarioId_fkey"
        FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
