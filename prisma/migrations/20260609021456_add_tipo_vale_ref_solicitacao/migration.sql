/*
  Warnings:

  - You are about to drop the column `anexoUrl` on the `solicitacoes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "solicitacoes" DROP COLUMN "anexoUrl",
ADD COLUMN     "tipoRefId" TEXT,
ADD COLUMN     "tipoValeId" TEXT;

-- CreateTable
CREATE TABLE "tipos_vale" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_vale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_ref" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_vale_nome_key" ON "tipos_vale"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_ref_nome_key" ON "tipos_ref"("nome");

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_tipoValeId_fkey" FOREIGN KEY ("tipoValeId") REFERENCES "tipos_vale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_tipoRefId_fkey" FOREIGN KEY ("tipoRefId") REFERENCES "tipos_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;
