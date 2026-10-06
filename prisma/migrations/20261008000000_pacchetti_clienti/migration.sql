-- Step 8: pacchetti e clienti (solo aggiunte: il codice dello step 7 continua a funzionare)

-- "Elimina cliente" (privacy) quando ha uno storico: i dati personali si cancellano, i numeri restano.
ALTER TABLE "Client" ADD COLUMN "anonymizedAt" TIMESTAMPTZ(3);

-- Pacchetti validi per un servizio OPPURE per un'intera categoria (es. "Massaggi").
ALTER TABLE "PackageTemplate" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "ClientPackage" ADD COLUMN "categoryId" TEXT;

ALTER TABLE "PackageTemplate" ADD CONSTRAINT "PackageTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Note allergie nascoste finché l'admin non le attiva in Impostazioni (il dato resta nel database).
ALTER TABLE "Settings" ADD COLUMN "showAllergyNotes" BOOLEAN NOT NULL DEFAULT false;

-- Vincoli scritti a mano (Prisma li ignora e non li rimuove).
ALTER TABLE "PackageTemplate"
  ADD CONSTRAINT "PackageTemplate_service_or_category" CHECK (num_nonnulls("serviceId", "categoryId") <= 1);
ALTER TABLE "ClientPackage"
  ADD CONSTRAINT "ClientPackage_service_or_category" CHECK (num_nonnulls("serviceId", "categoryId") <= 1),
  ADD CONSTRAINT "ClientPackage_sessions_valid"
    CHECK ("totalSessions" > 0 AND "sessionsUsedBefore" >= 0 AND "sessionsUsedBefore" <= "totalSessions"),
  ADD CONSTRAINT "ClientPackage_price_valid" CHECK ("priceCents" >= 0);
ALTER TABLE "PackagePayment"
  ADD CONSTRAINT "PackagePayment_amount_positive" CHECK ("amountCents" > 0);

-- Elenco "Pacchetti" (attivi) e statistiche.
CREATE INDEX "ClientPackage_closedAt_idx" ON "ClientPackage"("closedAt");
