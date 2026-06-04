-- AlterTable
ALTER TABLE "controle_financeiro" ADD COLUMN     "usuarioId" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "perfilFinanceiro" INTEGER;

-- AddForeignKey
ALTER TABLE "controle_financeiro" ADD CONSTRAINT "controle_financeiro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
