-- AlterTable
ALTER TABLE "agendamentos" ADD COLUMN     "mesesSelecionados" TEXT[] DEFAULT ARRAY[]::TEXT[];
