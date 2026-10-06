# Fabiana L. · Estetica — Specifiche

Webapp di prenotazioni per un'estetista (Fabiana L.) che lavora da sola.
Questo documento è il riferimento per tutti gli step di sviluppo.

## Stack e vincoli generali

- Next.js (App Router) + TypeScript + Tailwind.
- PostgreSQL su Neon con Prisma. Nello schema: `url = env("DATABASE_URL")` e
  `directUrl = env("DATABASE_URL_UNPOOLED")` (connessione diretta per le migrazioni).
- Hosting su Vercel (deploy automatico da `main`).
- Fuso orario **Europe/Rome** per tutti i calcoli, ora legale compresa.
- Interfaccia in italiano, pensata per il telefono.

## Clienti e accesso

- Clienti **solo su invito**: un link unico, rigenerabile dall'admin (il vecchio smette di funzionare).
- Iscrizione con nome, cognome, cellulare, email e consenso privacy.
- Accesso con **codice di 6 cifre inviato per email**, sessione lunga (6 mesi), nessuna password.
- L'admin può **bloccare** una cliente.

## Admin

- 2 admin (Fabiana e il marito) con email e password, area separata.
- Credenziali da `ADMIN_EMAIL_1/2` e `ADMIN_PASSWORD_1/2` tramite uno script di seed con password hashate.
- Sessione con cookie firmato da `SESSION_SECRET`.
- Menu: Agenda, Promemoria di domani, Orari, Listino, Clienti, Pacchetti, Statistiche, Impostazioni.

## Listino

- Categorie e servizi con nome, durata in minuti, prezzo, attivo/nascosto.
- L'admin aggiunge, modifica ed elimina.
- Più pacchetti massaggi (vedi sotto).

## Prenotazione (lato cliente)

- La cliente spunta uno o più servizi e vede durata e prezzo totale.
- Poi vede giorni e orari liberi fino a **3 mesi** avanti, sceglie, vede il riepilogo e conferma.
- Sezione **"I miei appuntamenti"**.
- Per ora niente disdette lato cliente.

## Logica orari

- Durata = somma dei servizi, **arrotondata per eccesso** al multiplo dell'arrotondamento
  (default 30 min), **più una pausa** (default 30 min).
- Gli orari d'inizio seguono una **griglia** (default 30 min).
- Un orario è libero solo se **tutto l'intervallo** cade dentro l'orario di lavoro e non tocca
  appuntamenti o blocchi.
- **Preavviso minimo** di 1 ora.
- Nessun blocco temporaneo mentre la cliente sceglie: gli orari si ricalcolano a ogni spunta.
- Controllo finale sul server dentro una **transazione**, più un **vincolo nel database** contro le
  sovrapposizioni (Postgres exclusion constraint su `tstzrange`).
- Tutti i parametri si modificano dall'admin.

## Orari di lavoro

- Settimana tipo con una o più fasce per giorno.
- Eccezioni su singola data (orario diverso o chiuso).
- Blocchi rapidi di una fascia.
- Se un'eccezione o un blocco toccano appuntamenti già presi, l'admin vede un **avviso**;
  non si cancella niente in automatico.

## Agenda admin

- Elenco da oggi a fine mese, raggruppato per giorno, con navigazione ai mesi successivi.
- Spunta **"Fatto"** reversibile: la riga diventa verde e barrata e si apre il campo dell'importo
  incassato (precompilato col totale, modificabile).
- L'admin può inserire, spostare e cancellare appuntamenti.

## Pacchetti massaggi

- Per cliente, con nome, prezzo totale e numero sedute.
- Registro pagamenti (data, importo, contanti/carta) con pagato e residuo.
- Ogni seduta spuntata scala una seduta.

## Clienti (lato admin)

- Elenco con ricerca, storico, pacchetti attivi.
- Note allergie visibili solo all'admin.

## Statistiche

- Incassato giorno per giorno e totale del mese: appuntamenti spuntati + pagamenti dei pacchetti
  (alla data di registrazione).
- Confronto col mese precedente.
- Dettaglio per servizio.

## Notifiche

