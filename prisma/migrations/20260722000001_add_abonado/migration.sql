ALTER TABLE "controle_financeiro" ADD COLUMN IF NOT EXISTS "abonado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "controle_financeiro" ADD COLUMN IF NOT EXISTS "abonadoPor" TEXT;
