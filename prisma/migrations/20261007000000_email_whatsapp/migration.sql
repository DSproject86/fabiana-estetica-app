-- Step 6: email automatiche e WhatsApp manuale (solo aggiunte: il codice dello step 5 continua a funzionare)

-- Avviso email agli admin per le prenotazioni fatte dalle clienti (interruttore per admin).
ALTER TABLE "Admin" ADD COLUMN "notifyNewBooking" BOOLEAN NOT NULL DEFAULT true;

-- Indirizzo dello studio (facoltativo), usato nelle email e nel file .ics.
ALTER TABLE "Settings" ADD COLUMN "businessAddress" TEXT;

-- Avviso nuove prenotazioni agli admin (registrato in NotificationLog).
ALTER TYPE "MessageKind" ADD VALUE 'ADMIN_NEW_BOOKING';

-- Email di prova mandate dall'admin.
ALTER TABLE "NotificationLog" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

-- Registro invii: ultimi 100.
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");
