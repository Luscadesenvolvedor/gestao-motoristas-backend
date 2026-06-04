-- AlterTable
ALTER TABLE "ferias" ADD COLUMN     "observacao" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'ferias',
ALTER COLUMN "fim" DROP NOT NULL,
ALTER COLUMN "quantidadeDias" DROP NOT NULL;

-- CreateTable
CREATE TABLE "afastamentos" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataRetorno" TIMESTAMP(3),
    "indeterminado" BOOLEAN NOT NULL DEFAULT false,
    "retornou" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "afastamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abandonos" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abandonos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "afastamentos" ADD CONSTRAINT "afastamentos_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abandonos" ADD CONSTRAINT "abandonos_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
