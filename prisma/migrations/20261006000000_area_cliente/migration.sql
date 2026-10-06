-- Step 5: area cliente

-- Numero WhatsApp di Fabiana (facoltativo), per il pulsante "Scrivi a Fabiana".
ALTER TABLE "Settings" ADD COLUMN "businessWhatsapp" TEXT;

-- Scritto a mano (Prisma non lo gestisce): al massimo un link d'invito attivo alla volta.
CREATE UNIQUE INDEX "InviteLink_single_active" ON "InviteLink" ((true)) WHERE "revokedAt" IS NULL;

-- Conteggio delle iscrizioni per link (limite orario e numero mostrato all'admin).
CREATE INDEX "Client_inviteLinkId_createdAt_idx" ON "Client"("inviteLinkId", "createdAt");