- Email automatiche con **Resend**:
  - codice di accesso;
  - conferma prenotazione;
  - promemoria il giorno prima alle 18 (`Settings.reminderHour`), tramite un endpoint cron protetto da `CRON_SECRET`;
    non parte se la prenotazione è stata fatta nello stesso giorno;
  - modifiche e cancellazioni.
- Su ogni appuntamento un tasto **WhatsApp** (link `wa.me` con testo precompilato) per i messaggi
  manuali, più la lista **"Appuntamenti di domani"** con la spunta "inviato".
- Testi modificabili dall'admin.
- Il sistema di invio va scritto in modo che in futuro si possa aggiungere la **WhatsApp Cloud API**.

## PWA

- Installabile: manifest, service worker, icone (vedi decisioni step 8b).

## Grafica

| Ruolo              | Colore    |
| ------------------ | --------- |
| Rosa cipria        | `#D8A7A0` |
| Oro                | `#C9A66B` |
| Sfondo avorio      | `#FBF7F4` |
| Testo prugna       | `#3D2B33` |
| Completato (salvia)| `#8FB89A` |

- Titoli in **Playfair Display**, testo in **Inter**.
- Logo provvisorio: monogramma "FL" in un cerchio sottile oro + "Fabiana L. · Estetica" (SVG).
- Colori e nome tutti in **un unico file di configurazione**.

## Roadmap

Stato: **tutti gli step completati** (manca solo quanto indicato nella checklist di lancio, in fondo).

1. ✅ Fondamenta
2. ✅ Listino
3. ✅ Orari di lavoro
4. ✅ Motore disponibilità con test automatici
5. ✅ Area cliente (con accesso tramite codice via email già da questo step)
6. ✅ Email e WhatsApp
7. ✅ Agenda admin e statistiche
8. ✅ Pacchetti, clienti, PWA e lancio (8a pacchetti e clienti, 8b sicurezza, PWA e checklist; privacy rimandata)

## Modo di lavorare

- Si lavora a step. Alla fine di ogni step: riepilogo e attesa di conferma prima di commit e push.

## Decisioni prese (step 1)

- **Email cliente facoltativa** nel database (`Client.email` nullable e unica): obbligatoria per chi si
  iscrive dal link, facoltativa per le clienti inserite a mano dall'admin.
- **Pausa:** il controllo "dentro l'orario di lavoro" usa la fine **senza pausa**; la pausa serve solo
  a distanziare gli appuntamenti. `endsAt` include la pausa (vincolo anti-sovrapposizione), quindi
  l'ultimo appuntamento può finire esattamente all'orario di chiusura.
- **Pausa per singolo appuntamento:** l'admin può impostare `bufferMin = 0` sugli appuntamenti che crea.
- **Stato NO_SHOW** ("non presentata"): non blocca il calendario; nelle statistiche si conta a parte.
- **Incassi senza doppi conteggi:** alla spunta "Fatto" l'importo precompilato esclude le voci scalate da
  un pacchetto (`clientPackageId` valorizzato), perché quei soldi stanno in `PackagePayment`.
- **Ora del promemoria** modificabile: `Settings.reminderHour` (default 18).
- **Migrazioni:** solo con `prisma migrate` (mai `db push`), lanciate a mano con `prisma migrate deploy`.
  Non fanno parte del build di Vercel (Preview e Production condividono lo stesso database).
- **Seed idempotente** (upsert), rilanciabile senza creare duplicati.
- **Sessioni:** cookie firmato (JWT HS256 con `SESSION_SECRET`) che contiene id e `sessionVersion`;
  aumentare `sessionVersion` invalida tutte le sessioni di quell'utente.
- **Prisma 6.x:** la 7 non accetta più `url`/`directUrl` nello schema.

## Decisioni prese (step 5)

- **Accesso con codice già allo step 5** (non più accesso temporaneo senza codice). Invio con Resend tramite
  `RESEND_API_KEY` ed `EMAIL_FROM`; finché non c'è un dominio verificato, Resend consegna solo all'email del
  proprietario dell'account. Conferme, promemoria e altre email restano allo step 6.
- **Codice:** 6 cifre, salvato come HMAC-SHA256 (chiave ricavata da `SESSION_SECRET`), valido 10 minuti,
  massimo 5 tentativi; vale solo l'ultimo codice richiesto. Massimo 3 codici ogni 15 minuti per email.
