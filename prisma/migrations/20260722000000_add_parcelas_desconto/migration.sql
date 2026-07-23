-- CreateTable
CREATE TABLE "parcelas_desconto" (
    "id" TEXT NOT NULL,
    "controleFinanceiroId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcelas_desconto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "parcelas_desconto" ADD CONSTRAINT "parcelas_desconto_controleFinanceiroId_fkey" FOREIGN KEY ("controleFinanceiroId") REFERENCES "controle_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
