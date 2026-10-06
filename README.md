# Fabiana L. · Estetica

Webapp di prenotazioni per Fabiana L. Le specifiche complete sono in [`docs/SPEC.md`](docs/SPEC.md).

Stack: Next.js (App Router) + TypeScript + Tailwind · PostgreSQL su Neon con Prisma 6 · Vercel.

## Comandi

```bash
npm install              # installa le dipendenze e genera il client Prisma
npm run dev              # sviluppo su http://localhost:3000
npm run lint             # ESLint
npm run typecheck        # controllo dei tipi
npm run build            # build di produzione (la usa anche Vercel)
npm test                 # test automatici (Vitest), senza database
```

### Test su Postgres vero

Prenotazioni simultanee, vincolo anti-sovrapposizione e promemoria (chiamate doppie o in parallelo)
si verificano su un database **locale**
usa-e-getta (mai Neon: il setup rifiuta host non locali; i test svuotano le proprie tabelle):

```bash
createdb fabiana_test
TEST_DATABASE_URL=postgresql://localhost/fabiana_test npm run test:db
```

## Database

Le migrazioni si applicano **solo a mano**, mai nel build di Vercel (Preview e Production
condividono lo stesso database). Mai `prisma db push`.

```bash
npm run db:migrate:status   # stato delle migrazioni
npm run db:migrate:deploy   # applica le migrazioni (usa DATABASE_URL_UNPOOLED)
npm run db:seed             # admin, parametri, testi: idempotente, si può rilanciare
```

Da GitHub (consigliato): **Actions → "Database: migrazioni e seed" → Run workflow**.
Il workflow (`.github/workflows/db-migrate.yml`) esegue `npm ci`, `prisma migrate deploy` e il seed,
leggendo i secrets del repository: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ADMIN_EMAIL_1`,
`ADMIN_EMAIL_2`, `ADMIN_PASSWORD_1`, `ADMIN_PASSWORD_2` (facoltativi `ADMIN_NAME_1`, `ADMIN_NAME_2`).
Il seed sblocca sempre gli account admin, ignora gli spazi iniziali/finali delle password e rimuove
gli admin la cui email non è più nei secrets (restano solo i 2 configurati). Rilanciarlo dopo aver
cambiato un'email admin. Le password dei secrets valgono solo alla **creazione** dell'admin: poi ognuno
la cambia dall'app (Impostazioni → Il mio account) e il seed non la tocca. Se una password è stata
dimenticata: Run workflow con **"Reimposta le password admin dai secrets"** spuntato (`RESET_ADMIN_PASSWORDS=1`),
che riporta le password a quelle dei secrets e chiude le sessioni aperte.

Per una nuova migrazione: modificare `prisma/schema.prisma`, poi
`npx prisma migrate dev --create-only --name <nome>` su un database di sviluppo, controllare l'SQL e committarlo.
La migrazione iniziale contiene anche vincoli scritti a mano (anti-sovrapposizione degli
appuntamenti con `tstzrange`, controlli su orari e durate): Prisma li ignora e non li rimuove.

## Variabili d'ambiente

Vedi [`.env.example`](.env.example).

## Promemoria del giorno prima (cron)

`GET /api/cron/promemoria` con `Authorization: Bearer <CRON_SECRET>`, da chiamare **ogni ora**
(es. cron-job.org). Manda i promemoria per gli appuntamenti di domani solo dopo l'ora impostata in
Impostazioni (default 18:00, ora di Roma). È idempotente: chiamarlo più volte, anche insieme, non
manda doppioni. Si ferma da solo dopo ~45 s e risponde con un riepilogo JSON (`sent`, `failed`,
`remaining`…); gli eventuali rimanenti partono alla chiamata successiva.

## Struttura

- `src/config/brand.ts`: nome, colori e font (unico file da modificare per la grafica)
- `src/app/admin/`: area admin (`login/` e le pagine del menu in `(area)/`)
- `src/app/{accedi,invito,prenota,appuntamenti,privacy}/`: area cliente
- `src/lib/auth/client*.ts`, `loginCode.ts`: sessione cliente e codice di accesso via email
- `src/lib/email/send.ts`: unico punto di contatto con Resend
- `src/lib/notifications/`: testi e segnaposto, grafica delle email, `.ics`, invio con registro
  (`deliver.ts`), conferme/modifiche/cancellazioni, promemoria e link WhatsApp
- `src/app/api/cron/promemoria/`: endpoint del promemoria
- `src/lib/packages/`: pacchetti delle clienti (conti, pagamenti, sedute scalate dall'agenda)
- `src/lib/clients/`: ricerca, scheda, blocco ed eliminazione (privacy) delle clienti
- `src/lib/export/` + `src/app/admin/esporta/[tipo]/`: copia di sicurezza in CSV
- `src/config/security-headers.ts`: header di sicurezza (CSP ecc.), usati da `next.config.ts`
- `src/app/manifest.ts`, `src/lib/pwa/`, `src/app/icons/`, `public/sw.js`, `src/app/offline/`: app installabile
- `src/app/protections.test.ts`: controlla che pagine admin, azioni e API richiedano il login
- `src/lib/push/`: notifiche push agli admin (abbonamenti, invio con registro, pulizia degli scaduti);
  eventi `push` e `notificationclick` in `public/sw.js`
- `src/lib/auth/`: sessioni con cookie firmato, password, controlli d'accesso
- `src/proxy.ts`: primo filtro sulle pagine `/admin`, `/prenota` e `/appuntamenti`
- `prisma/`: schema, migrazioni, seed
