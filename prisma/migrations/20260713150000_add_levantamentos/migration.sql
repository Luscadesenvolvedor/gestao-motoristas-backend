-- CreateTable
CREATE TABLE "levantamentos" (
    "id" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "motoristasFechados" INTEGER NOT NULL,
    "previa" DECIMAL(10,2) NOT NULL,
    "saldo" DECIMAL(10,2) NOT NULL,
    "salario" DECIMAL(10,2) NOT NULL,
    "quinzena" DECIMAL(10,2) NOT NULL,
    "inssIrpf" DECIMAL(10,2) NOT NULL,
    "observacao" TEXT,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levantamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "levantamentos_mes_key" ON "levantamentos"("mes");

-- AddForeignKey
ALTER TABLE "levantamentos" ADD CONSTRAINT "levantamentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