- **Risposte neutre:** "Se l'email è registrata riceverai un codice" per tutte le email; il codice si prepara e
  si invia dopo la risposta, così nemmeno i tempi rivelano chi è iscritta. Ogni invio finisce in `NotificationLog`.
- **Sessione cliente:** cookie `fl_client` separato da quello admin, 180 giorni. L'email in attesa del codice sta
  in un cookie firmato di 30 minuti (`fl_login`), non nell'indirizzo. Una cliente bloccata esce subito.
- **Link d'invito:** un solo link attivo, garantito da un indice unico parziale nel database; "Rigenera" disattiva
  il vecchio. Massimo **5 iscrizioni all'ora** per link (oltre: "Riprova più tardi", per tutte). Se l'email è già
  iscritta non si crea un doppione e i dati non cambiano: si passa al codice.
- **Cellulare** sempre in formato `+39…` (i numeri esteri scritti con `+` o `00` restano col loro prefisso).
- **WhatsApp di Fabiana:** `Settings.businessWhatsapp`, modificabile da Impostazioni; se vuoto il pulsante
  "Scrivi a Fabiana" non compare.
- **Indirizzo del link d'invito:** `APP_URL` se impostata, altrimenti il dominio da cui si sta navigando.

## Decisioni prese (step 6)

- **Un solo punto di invio:** `src/lib/notifications/deliver.ts` registra ogni invio in `NotificationLog`
  (PENDING → SENT / FAILED / SKIPPED) e non lancia mai errori: un'email non partita non blocca niente.
  `src/lib/email/send.ts` resta l'unico contatto con Resend (Reply-To da `EMAIL_REPLY_TO`, allegati, almeno
  0,6 s tra due invii, un solo nuovo tentativo solo se Resend risponde 429). Qui si aggiungerà la WhatsApp Cloud API.
- **Link nelle email:** sempre `APP_URL` (`{link}` = `APP_URL/appuntamenti`).
- **Grafica email:** tabelle e stili in linea, larghezza max 560px, monogramma FL in HTML, colori da `brand.ts`.
  Sotto il testo modificabile c'è sempre il riquadro automatico (data, ora, servizi, durata, totale); in fondo
  indirizzo, WhatsApp ed email di risposta. Sempre anche la versione solo testo.
- **Conferma:** dopo la prenotazione della cliente, con `after()`: email alla cliente con `.ics` (orari in UTC,
  fine senza pausa, UID fisso per appuntamento e SEQUENCE crescente) e avviso agli admin con
  `Admin.notifyNewBooking` acceso (testo fisso, Reply-To della cliente). Nessun avviso per gli appuntamenti
  inseriti dall'admin.
- **Modifica e cancellazione:** `sendAppointmentChangedEmail(id, inizioPrecedente)` (con `.ics` aggiornato e
  riga "Prima era") e `sendAppointmentCancelledEmail(id)`, pronte da collegare all'agenda allo step 7.
- **Promemoria:** `GET/POST /api/cron/promemoria`, `Authorization: Bearer CRON_SECRET` confrontato a tempo
  costante, chiamato ogni ora. Invia per gli appuntamenti CONFIRMED di domani solo se a Roma l'ora è
  ≥ `Settings.reminderHour`. Salta (senza segnare niente, stato "non prevista") le clienti senza email e gli
  appuntamenti prenotati il giorno prima dell'appuntamento. Ogni appuntamento si "prende in carico" con un
  aggiornamento condizionato di `reminderEmailSentAt` (da vuoto a adesso) nella stessa transazione della riga
  di log: due chiamate, anche simultanee, non mandano mai due email. Se l'invio fallisce non si riprova in
  automatico. `maxDuration` 60 s; dopo ~45 s si ferma e il JSON dice quanti ne restano (partono all'ora dopo).
  Le chiamate dopo mezzanotte non recuperano i promemoria del giorno prima.
- **Riprova** (pagina "Promemoria di domani"): blocca la riga dell'appuntamento (`FOR UPDATE`) e invia solo se
  l'ultimo tentativo è FAILED (o rimasto PENDING da più di 10 minuti): due clic non producono due email.
- **Step 7:** quando l'admin sposta un appuntamento a un altro giorno va azzerato `reminderEmailSentAt`
  (e `whatsappSentAt`), così il promemoria riparte per la nuova data.
- **Segnaposto:** `{nome} {cognome} {data} {ora} {servizi} {durata} {totale} {indirizzo} {link}`; il codice di
  accesso ammette solo `{nome} {cognome} {codice} {link}` e deve contenere `{codice}`. I segnaposto sbagliati
  non si salvano.
- **Seed dei testi:** i predefiniti stanno in `src/lib/notifications/defaults.ts`; il seed aggiorna solo i
  template identici a un predefinito precedente (`PREVIOUS_DEFAULTS`), quelli modificati non li tocca.
- **WhatsApp manuale:** link `wa.me` coi testi dei template WHATSAPP (agenda: Conferma / Promemoria;
  "Promemoria di domani": Promemoria con spunta "inviato" reversibile su `whatsappSentAt`).
- **Email di prova** (`NotificationLog.isTest`) all'admin collegato, coi dati di esempio e il testo salvato.
- **`Settings.businessAddress`** facoltativo, usato in email e `.ics`.

## Decisioni prese (step 7)

- **Nessuna migrazione:** lo schema degli step precedenti bastava (`doneAt`, `amountCollectedCents`, `NO_SHOW`,
  `cancelledBy`, `bufferMin`, `PackagePayment.paidOn`).
- **Agenda** (`/admin/agenda?mese=AAAA-MM`): il mese corrente parte da oggi (link "giorni precedenti"), gli altri
  mesi sono interi. Per giorno: fasce effettive, eccezione, blocchi e appuntamenti (ora inizio–fine senza pausa,
  cliente, allergie, servizi, totale, WhatsApp). I giorni senza appuntamenti né blocchi stanno su una riga; gli
  annullati sono chiusi in "N annullati · mostra".
- **Stati:** confermato · Fatto (CONFIRMED + `doneAt`) · Non presentata (NO_SHOW) · annullato (CANCELLED).
  Sposta e Servizi solo su confermati non Fatti; Fatto e Non presentata dal giorno dell'appuntamento.
  **Annulla** anche su un Fatto, con conferma che mostra l'importo ("…segnato come Fatto con X € incassati…"):
  stato CANCELLED, `doneAt` e importo azzerati nella stessa transazione (senza conferma il server rifiuta).
  Su un Fatto la spunta si toglie anche col pulsante "Fatto ✓ · tocca per annullare".
- **Fatto:** un tocco salva `doneAt` e l'importo precompilato (totale senza le voci con `clientPackageId`), poi si
  apre il riquadro per correggerlo. Togliere la spunta azzera `doneAt` e importo. "Non presentata" si ripristina solo
  se nel frattempo l'orario non è stato occupato.
- **"N appuntamenti passati non segnati"** (confermati, trattamento finito, né Fatti né Non presentata): avviso in
  cima all'agenda (tutti) e nelle statistiche (quelli del mese), con link alla vista `?vista=da-segnare`.
- **Operazioni** in `src/lib/agenda/mutations.ts`, tutte sotto `withBookingLock`; la violazione del vincolo
  anti-sovrapposizione diventa un messaggio leggibile. Il controllo dell'orario (`checkStart`) è lo stesso di
  `createAppointment`, con `excludeAppointmentId` (sposta/modifica) e `ignoreWorkingHours`.
- **Admin:** niente preavviso né limite dei mesi; anche servizi nascosti. "Senza pausa" = `bufferMin` 0 (togliendolo
  torna la pausa dell'appuntamento o quella di default). **"Fuori orario"** ignora fasce, blocchi e griglia, ora
  scritta a mano a passi di 5 minuti, con spunta di conferma esplicita; le sovrapposizioni restano sempre vietate.
- **Nuova cliente al volo** (`source` ADMIN, email facoltativa): con un'email già usata si deve scegliere quella
  cliente; con un cellulare già usato si propone quella cliente ma si può "creare comunque".
- **Sposta:** se cambia il giorno azzera `reminderEmailSentAt` e `whatsappSentAt`. **Modifica servizi:** le voci che
  restano tengono prezzo, durata e pacchetto originali, quelle nuove prendono il listino attuale; durata ricalcolata
  con l'arrotondamento attuale.
- **Email:** conferma (nuovo), APPOINTMENT_CHANGED con `.ics` (sposta e servizi), APPOINTMENT_CANCELLED (annulla),
  inviate con `after()`. Interruttore acceso di default solo se l'appuntamento è futuro e la cliente ha l'email.
  Dopo ogni operazione l'agenda mostra un riquadro col pulsante WhatsApp del messaggio giusto
  (conferma / spostamento / riepilogo / cancellazione).
- **Statistiche** (`/admin/statistiche?mese=`): appuntamenti Fatti (`amountCollectedCents`, nel giorno a Roma di
  `startsAt`) + pagamenti dei pacchetti (`paidOn`), separati e sommati; confronto col mese precedente (± € e %,
  niente % se il mese prima era a zero). Per servizio: volte (di cui da pacchetto, che valgono 0 €) e "ha reso",
  cioè l'incassato di ogni appuntamento diviso tra le voci pagate in proporzione al listino (resti più grandi, la somma
  torna al centesimo; un incasso senza voci pagate va in "Extra"). Conteggi di Fatti, Non presentate e Annullati.
- **Grafico:** barre impilate in CSS, colori `brand.chart` (verificati per daltonismo e contrasto), tabella dei giorni.

## Decisioni prese (step 8a: pacchetti e clienti)

- **Migrazione `20261008000000_pacchetti_clienti`** (solo aggiunte): `Client.anonymizedAt`, `categoryId` facoltativo su
  `PackageTemplate` e `ClientPackage`, `Settings.showAllergyNotes` (default spento), indice su `ClientPackage.closedAt`
  e vincoli scritti a mano: servizio **oppure** categoria (al massimo uno), sedute > 0, `sessionsUsedBefore` tra 0 e le
  sedute, prezzo ≥ 0, pagamenti > 0.
- **Conti di un pacchetto** (`src/lib/packages/rules.ts`): sedute usate = `sessionsUsedBefore` + voci collegate
  (`AppointmentItem.clientPackageId`); pagato = somma dei pagamenti; residuo = prezzo − pagato. "Completato" = sedute
  finite; se resta un residuo compare l'avviso "sedute finite ma restano X € da pagare" (elenco, dettaglio, archiviazione).
- **Validità:** un pacchetto vale per un servizio o per un'intera categoria (menu "Valido per", anche nel listino).
  Senza servizio/categoria non si scala dall'agenda.
- **Vendita:** dalla scheda cliente o da Pacchetti → "+ Vendi"; dal listino (campi precompilati e modificabili) o
  personalizzato; sedute già fatte prima dell'app; acconto facoltativo (data, importo, contanti/carta, nota).
- **Pagamenti:** aggiungi, modifica, elimina (con conferma). Data non nel futuro. Un pagamento che supera il residuo è
  rifiutato (anche l'acconto oltre il prezzo). Le statistiche li contano per `paidOn`, come allo step 7.
- **Modifica pacchetto:** sedute e prezzo non scendono sotto quanto già usato e pagato. **Elimina** solo se non ha
  pagamenti né sedute scalate; altrimenti **Archivia** (`closedAt`, sempre con conferma) e **Riapri**.
- **Scalare le sedute (agenda):** il collegamento esiste solo sugli appuntamenti Fatti.
  - Alla spunta "Fatto", ogni voce coperta da **un solo** pacchetto attivo della cliente con sedute rimaste si scala
    subito (se più voci puntano allo stesso pacchetto, finché ci sono sedute); l'importo precompilato le esclude.
  - Nel riquadro "Incassato": spunta "Scala dal pacchetto X (3 di 5 rimaste)" se il pacchetto possibile è uno, menu
    (Non scalare / pacchetto A / pacchetto B) se sono più di uno. Si salva subito.
  - Importo dopo scala/togli: se non era stato toccato diventa il nuovo precompilato; se era stato corretto a mano
    (sconto, extra) si sposta della differenza, mai sotto zero.
  - Togliere la spunta Fatto o annullare l'appuntamento scollega le voci nella stessa transazione (la seduta torna).
  - Tutto sotto `withBookingLock`, con ricontrollo di cliente, copertura, pacchetto attivo e sedute rimaste: due tocchi
    insieme sull'ultima seduta ne scalano una sola.
- **Pagina Pacchetti:** Attivi · Con residuo da pagare (anche archiviati: un residuo non deve sparire) · Archiviati,
  con totale da incassare.
- **Clienti:** elenco per cognome con ricerca (nome, cognome, cellulare, email), 50 per pagina, "+ Nuova". Scheda:
  contatti, WhatsApp, email (`mailto`), nuovo appuntamento, modifica dati (email unica), note, totale speso (incassi
  dei Fatti + pagamenti dei pacchetti), numero di Fatti e di non presentate, pacchetti (archiviati a parte), storico
  appuntamenti (ultimi 100). Dall'agenda il nome della cliente porta alla scheda.
- **Blocca:** `blockedAt`, `sessionVersion` +1 (esce subito) e codici di accesso cancellati. Gli appuntamenti restano.
- **Note allergie:** visibili (agenda, nuovo appuntamento, scheda, modifica) solo con "Mostra note allergie" acceso in
  Impostazioni → Schede clienti. Spento, il campo non è nel modulo e il dato salvato non si tocca.
- **Elimina cliente (privacy)**, confermando col cognome; rifiutata se ha appuntamenti futuri confermati.
  - Senza appuntamenti né pacchetti: cancellata davvero.
  - Con uno storico: anonimizzata ("Cliente eliminata", `anonymizedAt`): via nome, cellulare, email, note, allergie,
    consenso, ultimo accesso e codici; svuotate le note di appuntamenti, pacchetti e pagamenti. Restano date, servizi e
    importi (statistiche invariate). Non compare più in elenco e ricerca, non si può modificare né prenotare.
  - In entrambi i casi il destinatario nel registro invii diventa "cliente eliminata".
- **Lato cliente:** in "I miei appuntamenti" il riquadro dei pacchetti attivi (sedute rimaste e residuo da pagare).

## Decisioni prese (step 8b: sicurezza, PWA e lancio)

- **Nessuna migrazione.**
- **Il mio account** (Impostazioni → Il mio account), per ciascun admin:
  - **Cambia password:** attuale + nuova (almeno 10 caratteri, diversa dall'attuale) + conferma. La password attuale
    sbagliata conta nello stesso blocco del login (`src/lib/auth/lockout.ts`: 5 errori → 15 minuti). Dopo il cambio
    `sessionVersion` +1: gli altri dispositivi escono, questo riceve un cookie nuovo e resta collegato.
  - **Esci da tutti i dispositivi:** `sessionVersion` +1, compreso questo (si torna al login).
- **Seed:** la password dei secrets vale solo alla creazione dell'admin; poi il seed non la tocca più. Il workflow
  "Database: migrazioni e seed" ha l'opzione **"Reimposta le password admin dai secrets"** (`RESET_ADMIN_PASSWORDS=1`,
  spenta di default) per il recupero di una password dimenticata: riporta le password ai secrets e chiude le sessioni.
- **Copia di sicurezza (CSV)** da Impostazioni: clienti, appuntamenti, pacchetti, pagamenti
  (`GET /admin/esporta/<tipo>`, solo admin collegati, `Cache-Control: no-store`). Separatore `;`, virgola decimale,
  BOM UTF-8, righe CRLF; date e ore di Roma; le celle che inizierebbero con `= + - @` sono precedute da `'`
  (CSV injection), tranne i cellulari "+39 …". Le allergie sono nel CSV solo con "Mostra note allergie" acceso.
- **Header di sicurezza** su tutte le risposte (`src/config/security-headers.ts`): CSP (`default-src 'self'`, script e
  stili inline ammessi perché servono a Next senza nonce, niente iframe, `form-action 'self'`, `object-src 'none'`,
  `upgrade-insecure-requests`; in sviluppo `unsafe-eval`, nelle anteprime Vercel `vercel.live`), HSTS 1 anno,
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, COOP, Permissions-Policy.
- **Limiti anti-abuso** (solo clienti, contati sotto il lock delle prenotazioni): al massimo **4 prenotazioni online
  in 24 ore** (anche se poi annullate) e **6 appuntamenti confermati in programma**. Raggiunto un limite, `/prenota`
  lo dice subito e la conferma viene rifiutata col messaggio "scrivi a Fabiana". L'admin non ha limiti.
  Restano i limiti degli step precedenti: login admin, codici di accesso, iscrizioni dal link, cron con segreto.
- **Protezioni verificate da un test** (`src/app/protections.test.ts`): ogni server action inizia con
  `requireAdmin()` (area admin) o `requireClient()`; ogni pagina admin chiama `requireAdmin()` come prima cosa (non
  basta il layout); le pagine cliente chiamano `requireClient()`; ogni route handler ha la sua protezione (export
  admin, cron con `CRON_SECRET`, icone pubbliche statiche); il proxy copre `/admin`, `/prenota`, `/appuntamenti`.
  Le uniche azioni pubbliche (login, codice, iscrizione, esci) sono elencate nel test con il motivo.
- **PWA:** `manifest.webmanifest` ("Fabiana L. Estetica", standalone, avorio), icone generate al build dai colori di
  `brand.ts` con Playfair Display (OFL, `src/assets/fonts`): monogramma FL in avorio su rosa cipria, "any" 48–512 px,
  "maskable" 192/512, icona Apple 180, favicon.
  - **Service worker** (`public/sw.js`): niente cache dei dati né prenotazioni offline; se manca la rete durante la
    navigazione mostra `/offline` ("Sei offline"), tenuta in cache con i suoi stili e font. Registrato solo in
    produzione.
  - **Riquadro "Aggiungi alla schermata Home"** per le clienti collegate (home e "I miei appuntamenti"): istruzioni
    per iPhone (Condividi → Aggiungi alla schermata Home) e per Android (pulsante "Installa l'app" se il browser lo
    offre, altrimenti menu ⋮). Non compare se l'app è aperta dalla Home o è stata installata; chiuso con la ×,
    ricompare dopo 30 giorni.

## Checklist di lancio

Da fare prima di invitare le clienti vere:

- [ ] **Privacy definitiva + dati titolare + consenso dati sanitari:** testo definitivo di `/privacy` (ora
  provvisorio), dati del titolare (nome, indirizzo, P.IVA, email), consenso per le note allergie (dati sanitari) e
  nuova `PRIVACY_VERSION`.
- [ ] **Variabili su Vercel (Production):** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SESSION_SECRET` (≥ 32 caratteri,
  diverso da quello delle prove), `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `APP_URL` (dominio definitivo,
  https), `CRON_SECRET`.
- [ ] **Migrazioni e seed** applicati dal workflow (stato: "Database schema is up to date").
- [ ] **Admin:** entrambi accedono e cambiano la password dall'app (Il mio account); salvarla in un gestore di password.
- [ ] **Impostazioni:** WhatsApp e indirizzo dello studio, parametri delle prenotazioni, orari della settimana tipo,
  testi di email e WhatsApp (mandare un'email di prova), "Mostra note allergie" come deciso.
- [ ] **Listino:** categorie, servizi con durate e prezzi, pacchetti a listino con "Valido per".
- [ ] **Clienti e pacchetti in corso:** inserire le clienti con pacchetti già avviati (sedute già fatte e pagamenti).
- [ ] **Promemoria:** cron orario su `/api/cron/promemoria` con `Authorization: Bearer <CRON_SECRET>`; controllare il
  registro invii il primo giorno.
- [ ] **Dominio:** `APP_URL` col dominio definitivo; link d'invito rigenerato su quel dominio.
- [ ] **Prova completa da telefono:** iscrizione dal link, codice via email, prenotazione, email di conferma con
  `.ics`, promemoria, agenda (Fatto, scala dal pacchetto), statistiche.
- [ ] **App installata** su un iPhone e un Android (icona, apertura a schermo intero, pagina "Sei offline").
- [ ] **Copia di sicurezza:** scaricare i CSV dopo il caricamento iniziale e poi con regolarità (es. ogni mese);
  Neon tiene comunque la cronologia del database (verificare il periodo di ripristino del piano).
- [x] Dominio verificato su Resend e `EMAIL_FROM` con quel dominio (step 6, fabianaestetica.it).
